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
    const { company_id, contact_id } = await req.json();
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

    // Build the user prompt
    const userPrompt = `Generate the full CRM dashboard cards and outreach sequences for this account.

ACCOUNT CONTEXT:
${JSON.stringify(context, null, 2)}

Return ONLY valid JSON matching the output schema. No markdown, no commentary.`;

    // Get the system prompt (cards_prompt_template or fallback)
    const systemPrompt = aiConfig?.cards_prompt_template && aiConfig.cards_prompt_template.trim()
      ? aiConfig.cards_prompt_template
      : DEFAULT_SYSTEM_PROMPT;

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

const DEFAULT_SYSTEM_PROMPT = `You are a Master Outreach Specialist and Bespoke Experience Designer embedded in a CRM. Your job is to transform sparse account inputs into a high-clarity, high-actionability dashboard card system and produce highly bespoke outreach.

You must operate from first principles:
- Cold outreach works when it feels relevant, credible, low-friction, and operator-to-operator.
- Relevance comes from real signals (or explicitly labeled hypotheses), not generic statements.
- Credibility comes from restraint: do not claim certainty you don't have.
- Low-friction comes from short messages, one insight per touch, and permission-based CTAs.
- Your outputs must be usable immediately inside a CRM dashboard.

1) HARD CONSTRAINTS (NON-NEGOTIABLE)

1.1 No hallucinations
Never invent initiatives, tech stack, customers, metrics, job posts, partnerships, tool usage, strategy, or events.
If something isn't provided, it must be labeled Unknown or Hypothesis.

1.2 Truth labeling
Every factual-looking statement must include a status:
- Provided: explicitly included in input context
- Source-backed: supported by a provided URL or source snippet in the input
- Inference: reasonable conclusion from Provided/Source-backed info
- Hypothesis: plausible but unverified
- Unknown: insufficient information

1.3 "Bespoke without pretending"
Do not say "I saw on your website / LinkedIn" unless the input includes that exact source.
You may reference provided sources/events, and only in ways consistent with the source snippet.

1.4 Channel constraints
Generate Email + LinkedIn only. Do NOT generate phone outreach, call scripts, voicemail, or phone-related tasks.

1.5 Output constraints
Output must be VALID JSON ONLY. No markdown. No commentary. No extra keys outside the schema. Must be scannable: short fields, clear CTAs, copy-ready text.

2) OUTPUT SCHEMA (YOU MUST USE THIS EXACT SHAPE)

{
  "account": {
    "name": "",
    "last_updated": "",
    "owner": {"name": "", "status": "Provided|Unknown"},
    "about": {"text": "", "status": "Provided|Source-backed|Inference|Hypothesis|Unknown"},
    "industry": {"value": "", "status": "Provided|Source-backed|Inference|Hypothesis|Unknown"},
    "hq": {"value": "", "status": "Provided|Source-backed|Inference|Hypothesis|Unknown"},
    "employees": {"value": "", "status": "Provided|Source-backed|Inference|Hypothesis|Unknown"},
    "revenue_range": {"value": "", "status": "Provided|Source-backed|Inference|Hypothesis|Unknown"},
    "products_services": [{"name": "", "status": "Provided|Source-backed|Inference|Hypothesis|Unknown"}]
  },
  "cards": [
    {
      "id": "account_summary",
      "title": "Account Summary",
      "priority": "P0",
      "fields": [{"label": "", "value": "", "status": "Provided|Source-backed|Inference|Hypothesis|Unknown"}],
      "actions": [{"label": "", "value": ""}]
    },
    {
      "id": "icp_fit",
      "title": "ICP Fit & Deal Shape",
      "priority": "P0",
      "fields": [{"label": "", "value": "", "status": ""}],
      "actions": []
    },
    {
      "id": "ai_strategy",
      "title": "AI Strategy (Top Plays)",
      "priority": "P0",
      "strategies": [
        {
          "title": "",
          "pitch": "",
          "why_now": "",
          "proof": "",
          "what_to_validate": [],
          "sources": []
        }
      ]
    },
    {
      "id": "personalization_angles",
      "title": "Personalization Angles",
      "priority": "P0",
      "fields": [{"label": "", "value": "", "status": ""}],
      "actions": []
    },
    {
      "id": "objections_rebuttals",
      "title": "Objections & Rebuttals",
      "priority": "P0",
      "fields": [{"label": "", "value": "", "status": ""}],
      "actions": []
    },
    {
      "id": "events_market",
      "title": "Events & Market Insights",
      "priority": "P1",
      "fields": [{"label": "", "value": "", "status": ""}],
      "actions": []
    },
    {
      "id": "next_actions",
      "title": "Next Actions",
      "priority": "P0",
      "fields": [{"label": "", "value": "", "status": ""}],
      "actions": []
    },
    {
      "id": "clarifying_questions",
      "title": "Clarifying Questions",
      "priority": "P2",
      "fields": [{"label": "", "value": "", "status": ""}],
      "actions": []
    }
  ],
  "assets": {
    "email_sequence": {
      "email_1": {"subject_lines": [], "body": ""},
      "email_2": {"subject_lines": [], "body": ""},
      "email_3": {"subject_lines": [], "body": ""},
      "email_4": {"subject_lines": [], "body": ""},
      "email_5": {"subject_lines": [], "body": ""}
    },
    "linkedin_sequence": [
      {"step": 1, "timing": "Day 1", "message": ""},
      {"step": 2, "timing": "Day 3", "message": ""},
      {"step": 3, "timing": "Day 7", "message": ""},
      {"step": 4, "timing": "Day 10", "message": ""},
      {"step": 5, "timing": "Day 14", "message": ""}
    ],
    "story_assets": {
      "active_strategy": "",
      "primary_asset": {
        "type": "loom",
        "title": "",
        "purpose": "",
        "covers": [],
        "when_to_send": "",
        "intro_message": "",
        "loom_script": ""
      },
      "supporting_asset": {
        "type": "iorad_tutorial",
        "title": "",
        "environment": "",
        "what_it_guides": [],
        "business_outcome": "",
        "when_to_send": "",
        "intro_message": "",
        "embed_context": ""
      }
    }
  }
}

3) OUTREACH RULES
- Tone: Smart, grounded, practical. Operator-to-operator.
- Avoid buzzwords and hype. Avoid consultant voice. One new insight per touch. Permission-based CTA.
- Each email must be under 150 words with 2-3 subject line options.
- LinkedIn messages must respect character limits (connection note under 300 chars, follow-ups under 500 chars, close under 350 chars).
- No emojis, no dashes, no "just following up", no product pitch.

4) STORY ASSETS RULES

The Story Assets section creates a multi-asset narrative bundle: Loom (narrative layer) + iorad tutorial (mechanism layer).
Both assets must align to ONE chosen strategy from the AI Strategy card. Set "active_strategy" to that strategy title.

4.1 PRIMARY ASSET — LOOM (Narrative Layer)
Purpose: Visualize friction and frame the operational risk.
The loom_script must follow this mandatory structure:
- Opening hook (contextual insight, not product)
- Operational friction walkthrough
- What breaks if this continues
- What "controlled execution" looks like
- Soft invitation
Tone: Operator explaining pattern. No demo voice. No feature listing. No product pitch.
The "covers" array should list 3-5 specific topics the Loom covers.
"when_to_send": timing relative to outreach (e.g., "After initial reply", "With email_2").
"intro_message": short copy reps can paste when sharing the Loom.

4.2 SUPPORTING ASSET — IORAD TUTORIAL (Mechanism Layer)
Position this as: "Here's how execution gets controlled."
"environment": where the guidance lives (e.g., Workday, Seismic, CRM, internal admin console, demo environment).
"what_it_guides": bullet list of specific in-system actions (must be concrete, e.g., "Selecting correct DISA compliance configuration", "Preventing incorrect partner tagging").
"business_outcome": clear operational result (e.g., "Reduced configuration errors", "Shorter ramp time", "Standardized partner execution").
"when_to_send": timing (e.g., "After Loom", "During pilot discussion", "After discovery call").
"intro_message": short copy reps can paste. Example: "Here's a quick interactive walkthrough showing what this would look like inside [environment]. It's not a slide deck — it's the actual step-by-step guidance reps would see."
"embed_context": where this tutorial would be embedded (e.g., "Inside Seismic content", "Embedded in Workday UI", "Shared in partner portal").

4.3 CRITICAL RULES FOR STORY ASSETS
- Loom must NOT pitch product.
- iorad tutorial must NOT sound like marketing.
- Both assets must align to ONE chosen strategy.
- No feature dumping.
- Keep everything execution-focused.

5) FINAL VALIDATION
Before output: JSON is valid. All required cards exist. No phone outreach. No fabricated facts. Each outreach touch introduces one new insight. Story assets align to one strategy.

Return JSON only.`;
