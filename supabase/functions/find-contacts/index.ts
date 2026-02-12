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

    // Get company info
    const { data: company, error: compErr } = await supabase
      .from("companies")
      .select("id, name, domain, partner, industry, persona")
      .eq("id", company_id)
      .maybeSingle();

    if (compErr) throw compErr;
    if (!company) throw new Error("Company not found");

    const partnerPlatform = company.partner || "unknown";
    const persona = company.persona || "Learning & Development";

    const query = `Find the person at ${company.name}${company.domain ? ` (website: ${company.domain})` : ""} who is responsible for learning and development, training technology, or employee enablement. This person would be the decision-maker for purchasing tools like ${partnerPlatform}. Look for titles like VP of Learning, Director of L&D, Head of Training, Chief Learning Officer, Director of Enablement, or similar. Give me their full name, exact job title, LinkedIn profile URL, and work email if publicly available.`;

    console.log(`Finding contacts for: ${company.name}`);

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
            content: `You are a B2B sales researcher finding the right buyer contact at a company. Search thoroughly using LinkedIn and company websites. Return ONLY a JSON object (no markdown fences, no extra text). Use this exact structure:
{
  "buyer_name": "First Last",
  "buyer_title": "Their Exact Job Title",
  "buyer_email": "email@company.com",
  "buyer_linkedin": "https://www.linkedin.com/in/their-profile",
  "confidence": "high",
  "reasoning": "Why this person is the right contact"
}
If email is unknown, set it to null. If LinkedIn is unknown, set it to null. But you MUST find a real person's name and title - never return null for buyer_name. If you cannot find the exact person, find the closest match (e.g., CHRO, VP HR, Head of People) and explain in reasoning.`,
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

    console.log(`Perplexity response for ${company.name}: ${content.slice(0, 200)}`);

    // Parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Could not parse contact info from AI response");
    }

    const contact = JSON.parse(jsonMatch[0]);

    // Update company with contact info
    const updateData: Record<string, string | null> = {};
    if (contact.buyer_name) updateData.buyer_name = contact.buyer_name;
    if (contact.buyer_title) updateData.buyer_title = contact.buyer_title;
    if (contact.buyer_email) updateData.buyer_email = contact.buyer_email;
    if (contact.buyer_linkedin) updateData.buyer_linkedin = contact.buyer_linkedin;

    if (Object.keys(updateData).length > 0) {
      const { error: updateErr } = await supabase
        .from("companies")
        .update(updateData)
        .eq("id", company_id);
      if (updateErr) throw updateErr;
    }

    console.log(`Contact found for ${company.name}: ${contact.buyer_name} (${contact.buyer_title})`);

    return new Response(
      JSON.stringify({
        success: true,
        contact,
        citations,
        company: company.name,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("find-contacts error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
