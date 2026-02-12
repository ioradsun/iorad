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

    const query = `Who is the person responsible for ${persona} or training technology purchasing decisions at ${company.name}${company.domain ? ` (${company.domain})` : ""}? They would be the buyer for tools like ${partnerPlatform}. I need their full name, job title, email if available, and LinkedIn profile URL. Focus on VP, Director, or Head of ${persona}, Learning, Training, or Enablement roles.`;

    console.log(`Finding contacts for: ${company.name}`);

    const resp = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${perplexityKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "sonar",
        messages: [
          {
            role: "system",
            content: `You are a B2B contact researcher. Return ONLY valid JSON with no markdown fences. Find the most likely buyer/decision-maker for learning & enablement technology at the specified company. Return this exact JSON structure:
{
  "buyer_name": "Full Name",
  "buyer_title": "Their Job Title",
  "buyer_email": "email@company.com or null if unknown",
  "buyer_linkedin": "https://linkedin.com/in/profile or null if unknown",
  "confidence": "high|medium|low",
  "reasoning": "Brief explanation of why this person is the right contact"
}
If you cannot find a specific person, return your best guess based on typical org structures with confidence: "low".`,
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
