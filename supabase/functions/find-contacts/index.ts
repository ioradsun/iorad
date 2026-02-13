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

    const query = `Find at least 3 people at ${company.name}${company.domain ? ` (website: ${company.domain})` : ""} who are responsible for ${persona}, training technology, or employee enablement. These people would be decision-makers or influencers for purchasing tools like ${partnerPlatform}. Look for titles like VP of Learning, Director of L&D, Head of Training, Chief Learning Officer, Director of Enablement, or similar roles. For each person, find: their full name, exact job title, LinkedIn profile URL, work email if publicly available, and whether they mention "${partnerPlatform}" anywhere on their LinkedIn profile (experience, skills, recommendations, posts).`;

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
            content: `You are a B2B sales researcher finding buyer contacts at a company. Search thoroughly using LinkedIn and company websites. Return ONLY a JSON object (no markdown fences, no extra text). Use this exact structure:
{
  "contacts": [
    {
      "name": "First Last",
      "title": "Their Exact Job Title",
      "email": "email@company.com or null if unknown",
      "linkedin": "https://www.linkedin.com/in/their-profile or null",
      "has_partner_on_linkedin": true/false,
      "partner_linkedin_detail": "e.g. 'Lists ${partnerPlatform} as a skill' or 'Mentions ${partnerPlatform} in current role description' or null",
      "confidence": "high/medium/low",
      "reasoning": "Why this person is relevant"
    }
  ]
}
Rules:
- Return at least 3 contacts, ideally 5. Never return fewer than 3.
- has_partner_on_linkedin should be true ONLY if "${partnerPlatform}" appears on their LinkedIn profile (in experience, skills, about, posts, etc.)
- For emails: try common patterns like first.last@domain, first@domain, flast@domain. Only include if you have reasonable confidence.
- Prioritize people who mention "${partnerPlatform}" on their LinkedIn — they are warm leads.
- Sort results: contacts with has_partner_on_linkedin=true first, then by seniority.`,
          },
          { role: "user", content: query },
        ],
        search_domain_filter: ["linkedin.com", company.domain].filter(Boolean) as string[],
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error(`Perplexity error: ${resp.status} ${errText}`);
      throw new Error(`Perplexity API error: ${resp.status}`);
    }

    const aiResult = await resp.json();
    const content = aiResult.choices?.[0]?.message?.content || "";
    const citations = aiResult.citations || [];

    console.log(`Perplexity response for ${company.name}: ${content.slice(0, 300)}`);

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Could not parse contact info from AI response");
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const contacts = parsed.contacts || [];

    if (contacts.length === 0) {
      throw new Error("No contacts found in AI response");
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
