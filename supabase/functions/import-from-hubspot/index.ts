import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Verify HubSpot webhook signature (v1: HMAC-SHA256 of clientSecret + rawBody)
async function verifyHubSpotSignature(req: Request, rawBody: string): Promise<boolean> {
  const clientSecret = Deno.env.get("HUBSPOT_CLIENT_SECRET");
  if (!clientSecret) {
    console.warn("HUBSPOT_CLIENT_SECRET not set — skipping signature validation");
    return true; // Gracefully allow if secret not configured
  }

  const signature = req.headers.get("X-HubSpot-Signature") || req.headers.get("x-hubspot-signature");
  if (!signature) {
    console.warn("No HubSpot signature header found");
    return false;
  }

  // HubSpot v1: HMAC-SHA256(clientSecret + requestBody)
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(clientSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sigBytes = await crypto.subtle.sign("HMAC", key, encoder.encode(clientSecret + rawBody));
  const expectedSig = Array.from(new Uint8Array(sigBytes))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");

  return expectedSig === signature;
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

    // Validate HubSpot webhook signature only when a signature header is actually present
    const signature = req.headers.get("X-HubSpot-Signature") || req.headers.get("x-hubspot-signature");
    if (signature) {
      const isValid = await verifyHubSpotSignature(req, rawBody);
      if (!isValid) {
        console.error("HubSpot signature validation failed — rejecting request");
        return new Response(JSON.stringify({ error: "Invalid signature" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      console.log("No HubSpot signature header — proceeding without signature check");
    }

    // Handle HubSpot webhook events (array of subscription events)
    const events: any[] = Array.isArray(body) ? body : [body];
    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];
    const toProcess: string[] = []; // company IDs to auto-process

    for (const event of events) {
      try {
        const objectId = event.objectId;
        if (!objectId) { skipped++; continue; }

        const company = await fetchHubSpotCompany(objectId);
        if (!company) { skipped++; continue; }

        const { companyId, isNew, hasStory } = await upsertCompany(supabase, company);
        await importContactsForCompany(supabase, objectId, companyId);
        imported++;

        // Queue for auto-processing: only new companies without a story
        if (isNew && !hasStory) {
          toProcess.push(companyId);
          console.log(`Queued for auto-processing: ${company.properties?.name || companyId}`);
        } else {
          console.log(`Skipping auto-process: ${company.properties?.name} (isNew=${isNew}, hasStory=${hasStory})`);
        }
      } catch (err: any) {
        errors.push(`Event ${event.objectId || "unknown"}: ${err.message}`);
        skipped++;
      }
    }

    console.log(`HubSpot webhook: ${imported} imported, ${skipped} skipped, ${toProcess.length} queued for processing`);

    // Fire background processing — respond to HubSpot immediately, then process sequentially
    if (toProcess.length > 0) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

      const runSequential = async () => {
        for (const companyId of toProcess) {
          try {
            console.log(`Auto-processing inbound company: ${companyId}`);
            const res = await fetch(`${supabaseUrl}/functions/v1/run-signals`, {
              method: "POST",
              headers: {
                Authorization: `Bearer ${serviceRoleKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ company_id: companyId, mode: "full" }),
            });
            const result = await res.json();
            console.log(`Auto-processing done for ${companyId}:`, result?.status || result?.error || "ok");
          } catch (err: any) {
            console.error(`Auto-processing failed for ${companyId}:`, err.message);
          }
          // 1-minute gap between companies if there are multiple
          if (toProcess.indexOf(companyId) < toProcess.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 60_000));
          }
        }
      };

      // @ts-ignore - EdgeRuntime available in Supabase edge functions
      if (typeof EdgeRuntime !== "undefined" && EdgeRuntime.waitUntil) {
        // @ts-ignore
        EdgeRuntime.waitUntil(runSequential());
      } else {
        runSequential().catch(console.error);
      }
    }

    return new Response(
      JSON.stringify({ success: true, imported, skipped, queued: toProcess.length, errors: errors.slice(0, 10) }),
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

  // First get all available company properties to request them all
  const allProps = await getAllCompanyPropertyNames(apiKey);
  const propsParam = allProps.length > 0 ? allProps.join(",") : "name,domain,industry,country,numberofemployees,hubspot_owner_id";

  const res = await fetch(
    `https://api.hubapi.com/crm/v3/objects/companies/${objectId}?properties=${encodeURIComponent(propsParam)}`,
    { headers: { Authorization: `Bearer ${apiKey}` } }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HubSpot API error [${res.status}]: ${text}`);
  }

  const data = await res.json();
  return data;
}

// Cache for property names (per invocation)
let _companyPropNamesCache: string[] | null = null;
let _contactPropNamesCache: string[] | null = null;

async function getAllCompanyPropertyNames(apiKey: string): Promise<string[]> {
  if (_companyPropNamesCache) return _companyPropNamesCache;
  try {
    const res = await fetch("https://api.hubapi.com/crm/v3/properties/companies", {
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
    const res = await fetch("https://api.hubapi.com/crm/v3/properties/contacts", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) { await res.text(); return []; }
    const data = await res.json();
    _contactPropNamesCache = (data.results || []).map((p: any) => p.name);
    return _contactPropNamesCache!;
  } catch { return []; }
}

// Pull recently created companies from HubSpot (manual sync)
async function syncRecentCompanies(supabase: any) {
  const apiKey = Deno.env.get("HUBSPOT_API_KEY");
  if (!apiKey) throw new Error("HUBSPOT_API_KEY not configured");

  const allProps = await getAllCompanyPropertyNames(apiKey);
  const properties = allProps.length > 0 ? allProps.join(",") : "name,domain,industry,country,numberofemployees";
  
  // Fetch companies created in the last 7 days
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const searchBody = {
    filterGroups: [
      {
        filters: [
          {
            propertyName: "createdate",
            operator: "GTE",
            value: sevenDaysAgo,
          },
        ],
      },
    ],
    properties: properties.split(","),
    limit: 100,
    sorts: [{ propertyName: "createdate", direction: "DESCENDING" }],
  };

  const res = await fetch("https://api.hubapi.com/crm/v3/objects/companies/search", {
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
      const { companyId, isNew, hasStory } = await upsertCompany(supabase, company);
      // Fetch and save associated contacts
      await importContactsForCompany(supabase, company.id, companyId);
      imported++;

      // Auto-generate story only for brand-new records without a story
      if (isNew && !hasStory) {
        autoQueued++;
        const idx = results.indexOf(company);
        // Stagger requests by 10s per company to avoid overwhelming the AI gateway
        setTimeout(() => {
          fetch(`${supabaseUrl2}/functions/v1/run-signals`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${serviceRoleKey2}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ company_id: companyId, mode: "full" }),
          }).catch(err => console.error(`Auto run-signals error for ${companyId}:`, err.message));
        }, idx * 10_000);
      }
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
    const assocRes = await fetch(
      `https://api.hubapi.com/crm/v3/objects/companies/${hubspotCompanyId}/associations/deals`,
      { headers: { Authorization: `Bearer ${apiKey}` } }
    );
    if (!assocRes.ok) return { hasClosedWon: false, hasOpenDeal: false, dealCount: 0 };

    const assocData = await assocRes.json();
    const dealIds: string[] = (assocData.results || []).map((r: any) => String(r.toObjectId || r.id)).filter(Boolean);
    if (dealIds.length === 0) return { hasClosedWon: false, hasOpenDeal: false, dealCount: 0 };

    // Batch-read deal details
    const batchRes = await fetch("https://api.hubapi.com/crm/v3/objects/deals/batch/read", {
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
    hubspot_properties: props,
  };

  // Try to find existing by domain first
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


// Fetch contacts associated with a HubSpot company and save them
async function importContactsForCompany(supabase: any, hubspotCompanyId: string | number, companyId: string) {
  const apiKey = Deno.env.get("HUBSPOT_API_KEY");
  if (!apiKey) return;

  try {
    // Paginate through ALL associated contacts (HubSpot returns max 500 per page)
    const contactIds: string[] = [];
    let after: string | null = null;
    do {
      const url = `https://api.hubapi.com/crm/v3/objects/companies/${hubspotCompanyId}/associations/contacts?limit=500${after ? `&after=${after}` : ""}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` } });
      if (!res.ok) {
        const text = await res.text();
        console.warn(`Failed to fetch contacts for company ${hubspotCompanyId}: ${text}`);
        break;
      }
      const data = await res.json();
      const ids = (data.results || []).map((r: any) => String(r.toObjectId || r.id)).filter(Boolean);
      contactIds.push(...ids);
      after = data.paging?.next?.after || null;
    } while (after);

    if (contactIds.length === 0) return;
    console.log(`HubSpot: found ${contactIds.length} associated contacts for company ${hubspotCompanyId}`);

    // Fetch contact details via HubSpot batch read API (max 100 per batch)
    const allContactProps = await getAllContactPropertyNames(apiKey);
    const propsToFetch = allContactProps.length > 0
      ? allContactProps
      : ["firstname", "lastname", "email", "jobtitle", "hs_linkedin_url"];

    const BATCH_SIZE = 100;
    for (let i = 0; i < contactIds.length; i += BATCH_SIZE) {
      const batchIds = contactIds.slice(i, i + BATCH_SIZE);
      let batchContacts: any[] = [];
      try {
        const batchRes = await fetch("https://api.hubapi.com/crm/v3/objects/contacts/batch/read", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            inputs: batchIds.map((cid) => ({ id: cid })),
            properties: propsToFetch,
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

      for (const contact of batchContacts) {
        const contactId = contact.id;
        try {
          const cp = contact.properties || {};
          const contactName = [cp.firstname, cp.lastname].filter(Boolean).join(" ").trim();
          if (!contactName) continue;

          let savedContactId: string | null = null;

          // Check if contact already exists for this company by email
          if (cp.email) {
            const { data: existing } = await supabase
              .from("contacts")
              .select("id")
              .eq("company_id", companyId)
              .eq("email", cp.email)
              .maybeSingle();

            if (existing) {
              await supabase.from("contacts").update({
                name: contactName,
                title: cp.jobtitle || null,
                linkedin: cp.hs_linkedin_url || null,
                hubspot_properties: cp,
              }).eq("id", existing.id);
              savedContactId = existing.id;
            }
          }

          if (!savedContactId) {
            const { data: inserted } = await supabase.from("contacts").insert({
              company_id: companyId,
              name: contactName,
              email: cp.email || null,
              title: cp.jobtitle || null,
              linkedin: cp.hs_linkedin_url || null,
              source: "hubspot",
              confidence: "high",
              hubspot_properties: cp,
            }).select("id").single();
            savedContactId = inserted?.id || null;
          }

          // Pull engagement timeline for this contact
          await importContactActivity(supabase, contactId, companyId, savedContactId, apiKey);
        } catch (err: any) {
          console.warn(`Failed to import contact ${contactId}: ${err.message}`);
        }
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
    const engRes = await fetch(
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
    const timelineRes = await fetch(
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

    const hsRes = await fetch("https://api.hubapi.com/crm/v3/objects/companies/search", {
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

  const res = await fetch(url, fetchOpts);
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

// ── Sync a single HubSpot company by HubSpot ID ───────────────────────────────
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

  // Auto-generate story only for new companies without an existing story
  if (isNew && !hasStory) {
    console.log(`Auto-triggering run-signals for new company: ${company.properties?.name}`);
    // Fire and forget — don't block the picker modal response
    fetch(`${supabaseUrl}/functions/v1/run-signals`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ company_id: companyId, mode: "full" }),
    }).catch(err => console.error("Auto run-signals error:", err.message));
  } else {
    console.log(`Skipping auto-generation for ${company.properties?.name} (isNew=${isNew}, hasStory=${hasStory})`);
  }

  return new Response(
    JSON.stringify({
      success: true,
      company_id: companyId,
      is_new: isNew,
      has_story: hasStory,
      auto_generating: isNew && !hasStory,
      name: company.properties?.name,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
