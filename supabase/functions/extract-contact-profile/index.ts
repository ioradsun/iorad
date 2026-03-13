import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─────────────────────────────────────────────────────────────────────────────
// DETERMINISTIC INBOUND SCORE  (no AI, 0–100 points)
// Based on existing HubSpot contact properties only.
// ─────────────────────────────────────────────────────────────────────────────

function daysSince(isoString: string | null | undefined): number | null {
  if (!isoString) return null;
  const ts = new Date(isoString).getTime();
  if (isNaN(ts)) return null;
  return Math.floor((Date.now() - ts) / (1000 * 60 * 60 * 24));
}

function scoreInboundContact(hp: Record<string, any>): {
  inbound_score: number;
  inbound_tier: number;
  inbound_tier_label: string;
  score_breakdown: Record<string, number>;
} {
  let score = 0;
  const breakdown: Record<string, number> = {
    engagement: 0,
    conversion: 0,
    commercial: 0,
    momentum: 0,
    volume: 0,
  };

  // ── 1. Engagement Intensity (max 25) ──────────────────────────────────────
  const pageViews = parseInt(hp.hs_analytics_num_page_views || hp.num_page_views || "0", 10) || 0;
  let engPV = 0;
  if (pageViews >= 50)       engPV = 15;
  else if (pageViews >= 20)  engPV = 10;
  else if (pageViews >= 5)   engPV = 5;
  else                       engPV = 2;

  const daysSinceWebVisit = daysSince(hp.hs_analytics_last_visit_timestamp);
  const recentWebVisit = daysSinceWebVisit !== null && daysSinceWebVisit <= 7 ? 5 : 0;

  const daysSinceEmail = daysSince(hp.hs_email_last_engagement);
  const recentEmail = daysSinceEmail !== null && daysSinceEmail <= 14 ? 5 : 0;

  breakdown.engagement = Math.min(25, engPV + recentWebVisit + recentEmail);
  score += breakdown.engagement;

  // ── 2. Conversion Strength (max 20) ───────────────────────────────────────
  const conversionDate = hp.recent_conversion_date;
  const conversionEvent = (hp.recent_conversion_event_name || "").toLowerCase();
  const daysSinceConv = daysSince(conversionDate);
  const recentConversion = daysSinceConv !== null && daysSinceConv <= 14;

  if (recentConversion) {
    if (conversionEvent.includes("demo"))                   breakdown.conversion = 20;
    else if (conversionEvent.includes("pric") ||
             conversionEvent.includes("upgrad") ||
             conversionEvent.includes("plan"))              breakdown.conversion = 15;
    else if (conversionEvent.includes("download") ||
             conversionEvent.includes("resource") ||
             conversionEvent.includes("guide"))             breakdown.conversion = 10;
    else                                                    breakdown.conversion = 5;
  }
  score += breakdown.conversion;

  // ── 3. Commercial Proximity (max 20) ──────────────────────────────────────
  const lifecycle = (hp.lifecyclestage || "").toLowerCase();
  let lifecyclePts = 0;
  if      (lifecycle.includes("opportunit"))  lifecyclePts = 20;
  else if (lifecycle.includes("salesqualif")) lifecyclePts = 15;
  else if (lifecycle.includes("marketingqu")) lifecyclePts = 10;
  else if (lifecycle.includes("lead"))        lifecyclePts = 5;
  else if (lifecycle.includes("subscriber"))  lifecyclePts = 2;

  const dealBonus = parseInt(hp.num_associated_deals || "0", 10) > 0 ? 5 : 0;
  breakdown.commercial = Math.min(20, lifecyclePts + dealBonus);
  score += breakdown.commercial;

  // ── 4. Recency & Momentum (max 20) ────────────────────────────────────────
  const daysSinceCreated  = daysSince(hp.createdate);
  const daysSinceModified = daysSince(hp.lastmodifieddate);
  const freshCreate   = daysSinceCreated  !== null && daysSinceCreated  <= 7 ? 10 : 0;
  const freshModified = daysSinceModified !== null && daysSinceModified <= 7 ? 10 : 0;
  breakdown.momentum = Math.min(20, freshCreate + freshModified);
  score += breakdown.momentum;

  // ── 5. Volume / Intent Depth (max 15) ─────────────────────────────────────
  let volumePts = 0;
  if      (pageViews > 100)  volumePts = 15;
  else if (pageViews >= 50)  volumePts = 10;
  else if (pageViews >= 20)  volumePts = 5;
  else                       volumePts = 2;
  breakdown.volume = volumePts;
  score += breakdown.volume;

  // ── Also honor hubspotscore if present ───────────────────────────────────
  const hubspotScore = parseInt(hp.hubspotscore || "0", 10);
  if (hubspotScore > 0) {
    // Blend: give up to 10 bonus points, scaled at 100 = 10 pts
    const bonus = Math.round(Math.min(10, hubspotScore / 10));
    score = Math.min(100, score + bonus);
  }

  const finalScore = Math.min(100, score);

  // ── Tier assignment ───────────────────────────────────────────────────────
  let inbound_tier = 4;
  let inbound_tier_label = "Dormant";
  if      (finalScore >= 70) { inbound_tier = 1; inbound_tier_label = "Strategic Inbound"; }
  else if (finalScore >= 45) { inbound_tier = 2; inbound_tier_label = "Emerging Momentum"; }
  else if (finalScore >= 20) { inbound_tier = 3; inbound_tier_label = "Early Stage"; }

  return {
    inbound_score: finalScore,
    inbound_tier,
    inbound_tier_label,
    score_breakdown: breakdown,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// AI EXTRACTION PROMPT
// ─────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────
// CONTACT FETCH HELPERS (batched to avoid oversized `id=in.(...)` requests)
// ─────────────────────────────────────────────────────────────────────────────

const CONTACT_SELECT = "id, name, title, email, hubspot_properties, company_id";
const CONTACT_FETCH_BATCH_SIZE = 100;
const CONTACT_PAGE_SIZE = 200;

type ContactRow = {
  id: string;
  name: string;
  title: string | null;
  email: string | null;
  hubspot_properties: Record<string, any> | null;
  company_id: string;
};

async function fetchContactsByIds(sb: any, ids: string[]): Promise<ContactRow[]> {
  const contacts: ContactRow[] = [];

  for (let i = 0; i < ids.length; i += CONTACT_FETCH_BATCH_SIZE) {
    const batchIds = ids.slice(i, i + CONTACT_FETCH_BATCH_SIZE);
    const { data, error } = await sb
      .from("contacts")
      .select(CONTACT_SELECT)
      .in("id", batchIds);

    if (error) throw error;
    contacts.push(...((data || []) as ContactRow[]));
  }

  return contacts;
}

async function fetchContactsByCompany(sb: any, companyId: string): Promise<ContactRow[]> {
  const contacts: ContactRow[] = [];
  let from = 0;

  while (true) {
    const to = from + CONTACT_PAGE_SIZE - 1;
    const { data, error } = await sb
      .from("contacts")
      .select(CONTACT_SELECT)
      .eq("company_id", companyId)
      .not("hubspot_properties", "is", null)
      .range(from, to);

    if (error) throw error;

    const batch = (data || []) as ContactRow[];
    contacts.push(...batch);

    if (batch.length < CONTACT_PAGE_SIZE) break;
    from += CONTACT_PAGE_SIZE;
  }

  return contacts;
}

// ─────────────────────────────────────────────────────────────────────────────
// HANDLER
// ─────────────────────────────────────────────────────────────────────────────

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

    let contacts: ContactRow[] = [];

    if (contact_id) {
      contacts = await fetchContactsByIds(sb, [contact_id]);
    } else if (company_id) {
      contacts = await fetchContactsByCompany(sb, company_id);
    } else {
      throw new Error("contact_id or company_id is required");
    }

    if (contacts.length === 0) {
      return new Response(
        JSON.stringify({ success: true, profiles_extracted: 0, message: "No contacts with HubSpot data", total: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let extracted = 0;
    let failed = 0;
    const errors: string[] = [];

    // Process in sequence to respect rate limits
    for (const contact of (contacts || [])) {
      try {
        const hp = contact.hubspot_properties;
        if (!hp || Object.keys(hp).length === 0) continue;

        // ── Deterministic inbound score (always computed, no AI needed) ──────
        const inboundScoring = scoreInboundContact(hp as Record<string, any>);

        // ── Filter out null/empty/irrelevant properties for AI prompt ─────────
        const meaningful: Record<string, any> = {};
        for (const [key, value] of Object.entries(hp)) {
          if (
            value !== null &&
            value !== undefined &&
            value !== "" &&
            value !== "--" &&
            value !== "0" &&
            !(typeof value === "string" && value.startsWith("hs_v2_"))
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

        const ac = new AbortController();
        const timeout = setTimeout(() => ac.abort(), 15_000);
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
          signal: ac.signal,
        }).finally(() => clearTimeout(timeout));

        if (!aiResponse.ok) {
          const errText = await aiResponse.text();
          if (aiResponse.status === 429) {
            console.warn("Rate limited, waiting 5s before retry...");
            await new Promise((r) => setTimeout(r, 5000));
            errors.push(`${contact.name}: Rate limited`);
            failed++;
            continue;
          }
          throw new Error(`AI gateway error [${aiResponse.status}]: ${errText.slice(0, 200)}`);
        }

        const aiData = await aiResponse.json();
        const rawContent = aiData.choices?.[0]?.message?.content || "";

        // Parse AI profile JSON
        const cleaned = rawContent.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
        const aiProfile = JSON.parse(cleaned);

        // ── Merge deterministic scoring INTO the profile ───────────────────
        const profile = {
          ...aiProfile,
          inbound_score: inboundScoring.inbound_score,
          inbound_tier: inboundScoring.inbound_tier,
          inbound_tier_label: inboundScoring.inbound_tier_label,
          inbound_score_breakdown: inboundScoring.score_breakdown,
        };

        // Save to contacts table
        const { error: updateErr } = await sb
          .from("contacts")
          .update({
            contact_profile: profile,
            profile_extracted_at: new Date().toISOString(),
          })
          .eq("id", contact.id);

        if (updateErr) throw updateErr;

        // ── If this is a company-level batch, roll up the best score ─────────
        // (handled downstream in run-signals; logged here for visibility)
        console.log(
          `Profile extracted for ${contact.name} — Inbound Score: ${inboundScoring.inbound_score} (Tier ${inboundScoring.inbound_tier}: ${inboundScoring.inbound_tier_label})`
        );

        extracted++;

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
        total: contacts.length,
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
