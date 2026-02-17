import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { company_id, contact_id, tab } = await req.json();
    const activeTab = tab || "strategy"; // default to strategy for backward compat
    if (!company_id) throw new Error("company_id is required");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const sb = createClient(supabaseUrl, supabaseKey);

    // Load company
    const { data: company, error: compErr } = await sb
      .from("companies")
      .select("*")
      .eq("id", company_id)
      .single();
    if (compErr || !company) throw new Error(compErr?.message || "Company not found");

    // Load contacts, signals, latest snapshot in parallel
    const [contactsRes, signalsRes, snapshotRes, aiConfigRes] = await Promise.all([
      sb.from("contacts").select("*").eq("company_id", company_id),
      sb.from("signals").select("*").eq("company_id", company_id).order("discovered_at", { ascending: false }),
      sb.from("snapshots").select("*").eq("company_id", company_id).order("created_at", { ascending: false }).limit(1),
      sb.from("ai_config").select("*").eq("id", 1).single(),
    ]);

    const contacts = contactsRes.data || [];
    const signals = signalsRes.data || [];
    const latestSnapshot = snapshotRes.data?.[0] || null;
    const aiConfig = aiConfigRes.data;

    // Determine model
    const model = aiConfig?.model || "google/gemini-2.5-flash";

    // Use specified contact or fall back to first
    const primaryContact = contact_id
      ? contacts.find((c: any) => c.id === contact_id) || contacts[0] || null
      : contacts[0] || null;
    const context = {
      company_name: company.name,
      domain: company.domain,
      industry: company.industry,
      hq: company.hq_country,
      employees: company.headcount,
      partner: company.partner,
      persona: company.persona,
      contact_name: primaryContact?.name || company.buyer_name || null,
      contact_role: primaryContact?.title || company.buyer_title || null,
      contacts: contacts.map((c: any) => ({
        name: c.name,
        title: c.title,
        email: c.email,
        linkedin: c.linkedin,
        source: c.source,
        confidence: c.confidence,
      })),
      signals: signals.map((s: any) => ({
        type: s.type,
        title: s.title,
        url: s.url,
        date: s.date,
        raw_excerpt: s.raw_excerpt,
        evidence_snippets: s.evidence_snippets,
      })),
      latest_snapshot: latestSnapshot
        ? {
            score_total: latestSnapshot.score_total,
            score_breakdown: latestSnapshot.score_breakdown,
            snapshot_json: latestSnapshot.snapshot_json,
          }
        : null,
    };

    const userPrompt = `Generate content for the "${activeTab}" tab of the CRM dashboard for this account.

ACCOUNT CONTEXT:
${JSON.stringify(context, null, 2)}

Return ONLY valid JSON matching the output schema. No markdown, no commentary.`;

    // Select the prompt for the requested tab
    const promptMap: Record<string, string> = {
      company: aiConfig?.company_prompt || "",
      strategy: aiConfig?.strategy_prompt || aiConfig?.cards_prompt_template || "",
      outreach: aiConfig?.outreach_prompt || "",
      story: aiConfig?.story_prompt || "",
    };
    const systemPrompt = promptMap[activeTab];
    if (!systemPrompt || !systemPrompt.trim()) {
      throw new Error(`${activeTab} prompt is not configured. Go to Admin Settings → AI & Prompt to set it up.`);
    }

    console.log(`Generating cards for ${company.name} using ${model}`);

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required. Please add credits." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway returned ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const rawContent = aiData.choices?.[0]?.message?.content || "";

    // Parse JSON from response (strip markdown fences if present)
    let parsed: any;
    try {
      const cleaned = rawContent.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
      parsed = JSON.parse(cleaned);
    } catch (e) {
      console.error("Failed to parse AI response as JSON:", rawContent.substring(0, 500));
      throw new Error("AI returned invalid JSON");
    }

    // Extract the three pieces
    const cards_json = parsed.cards || [];
    const assets_json = parsed.assets || {};
    const account_json = parsed.account || {};

    // Upsert into company_cards
    const { error: upsertErr } = await sb
      .from("company_cards")
      .upsert(
        {
          company_id,
          cards_json,
          assets_json,
          account_json,
          model_version: model,
        },
        { onConflict: "company_id" }
      );

    if (upsertErr) {
      console.error("Upsert error:", upsertErr);
      throw new Error(upsertErr.message);
    }

    console.log(`Cards generated and saved for ${company.name}`);

    return new Response(
      JSON.stringify({ success: true, company: company.name, cards_count: cards_json.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("generate-cards error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

