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
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { company_id, company_ids } = await req.json();
    
    // Support single or batch
    const ids: string[] = company_ids || (company_id ? [company_id] : []);
    if (ids.length === 0) throw new Error("company_id or company_ids required");

    const { data: companies, error: fetchErr } = await sb
      .from("companies")
      .select("id, name, domain")
      .in("id", ids);

    if (fetchErr) throw fetchErr;
    if (!companies?.length) throw new Error("No companies found");

    const prompt = companies.map((c) =>
      `- id="${c.id}" name="${c.name}" current_domain="${c.domain || "none"}"`
    ).join("\n");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `You are a data quality assistant. Given a company name and its current domain, return the correct primary corporate website domain. Rules:
- Return ONLY the root domain (e.g. "tierpoint.com" not "www.tierpoint.com")
- If the current domain is already correct, return it unchanged
- Use your knowledge of well-known companies to fix errors
- For ambiguous names, prefer the most prominent company with that name
- Return results as a JSON array of objects with "id" and "domain" fields`,
          },
          {
            role: "user",
            content: `Fix the domains for these companies:\n${prompt}\n\nReturn JSON array: [{"id": "...", "domain": "corrected.com"}]`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "fix_domains",
              description: "Return corrected domains for companies",
              parameters: {
                type: "object",
                properties: {
                  fixes: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        id: { type: "string" },
                        domain: { type: "string" },
                      },
                      required: ["id", "domain"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["fixes"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "fix_domains" } },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI error:", response.status, errText);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway error ${response.status}`);
    }

    const aiData = await response.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No tool call in AI response");

    const { fixes } = JSON.parse(toolCall.function.arguments);
    console.log("AI domain fixes:", JSON.stringify(fixes));

    // Apply fixes
    let updated = 0;
    const results: { name: string; old_domain: string | null; new_domain: string }[] = [];

    for (const fix of fixes) {
      const company = companies.find((c) => c.id === fix.id);
      if (!company) continue;
      if (company.domain === fix.domain) {
        results.push({ name: company.name, old_domain: company.domain, new_domain: fix.domain });
        continue; // already correct
      }

      const { error: updateErr } = await sb
        .from("companies")
        .update({ domain: fix.domain })
        .eq("id", fix.id);

      if (updateErr) {
        console.warn(`Failed to update ${company.name}: ${updateErr.message}`);
        continue;
      }

      updated++;
      results.push({ name: company.name, old_domain: company.domain, new_domain: fix.domain });
      console.log(`Fixed: ${company.name} ${company.domain} → ${fix.domain}`);
    }

    return new Response(
      JSON.stringify({ success: true, updated, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("fix-domain error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
