import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Tier labels ───────────────────────────────────────────────────────────────
export function getTier(score: number): "hot" | "warm" | "lukewarm" | "cold" {
  if (score >= 75) return "hot";
  if (score >= 50) return "warm";
  if (score >= 25) return "lukewarm";
  return "cold";
}

// ── Scout Score Formula ───────────────────────────────────────────────────────
interface ScoreBreakdown {
  tutorial: number;
  commercial: number;
  recency: number;
  intent: number;
  expansion_signal: boolean;
  expansion_bonus: number;
  top_plan: string | null;
  total: number;
}

// ── Plan tier helpers ──────────────────────────────────────────────────────
const PAID_PLANS = ["team", "enterprise"];
const PLAN_TIER: Record<string, number> = { "free": 1, "team": 2, "enterprise": 3 };

function normalizePlan(raw: string | null): string | null {
  if (!raw) return null;
  const lower = raw.toLowerCase().trim();
  if (lower.includes("enterprise")) return "Enterprise";
  if (lower.includes("team"))       return "Team";
  if (lower.includes("free"))       return "Free";
  return null;
}

function calculateScoutScore(
  company: any,
  contacts: any[]
): ScoreBreakdown {
  const now = Date.now();
  const DAY = 24 * 60 * 60 * 1000;

  // ── Tutorial Activity (max 60) ───────────────────────────────────────────
  let tutorial = 0;

  const creators = contacts.filter((c: any) => {
    const hp = (c.hubspot_properties as any) || {};
    return !!hp.first_tutorial_create_date;
  });

  if (creators.length > 0) {
    // Base: any creator exists
    tutorial += 20;

    // Recency bonus: most recent creator date within 14 days
    const mostRecentCreate = creators
      .map((c: any) => {
        const d = (c.hubspot_properties as any)?.first_tutorial_create_date;
        return d ? new Date(d).getTime() : 0;
      })
      .filter(Boolean)
      .sort((a: number, b: number) => b - a)[0];

    if (mostRecentCreate && (now - mostRecentCreate) <= 14 * DAY) {
      tutorial += 15; // +15 for recent creation (total 35 for recent creator)
    }

    // Multi-user bonus: +5 per extra creator beyond the first, max +20
    const extraCreators = Math.min(creators.length - 1, 4);
    tutorial += extraCreators * 5;
  }

  // Tutorial viewers in last 30 days
  const hasRecentViewer = contacts.some((c: any) => {
    const hp = (c.hubspot_properties as any) || {};
    const viewDate = hp.first_tutorial_view_date;
    if (!viewDate) return false;
    return (now - new Date(viewDate).getTime()) <= 30 * DAY;
  });
  if (hasRecentViewer) tutorial += 8;

  // Monthly tutorial answerer
  const hasMonthlyAnswerer = contacts.some((c: any) => {
    const hp = (c.hubspot_properties as any) || {};
    return parseInt(hp.answers_with_own_tutorial_month_count || "0", 10) > 0;
  });
  if (hasMonthlyAnswerer) tutorial += 7;

  // Extension connections
  const hasExtension = contacts.some((c: any) => {
    const hp = (c.hubspot_properties as any) || {};
    return parseInt(hp.extension_connections || "0", 10) > 0;
  });
  if (hasExtension) tutorial += 5;

  tutorial = Math.min(60, tutorial);

  // ── Commercial Motion (max 20) ───────────────────────────────────────────
  let commercial = 0;
  const lifecycle_stage = company.lifecycle_stage || "prospect";
  const sales_motion = company.sales_motion || "new-logo";
  if (lifecycle_stage === "customer" && sales_motion === "expansion") commercial = 20;
  else if (lifecycle_stage === "customer") commercial = 15;
  else if (lifecycle_stage === "opportunity") commercial = 10;
  else if (lifecycle_stage === "prospect" && company.is_existing_customer) commercial = 5;

  // ── Recency (max 10) ─────────────────────────────────────────────────────
  let recency = 0;
  const lastContactedDates = contacts
    .map((c: any) => {
      const hp = (c.hubspot_properties as any) || {};
      const d = hp.hs_last_contacted;
      return d ? new Date(d).getTime() : 0;
    })
    .filter(Boolean);

  if (lastContactedDates.length > 0) {
    const mostRecent = Math.max(...lastContactedDates);
    const daysSince = (now - mostRecent) / DAY;
    if (daysSince <= 7) recency = 10;
    else if (daysSince <= 30) recency = 7;
    else if (daysSince <= 90) recency = 3;
  }

  // ── HubSpot Intent (max 10) ──────────────────────────────────────────────
  let intent = 0;

  const maxHubspotScore = Math.max(
    0,
    ...contacts.map((c: any) => {
      const hp = (c.hubspot_properties as any) || {};
      return parseFloat(hp.hubspot_score || "0") || 0;
    })
  );
  if (maxHubspotScore > 70) intent = Math.max(intent, 10);
  else if (maxHubspotScore > 40) intent = Math.max(intent, 5);

  const maxEmailEngagement = Math.max(
    0,
    ...contacts.map((c: any) => {
      const hp = (c.hubspot_properties as any) || {};
      return (parseInt(hp.hs_email_open_count || "0", 10) || 0) +
        (parseInt(hp.hs_email_click_count || "0", 10) || 0);
    })
  );
  if (maxEmailEngagement > 10) intent = Math.max(intent, 3);

  const hasEmbedDomain = contacts.some((c: any) => {
    const hp = (c.hubspot_properties as any) || {};
    return !!hp.first_embed_tutorial_base_domain_name;
  });
  if (hasEmbedDomain) intent = Math.max(intent, 2);

  intent = Math.min(10, intent);

  // ── iorad Plan derivation (bubble up highest plan to company level) ────────
  const planValues = contacts
    .map((c: any) => normalizePlan((c.hubspot_properties as any)?.plan_name || null))
    .filter(Boolean) as string[];
  const topPlan = planValues.length > 0
    ? planValues.reduce((best, cur) =>
        (PLAN_TIER[cur.toLowerCase()] || 0) > (PLAN_TIER[best.toLowerCase()] || 0) ? cur : best
      )
    : null;

  // ── Expansion Signal (max 20 bonus) ───────────────────────────────────────
  const hasPaidContact = contacts.some((c: any) => {
    const plan = normalizePlan((c.hubspot_properties as any)?.plan_name || null);
    return plan !== null && PAID_PLANS.includes(plan.toLowerCase());
  });

  const hasFreeCreator = contacts.some((c: any) => {
    const hp = (c.hubspot_properties as any) || {};
    const plan = normalizePlan(hp.plan_name || null);
    return plan?.toLowerCase() === "free" && !!hp.first_tutorial_create_date;
  });

  const expansion_signal = hasPaidContact && hasFreeCreator;
  const expansion_bonus = expansion_signal ? 20 : 0;

  const total = Math.min(100, Math.max(0, tutorial + commercial + recency + intent + expansion_bonus));

  return { tutorial, commercial, recency, intent, expansion_signal, expansion_bonus, top_plan: topPlan, total };
}

// ── AI Activity Summary ───────────────────────────────────────────────────────
async function generateScoutSummary(
  company: any,
  contacts: any[],
  breakdown: ScoreBreakdown,
  systemPrompt: string
): Promise<string> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    console.warn("LOVABLE_API_KEY not set — skipping AI summary");
    return "";
  }

  // Build a structured contact activity summary for the AI
  const contactSummaries = contacts.map((c: any) => {
    const hp = (c.hubspot_properties as any) || {};
    return {
      name: c.name,
      title: c.title,
      first_tutorial_create_date: hp.first_tutorial_create_date || null,
      first_tutorial_view_date: hp.first_tutorial_view_date || null,
      answers_with_own_tutorial_month_count: hp.answers_with_own_tutorial_month_count || null,
      answers_with_own_tutorial_previous_month_count: hp.answers_with_own_tutorial_previous_month_count || null,
      extension_connections: hp.extension_connections || null,
      first_embed_tutorial_base_domain_name: hp.first_embed_tutorial_base_domain_name || null,
      hs_last_contacted: hp.hs_last_contacted || null,
      hubspot_score: hp.hubspot_score || null,
    };
  }).filter((c: any) =>
    c.first_tutorial_create_date || c.first_tutorial_view_date ||
    c.answers_with_own_tutorial_month_count || c.extension_connections
  );

  const userInput = `Company: ${company.name}
Lifecycle: ${company.lifecycle_stage}
Sales motion: ${company.sales_motion}
Account type: ${company.account_type}
Brief type: ${company.brief_type}
Plan: ${company.iorad_plan || "unknown"}
Scout Score: ${breakdown.total}/100 (tutorial: ${breakdown.tutorial}, commercial: ${breakdown.commercial}, recency: ${breakdown.recency}, intent: ${breakdown.intent}, expansion_bonus: ${breakdown.expansion_bonus})

Contacts with iorad activity (${contactSummaries.length} of ${contacts.length} total):
${JSON.stringify(contactSummaries, null, 2)}`;

  try {
    const ac = new AbortController();
    const timeout = setTimeout(() => ac.abort(), 30_000);
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userInput },
        ],
        max_tokens: 300,
      }),
      signal: ac.signal,
    }).finally(() => clearTimeout(timeout));

    if (!res.ok) {
      const text = await res.text();
      console.warn(`AI summary failed [${res.status}]: ${text.slice(0, 200)}`);
      return "";
    }

    const data = await res.json();
    return (data.choices?.[0]?.message?.content || "").trim();
  } catch (err: any) {
    console.warn(`AI summary error: ${err.message}`);
    return "";
  }
}

// ── Score a single company ────────────────────────────────────────────────────
async function scoreOneCompany(
  supabase: any,
  companyId: string,
  systemPrompt: string
): Promise<{ scored: boolean; score: number; changed: boolean }> {
  // Fetch company
  const { data: company, error: cErr } = await supabase
    .from("companies")
    .select("id, name, lifecycle_stage, sales_motion, account_type, brief_type, iorad_plan, is_existing_customer, scout_score, scout_scored_at")
    .eq("id", companyId)
    .maybeSingle();

  if (cErr || !company) {
    console.warn(`scoreOneCompany: company ${companyId} not found`);
    return { scored: false, score: 0, changed: false };
  }

  // Fetch contacts
  const { data: contacts = [] } = await supabase
    .from("contacts")
    .select("id, name, title, hubspot_properties")
    .eq("company_id", companyId);

  // Guard: require contacts before scoring — contacts carry the iorad product activity
  // data (tutorial creates, views, extension connections) that the score depends on.
  if (!contacts || contacts.length === 0) {
    console.log(`scoreOneCompany: skipping ${company.name} — no contacts yet`);
    return { scored: false, score: 0, changed: false };
  }

  const breakdown = calculateScoutScore(company, contacts || []);
  const prevScore = company.scout_score ?? null;
  const scoreChanged = prevScore === null || Math.abs(breakdown.total - prevScore) >= 5;

  // Generate AI summary only if score changed materially or first time
  let summary = "";
  if (scoreChanged && contacts.length > 0) {
    summary = await generateScoutSummary(company, contacts || [], breakdown, systemPrompt);
  }

  // Write back to DB
  const updateData: Record<string, any> = {
    scout_score: breakdown.total,
    scout_score_breakdown: breakdown,
    scout_scored_at: new Date().toISOString(),
    iorad_plan: breakdown.top_plan,
  };
  if (summary) updateData.scout_summary = summary;

  const { error: uErr } = await supabase
    .from("companies")
    .update(updateData)
    .eq("id", companyId);

  if (uErr) console.warn(`Failed to update scout score for ${companyId}: ${uErr.message}`);

  return { scored: true, score: breakdown.total, changed: scoreChanged };
}

// ── Auto-sync: fetch HubSpot companies changed in last N hours ───────────────
async function autoSync(supabase: any, systemPrompt: string, hoursBack = 12) {
  const apiKey = Deno.env.get("HUBSPOT_API_KEY");
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  if (!apiKey) {
    return new Response(JSON.stringify({ error: "HUBSPOT_API_KEY not configured" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const since = new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString();
  console.log(`auto_sync: fetching HubSpot companies modified since ${since}`);

  // Run contact-first incremental sync first so company rescoring has fresh contacts.
  try {
    await fetch(`${supabaseUrl}/functions/v1/import-from-hubspot`, {
      method: "POST",
      headers: { Authorization: `Bearer ${serviceRoleKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ action: "sync_contacts" }),
    });
  } catch (e: any) {
    console.warn(`auto_sync: sync_contacts trigger failed: ${e.message}`);
  }

  let processed = 0;
  let after: string | null = null;

  do {
    const searchBody: any = {
      filterGroups: [{
        filters: [{
          propertyName: "hs_lastmodifieddate",
          operator: "GTE",
          value: since,
        }],
      }],
      properties: ["name", "domain", "hs_lastmodifieddate"],
      limit: 100,
      sorts: [{ propertyName: "hs_lastmodifieddate", direction: "DESCENDING" }],
    };
    if (after) searchBody.after = after;

    const res = await fetch("https://api.hubapi.com/crm/v3/objects/companies/search", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(searchBody),
    });

    if (!res.ok) {
      const text = await res.text();
      console.warn(`auto_sync HubSpot search failed: ${text}`);
      break;
    }

    const data = await res.json();
    const companies = data.results || [];
    after = data.paging?.next?.after || null;

    for (const hsCompany of companies) {
      const domain = hsCompany.properties?.domain;
      if (!domain) continue;

      // Find matching company in our DB
      const { data: dbCompany } = await supabase
        .from("companies")
        .select("id")
        .eq("domain", domain)
        .maybeSingle();

      if (!dbCompany) continue;

      // Re-score
      await scoreOneCompany(supabase, dbCompany.id, systemPrompt);
      processed++;
    }
  } while (after);

  console.log(`auto_sync: processed ${processed} companies`);
  return new Response(
    JSON.stringify({ success: true, processed }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

// ── Main handler ─────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json();
    const action = body.action || "score_all";

    // Fetch the scoring prompt from ai_config
    const { data: aiConfig } = await supabase
      .from("ai_config")
      .select("scout_scoring_prompt")
      .eq("id", 1)
      .maybeSingle();

    const systemPrompt = (aiConfig as any)?.scout_scoring_prompt || "You are iorad Scout. Write a 2-3 sentence plain text summary of this company's iorad activity.";

    // ── score_one ───────────────────────────────────────────────────────────
    if (action === "score_one") {
      const companyId = body.company_id;
      if (!companyId) {
        return new Response(JSON.stringify({ error: "company_id required for score_one" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const result = await scoreOneCompany(supabase, companyId, systemPrompt);
      return new Response(
        JSON.stringify({ success: true, ...result }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── auto_sync ───────────────────────────────────────────────────────────
    if (action === "auto_sync") {
      const hoursBack = body.hours_back || 12;
      return await autoSync(supabase, systemPrompt, hoursBack);
    }

    // ── score_all ───────────────────────────────────────────────────────────
    // Paginate through all companies and score them
    const offset = body.offset || 0;
    const batchSize = 50;

    const { data: companies, error } = await supabase
      .from("companies")
      .select("id, name, lifecycle_stage, sales_motion, account_type, brief_type, iorad_plan, is_existing_customer, scout_score, scout_scored_at")
      .order("created_at", { ascending: true })
      .range(offset, offset + batchSize - 1);

    if (error) throw error;

    let scored = 0;
    let errors: string[] = [];

    for (const company of companies || []) {
      try {
        await scoreOneCompany(supabase, company.id, systemPrompt);
        scored++;
      } catch (err: any) {
        errors.push(`${company.name}: ${err.message}`);
        console.warn(`Score error for ${company.name}: ${err.message}`);
      }
    }

    const hasMore = (companies?.length || 0) === batchSize;

    // Self-chain if there are more companies
    if (hasMore) {
      const supabaseUrl2 = Deno.env.get("SUPABASE_URL")!;
      const serviceRoleKey2 = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      // Fire and forget next batch
      fetch(`${supabaseUrl2}/functions/v1/score-companies`, {
        method: "POST",
        headers: { Authorization: `Bearer ${serviceRoleKey2}`, "Content-Type": "application/json" },
        body: JSON.stringify({ action: "score_all", offset: offset + batchSize }),
      }).catch((e: any) => console.error("Self-chain error:", e.message));
    }

    console.log(`score_all: offset=${offset}, scored=${scored}, hasMore=${hasMore}`);

    return new Response(
      JSON.stringify({
        success: true,
        offset,
        scored,
        has_more: hasMore,
        errors: errors.slice(0, 10),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("score-companies error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
