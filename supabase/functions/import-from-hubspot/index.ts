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

async function logSyncEvent(
  supabase: any,
  event: {
    source: string; job_id?: string | null; entity_type: string;
    entity_id?: string | null; entity_name?: string | null; action: string;
    diff?: any; batch_seq?: number | null; cursor_val?: string | null; meta?: any;
  }
) {
  try {
    await supabase.from("sync_events").insert({
      source: event.source, job_id: event.job_id || null,
      entity_type: event.entity_type, entity_id: event.entity_id || null,
      entity_name: event.entity_name || null, action: event.action,
      diff: event.diff || {}, batch_seq: event.batch_seq ?? null,
      cursor_val: event.cursor_val || null, meta: event.meta || {},
    });
  } catch (e: any) { console.warn("logSyncEvent failed:", e.message); }
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

    // Contact-first incremental sync — replaces company-first syncRecentCompanies
    if (body.action === "sync_contacts") {
      return await syncContactsIncremental(supabase);
    }

    // HubSpot total contact count — for sync completeness display
    if (body.action === "contact_count") {
      const apiKey = Deno.env.get("HUBSPOT_API_KEY");
      if (!apiKey) throw new Error("HUBSPOT_API_KEY not configured");

      const TWO_YEARS_AGO = String(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000);

      // Count contacts active in last 2 years using the same filter as sync
      const searchRes = await hubspotFetch(
        "https://api.hubapi.com/crm/v3/objects/contacts/search",
        {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            filterGroups: [{
              filters: [{
                propertyName: "lastmodifieddate",
                operator: "GTE",
                value: TWO_YEARS_AGO,
              }],
            }],
            limit: 1,
            properties: ["hs_object_id"],
          }),
        }
      );
      if (!searchRes.ok) throw new Error(`HubSpot count failed: ${searchRes.status}`);
      const searchData = await searchRes.json();
      const hubspotTotal = searchData.total || 0;

      await supabase.from("sync_checkpoints").upsert({
        key: "hubspot_contact_count",
        value: String(hubspotTotal),
        updated_at: new Date().toISOString(),
      });

      return new Response(
        JSON.stringify({ success: true, hubspot_total: hubspotTotal }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // HubSpot total company count (active 2 years) — for sync completeness display
    if (body.action === "company_count") {
      const apiKey = Deno.env.get("HUBSPOT_API_KEY");
      if (!apiKey) throw new Error("HUBSPOT_API_KEY not configured");

      const TWO_YEARS_AGO = String(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000);

      const searchRes = await hubspotFetch(
        "https://api.hubapi.com/crm/v3/objects/companies/search",
        {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            filterGroups: [{
              filters: [{
                propertyName: "hs_lastmodifieddate",
                operator: "GTE",
                value: TWO_YEARS_AGO,
              }],
            }],
            limit: 1,
            properties: ["hs_object_id"],
          }),
        }
      );

      if (!searchRes.ok) throw new Error(`HubSpot company count failed: ${searchRes.status}`);
      const data = await searchRes.json();
      const hubspotTotal = data.total || 0;

      await supabase.from("sync_checkpoints").upsert({
        key: "hubspot_company_count",
        value: String(hubspotTotal),
        updated_at: new Date().toISOString(),
      });

      return new Response(
        JSON.stringify({ success: true, hubspot_total: hubspotTotal }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (body.action === "sync_companies") {
      return await syncCompaniesIncremental(supabase);
    }

    if (body.action === "sync_all") {
      const compRes = await syncCompaniesIncremental(supabase);
      const compData = await compRes.json();
      const contRes = await syncContactsIncremental(supabase);
      const contData = await contRes.json();

      return new Response(JSON.stringify({
        success: true,
        companies: compData,
        contacts: contData,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── Catchup: one-time sweep of all 2-year active contacts ──────────────
    if (body.action === "catchup_contacts") {
      return await catchupContacts(supabase, body.after || null);
    }

    // Contact-first backfill — pages through ALL HubSpot contacts
    if (body.action === "backfill_contacts") {
      return await backfillContacts(supabase, body.after || null, body.job_id || null, body.total || 0);
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

// Fetch a single company from HubSpot by ID using essential properties only
async function fetchHubSpotCompany(objectId: string | number) {
  const apiKey = Deno.env.get("HUBSPOT_API_KEY");
  if (!apiKey) throw new Error("HUBSPOT_API_KEY not configured");

  const ESSENTIAL_PROPS = [
    "name", "domain", "industry", "country", "numberofemployees",
    "lifecyclestage", "hubspot_owner_id", "hs_object_id",
    "hs_lastmodifieddate", "createdate",
  ];
  const properties = ESSENTIAL_PROPS;

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

async function syncContactsIncremental(supabase: any) {
  const apiKey = Deno.env.get("HUBSPOT_API_KEY");
  if (!apiKey) throw new Error("HUBSPOT_API_KEY not configured");

  // Read checkpoint — default to 30 minutes ago if no checkpoint exists
  const { data: cpRow } = await supabase
    .from("sync_checkpoints")
    .select("value")
    .eq("key", "contact_sync_cursor")
    .maybeSingle();

  const defaultLookback = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const checkpoint = cpRow?.value || defaultLookback;

  // Overlap window: start 5 minutes before checkpoint to catch edge cases
  const overlapMs = 5 * 60 * 1000;
  const searchFrom = new Date(new Date(checkpoint).getTime() - overlapMs).toISOString();

  // Properties to fetch — only what we actually use
  const CONTACT_PROPS = [
    "firstname", "lastname", "email", "jobtitle", "hs_linkedin_url",
    "hs_lastmodifieddate", "hs_object_id", "associatedcompanyid",
    "hs_last_contacted", "num_contacted_notes",
    "hs_email_open_count", "hs_email_click_count", "hubspot_score",
    // iorad activity dates
    "first_tutorial_create_date", "first_tutorial_view_date",
    "first_tutorial_learn_date",
    // iorad usage counts
    "tutorials_created", "tutorials_views",
    "answers_with_own_tutorial_month_count",
    "answers_with_own_tutorial_previous_month_count",
    "answers", "extension_connections",
    // iorad account info
    "plan_name", "account_type", "account__type",
    "last_active_date", "engagement_segment",
    "first_embed_tutorial_base_domain_name",
    "first_embed_base_domain_name",
  ];

  // Search contacts modified since checkpoint, sorted by modification date ASC
  // so we can safely update the checkpoint as we go
  const PAGE_SIZE = 100;
  let totalProcessed = 0;
  let latestModified = checkpoint;
  let after: string | null = null;
  let pageCount = 0;
  const MAX_PAGES = 5; // Process up to 500 contacts per invocation

  while (pageCount < MAX_PAGES) {
    const TWO_YEARS_AGO = new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000).toISOString();

    const searchBody: any = {
      filterGroups: [{
        filters: [
          {
            propertyName: "hs_lastmodifieddate",
            operator: "GTE",
            value: searchFrom,
          },
          {
            propertyName: "hs_lastmodifieddate",
            operator: "GTE",
            value: TWO_YEARS_AGO,
          },
        ],
      }],
      properties: CONTACT_PROPS,
      sorts: [{ propertyName: "hs_lastmodifieddate", direction: "ASCENDING" }],
      limit: PAGE_SIZE,
    };
    if (after) searchBody.after = after;

    const res = await hubspotFetch("https://api.hubapi.com/crm/v3/objects/contacts/search", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(searchBody),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`HubSpot contact search failed [${res.status}]: ${text.slice(0, 300)}`);
    }

    const data = await res.json();
    const contacts = data.results || [];

    if (contacts.length === 0) break;

    // Process this page
    const { processed, newest } = await processContactPage(supabase, contacts, apiKey);
    totalProcessed += processed;
    if (newest > latestModified) latestModified = newest;

    // Update checkpoint after each successful page
    await supabase.from("sync_checkpoints").upsert({
      key: "contact_sync_cursor",
      value: latestModified,
      updated_at: new Date().toISOString(),
    });

    after = data.paging?.next?.after || null;
    pageCount++;

    if (!after) break; // No more pages
  }

  await supabase.from("sync_checkpoints").upsert({
    key: "last_contact_sync_result",
    value: JSON.stringify({
      processed: totalProcessed,
      pages: pageCount,
      checkpoint: latestModified,
      has_more: !!after,
      at: new Date().toISOString(),
    }),
    updated_at: new Date().toISOString(),
  });

  console.log(`sync_contacts: processed ${totalProcessed} contacts across ${pageCount} pages, checkpoint=${latestModified}, has_more=${!!after}`);

  // Self-chain if there are more pages — catch up in one continuous run
  if (after) {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    console.log(`sync_contacts: has_more=true, self-chaining for next batch`);
    fetch(`${supabaseUrl}/functions/v1/import-from-hubspot`, {
      method: "POST",
      headers: { Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ action: "sync_contacts" }),
    }).catch(e => console.warn("sync_contacts self-chain failed:", e.message));
  }

  return new Response(
    JSON.stringify({
      success: true,
      processed: totalProcessed,
      pages: pageCount,
      checkpoint: latestModified,
      has_more: !!after,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

async function syncCompaniesIncremental(supabase: any) {
  const apiKey = Deno.env.get("HUBSPOT_API_KEY");
  if (!apiKey) throw new Error("HUBSPOT_API_KEY not configured");

  const { data: cpRow } = await supabase
    .from("sync_checkpoints")
    .select("value")
    .eq("key", "company_sync_cursor")
    .maybeSingle();

  const defaultLookback = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  const checkpoint = cpRow?.value || defaultLookback;

  const overlapMs = 5 * 60 * 1000;
  const searchFrom = new Date(new Date(checkpoint).getTime() - overlapMs).toISOString();

  const COMPANY_PROPS = [
    "name", "domain", "industry", "country", "numberofemployees",
    "lifecyclestage", "hs_object_id", "hs_lastmodifieddate",
    "hubspot_owner_id", "createdate",
  ];

  const PAGE_SIZE = 100;
  let totalProcessed = 0;
  let latestModified = checkpoint;
  let after: string | null = null;
  let pageCount = 0;
  const MAX_PAGES = 5;

  while (pageCount < MAX_PAGES) {
    const searchBody: any = {
      filterGroups: [{
        filters: [{
          propertyName: "hs_lastmodifieddate",
          operator: "GTE",
          value: searchFrom,
        }],
      }],
      properties: COMPANY_PROPS,
      sorts: [{ propertyName: "hs_lastmodifieddate", direction: "ASCENDING" }],
      limit: PAGE_SIZE,
    };

    if (after) searchBody.after = after;

    const companyRes = await hubspotFetch("https://api.hubapi.com/crm/v3/objects/companies/search", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(searchBody),
    });

    if (!companyRes.ok) {
      const text = await companyRes.text();
      throw new Error(`HubSpot company search failed [${companyRes.status}]: ${text.slice(0, 300)}`);
    }

    const data = await companyRes.json();
    const companies = data.results || [];

    if (companies.length === 0) break;

    let processed = 0;
    let newest = checkpoint;

    for (const hs of companies) {
      try {
        const p = hs.properties || {};
        const name = p.name || "";
        const domain = (p.domain || "").toLowerCase().replace(/^www\./, "").replace(/\/$/, "") || null;
        const hubspotObjectId = String(hs.id || p.hs_object_id || "").trim();
        const modified = p.hs_lastmodifieddate || "";

        if (!name) continue;

        const domainLow = (domain || "").toLowerCase();
        const nameLow = name.toLowerCase();
        const schoolKeys = ["university", "college", "school", "academy", "education", "institute", "district", "k12", "edu"];
        const isSchool = domainLow.includes(".edu") || domainLow.includes(".k12.") || domainLow.includes(".school") ||
          schoolKeys.some((k) => nameLow.includes(k)) ||
          (p.industry || "").toLowerCase().includes("education");
        const account_type = isSchool ? "school" : "company";

        const lifecycle = (p.lifecyclestage || "").toLowerCase();
        let lifecycle_stage = "prospect";
        if (lifecycle === "customer" || lifecycle === "evangelist") lifecycle_stage = "customer";
        else if (lifecycle === "opportunity" || lifecycle === "salesqualifiedlead") lifecycle_stage = "opportunity";

        const sales_motion =
          lifecycle_stage === "customer"    ? "expansion"    :
          lifecycle_stage === "opportunity" ? "active-deal"  : "new-logo";
        const partnerRaw = (p.partner || "").trim();
        const relationship_type = partnerRaw ? "partner-managed" : "direct";
        const brief_type =
          lifecycle_stage === "customer"    ? "expansionBrief"    :
          lifecycle_stage === "opportunity" ? "opportunityBrief"  : "prospectBrief";

        const headcount = p.numberofemployees ? parseInt(p.numberofemployees, 10) || null : null;

        if (hubspotObjectId) {
          const { data: existing } = await supabase
            .from("companies")
            .select("id")
            .eq("hubspot_object_id", hubspotObjectId)
            .maybeSingle();

          if (existing) {
            await supabase.from("companies").update({
              name,
              domain,
              account_type,
              lifecycle_stage,
              sales_motion,
              relationship_type,
              brief_type,
              industry: p.industry || null,
              hq_country: p.country || null,
              headcount,
              hubspot_properties: p,
            }).eq("id", existing.id);
          } else {
            await supabase.from("companies").insert({
              name,
              domain,
              account_type,
              lifecycle_stage,
              sales_motion,
              relationship_type,
              brief_type,
              source_type: "hubspot",
              industry: p.industry || null,
              hq_country: p.country || null,
              headcount,
              hubspot_object_id: hubspotObjectId,
              hubspot_properties: p,
            });
          }
        }

        if (modified > newest) newest = modified;
        processed++;
      } catch (e: any) {
        console.warn(`sync_companies: failed to process ${hs.id}: ${e.message}`);
      }
    }

    totalProcessed += processed;
    if (newest > latestModified) latestModified = newest;

    await supabase.from("sync_checkpoints").upsert({
      key: "company_sync_cursor",
      value: latestModified,
      updated_at: new Date().toISOString(),
    });

    after = data.paging?.next?.after || null;
    pageCount++;

    if (!after) break;
  }

  await supabase.from("sync_checkpoints").upsert({
    key: "last_company_sync_result",
    value: JSON.stringify({
      processed: totalProcessed,
      pages: pageCount,
      checkpoint: latestModified,
      has_more: !!after,
      at: new Date().toISOString(),
    }),
    updated_at: new Date().toISOString(),
  });

  console.log(`sync_companies: processed ${totalProcessed} across ${pageCount} pages, checkpoint=${latestModified}`);

  return new Response(
    JSON.stringify({
      success: true,
      companies_processed: totalProcessed,
      pages: pageCount,
      checkpoint: latestModified,
      has_more: !!after,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

// Process a single page of HubSpot contacts
async function processContactPage(
  supabase: any,
  hsContacts: any[],
  apiKey: string,
): Promise<{ processed: number; newest: string }> {
  let newest = "";
  const rowsByCompany = new Map<string, any[]>(); // companyId → contact rows
  const orphanRows: any[] = []; // contacts with no company association

  for (const contact of hsContacts) {
    const cp = contact.properties || {};
    const name = [cp.firstname, cp.lastname].filter(Boolean).join(" ").trim();
    if (!name) continue;

    const modified = cp.hs_lastmodifieddate || "";
    if (modified > newest) newest = modified;

    const hubspotObjectId = String(contact.id || cp.hs_object_id || "").trim();
    const associatedCompanyId = cp.associatedcompanyid || null;

    const row: any = {
      name,
      email: cp.email || null,
      title: cp.jobtitle || null,
      linkedin: cp.hs_linkedin_url || null,
      source: "hubspot",
      confidence: "high",
      hubspot_object_id: hubspotObjectId || null,
      hubspot_properties: {
        rank: 0,
        hs_last_contacted: cp.hs_last_contacted || null,
        num_contacted_notes: cp.num_contacted_notes || null,
        hs_email_open_count: cp.hs_email_open_count || null,
        hs_email_click_count: cp.hs_email_click_count || null,
        hubspot_score: cp.hubspot_score || null,
        // iorad activity dates
        first_tutorial_create_date: cp.first_tutorial_create_date || null,
        first_tutorial_view_date: cp.first_tutorial_view_date || null,
        first_tutorial_learn_date: cp.first_tutorial_learn_date || null,
        // iorad usage counts
        tutorials_created: cp.tutorials_created || null,
        tutorials_views: cp.tutorials_views || null,
        answers_with_own_tutorial_month_count: cp.answers_with_own_tutorial_month_count || null,
        answers_with_own_tutorial_previous_month_count: cp.answers_with_own_tutorial_previous_month_count || null,
        answers: cp.answers || null,
        extension_connections: cp.extension_connections || null,
        // iorad account info
        plan_name: cp.plan_name || null,
        account_type: cp.account_type || cp.account__type || null,
        last_active_date: cp.last_active_date || null,
        engagement_segment: cp.engagement_segment || null,
        first_embed_tutorial_base_domain_name: cp.first_embed_tutorial_base_domain_name || null,
        first_embed_base_domain_name: cp.first_embed_base_domain_name || null,
      },
      _hs_company_id: associatedCompanyId,
    };

    row.hubspot_properties.rank = computeContactRank(cp);

    if (associatedCompanyId) {
      const key = String(associatedCompanyId);
      if (!rowsByCompany.has(key)) rowsByCompany.set(key, []);
      rowsByCompany.get(key)!.push(row);
    } else {
      orphanRows.push(row);
    }
  }

  let processed = 0;

  // Resolve HubSpot company IDs to our company IDs in batch
  const hsCompanyIds = [...rowsByCompany.keys()];
  const companyIdMap = new Map<string, string>(); // hs_company_id → our company_id

  if (hsCompanyIds.length > 0) {
    // Look up by hubspot_object_id
    const { data: dbCompanies } = await supabase
      .from("companies")
      .select("id, hubspot_object_id")
      .in("hubspot_object_id", hsCompanyIds);

    for (const c of dbCompanies || []) {
      if (c.hubspot_object_id) companyIdMap.set(c.hubspot_object_id, c.id);
    }

    // For unresolved companies, auto-create minimal records from HubSpot
    const unresolvedIds = hsCompanyIds.filter(id => !companyIdMap.has(id));
    if (unresolvedIds.length > 0) {
      const batchRes = await hubspotFetch("https://api.hubapi.com/crm/v3/objects/companies/batch/read", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          inputs: unresolvedIds.slice(0, 50).map(id => ({ id })),
          properties: ["name", "domain", "industry", "country", "numberofemployees", "lifecyclestage"],
        }),
      });

      if (batchRes.ok) {
        const batchData = await batchRes.json();
        for (const hs of batchData.results || []) {
          try {
            const { companyId } = await upsertCompany(supabase, hs);
            companyIdMap.set(String(hs.id), companyId);
          } catch (e: any) {
            console.warn(`sync_contacts: failed to upsert company ${hs.id}: ${e.message}`);
          }
        }
      }
    }
  }

  // ── iorad activity fields worth diffing ──────────────────────────────────
  const ACTIVITY_FIELDS = [
    "first_tutorial_create_date",
    "answers_with_own_tutorial_month_count",
    "extension_connections",
    "first_tutorial_view_date",
    "plan_name",
  ];

  // Now upsert contacts for each resolved company
  for (const [hsCompanyId, rows] of rowsByCompany.entries()) {
    const companyId = companyIdMap.get(hsCompanyId);
    if (!companyId) {
      console.warn(`sync_contacts: could not resolve company ${hsCompanyId} — skipping ${rows.length} contacts`);
      continue;
    }

    const { data: existing } = await supabase
      .from("contacts")
      .select("id, email, hubspot_object_id, hubspot_properties")
      .eq("company_id", companyId);

    const byHubspotId = new Map<string, string>();
    const byEmail = new Map<string, string>();
    const existingPropsById = new Map<string, any>();
    for (const ec of existing || []) {
      if (ec.hubspot_object_id) byHubspotId.set(ec.hubspot_object_id, ec.id);
      if (ec.email) byEmail.set(ec.email.toLowerCase(), ec.id);
      existingPropsById.set(ec.id, ec.hubspot_properties || {});
    }

    const toInsert: any[] = [];
    const toUpdate: { id: string; data: any }[] = [];
    let hasProductActivity = false;
    const allActivityChanges: Record<string, Record<string, { from: any; to: any }>> = {};

    for (const row of rows) {
      const { _hs_company_id, ...contactData } = row;
      contactData.company_id = companyId;

      const existingId =
        (contactData.hubspot_object_id && byHubspotId.get(contactData.hubspot_object_id)) ||
        (contactData.email && byEmail.get(contactData.email.toLowerCase())) ||
        null;

      if (existingId && existingId !== "pending") {
        // Diff activity fields before updating
        const oldProps = existingPropsById.get(existingId) || {};
        const newProps = contactData.hubspot_properties || {};
        const activityChanges: Record<string, { from: any; to: any }> = {};

        for (const field of ACTIVITY_FIELDS) {
          const oldVal = oldProps[field] ?? null;
          const newVal = newProps[field] ?? null;
          if (String(oldVal ?? "") !== String(newVal ?? "")) {
            activityChanges[field] = { from: oldVal, to: newVal };
          }
        }

        // Detect meaningful product activity
        const isProductActivity =
          (!oldProps.first_tutorial_create_date && newProps.first_tutorial_create_date) ||
          (parseInt(newProps.answers_with_own_tutorial_month_count || "0", 10) >
           parseInt(oldProps.answers_with_own_tutorial_month_count || "0", 10)) ||
          (!oldProps.extension_connections && newProps.extension_connections);

        if (isProductActivity) hasProductActivity = true;
        if (Object.keys(activityChanges).length > 0) {
          allActivityChanges[contactData.name || existingId] = activityChanges;
        }

        toUpdate.push({ id: existingId, data: contactData });
      } else if (!existingId) {
        toInsert.push(contactData);
        if (contactData.hubspot_object_id) byHubspotId.set(contactData.hubspot_object_id, "pending");
        if (contactData.email) byEmail.set(contactData.email.toLowerCase(), "pending");
      }
    }

    if (toInsert.length > 0) {
      const { error } = await supabase
        .from("contacts")
        .upsert(toInsert, { onConflict: "company_id,hubspot_object_id", ignoreDuplicates: false });
      if (error) console.warn(`sync_contacts: upsert error for company ${companyId}: ${error.message}`);
    }

    if (toUpdate.length > 0) {
      await Promise.all(toUpdate.map(({ id, data }) =>
        supabase.from("contacts").update(data).eq("id", id)
      ));
    }

    // Bubble up activity changes to company last_sync_changes
    if (Object.keys(allActivityChanges).length > 0 || hasProductActivity) {
      await supabase.from("companies").update({
        last_sync_changes: {
          changed_at: new Date().toISOString(),
          trigger: hasProductActivity ? "product_activity" : "contact_update",
          activity: allActivityChanges,
          fields: {},
        },
      }).eq("id", companyId);
    }

    // Auto-trigger scoring + brief generation on product activity
    if (hasProductActivity) {
      const supabaseUrl2 = Deno.env.get("SUPABASE_URL")!;
      const serviceKey2 = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

      fetch(`${supabaseUrl2}/functions/v1/score-companies`, {
        method: "POST",
        headers: { Authorization: `Bearer ${serviceKey2}`, "Content-Type": "application/json" },
        body: JSON.stringify({ action: "score_one", company_id: companyId }),
      }).catch(e => console.warn("auto-score failed:", e.message));

      fetch(`${supabaseUrl2}/functions/v1/generate-cards`, {
        method: "POST",
        headers: { Authorization: `Bearer ${serviceKey2}`, "Content-Type": "application/json" },
        body: JSON.stringify({ company_id: companyId, tab: "strategy", auto_triggered: true }),
      }).catch(e => console.warn("auto-brief failed:", e.message));

      console.log(`sync_contacts: product_activity detected for company ${companyId} — auto-score + auto-brief triggered`);
    } else {
      scoreCompanyAsync(companyId);
    }

    processed += rows.length;
  }

  if (orphanRows.length > 0) {
    console.warn(`sync_contacts: ${orphanRows.length} contacts have no company association — skipped`);
  }

  return { processed, newest };
}

async function backfillContacts(
  supabase: any,
  after: string | null,
  jobId: string | null,
  totalProcessed: number,
) {
  const apiKey = Deno.env.get("HUBSPOT_API_KEY");
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  if (!apiKey) throw new Error("HUBSPOT_API_KEY not configured");

  // Create job on first call
  let currentJobId = jobId;
  if (!currentJobId) {
    const { data: job } = await supabase
      .from("processing_jobs")
      .insert({
        trigger: "contact_backfill",
        status: "running",
        total_companies_targeted: 0,
        settings_snapshot: { action: "backfill_contacts", started: new Date().toISOString() },
      })
      .select("id")
      .single();
    currentJobId = job?.id || null;
  }

  // Check for cancellation
  if (currentJobId) {
    const { data: jobRow } = await supabase
      .from("processing_jobs")
      .select("status")
      .eq("id", currentJobId)
      .single();
    if (jobRow?.status === "canceled" || jobRow?.status === "failed") {
      return new Response(
        JSON.stringify({ status: "stopped", reason: jobRow.status }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  }

  const CONTACT_PROPS = [
    "firstname", "lastname", "email", "jobtitle", "hs_linkedin_url",
    "hs_lastmodifieddate", "hs_object_id", "associatedcompanyid",
    "hs_last_contacted", "num_contacted_notes",
    "hs_email_open_count", "hs_email_click_count", "hubspot_score",
    // iorad activity dates
    "first_tutorial_create_date", "first_tutorial_view_date",
    "first_tutorial_learn_date",
    // iorad usage counts
    "tutorials_created", "tutorials_views",
    "answers_with_own_tutorial_month_count",
    "answers_with_own_tutorial_previous_month_count",
    "answers", "extension_connections",
    // iorad account info
    "plan_name", "account_type", "account__type",
    "last_active_date", "engagement_segment",
    "first_embed_tutorial_base_domain_name",
    "first_embed_base_domain_name",
  ];

  // List contacts with cursor pagination
  const PAGE_SIZE = 100;
  const params = new URLSearchParams({
    limit: String(PAGE_SIZE),
    properties: CONTACT_PROPS.join(","),
    archived: "false",
  });
  if (after) params.set("after", after);

  const res = await hubspotFetch(`https://api.hubapi.com/crm/v3/objects/contacts?${params}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HubSpot contacts list failed [${res.status}]: ${text.slice(0, 300)}`);
  }

  const data = await res.json();
  const contacts = data.results || [];
  const nextAfter = data.paging?.next?.after || null;

  if (contacts.length === 0) {
    // Done
    if (currentJobId) {
      await supabase.from("processing_jobs").update({
        status: "completed",
        finished_at: new Date().toISOString(),
        companies_processed: totalProcessed,
        companies_succeeded: totalProcessed,
      }).eq("id", currentJobId);
    }
    // Set the contact sync checkpoint to now so incremental sync takes over
    await supabase.from("sync_checkpoints").upsert({
      key: "contact_sync_cursor",
      value: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    return new Response(
      JSON.stringify({ success: true, total: totalProcessed, status: "completed" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Reuse processContactPage from the incremental sync
  const { processed } = await processContactPage(supabase, contacts, apiKey);
  const newTotal = totalProcessed + processed;

  // Update job progress
  if (currentJobId) {
    await supabase.from("processing_jobs").update({
      companies_processed: newTotal,
      companies_succeeded: newTotal,
      settings_snapshot: {
        action: "backfill_contacts",
        after: nextAfter,
        total: newTotal,
      },
    }).eq("id", currentJobId);
  }

  // Save backfill cursor
  await supabase.from("sync_checkpoints").upsert({
    key: "contact_backfill_after",
    value: nextAfter || "done",
    updated_at: new Date().toISOString(),
  });

  // Self-chain if more pages
  if (nextAfter) {
    fetch(`${supabaseUrl}/functions/v1/import-from-hubspot`, {
      method: "POST",
      headers: { Authorization: `Bearer ${serviceRoleKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "backfill_contacts",
        after: nextAfter,
        job_id: currentJobId,
        total: newTotal,
      }),
    }).catch((e: any) => console.error("backfill_contacts chain error:", e.message));
  }

  return new Response(
    JSON.stringify({
      success: true,
      processed,
      total: newTotal,
      has_more: !!nextAfter,
      job_id: currentJobId,
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

function deriveAccountType(props: Record<string, any>, existingPartner?: string | null): "school" | "company" | "partner" {
  // Partner: already flagged (outbound partner company)
  if (existingPartner) return "partner";

  const industry = (props.industry || "").toUpperCase().replace(/[\s-]/g, "_");
  if (EDU_INDUSTRIES.has(industry)) return "school";

  const domain = (props.domain || "").toLowerCase();
  if (isEduDomain(domain)) return "school";

  const name = props.name || "";
  if (isEduName(name)) return "school";

  return "company";
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
): "prospect" | "opportunity" | "customer" {
  // Deal-based signals take priority over company lifecycle (more reliable)
  if (deals?.hasClosedWon) {
    return "customer";
  }
  if (deals?.hasOpenDeal) return "opportunity";

  // Fall back to company-level lifecycle stage
  const lifecycle = (props.lifecyclestage || "").toLowerCase();
  if (lifecycle === "customer" || lifecycle === "evangelist") return "customer";
  if (lifecycle === "opportunity" || lifecycle === "salesqualifiedlead") return "opportunity";
  if (props.hs_date_entered_customer) return "customer";
  if (props.hs_date_entered_opportunity) return "opportunity";

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

  // Fetch associated deals for accurate stage derivation, but avoid blocking sync
  let deals = { hasClosedWon: false, hasOpenDeal: false, dealCount: 0 };
  try {
    const dealPromise = fetchDealsForCompany(hubspotCompany.id, apiKey);
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("deal fetch timeout")), 5000)
    );
    deals = await Promise.race([dealPromise, timeoutPromise]);
  } catch (e: any) {
    console.warn(`upsertCompany: deal fetch skipped for ${hubspotCompany.id}: ${e.message}`);
    // Falls back to lifecycle-stage-only derivation, which is fine
  }

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
      .select("id, snapshot_status, partner, account_type")
      .eq("hubspot_object_id", hubspotObjectId)
      .maybeSingle();

    if (existingByHubspotId) {
      const account_type = existingByHubspotId.partner ? "partner" : deriveAccountType(props, existingByHubspotId.partner);
      const lifecycle_stage = deriveStage(props, deals);
      const isCustomer = lifecycle_stage === "customer";
      const sales_motion = lifecycle_stage === "customer" ? "expansion" : lifecycle_stage === "opportunity" ? "active-deal" : "new-logo";
      const partnerRaw = (props.partner || existingByHubspotId.partner || "").trim();
      const relationship_type = partnerRaw ? "partner-managed" : "direct";
      const brief_type = lifecycle_stage === "customer" ? "expansionBrief" : lifecycle_stage === "opportunity" ? "opportunityBrief" : "prospectBrief";

      await supabase.from("companies").update({
        ...companyData,
        account_type,
        lifecycle_stage,
        sales_motion,
        relationship_type,
        brief_type,
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
      .select("id, snapshot_status, partner, account_type")
      .eq("domain", domain)
      .maybeSingle();

    if (existing) {
      const account_type = existing.partner ? "partner" : deriveAccountType(props, existing.partner);
      const lifecycle_stage = deriveStage(props, deals);
      const isCustomer = lifecycle_stage === "customer";
      const sales_motion = lifecycle_stage === "customer" ? "expansion" : lifecycle_stage === "opportunity" ? "active-deal" : "new-logo";
      const partnerRaw = (props.partner || existing.partner || "").trim();
      const relationship_type = partnerRaw ? "partner-managed" : "direct";
      const brief_type = lifecycle_stage === "customer" ? "expansionBrief" : lifecycle_stage === "opportunity" ? "opportunityBrief" : "prospectBrief";

      await supabase.from("companies").update({
        ...companyData,
        account_type,
        lifecycle_stage,
        sales_motion,
        relationship_type,
        brief_type,
        ...(isCustomer ? { is_existing_customer: true } : {}),
      }).eq("id", existing.id);

      const hasStory = existing.snapshot_status === "Generated";
      return { companyId: existing.id, isNew: false, hasStory };
    }
  }

  // Insert new company — derive account_type & lifecycle_stage from HubSpot data + deals
  const account_type = deriveAccountType(props, null);
  const lifecycle_stage = deriveStage(props, deals);
  const isCustomer = lifecycle_stage === "customer";
  const sales_motion = lifecycle_stage === "customer" ? "expansion" : lifecycle_stage === "opportunity" ? "active-deal" : "new-logo";
  const partnerRaw = (props.partner || "").trim();
  const relationship_type = partnerRaw ? "partner-managed" : "direct";
  const brief_type = lifecycle_stage === "customer" ? "expansionBrief" : lifecycle_stage === "opportunity" ? "opportunityBrief" : "prospectBrief";

  const { data: inserted, error } = await supabase
    .from("companies")
    .insert({
      ...companyData,
      account_type,
      lifecycle_stage,
      sales_motion,
      relationship_type,
      brief_type,
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
    // iorad activity dates
    "first_tutorial_create_date", "first_tutorial_view_date", "first_tutorial_learn_date",
    // iorad usage counts
    "tutorials_created", "tutorials_views",
    "answers_with_own_tutorial_month_count", "answers_with_own_tutorial_previous_month_count",
    "answers", "extension_connections",
    // iorad account info
    "plan_name", "account_type", "account__type",
    "last_active_date", "engagement_segment",
    "first_embed_tutorial_base_domain_name", "first_embed_base_domain_name",
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

    // Cap at 200 contacts for single-company sync to avoid timeout
    if (contactIds.length > 200) {
      console.warn(`importContactsForCompany: capping ${contactIds.length} contacts to 200 for ${hubspotCompanyId}`);
      contactIds.length = 200;
    }

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
            // iorad activity dates
            first_tutorial_create_date: cp.first_tutorial_create_date || null,
            first_tutorial_view_date: cp.first_tutorial_view_date || null,
            first_tutorial_learn_date: cp.first_tutorial_learn_date || null,
            // iorad usage counts
            tutorials_created: cp.tutorials_created || null,
            tutorials_views: cp.tutorials_views || null,
            answers_with_own_tutorial_month_count: cp.answers_with_own_tutorial_month_count || null,
            answers_with_own_tutorial_previous_month_count: cp.answers_with_own_tutorial_previous_month_count || null,
            answers: cp.answers || null,
            extension_connections: cp.extension_connections || null,
            // iorad account info
            plan_name: cp.plan_name || null,
            account_type: cp.account_type || cp.account__type || null,
            last_active_date: cp.last_active_date || null,
            engagement_segment: cp.engagement_segment || null,
            first_embed_tutorial_base_domain_name: cp.first_embed_tutorial_base_domain_name || null,
            first_embed_base_domain_name: cp.first_embed_base_domain_name || null,
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

    const account_type = deriveAccountType(props, existingPartner);
    const lifecycle_stage = deriveStage(props, deals);
    const isCustomer = lifecycle_stage === "customer";
    const sales_motion = lifecycle_stage === "customer" ? "expansion" : lifecycle_stage === "opportunity" ? "active-deal" : "new-logo";
    const partnerRaw = (props.partner || existingPartner || "").trim();
    const relationship_type = partnerRaw ? "partner-managed" : "direct";
    const brief_type = lifecycle_stage === "customer" ? "expansionBrief" : lifecycle_stage === "opportunity" ? "opportunityBrief" : "prospectBrief";

    // Update company record
    if (companyId) {
      const updates: Record<string, any> = {
        hubspot_properties: props,
        account_type,
        lifecycle_stage,
        sales_motion,
        relationship_type,
        brief_type,
        ...(isCustomer ? { is_existing_customer: true } : {}),
        ...(props.industry ? { industry: props.industry } : {}),
        ...(props.numberofemployees ? { headcount: parseInt(String(props.numberofemployees), 10) || undefined } : {}),
      };
      await supabase.from("companies").update(updates).eq("id", companyId);
      console.log(`sync_company: updated ${domain} (account_type: ${account_type}, lifecycle_stage: ${lifecycle_stage}, deals: closed_won=${deals.hasClosedWon} open=${deals.hasOpenDeal})`);

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
          account_type,
          lifecycle_stage,
          sales_motion,
          relationship_type,
          brief_type,
          is_existing_customer: isCustomer,
          hs_lifecycle_stage: props.lifecyclestage || null,
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
        success: true, found: true, account_type, lifecycle_stage, sales_motion, relationship_type, brief_type,
        is_existing_customer: isCustomer,
        hs_lifecycle_stage: props.lifecyclestage || null,
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

// ── Catchup: one-time sweep of all 2-year active contacts ──────────────────
// Simple cursor-based: searches ALL contacts modified in last 2 years, sorted ASC,
// pages through 500 per invocation using HubSpot's `after` cursor.
// When HubSpot's 10k search limit is hit, advances the date cursor from the last
// contact's lastmodifieddate and starts fresh pagination.
async function catchupContacts(supabase: any, afterParam: string | null) {
  const apiKey = Deno.env.get("HUBSPOT_API_KEY");
  if (!apiKey) throw new Error("HUBSPOT_API_KEY not configured");

  const TWO_YEARS_AGO_MS = String(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000);

  // Cursor is the lastmodifieddate millis of where we left off
  const { data: cursorRow } = await supabase
    .from("sync_checkpoints")
    .select("value")
    .eq("key", "contact_catchup_cursor")
    .maybeSingle();

  const cursorMs = cursorRow?.value || TWO_YEARS_AGO_MS;

  // Check if complete (cursor stored as "complete" sentinel)
  if (cursorMs === "complete") {
    return new Response(
      JSON.stringify({ success: true, status: "complete" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const CONTACT_PROPS = [
    "firstname", "lastname", "email", "jobtitle", "hs_linkedin_url",
    "hs_lastmodifieddate", "hs_object_id", "associatedcompanyid",
    "hs_last_contacted", "num_contacted_notes",
    "hs_email_open_count", "hs_email_click_count", "hubspot_score",
    "first_tutorial_create_date", "first_tutorial_view_date",
    "first_tutorial_learn_date",
    "tutorials_created", "tutorials_views",
    "answers_with_own_tutorial_month_count",
    "answers_with_own_tutorial_previous_month_count",
    "answers", "extension_connections",
    "plan_name", "account_type", "account__type",
    "last_active_date", "engagement_segment",
    "first_embed_tutorial_base_domain_name",
    "first_embed_base_domain_name",
  ];

  const PAGE_SIZE = 100;
  const MAX_PAGES = 5; // 500 contacts per invocation
  let after: string | null = afterParam;
  let totalProcessed = 0;
  let lastSeenModified = cursorMs;
  let pageCount = 0;

  while (pageCount < MAX_PAGES) {
    const searchBody: any = {
      filterGroups: [{
        filters: [{
          propertyName: "lastmodifieddate",
          operator: "GTE",
          value: cursorMs,
        }],
      }],
      properties: CONTACT_PROPS,
      sorts: [{ propertyName: "lastmodifieddate", direction: "ASCENDING" }],
      limit: PAGE_SIZE,
    };
    if (after) searchBody.after = after;

    const res = await hubspotFetch(
      "https://api.hubapi.com/crm/v3/objects/contacts/search",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(searchBody),
      }
    );

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`HubSpot catchup failed [${res.status}]: ${text.slice(0, 200)}`);
    }

    const data = await res.json();
    const contacts = data.results || [];

    if (contacts.length === 0) {
      // No more contacts — catchup is complete
      await supabase.from("sync_checkpoints").upsert({
        key: "contact_catchup_cursor", value: "complete",
        updated_at: new Date().toISOString(),
      });
      await supabase.from("sync_checkpoints").upsert({
        key: "contact_catchup_status", value: "complete",
        updated_at: new Date().toISOString(),
      });
      console.log(`catchup_contacts: COMPLETE after ${totalProcessed} this run`);
      return new Response(
        JSON.stringify({ success: true, status: "complete", processed: totalProcessed }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { processed } = await processContactPage(supabase, contacts, apiKey);
    totalProcessed += processed;
    pageCount++;

    // Track the lastmodifieddate of the last contact for cursor advancement
    const lastContact = contacts[contacts.length - 1];
    const lastMod = lastContact?.properties?.lastmodifieddate || lastContact?.properties?.hs_lastmodifieddate;
    if (lastMod) {
      // Convert to millis if it's an ISO string
      const ms = isNaN(Number(lastMod)) ? new Date(lastMod).getTime() : Number(lastMod);
      if (ms > Number(lastSeenModified)) lastSeenModified = String(ms);
    }

    after = data.paging?.next?.after || null;
    if (!after) {
      // HubSpot search hit 10k limit or no more pages
      // Advance cursor to lastSeenModified and reset pagination
      break;
    }
  }

  // Determine next cursor: if after is set, keep same cursor (more pages).
  // If after is null, advance cursor to lastSeenModified.
  const nextCursor = after ? cursorMs : lastSeenModified;

  await supabase.from("sync_checkpoints").upsert({
    key: "contact_catchup_cursor",
    value: nextCursor,
    updated_at: new Date().toISOString(),
  });

  const cursorDate = new Date(Number(nextCursor)).toISOString().slice(0, 10);
  await supabase.from("sync_checkpoints").upsert({
    key: "contact_catchup_status",
    value: JSON.stringify({
      cursor: cursorDate,
      processed_this_run: totalProcessed,
      at: new Date().toISOString(),
    }),
    updated_at: new Date().toISOString(),
  });

  console.log(`catchup_contacts: processed ${totalProcessed}, cursor=${cursorDate}`);

  // Self-chain to continue
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  fetch(`${supabaseUrl}/functions/v1/import-from-hubspot`, {
    method: "POST",
    headers: { Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ action: "catchup_contacts", after: after || null }),
  }).catch(e => console.warn("catchup self-chain failed:", e.message));

  return new Response(
    JSON.stringify({ success: true, processed: totalProcessed, cursor: cursorDate }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
