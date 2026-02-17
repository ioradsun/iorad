import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const EXTRACTION_PROMPT = `You are an expert product analytics interpreter for iorad, an interactive tutorial/walkthrough platform used for employee training, customer education, and partner enablement.

Given a contact's raw HubSpot properties, extract a structured Product Usage Profile. Focus on signals that reveal:
- How deeply they use iorad (creation vs consumption vs embedding)
- What product/tool they are documenting (the "subject matter")
- Where they deploy tutorials (LMS, help center, knowledge base)
- Their engagement trajectory (growing, stagnant, churning)
- Expansion signals (team size, integrations, feature usage)
- Risk signals (inactivity, downgrade, low adoption)

Return ONLY valid JSON matching this exact schema:
{
  "engagement_tier": "power_user | active_creator | casual_user | learner_only | dormant | new_signup",
  "adoption_stage": "evaluating | onboarding | adopted | expanding | churning | churned",
  "primary_use_case": "string — what they primarily use iorad for (e.g., 'CRM training for sales team', 'customer onboarding walkthroughs')",
  "tools_documented": ["list of products/tools they create tutorials about, inferred from embed domains and tutorial base domains"],
  "deployment_channels": ["where tutorials are embedded: LMS name, help center, website, internal wiki, etc."],
  "integrations_active": ["list of connected platforms: Salesforce, Docebo, Zendesk, etc."],
  "key_metrics": {
    "tutorials_created": number,
    "tutorials_viewed": number,
    "tutorials_learned": number,
    "libraries_owned": number,
    "sessions": number,
    "total_page_views": number,
    "days_since_last_active": number or null,
    "days_since_signup": number or null,
    "plan": "string"
  },
  "expansion_signals": ["list of concrete signals suggesting growth potential"],
  "risk_signals": ["list of concrete signals suggesting churn or disengagement"],
  "account_narrative": "2-3 sentence summary of this contact's iorad journey, current state, and likely next move — written for a sales rep preparing outreach",
  "recommended_angles": ["list of 2-3 specific outreach angles based on their usage pattern"]
}

Important:
- Infer intelligently from property names and values — many are self-explanatory
- If a property is null/empty/"--"/0, treat it as absent, don't fabricate data
- days_since_last_active should be calculated from last_active_date relative to today
- Be specific in narratives: mention actual products, numbers, and behaviors`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const sb = createClient(supabaseUrl, serviceRoleKey);
    const body = await req.json();

    // Support single contact or batch (by company_id)
    const { contact_id, company_id } = body;

    let contactIds: string[] = [];

    if (contact_id) {
      contactIds = [contact_id];
    } else if (company_id) {
      // Extract profiles for all contacts of a company that have HubSpot data
      const { data: contacts } = await sb
        .from("contacts")
        .select("id")
        .eq("company_id", company_id)
        .not("hubspot_properties", "is", null);
      contactIds = (contacts || []).map((c: any) => c.id);
    } else {
      throw new Error("contact_id or company_id is required");
    }

    if (contactIds.length === 0) {
      return new Response(
        JSON.stringify({ success: true, profiles_extracted: 0, message: "No contacts with HubSpot data" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Load all contacts
    const { data: contacts, error: contactErr } = await sb
      .from("contacts")
      .select("id, name, title, email, hubspot_properties, company_id")
      .in("id", contactIds);

    if (contactErr) throw contactErr;

    let extracted = 0;
    let failed = 0;
    const errors: string[] = [];

    // Process in sequence to respect rate limits
    for (const contact of (contacts || [])) {
      try {
        const hp = contact.hubspot_properties;
        if (!hp || Object.keys(hp).length === 0) continue;

        // Filter out null/empty/irrelevant properties to reduce token usage
        const meaningful: Record<string, any> = {};
        for (const [key, value] of Object.entries(hp)) {
          if (
            value !== null &&
            value !== undefined &&
            value !== "" &&
            value !== "--" &&
            value !== "0" &&
            !(typeof value === "string" && value.startsWith("hs_v2_")) // skip internal HS tracking
          ) {
            meaningful[key] = value;
          }
        }

        const userPrompt = `Extract the Product Usage Profile for this iorad contact.

Contact: ${contact.name}${contact.title ? ` (${contact.title})` : ""}${contact.email ? ` — ${contact.email}` : ""}
Today's date: ${new Date().toISOString().split("T")[0]}

Raw HubSpot Properties (${Object.keys(meaningful).length} non-empty fields):
${JSON.stringify(meaningful, null, 2)}

Return ONLY the JSON profile object.`;

        const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              { role: "system", content: EXTRACTION_PROMPT },
              { role: "user", content: userPrompt },
            ],
          }),
        });

        if (!aiResponse.ok) {
          const errText = await aiResponse.text();
          if (aiResponse.status === 429) {
            console.warn("Rate limited, waiting 5s before retry...");
            await new Promise((r) => setTimeout(r, 5000));
            // Skip this one for now
            errors.push(`${contact.name}: Rate limited`);
            failed++;
            continue;
          }
          throw new Error(`AI gateway error [${aiResponse.status}]: ${errText.slice(0, 200)}`);
        }

        const aiData = await aiResponse.json();
        const rawContent = aiData.choices?.[0]?.message?.content || "";

        // Parse JSON
        const cleaned = rawContent.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
        const profile = JSON.parse(cleaned);

        // Save to contacts table
        const { error: updateErr } = await sb
          .from("contacts")
          .update({
            contact_profile: profile,
            profile_extracted_at: new Date().toISOString(),
          })
          .eq("id", contact.id);

        if (updateErr) throw updateErr;

        extracted++;
        console.log(`Profile extracted for ${contact.name}`);

        // Small delay between calls to avoid rate limits
        if (contacts && contacts.length > 1) {
          await new Promise((r) => setTimeout(r, 1000));
        }
      } catch (err: any) {
        console.error(`Failed to extract profile for ${contact.name}:`, err.message);
        errors.push(`${contact.name}: ${err.message}`);
        failed++;
      }
    }

    console.log(`Profile extraction: ${extracted} extracted, ${failed} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        profiles_extracted: extracted,
        failed,
        total: contactIds.length,
        errors: errors.slice(0, 10),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("extract-contact-profile error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
