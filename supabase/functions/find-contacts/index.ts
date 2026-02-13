import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const perplexityKey = Deno.env.get("PERPLEXITY_API_KEY");
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    if (!perplexityKey) throw new Error("PERPLEXITY_API_KEY not configured");

    const { company_id } = await req.json();
    if (!company_id) throw new Error("company_id is required");

    const { data: company, error: compErr } = await supabase
      .from("companies")
      .select("id, name, domain, partner, industry, persona")
      .eq("id", company_id)
      .maybeSingle();

    if (compErr) throw compErr;
    if (!company) throw new Error("Company not found");

    const partnerPlatform = company.partner || "unknown";
    const persona = company.persona || "Learning & Development";

    const query = `Find at least 3 people at ${company.name}${company.domain ? ` (${company.domain})` : ""} who are responsible for ${persona}, training technology, or employee enablement. These people would be decision-makers or influencers for purchasing tools like ${partnerPlatform}. Look for titles like VP of Learning, Director of L&D, Head of Training, Chief Learning Officer, Director of Enablement, or similar. For each person find: full name, job title, LinkedIn URL, work email if available, and whether "${partnerPlatform}" appears on their LinkedIn profile.`;

    console.log(`Finding contacts for: ${company.name} (partner: ${partnerPlatform})`);

    const resp = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${perplexityKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "sonar-pro",
        messages: [
          {
            role: "system",
            content: `You are a B2B sales researcher. Search LinkedIn and the web thoroughly. Return ONLY valid JSON, no markdown fences. Structure:
{
  "contacts": [
    {
      "name": "First Last",
      "title": "Job Title",
      "email": "email@company.com or null",
      "linkedin": "https://www.linkedin.com/in/profile or null",
      "has_partner_on_linkedin": true or false,
      "partner_linkedin_detail": "e.g. 'Lists ${partnerPlatform} as skill' or null",
      "confidence": "high/medium/low",
      "reasoning": "Why relevant"
    }
  ]
}
Rules:
- Return at least 3 contacts. If you cannot find exact L&D roles, broaden to HR, People, Operations, or IT leadership.
- has_partner_on_linkedin: true only if "${partnerPlatform}" appears on their LinkedIn.
- For emails: try patterns like first.last@${company.domain || "company.com"}. Set null if uncertain.
- Sort: contacts with has_partner_on_linkedin=true first, then by seniority.
- NEVER return an empty contacts array. Always find at least 3 people.`,
          },
          { role: "user", content: query },
        ],
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error(`Perplexity error: ${resp.status} ${errText}`);
      throw new Error(`Perplexity API error: ${resp.status}`);
    }

    const aiResult = await resp.json();
    let content = aiResult.choices?.[0]?.message?.content || "";
    const citations = aiResult.citations || [];

    // Strip markdown fences if present
    content = content.replace(/```json\s*/gi, "").replace(/```\s*/g, "");

    console.log(`Perplexity response for ${company.name}: ${content.slice(0, 400)}`);

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Could not parse contact JSON from AI response: " + content.slice(0, 200));
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const contacts = parsed.contacts || [];

    if (contacts.length === 0) {
      console.warn(`AI returned 0 contacts for ${company.name} — response may need broader search`);
      // Don't throw — just return empty result gracefully
    }

    // Upsert contacts into the contacts table
    let added = 0;
    for (const c of contacts) {
      if (!c.name) continue;

      const partnerNote = c.has_partner_on_linkedin
        ? `🟢 ${partnerPlatform} on LinkedIn: ${c.partner_linkedin_detail || "Yes"}`
        : `⚪ No ${partnerPlatform} on LinkedIn`;

      const reasoning = [c.reasoning, partnerNote].filter(Boolean).join(" | ");

      const contactData = {
        company_id: company.id,
        name: c.name,
        title: c.title || null,
        email: c.email || null,
        linkedin: c.linkedin || null,
        source: "perplexity",
        confidence: c.confidence || null,
        reasoning,
        updated_at: new Date().toISOString(),
      };

      // Upsert by company_id + email (if email exists), otherwise by company_id + name
      if (c.email) {
        const { data: existing } = await supabase
          .from("contacts")
          .select("id")
          .eq("company_id", company.id)
          .eq("email", c.email)
          .maybeSingle();

        if (existing) {
          await supabase.from("contacts").update(contactData).eq("id", existing.id);
        } else {
          await supabase.from("contacts").insert(contactData);
        }
      } else {
        // Check by name to avoid duplicates
        const { data: existing } = await supabase
          .from("contacts")
          .select("id")
          .eq("company_id", company.id)
          .eq("name", c.name)
          .maybeSingle();

        if (existing) {
          await supabase.from("contacts").update(contactData).eq("id", existing.id);
        } else {
          await supabase.from("contacts").insert(contactData);
        }
      }
      added++;
    }

    // Also update legacy buyer fields with the top contact for backwards compat
    const top = contacts[0];
    if (top?.name) {
      await supabase.from("companies").update({
        buyer_name: top.name,
        buyer_title: top.title || null,
        buyer_email: top.email || null,
        buyer_linkedin: top.linkedin || null,
      }).eq("id", company_id);
    }

    console.log(`Found ${added} contacts for ${company.name}`);

    return new Response(
      JSON.stringify({
        success: true,
        contacts_found: added,
        contacts,
        citations,
        company: company.name,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("find-contacts error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
