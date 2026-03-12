import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── HubSpot rate-limit-aware fetch ──────────────────────────────────────────
// HubSpot private app limit: 100 calls per 10 seconds.
// This wrapper enforces a minimum gap between calls and retries on 429.
let _lastHubSpotCall = 0;
const MIN_DELAY_MS = 110; // ~9 calls/sec, well under the 100/10s limit

async function hubspotFetch(url: string, options?: RequestInit, retries = 3): Promise<Response> {
  for (let attempt = 0; attempt < retries; attempt++) {
    const now = Date.now();
    const elapsed = now - _lastHubSpotCall;
    if (elapsed < MIN_DELAY_MS) {
      await new Promise(r => setTimeout(r, MIN_DELAY_MS - elapsed));
    }
    _lastHubSpotCall = Date.now();

    const res = await fetch(url, options);

    if (res.status === 429) {
      const retryAfter = parseInt(res.headers.get("Retry-After") || "2", 10);
      const waitMs = Math.min(retryAfter * 1000, 10_000);
      console.warn(`HubSpot 429 — retrying in ${waitMs}ms (attempt ${attempt + 1}/${retries})`);
      await new Promise(r => setTimeout(r, waitMs));
      continue;
    }
    return res;
  }
  // Final attempt, no more retries
  _lastHubSpotCall = Date.now();
  return fetch(url, options);
}

// Fire-and-forget Scout scoring for a single company after import
function scoreCompanyAsync(companyId: string) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  fetch(`${supabaseUrl}/functions/v1/score-companies`, {
    method: "POST",
    headers: { Authorization: `Bearer ${serviceRoleKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ action: "score_one", company_id: companyId }),
  }).catch(err => console.error(`score-companies error for ${companyId}:`, err.message));
}


async function verifyHubSpotSignature(req: Request, rawBody: string): Promise<boolean> {
  const clientSecret = Deno.env.get("HUBSPOT_CLIENT_SECRET");
  if (!clientSecret) {
    console.warn("HUBSPOT_CLIENT_SECRET not set — skipping signature validation");
    return true;
  }

  const signature = req.headers.get("X-HubSpot-Signature") || req.headers.get("x-hubspot-signature");
  if (!signature) {
    console.warn("No HubSpot signature header found");
    return false;
  }

  // HubSpot v1: SHA-256 hash of (clientSecret + requestBody), hex-encoded — NOT HMAC
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(clientSecret + rawBody));
  const expectedSig = Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");

  const match = expectedSig === signature;
  if (!match) {
    console.error(`Signature mismatch — expected: ${expectedSig}, got: ${signature}`);
  }
  return match;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const rawBody = await req.text();
    let body: any;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Manual sync trigger — skip signature check
    if (body.action === "sync") {
      return await syncRecentCompanies(supabase);
    }

    // Per-company sync — triggered from Company Detail page
    if (body.action === "sync_company") {
      return await syncSingleCompany(supabase, body.domain, body.company_id);
    }

    // List all HubSpot companies for the picker UI
    if (body.action === "list_companies") {
      return await listHubSpotCompanies(body.search || "", body.after || null);
    }

    // Sync a specific HubSpot company by its HubSpot ID
    if (body.action === "sync_hubspot_id") {
      return await syncByHubSpotId(supabase, body.hubspot_id);
    }

    // Bulk import all HubSpot companies created in the last 12 months (self-chaining)
    if (body.action === "bulk_import") {
      return await bulkImportCompanies(supabase, body.after || null, body.job_id || null, body.total_processed || 0);
    }

    // Fix missing contacts: fetch contacts from HubSpot for companies that have none (self-chaining)
    if (body.action === "fix_missing_contacts") {
      return await fixMissingContacts(supabase, body.offset || 0, body.job_id || null, body.total_processed || 0);
    }

    // Webhook requests must always include a valid HubSpot signature.
    // (action-based calls above are explicit internal/manual invocations.)
    const signature = req.headers.get("X-HubSpot-Signature") || req.headers.get("x-hubspot-signature");
    if (!signature) {
      console.error("Missing HubSpot signature header on webhook request — rejecting");
      return new Response(JSON.stringify({ error: "Missing signature" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isValid = await verifyHubSpotSignature(req, rawBody);
    if (!isValid) {
      console.error("HubSpot signature validation failed — rejecting request");
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Handle HubSpot webhook events (array of subscription events)
    const events: any[] = Array.isArray(body) ? body : [body];
    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    // Deduplicate company IDs — HubSpot may send multiple events for same company
    const companyObjectIds = new Set<string>();
    for (const event of events) {
      const subType: string = event.subscriptionType || "";
      // Only handle company creation/update — skip contacts, associations, deletions
      if (!subType.startsWith("company.creation") && !subType.startsWith("company.propertyChange") && subType !== "company.creation") {
        if (subType && !subType.startsWith("company.")) {
          console.log(`Skipping non-company event: ${subType}`);
          skipped++;
          continue;
        }
        // For company.associationChange or company.deletion — skip
        if (subType === "company.associationChange" || subType === "company.deletion" || subType === "company.merge") {
          console.log(`Skipping association/deletion event: ${subType}`);
          skipped++;
          continue;
        }
      }
      const objectId = String(event.objectId || "").trim();
      if (objectId) companyObjectIds.add(objectId);
      else skipped++;
    }

    console.log(`Processing ${companyObjectIds.size} unique company IDs from ${events.length} events`);

    for (const objectId of companyObjectIds) {
      try {
        const company = await fetchHubSpotCompany(objectId);
        if (!company) {
          console.warn(`fetchHubSpotCompany returned null for objectId: ${objectId}`);
          skipped++;
          continue;
        }

        const { companyId } = await upsertCompany(supabase, company);
        await importContactsForCompany(supabase, objectId, companyId);
        imported++;

        // Score immediately after import (fire-and-forget)
        scoreCompanyAsync(companyId);
        console.log(`Imported & scoring queued: ${company.properties?.name || companyId}`);
      } catch (err: any) {
        console.error(`Error processing company ${objectId}:`, err.message);
        errors.push(`Company ${objectId}: ${err.message}`);
        skipped++;
      }
    }

    console.log(`HubSpot webhook: ${imported} imported, ${skipped} skipped`);

    return new Response(
      JSON.stringify({ success: true, imported, skipped, errors: errors.slice(0, 10) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("import-from-hubspot error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// Fetch a single company from HubSpot by ID — pull ALL properties
async function fetchHubSpotCompany(objectId: string | number) {
  const apiKey = Deno.env.get("HUBSPOT_API_KEY");
  if (!apiKey) throw new Error("HUBSPOT_API_KEY not configured");

  const allProps = await getAllCompanyPropertyNames(apiKey);
  const properties = allProps.length > 0
    ? allProps
    : ["name", "domain", "industry", "country", "numberofemployees", "hubspot_owner_id"];

  // Use POST batch read instead of GET to avoid URL length limits
  const res = await hubspotFetch("https://api.hubapi.com/crm/v3/objects/companies/batch/read", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      inputs: [{ id: String(objectId) }],
      properties,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HubSpot API error [${res.status}]: ${text}`);
  }
  const data = await res.json();
  // Batch read wraps results in an array — extract the single result
  return data.results?.[0] || null;
}

// Cache for property names (per invocation)
let _companyPropNamesCache: string[] | null = null;
let _contactPropNamesCache: string[] | null = null;

async function getAllCompanyPropertyNames(apiKey: string): Promise<string[]> {
  if (_companyPropNamesCache) return _companyPropNamesCache;
  try {
    const res = await hubspotFetch("https://api.hubapi.com/crm/v3/properties/companies", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) { await res.text(); return []; }
    const data = await res.json();
    _companyPropNamesCache = (data.results || []).map((p: any) => p.name);
    return _companyPropNamesCache!;
  } catch { return []; }
}

async function getAllContactPropertyNames(apiKey: string): Promise<string[]> {
  if (_contactPropNamesCache) return _contactPropNamesCache;
  try {
    const res = await hubspotFetch("https://api.hubapi.com/crm/v3/properties/contacts", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) { await res.text(); return []; }
    const data = await res.json();
    _contactPropNamesCache = (data.results || []).map((p: any) => p.name);
    return _contactPropNamesCache!;
  } catch { return []; }
}

// Pull recently created OR modified companies from HubSpot (auto sync safety net)
async function syncRecentCompanies(supabase: any) {
  const apiKey = Deno.env.get("HUBSPOT_API_KEY");
  if (!apiKey) throw new Error("HUBSPOT_API_KEY not configured");

  const allProps = await getAllCompanyPropertyNames(apiKey);
  const properties = allProps.length > 0 ? allProps.join(",") : "name,domain,industry,country,numberofemployees";

  // Look back 30 minutes to catch anything webhooks may have missed
  const lookback = new Date(Date.now() - 30 * 60 * 1000).toISOString();

  const searchBody = {
    filterGroups: [
      // Companies created in the last 30 minutes
      { filters: [{ propertyName: "createdate", operator: "GTE", value: lookback }] },
      // Companies modified in the last 30 minutes
      { filters: [{ propertyName: "hs_lastmodifieddate", operator: "GTE", value: lookback }] },
    ],
    properties: properties.split(","),
    limit: 20,
    sorts: [{ propertyName: "hs_lastmodifieddate", direction: "DESCENDING" }],
  };

  const res = await hubspotFetch("https://api.hubapi.com/crm/v3/objects/companies/search", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(searchBody),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HubSpot search error [${res.status}]: ${text}`);
  }

  const data = await res.json();
  const results = data.results || [];

  const supabaseUrl2 = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey2 = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  let imported = 0;
  let skipped = 0;
  let autoQueued = 0;
  const errors: string[] = [];

  for (const company of results) {
    try {
      const { companyId, isNew } = await upsertCompany(supabase, company);
      await importContactsForCompany(supabase, company.id, companyId);
      imported++;
      if (isNew) autoQueued++;

      // Score immediately after import (fire-and-forget)
      scoreCompanyAsync(companyId);
    } catch (err: any) {
      errors.push(`${company.properties?.name || company.id}: ${err.message}`);
      skipped++;
    }
  }

  console.log(`HubSpot sync: ${imported} imported, ${skipped} skipped, ${autoQueued} queued for story generation`);

  return new Response(
    JSON.stringify({
      success: true,
      imported,
      skipped,
      auto_queued: autoQueued,
      total: results.length,
      errors: errors.slice(0, 10),
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

// ── Category & Stage derivation from HubSpot properties ─────────────────────

const EDU_INDUSTRIES = new Set([
  "EDUCATION_MANAGEMENT",
  "HIGHER_EDUCATION",
  "PRIMARY_SECONDARY_EDUCATION",
  "E_LEARNING",
  "EDUCATION",
  "ELEARNING",
  "PROFESSIONAL_TRAINING_COACHING",
]);

// Domain patterns — order matters (most specific first)
const EDU_DOMAIN_PATTERNS = [
  /\.edu($|\/|\.)/,       // .edu  .edu.au  .edu.ec  silkwood.qld.edu.au
  /\.ac\.[a-z]{2}/,       // .ac.uk  .ac.nz  .ac.jp
  /\.k12\./,              // .k12.in.us
  /\.school\./,           // gilberthorpe.school.nz
  /\.[a-z]+\.edu\./,      // mybce.catholic.edu.au  (catches multi-part edu domains)
  /\.edu\.[a-z]{2,}/,     // explicit .edu.xx TLDs
];

// Name-based keywords that strongly indicate a school (case-insensitive)
const EDU_NAME_KEYWORDS = [
  /\bschool\b/i,
  /\buniversity\b/i,
  /\buniversit[yé]\b/i,
  /\bcollege\b/i,
  /\bacademy\b/i,
  /\binstitute\b/i,
  /\bdistrict\b/i,       // school district
  /\bseminary\b/i,
  /\bpolytechnic\b/i,
];

function isEduDomain(domain: string): boolean {
  if (!domain) return false;
  const d = domain.toLowerCase();
  return EDU_DOMAIN_PATTERNS.some(rx => rx.test(d));
}

function isEduName(name: string): boolean {
  if (!name) return false;
  return EDU_NAME_KEYWORDS.some(rx => rx.test(name));
}

function deriveCategory(props: Record<string, any>, existingPartner?: string | null): "school" | "business" | "partner" {
  // Partner: already flagged (outbound partner company)
  if (existingPartner) return "partner";

  const industry = (props.industry || "").toUpperCase().replace(/[\s-]/g, "_");
  if (EDU_INDUSTRIES.has(industry)) return "school";

  const domain = (props.domain || "").toLowerCase();
  if (isEduDomain(domain)) return "school";

  const name = props.name || "";
  if (isEduName(name)) return "school";

  return "business";
}

// ── Deal-aware stage derivation ───────────────────────────────────────────────

// HubSpot deal stage IDs that indicate a closed-won / active customer deal.
// These are common defaults; custom pipelines may differ but closed-won is nearly universal.
const DEAL_CLOSED_WON_PATTERNS = [
  /closed.?won/i,
  /closedwon/i,
  /won/i,
];

const DEAL_ACTIVE_PATTERNS = [
  /appointment/i,
  /demo/i,
  /proposal/i,
  /contract/i,
  /negotiat/i,
  /qualified/i,
  /presentat/i,
];

async function fetchDealsForCompany(hubspotCompanyId: string | number, apiKey: string): Promise<{
  hasClosedWon: boolean;
  hasOpenDeal: boolean;
  dealCount: number;
}> {
  try {
    // Get associated deal IDs
    const assocRes = await hubspotFetch(
      `https://api.hubapi.com/crm/v3/objects/companies/${hubspotCompanyId}/associations/deals`,
      { headers: { Authorization: `Bearer ${apiKey}` } }
    );
    if (!assocRes.ok) return { hasClosedWon: false, hasOpenDeal: false, dealCount: 0 };

    const assocData = await assocRes.json();
    const dealIds: string[] = (assocData.results || []).map((r: any) => String(r.toObjectId || r.id)).filter(Boolean);
    if (dealIds.length === 0) return { hasClosedWon: false, hasOpenDeal: false, dealCount: 0 };

    // Batch-read deal details
    const batchRes = await hubspotFetch("https://api.hubapi.com/crm/v3/objects/deals/batch/read", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        inputs: dealIds.slice(0, 20).map(id => ({ id })),
        properties: ["dealstage", "dealname", "closedate", "hs_deal_stage_probability", "hs_is_closed_won", "hs_is_closed"],
      }),
    });

    if (!batchRes.ok) return { hasClosedWon: false, hasOpenDeal: false, dealCount: dealIds.length };

    const batchData = await batchRes.json();
    const deals = batchData.results || [];

    let hasClosedWon = false;
    let hasOpenDeal = false;

    for (const deal of deals) {
      const dp = deal.properties || {};
      const stageId = (dp.dealstage || "").toLowerCase();
      const isClosedWon = dp.hs_is_closed_won === "true" || DEAL_CLOSED_WON_PATTERNS.some(rx => rx.test(stageId));
      const isClosed = dp.hs_is_closed === "true";

      if (isClosedWon) { hasClosedWon = true; }
      if (!isClosed && !isClosedWon) { hasOpenDeal = true; }
    }

    console.log(`Deals for company ${hubspotCompanyId}: total=${dealIds.length} closedWon=${hasClosedWon} openDeal=${hasOpenDeal}`);
    return { hasClosedWon, hasOpenDeal, dealCount: dealIds.length };
  } catch (err: any) {
    console.warn(`fetchDealsForCompany error for ${hubspotCompanyId}: ${err.message}`);
    return { hasClosedWon: false, hasOpenDeal: false, dealCount: 0 };
  }
}

function deriveStage(
  props: Record<string, any>,
  deals?: { hasClosedWon: boolean; hasOpenDeal: boolean; dealCount: number }
): "prospect" | "active_opp" | "customer" | "expansion" {
  // Deal-based signals take priority over company lifecycle (more reliable)
  if (deals?.hasClosedWon) {
    // If they also have an open deal after closing, treat as expansion
    return deals.hasOpenDeal ? "expansion" : "customer";
  }
  if (deals?.hasOpenDeal) return "active_opp";

  // Fall back to company-level lifecycle stage
  const lifecycle = (props.lifecyclestage || "").toLowerCase();
  if (lifecycle === "customer" || lifecycle === "evangelist") return "customer";
  if (lifecycle === "opportunity" || lifecycle === "salesqualifiedlead") return "active_opp";
  if (props.hs_date_entered_customer) return "customer";
  if (props.hs_date_entered_opportunity) return "active_opp";

  return "prospect";
}

// Upsert a HubSpot company into our companies table
// Returns { companyId, isNew, hasStory } so caller can decide whether to auto-process
async function upsertCompany(supabase: any, hubspotCompany: any): Promise<{ companyId: string; isNew: boolean; hasStory: boolean }> {
  const apiKey = Deno.env.get("HUBSPOT_API_KEY")!;
  const props = hubspotCompany.properties || {};
  const hubspotObjectId = String(hubspotCompany.id || props.hs_object_id || "").trim();
  const domain = props.domain
    ? props.domain.toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "")
    : null;
  const name = (props.name || "").trim() || domain || "";
  if (!name) throw new Error("No company name or domain");

  // Fetch associated deals for accurate stage derivation
  const deals = await fetchDealsForCompany(hubspotCompany.id, apiKey);

  const companyData: Record<string, any> = {
    name,
    domain,
    industry: props.industry || null,
    hq_country: props.country || null,
    headcount: props.numberofemployees ? parseInt(String(props.numberofemployees), 10) || null : null,
    source_type: "inbound",
    hubspot_object_id: hubspotObjectId || null,
    hubspot_properties: props,
  };

  // Prefer exact HubSpot object-ID match
  if (hubspotObjectId) {
    const { data: existingByHubspotId } = await supabase
      .from("companies")
      .select("id, snapshot_status, partner, category")
      .eq("hubspot_object_id", hubspotObjectId)
      .maybeSingle();

    if (existingByHubspotId) {
      const category = existingByHubspotId.partner ? "partner" : deriveCategory(props, existingByHubspotId.partner);
      const stage = deriveStage(props, deals);
      const isCustomer = stage === "customer" || stage === "expansion";

      await supabase.from("companies").update({
        ...companyData,
        category,
        stage,
        ...(isCustomer ? { is_existing_customer: true } : {}),
      }).eq("id", existingByHubspotId.id);

      const hasStory = existingByHubspotId.snapshot_status === "Generated";
      return { companyId: existingByHubspotId.id, isNew: false, hasStory };
    }
  }

  // Fallback: find existing by domain
  if (domain) {
    const { data: existing } = await supabase
      .from("companies")
      .select("id, snapshot_status, partner, category")
      .eq("domain", domain)
      .maybeSingle();

    if (existing) {
      const category = existing.partner ? "partner" : deriveCategory(props, existing.partner);
      const stage = deriveStage(props, deals);
      const isCustomer = stage === "customer" || stage === "expansion";

      await supabase.from("companies").update({
        ...companyData,
        category,
        stage,
        ...(isCustomer ? { is_existing_customer: true } : {}),
      }).eq("id", existing.id);

      const hasStory = existing.snapshot_status === "Generated";
      return { companyId: existing.id, isNew: false, hasStory };
    }
  }

  // Insert new company — derive category & stage from HubSpot data + deals
  const category = deriveCategory(props, null);
  const stage = deriveStage(props, deals);
  const isCustomer = stage === "customer" || stage === "expansion";

  const { data: inserted, error } = await supabase
    .from("companies")
    .insert({
      ...companyData,
      category,
      stage,
      ...(isCustomer ? { is_existing_customer: true } : {}),
    })
    .select("id, snapshot_status")
    .single();
  if (error) throw error;
  return { companyId: inserted.id, isNew: true, hasStory: false };
}

// ── Contact ranking ───────────────────────────────────────────────────────────

// Target persona keywords — title relevance score
const TITLE_TIER_1 = [
  /\blearning\b/i, /\benablement\b/i, /\btraining\b/i, /\bl&d\b/i,
  /\bcurriculum\b/i, /\binstructional\b/i, /\be.?learning\b/i,
];
const TITLE_TIER_2 = [
  /\bprincipal\b/i, /\bsuperintendent\b/i, /\bdirector\b/i, /\badministrat/i,
  /\bchief\b/i, /\bvp\b/i, /\bvice president\b/i, /\bit\b/i, /\btechnology\b/i,
  /\boperations\b/i, /\bchief.*officer\b/i,
];

function titleScore(title: string | null | undefined): number {
  if (!title) return 0;
  if (TITLE_TIER_1.some(rx => rx.test(title))) return 40;
  if (TITLE_TIER_2.some(rx => rx.test(title))) return 20;
  return 5;
}

function computeContactRank(cp: Record<string, any>): number {
  let score = 0;

  // Title relevance (0–40)
  score += titleScore(cp.jobtitle);

  // ── iorad activity signals (0–40 total) — most important signals ──────────
  // Tutorial creator: first_tutorial_create_date means they've built content
  if (cp.first_tutorial_create_date) score += 20;
  // Tutorial viewer: has ever learned via iorad
  if (cp.first_tutorial_view_date || cp.first_tutorial_learn_date) score += 10;
  // Active tutorial answerer this month — power user signal
  const monthAnswers = parseInt(cp.answers_with_own_tutorial_month_count || "0", 10) || 0;
  if (monthAnswers > 0) score += Math.min(10, monthAnswers * 2);
  // Previous month activity — still valuable
  const prevAnswers = parseInt(cp.answers_with_own_tutorial_previous_month_count || "0", 10) || 0;
  if (prevAnswers > 0) score += Math.min(5, prevAnswers);
  // Extension connected — active power user
  const extConn = parseInt(cp.extension_connections || "0", 10) || 0;
  if (extConn > 0) score += Math.min(5, extConn);

  // HubSpot score (0–10, capped)
  const hsScore = parseFloat(cp.hubspot_score || "0") || 0;
  score += Math.min(10, Math.round(hsScore / 10));

  // Number of times contacted (0–10)
  const contacted = parseInt(cp.num_contacted_notes || "0", 10) || 0;
  score += Math.min(10, contacted * 2);

  // Email engagement: opens + clicks (0–10)
  const opens = parseInt(cp.hs_email_open_count || "0", 10) || 0;
  const clicks = parseInt(cp.hs_email_click_count || "0", 10) || 0;
  score += Math.min(10, opens + clicks * 2);

  // Recency of last contact (0–10)
  const lastContacted = cp.hs_last_contacted || cp.notes_last_contacted || cp.hs_sales_email_last_replied;
  if (lastContacted) {
    const daysSince = (Date.now() - new Date(lastContacted).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSince < 30) score += 10;
    else if (daysSince < 90) score += 5;
    else if (daysSince < 365) score += 2;
  }

  return score;
}


async function importContactsForCompany(supabase: any, hubspotCompanyId: string | number, companyId: string) {
  const apiKey = Deno.env.get("HUBSPOT_API_KEY");
  if (!apiKey) return;

  // Fetch the fields we store — includes engagement signals for ranking
  const CONTACT_PROPS = [
    "firstname", "lastname", "email", "jobtitle", "hs_linkedin_url",
    "hs_last_contacted", "num_contacted_notes", "hs_email_open_count",
    "hs_email_click_count", "hubspot_score", "notes_last_contacted",
    "hs_sales_email_last_replied",
    // iorad-specific activity fields
    "first_tutorial_create_date", "first_tutorial_view_date", "first_tutorial_learn_date",
    "answers_with_own_tutorial_month_count", "answers_with_own_tutorial_previous_month_count",
    "answers", "extension_connections", "first_embed_tutorial_base_domain_name",
  ];

  try {
    // Paginate through ALL associated contacts (HubSpot returns max 500 per page)
    const contactIds: string[] = [];
    let after: string | null = null;
    do {
      const url: string = `https://api.hubapi.com/crm/v3/objects/companies/${hubspotCompanyId}/associations/contacts?limit=500${after ? `&after=${after}` : ""}`;
      const res: Response = await hubspotFetch(url, { headers: { Authorization: `Bearer ${apiKey}` } });
      if (!res.ok) {
        const text = await res.text();
        console.warn(`Failed to fetch contacts for company ${hubspotCompanyId}: ${text}`);
        break;
      }
      const data: any = await res.json();
      const ids = (data.results || []).map((r: any) => String(r.toObjectId || r.id)).filter(Boolean);
      contactIds.push(...ids);
      after = data.paging?.next?.after || null;
    } while (after);

    if (contactIds.length === 0) return;

    // Pre-load all existing contacts for this company in ONE query
    const { data: existingContacts } = await supabase
      .from("contacts")
      .select("id, email, hubspot_object_id")
      .eq("company_id", companyId);

    const byHubspotId = new Map<string, string>();
    const byEmail = new Map<string, string>();
    for (const ec of existingContacts || []) {
      if (ec.hubspot_object_id) byHubspotId.set(ec.hubspot_object_id, ec.id);
      if (ec.email) byEmail.set(ec.email.toLowerCase(), ec.id);
    }

    console.log(`HubSpot: found ${contactIds.length} associated contacts for company ${hubspotCompanyId}`);

    // Fetch contact details in batches of 100 (HubSpot batch read limit)
    const BATCH_SIZE = 100;
    for (let i = 0; i < contactIds.length; i += BATCH_SIZE) {
      const batchIds = contactIds.slice(i, i + BATCH_SIZE);
      let batchContacts: any[] = [];
      try {
        const batchRes = await hubspotFetch("https://api.hubapi.com/crm/v3/objects/contacts/batch/read", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            inputs: batchIds.map((cid) => ({ id: cid })),
            properties: CONTACT_PROPS,
          }),
        });
        if (!batchRes.ok) {
          const errText = await batchRes.text();
          console.warn(`Batch contact read failed [${batchRes.status}]: ${errText.slice(0, 300)}`);
          continue;
        }
        const batchData = await batchRes.json();
        batchContacts = batchData.results || [];
      } catch (err: any) {
        console.warn(`Batch contact read error (batch ${i}): ${err.message}`);
        continue;
      }

      // Build rows to upsert
      const rowsToInsert: any[] = [];
      const rowsToUpdate: { id: string; data: any }[] = [];

      for (const contact of batchContacts) {
        const cp = contact.properties || {};
        const contactName = [cp.firstname, cp.lastname].filter(Boolean).join(" ").trim();
        if (!contactName) continue;

        const rank = computeContactRank(cp);

        const row = {
          company_id: companyId,
          name: contactName,
          email: cp.email || null,
          title: cp.jobtitle || null,
          linkedin: cp.hs_linkedin_url || null,
          source: "hubspot",
          confidence: "high",
          hubspot_object_id: String(contact.id || cp.hs_object_id || "").trim() || null,
          hubspot_properties: {
            rank,
            hs_last_contacted: cp.hs_last_contacted || null,
            num_contacted_notes: cp.num_contacted_notes || null,
            hs_email_open_count: cp.hs_email_open_count || null,
            hs_email_click_count: cp.hs_email_click_count || null,
            hubspot_score: cp.hubspot_score || null,
            // iorad activity
            first_tutorial_create_date: cp.first_tutorial_create_date || null,
            first_tutorial_view_date: cp.first_tutorial_view_date || null,
            first_tutorial_learn_date: cp.first_tutorial_learn_date || null,
            answers_with_own_tutorial_month_count: cp.answers_with_own_tutorial_month_count || null,
            answers_with_own_tutorial_previous_month_count: cp.answers_with_own_tutorial_previous_month_count || null,
            answers: cp.answers || null,
            extension_connections: cp.extension_connections || null,
          },
        };

        const hubspotContactId = String(contact.id || cp.hs_object_id || "").trim();

        // In-memory dedup instead of per-contact DB queries
        const existingId =
          (hubspotContactId && byHubspotId.get(hubspotContactId)) ||
          (cp.email && byEmail.get(cp.email.toLowerCase())) ||
          null;

        if (existingId && existingId !== "pending") {
          rowsToUpdate.push({
            id: existingId,
            data: {
              name: contactName,
              email: row.email,
              title: row.title,
              linkedin: row.linkedin,
              hubspot_object_id: row.hubspot_object_id,
              hubspot_properties: row.hubspot_properties,
            },
          });
        } else {
          rowsToInsert.push(row);
          // Track in maps to prevent duplicates within the same batch
          if (row.hubspot_object_id) byHubspotId.set(row.hubspot_object_id, "pending");
          if (row.email) byEmail.set(row.email.toLowerCase(), "pending");
        }
      }

      if (rowsToInsert.length > 0) {
        const { error } = await supabase
          .from("contacts")
          .upsert(rowsToInsert, {
            onConflict: "company_id,hubspot_object_id",
            ignoreDuplicates: false,
          });
        if (error) {
          // Fallback: try one-by-one if batch fails on mixed constraint violations
          console.warn(`Batch upsert error: ${error.message} — falling back to individual inserts`);
          for (const row of rowsToInsert) {
            try {
              await supabase.from("contacts").upsert(row, {
                onConflict: "company_id,hubspot_object_id",
                ignoreDuplicates: true,
              });
            } catch (e: any) {
              console.warn(`Individual insert failed for ${row.name}: ${e.message}`);
            }
          }
        }
      }

      if (rowsToUpdate.length > 0) {
        await Promise.all(
          rowsToUpdate.map(({ id, data }) =>
            supabase.from("contacts").update(data).eq("id", id)
          )
        );
      }
    }
    console.log(`HubSpot: finished importing contacts for company ${companyId}`);
  } catch (err: any) {
    console.warn(`Contact import error for company ${companyId}: ${err.message}`);
  }
}




// Fetch engagement/activity timeline for a HubSpot contact
async function importContactActivity(
  supabase: any,
  hubspotContactId: string | number,
  companyId: string,
  contactId: string | null,
  apiKey: string
) {
  try {
    // Fetch engagements associated with this contact (last 50)
    const engRes = await hubspotFetch(
      `https://api.hubapi.com/engagements/v1/engagements/associated/CONTACT/${hubspotContactId}/paged?limit=50`,
      { headers: { Authorization: `Bearer ${apiKey}` } }
    );

    if (!engRes.ok) {
      // Try the v3 timeline API as fallback
      const text = await engRes.text();
      console.warn(`Engagements API failed for contact ${hubspotContactId}: ${text}`);

      // Fallback: try web analytics events (page views)
      await importWebAnalyticsEvents(supabase, hubspotContactId, companyId, contactId, apiKey);
      return;
    }

    const engData = await engRes.json();
    const engagements = engData.results || [];

    for (const eng of engagements) {
      const e = eng.engagement || {};
      const meta = eng.metadata || {};
      const eventId = `eng_${e.id}`;

      const typeMap: Record<string, string> = {
        EMAIL: "EMAIL",
        MEETING: "MEETING",
        CALL: "CALL",
        TASK: "TASK",
        NOTE: "NOTE",
        INCOMING_EMAIL: "EMAIL_RECEIVED",
      };

      const activityType = typeMap[e.type] || e.type || "UNKNOWN";
      const title = meta.subject || meta.title || meta.body?.substring(0, 100) || `${activityType} engagement`;
      const occurredAt = e.timestamp ? new Date(e.timestamp).toISOString() : new Date().toISOString();

      // Upsert by hubspot_event_id
      const { error } = await supabase.from("customer_activity").upsert(
        {
          company_id: companyId,
          contact_id: contactId,
          activity_type: activityType,
          title,
          occurred_at: occurredAt,
          metadata: { source: "hubspot_engagement", engagement_type: e.type, ...meta },
          hubspot_event_id: eventId,
        },
        { onConflict: "hubspot_event_id" }
      );

      if (error) console.warn(`Failed to save engagement ${eventId}: ${error.message}`);
    }

    // Also try web analytics
    await importWebAnalyticsEvents(supabase, hubspotContactId, companyId, contactId, apiKey);
  } catch (err: any) {
    console.warn(`Activity import error for contact ${hubspotContactId}: ${err.message}`);
  }
}

// Fetch web analytics events (page views, form submissions) for a contact
async function importWebAnalyticsEvents(
  supabase: any,
  hubspotContactId: string | number,
  companyId: string,
  contactId: string | null,
  apiKey: string
) {
  try {
    // Get contact's recent page views via the contacts API timeline
    const timelineRes = await hubspotFetch(
      `https://api.hubapi.com/contacts/v1/contact/vid/${hubspotContactId}/profile?propertyMode=value_and_history&formSubmissionMode=all&showListMemberships=false`,
      { headers: { Authorization: `Bearer ${apiKey}` } }
    );

    if (!timelineRes.ok) return;

    const profile = await timelineRes.json();

    // Extract form submissions
    const formSubs = profile["form-submissions"] || [];
    for (const fs of formSubs.slice(0, 20)) {
      const eventId = `form_${fs.timestamp || Date.now()}_${hubspotContactId}`;
      const title = fs.title || fs["form-id"] || "Form Submission";
      const url = fs["page-url"] || null;

      await supabase.from("customer_activity").upsert(
        {
          company_id: companyId,
          contact_id: contactId,
          activity_type: "FORM_SUBMISSION",
          title: `Form: ${title}`,
          url,
          occurred_at: fs.timestamp ? new Date(fs.timestamp).toISOString() : new Date().toISOString(),
          metadata: { source: "hubspot_form", form_id: fs["form-id"], page_title: fs.title },
          hubspot_event_id: eventId,
        },
        { onConflict: "hubspot_event_id" }
      );
    }

    // Extract identity profiles for signup source info
    const identities = profile["identity-profiles"] || [];
    for (const ip of identities) {
      for (const ident of (ip.identities || [])) {
        if (ident.type === "LEAD_STATUS" || ident.type === "EMAIL") continue;
        // Could log first-touch source etc.
      }
    }
  } catch (err: any) {
    console.warn(`Web analytics import error for contact ${hubspotContactId}: ${err.message}`);
  }
}

// ── Sync a single company by domain — called from Company Detail page ──────
async function syncSingleCompany(supabase: any, domain: string | undefined, companyId: string | undefined) {
  const apiKey = Deno.env.get("HUBSPOT_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "HUBSPOT_API_KEY not configured" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (!domain && !companyId) {
    return new Response(JSON.stringify({ error: "domain or company_id required" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Domain-less company — try hubspot_object_id fallback
  if (!domain) {
    if (companyId) {
      const { data: comp } = await supabase
        .from("companies")
        .select("hubspot_object_id")
        .eq("id", companyId)
        .maybeSingle();

      if (comp?.hubspot_object_id) {
        return await syncByHubSpotId(supabase, comp.hubspot_object_id);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      found: false,
      message: "Company has no domain and no HubSpot ID — cannot search HubSpot",
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  try {
    // Search HubSpot by domain
    const allProps = await getAllCompanyPropertyNames(apiKey);
    const searchBody = {
      filterGroups: [
        { filters: [{ propertyName: "domain", operator: "EQ", value: domain }] },
      ],
      properties: allProps.length > 0 ? allProps : ["name", "domain", "lifecyclestage", "numberofemployees", "industry"],
      limit: 1,
    };

    const hsRes = await hubspotFetch("https://api.hubapi.com/crm/v3/objects/companies/search", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(searchBody),
    });

    if (!hsRes.ok) {
      const text = await hsRes.text();
      throw new Error(`HubSpot search failed [${hsRes.status}]: ${text.slice(0, 300)}`);
    }

    const hsData = await hsRes.json();
    const hsCompany = hsData.results?.[0];

    if (!hsCompany) {
      return new Response(
        JSON.stringify({ success: true, found: false, message: `No HubSpot record found for domain: ${domain}` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const props = hsCompany.properties || {};

    // Fetch existing company to get partner flag before deriving category
    let existingPartner: string | null = null;
    if (companyId) {
      const { data: cur } = await supabase.from("companies").select("partner").eq("id", companyId).maybeSingle();
      existingPartner = cur?.partner || null;
    }

    // Fetch associated deals for accurate stage derivation
    const deals = await fetchDealsForCompany(hsCompany.id, apiKey);

    const category = deriveCategory(props, existingPartner);
    const stage = deriveStage(props, deals);
    const isCustomer = stage === "customer" || stage === "expansion";

    // Update company record
    if (companyId) {
      const updates: Record<string, any> = {
        hubspot_properties: props,
        category,
        stage,
        ...(isCustomer ? { is_existing_customer: true } : {}),
        ...(props.industry ? { industry: props.industry } : {}),
        ...(props.numberofemployees ? { headcount: parseInt(String(props.numberofemployees), 10) || undefined } : {}),
      };
      await supabase.from("companies").update(updates).eq("id", companyId);
      console.log(`sync_company: updated ${domain} (category: ${category}, stage: ${stage}, deals: closed_won=${deals.hasClosedWon} open=${deals.hasOpenDeal})`);

      // Import associated contacts
      let contactsImported = 0;
      try {
        await importContactsForCompany(supabase, hsCompany.id, companyId);
        const { count } = await supabase
          .from("contacts")
          .select("id", { count: "exact", head: true })
          .eq("company_id", companyId)
          .eq("source", "hubspot");
        contactsImported = count || 0;
      } catch (ce: any) {
        console.warn(`Contact import error: ${ce.message}`);
      }

      return new Response(
        JSON.stringify({
          success: true,
          found: true,
          category,
          stage,
          is_existing_customer: isCustomer,
          lifecycle_stage: props.lifecyclestage || null,
          deals: { closed_won: deals.hasClosedWon, open: deals.hasOpenDeal, total: deals.dealCount },
          contacts_imported: contactsImported,
          hubspot_id: hsCompany.id,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // No companyId — just return derived values
    return new Response(
      JSON.stringify({
        success: true, found: true, category, stage,
        is_existing_customer: isCustomer,
        lifecycle_stage: props.lifecyclestage || null,
        deals: { closed_won: deals.hasClosedWon, open: deals.hasOpenDeal, total: deals.dealCount },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("syncSingleCompany error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

// ── List all HubSpot companies (for picker UI) ────────────────────────────────
async function listHubSpotCompanies(search: string, after: string | null) {
  const apiKey = Deno.env.get("HUBSPOT_API_KEY");
  if (!apiKey) throw new Error("HUBSPOT_API_KEY not configured");

  const properties = ["name", "domain", "industry", "country", "lifecyclestage", "numberofemployees", "createdate"];

  let url: string;
  let fetchOpts: RequestInit;

  if (search && search.trim()) {
    // Use search endpoint for text queries
    url = "https://api.hubapi.com/crm/v3/objects/companies/search";
    const searchBody: any = {
      query: search.trim(),
      properties,
      limit: 50,
      sorts: [{ propertyName: "name", direction: "ASCENDING" }],
    };
    if (after) searchBody.after = after;
    fetchOpts = {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(searchBody),
    };
  } else {
    // List all companies paginated
    const params = new URLSearchParams({
      limit: "100",
      properties: properties.join(","),
      sorts: "name",
    });
    if (after) params.set("after", after);
    url = `https://api.hubapi.com/crm/v3/objects/companies?${params}`;
    fetchOpts = { headers: { Authorization: `Bearer ${apiKey}` } };
  }

  const res = await hubspotFetch(url, fetchOpts);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HubSpot list error [${res.status}]: ${text}`);
  }

  const data = await res.json();
  const results = (data.results || []).map((c: any) => ({
    hubspot_id: c.id,
    name: c.properties?.name || "",
    domain: c.properties?.domain || "",
    industry: c.properties?.industry || "",
    country: c.properties?.country || "",
    lifecycle: c.properties?.lifecyclestage || "",
    employees: c.properties?.numberofemployees || "",
  }));

  return new Response(
    JSON.stringify({
      companies: results,
      paging: data.paging || null,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

// ── Bulk Import: all HubSpot companies (no date filter) ─────────────────────
// Self-chaining: processes 50 companies per invocation to stay under timeout
async function bulkImportCompanies(
  supabase: any,
  after: string | null,
  jobId: string | null,
  totalProcessed = 0,
) {
  const apiKey = Deno.env.get("HUBSPOT_API_KEY");
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  if (!apiKey) {
    return new Response(JSON.stringify({ error: "HUBSPOT_API_KEY not configured" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Create job on first call (after === null && jobId === null)
  let currentJobId = jobId;
  if (!currentJobId) {
    const { data: job, error: jobErr } = await supabase
      .from("processing_jobs")
      .insert({
        trigger: "manual",
        status: "running",
        total_companies_targeted: 0,
        settings_snapshot: { action: "bulk_import", started: new Date().toISOString() },
      })
      .select("id")
      .single();
    if (jobErr) console.warn(`bulk_import: job insert error: ${jobErr.message}`);
    currentJobId = job?.id || null;
    console.log(`bulk_import: created job ${currentJobId}`);
  }

  // ── Fetch ALL companies from HubSpot using the list endpoint (no date filter)
  // Using GET /crm/v3/objects/companies with pagination cursor
  const params = new URLSearchParams({
    limit: "10",
    properties: "name,domain,industry,country,numberofemployees,lifecyclestage,createdate,hs_lastmodifieddate,hubspot_owner_id",
    archived: "false",
  });
  if (after) params.set("after", after);

  const res = await hubspotFetch(`https://api.hubapi.com/crm/v3/objects/companies?${params}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`bulk_import: HubSpot list failed [${res.status}]: ${text}`);
    if (currentJobId) {
      await supabase.from("processing_jobs").update({
        status: "failed",
        finished_at: new Date().toISOString(),
        error_summary: `HubSpot list failed: ${text.slice(0, 300)}`,
      }).eq("id", currentJobId);
    }
    return new Response(JSON.stringify({ error: `HubSpot list failed: ${res.status}` }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const data = await res.json();
  const companies = data.results || [];
  const nextAfter = data.paging?.next?.after || null;
  const hasMore = !!nextAfter;

  console.log(`bulk_import: processing ${companies.length} companies (after=${after ?? "start"}, hasMore=${hasMore})`);

  let imported = 0;
  let updated = 0;
  let errors = 0;

  for (const hsCompany of companies) {
    try {
      const domain = (hsCompany.properties?.domain || "")
        .toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
      const { isNew } = await upsertCompany(supabase, hsCompany);

      // Resolve DB company id (needed for no-domain companies too)
      let dbId: string | null = null;
      if (domain) {
        const { data: dbCo } = await supabase.from("companies").select("id").eq("domain", domain).maybeSingle();
        dbId = dbCo?.id || null;
      }
      if (!dbId) {
        const { data: dbCo } = await supabase.from("companies")
          .select("id").eq("name", (hsCompany.properties?.name || "").trim()).maybeSingle();
        dbId = dbCo?.id || null;
      }

      if (dbId) {
        await importContactsForCompany(supabase, hsCompany.id, dbId);
        await supabase.from("companies")
          .update({ scout_synced_at: new Date().toISOString() })
          .eq("id", dbId);
      }

      if (isNew) imported++; else updated++;
    } catch (err: any) {
      console.warn(`bulk_import: error for ${hsCompany.properties?.name}: ${err.message}`);
      errors++;
    }
  }

  const newTotal = totalProcessed + imported + updated;

  // Update job progress BEFORE firing the chain so the UI sees progress
  if (currentJobId) {
    await supabase.from("processing_jobs").update({
      companies_processed: newTotal,
      companies_succeeded: newTotal,
      companies_failed: errors,
      ...(hasMore ? {} : {
        status: "completed",
        finished_at: new Date().toISOString(),
        total_companies_targeted: newTotal,
      }),
    }).eq("id", currentJobId);
  }

  // Self-chain for next page
  if (hasMore) {
    console.log(`bulk_import: self-chaining with after=${nextAfter}, totalSoFar=${newTotal}`);
    fetch(`${supabaseUrl}/functions/v1/import-from-hubspot`, {
      method: "POST",
      headers: { Authorization: `Bearer ${serviceRoleKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "bulk_import",
        after: nextAfter,
        job_id: currentJobId,
        total_processed: newTotal,
      }),
    }).catch((e: any) => console.error("bulk_import self-chain error:", e.message));
  } else {
    // All pages done — kick off scoring
    console.log(`bulk_import: all pages done — total=${newTotal}, triggering score_all`);
    fetch(`${supabaseUrl}/functions/v1/score-companies`, {
      method: "POST",
      headers: { Authorization: `Bearer ${serviceRoleKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ action: "score_all", offset: 0 }),
    }).catch((e: any) => console.error("score_all trigger error:", e.message));
  }

  return new Response(
    JSON.stringify({
      success: true,
      imported,
      updated,
      errors,
      total_processed: newTotal,
      has_more: hasMore,
      job_id: currentJobId,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

// ── Sync a single company by its HubSpot ID ───────────────────────────────────
async function syncByHubSpotId(supabase: any, hubspotId: string) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const company = await fetchHubSpotCompany(hubspotId);
  if (!company) {
    return new Response(JSON.stringify({ error: "Company not found in HubSpot" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { companyId, isNew, hasStory } = await upsertCompany(supabase, company);
  await importContactsForCompany(supabase, hubspotId, companyId);

  // Update scout_synced_at and score immediately
  await supabase.from("companies").update({ scout_synced_at: new Date().toISOString() }).eq("id", companyId);
  scoreCompanyAsync(companyId);

  return new Response(
    JSON.stringify({
      success: true,
      company_id: companyId,
      is_new: isNew,
      has_story: hasStory,
      auto_generating: false,
      name: company.properties?.name,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

// ── Fix Missing Contacts: targeted backfill for companies with 0 contacts ─────
// Self-chaining: processes 20 companies per invocation, uses DB offset for pagination
async function fixMissingContacts(
  supabase: any,
  offset: number,
  jobId: string | null,
  totalProcessed: number,
) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const apiKey = Deno.env.get("HUBSPOT_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "HUBSPOT_API_KEY not configured" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const BATCH = 20;

  // Create job record on first call
  let currentJobId = jobId;
  if (!currentJobId) {
    const { data: job, error: jobErr } = await supabase
      .from("processing_jobs")
      .insert({
        trigger: "manual",
        status: "running",
        total_companies_targeted: 0,
        settings_snapshot: { action: "fix_missing_contacts", started: new Date().toISOString() },
      })
      .select("id")
      .single();
    if (jobErr) console.warn(`fix_missing_contacts: job insert error: ${jobErr.message}`);
    currentJobId = job?.id || null;
    console.log(`fix_missing_contacts: created job ${currentJobId}`);
  }

  // Fetch companies that have no contacts at all, paginated by offset
  const { data: companies, error: fetchErr } = await supabase
    .from("companies")
    .select("id, name, domain, hubspot_properties")
    .not("id", "in",
      supabase.from("contacts").select("company_id")
    )
    .range(offset, offset + BATCH - 1);

  // Fallback if the NOT IN subquery doesn't work — use raw approach
  let targets: any[] = companies || [];
  if (fetchErr || !companies) {
    console.warn(`fix_missing_contacts: primary query failed (${fetchErr?.message}), using fallback`);
    // Fallback: fetch all company IDs that have contacts, then exclude
    const { data: withContacts } = await supabase
      .from("contacts")
      .select("company_id");
    const withContactSet = new Set((withContacts || []).map((r: any) => r.company_id));

    const { data: allCompanies } = await supabase
      .from("companies")
      .select("id, name, domain, hubspot_properties")
      .range(offset, offset + BATCH - 1);

    targets = (allCompanies || []).filter((c: any) => !withContactSet.has(c.id));
  }

  console.log(`fix_missing_contacts: offset=${offset}, found ${targets.length} companies without contacts`);

  if (targets.length === 0) {
    // Done — no more companies missing contacts
    if (currentJobId) {
      await supabase.from("processing_jobs").update({
        status: "completed",
        finished_at: new Date().toISOString(),
        total_companies_targeted: totalProcessed,
        companies_processed: totalProcessed,
        companies_succeeded: totalProcessed,
      }).eq("id", currentJobId);
    }
    console.log(`fix_missing_contacts: complete — ${totalProcessed} companies fixed`);
    return new Response(
      JSON.stringify({ success: true, total_fixed: totalProcessed }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  let fixed = 0;
  let errors = 0;

  for (const company of targets) {
    try {
      // Get HubSpot ID from stored hubspot_properties
      const hsProps = company.hubspot_properties as any || {};
      const hubspotId = hsProps.hs_object_id || hsProps.hubspot_id;
      if (!hubspotId) {
        console.warn(`fix_missing_contacts: no HubSpot ID for company ${company.name}`);
        errors++;
        continue;
      }

      await importContactsForCompany(supabase, hubspotId, company.id);
      fixed++;
      // Re-score since contacts may affect scoring
      scoreCompanyAsync(company.id);
    } catch (err: any) {
      console.warn(`fix_missing_contacts: error for ${company.name}: ${err.message}`);
      errors++;
    }
  }

  const newTotal = totalProcessed + fixed;
  const newOffset = offset + BATCH;

  // Update job progress
  if (currentJobId) {
    await supabase.from("processing_jobs").update({
      companies_processed: newTotal,
      companies_succeeded: newTotal,
      companies_failed: errors,
    }).eq("id", currentJobId);
  }

  // Self-chain to next batch
  console.log(`fix_missing_contacts: fixed=${fixed} errors=${errors} total=${newTotal}, chaining offset=${newOffset}`);
  fetch(`${supabaseUrl}/functions/v1/import-from-hubspot`, {
    method: "POST",
    headers: { Authorization: `Bearer ${serviceRoleKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "fix_missing_contacts",
      offset: newOffset,
      job_id: currentJobId,
      total_processed: newTotal,
    }),
  }).catch((e: any) => console.error("fix_missing_contacts chain error:", e.message));

  return new Response(
    JSON.stringify({ success: true, fixed, errors, total_so_far: newTotal, next_offset: newOffset, job_id: currentJobId }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
