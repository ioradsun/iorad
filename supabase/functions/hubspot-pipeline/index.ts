import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

/**
 * hubspot-pipeline
 * ────────────────
 * A strict sequential 3-phase pipeline that never does two expensive things
 * at once. Each phase self-chains in small batches, and only transitions
 * to the next phase when the current phase is 100% complete.
 *
 * Phase 1 — COMPANIES:  Page through all HubSpot companies and upsert to DB.
 *                        NO contacts, NO scoring.
 *
 * Phase 2 — CONTACTS:   Find every company in DB with 0 contacts and fetch
 *                        their contacts from HubSpot. Only missing contacts.
 *
 * Phase 3 — SCORING:    Score every company that was touched in Phase 1 or 2.
 *                        Uses DB-only data — zero HubSpot API calls.
 *
 * Single `processing_jobs` row tracks the whole pipeline. The `settings_snapshot`
 * carries: { phase, phase1_cursor, phase2_offset, scored_ids[], ... }
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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


// ── HubSpot rate-limit-aware fetch ──────────────────────────────────────────
let _lastHubSpotCall = 0;
const MIN_DELAY_MS = 110;

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
  _lastHubSpotCall = Date.now();
  return fetch(url, options);
}

const COMPANY_BATCH = 20;   // companies upserted per Phase-1 invocation
const CONTACT_BATCH = 15;   // companies whose contacts are fetched per Phase-2 invocation
const SCORE_BATCH   = 30;   // companies scored per Phase-3 invocation

// ── Fire-and-forget self-chain ────────────────────────────────────────────────
function chainSelf(jobId: string) {
  const url  = Deno.env.get("SUPABASE_URL")!;
  const key  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  // Only send job_id — the next invocation reads snapshot from DB.
  // Tiny payload = no size issues, no stale data.
  fetch(`${url}/functions/v1/hubspot-pipeline`, {
    method : "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body   : JSON.stringify({ job_id: jobId }),
  }).catch(e => console.error("chain error:", e.message));
}

// ── HubSpot helpers ───────────────────────────────────────────────────────────
async function getAllPropertyNames(apiKey: string): Promise<string[]> {
  try {
    const res = await hubspotFetch("https://api.hubapi.com/crm/v3/properties/companies", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results || []).map((p: any) => p.name).filter(Boolean);
  } catch {
    return [];
  }
}

async function listHubSpotPage(
  apiKey: string,
  after: string | null,
  properties: string
): Promise<{ companies: any[]; nextAfter: string | null }> {
  const url = new URL("https://api.hubapi.com/crm/v3/objects/companies");
  url.searchParams.set("limit", String(COMPANY_BATCH));
  // Cap properties to prevent URL overflow on GET requests.
  // HubSpot GET URL limit is ~4096 chars. Keep properties under 2000 chars.
  const safeProps = properties.length > 2000
    ? "name,domain,industry,country,numberofemployees,lifecyclestage,hubspot_owner_id,hs_object_id,hs_lastmodifieddate,createdate"
    : properties;
  url.searchParams.set("properties", safeProps);
  if (after) url.searchParams.set("after", after);

  const res = await hubspotFetch(url.toString(), {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HubSpot list failed (${res.status}): ${text.slice(0, 200)}`);
  }
  const data = await res.json();
  return {
    companies: data.results || [],
    nextAfter: data.paging?.next?.after ?? null,
  };
}

// ── Upsert a single company (domain-based dedup) ──────────────────────────────
async function upsertCompany(
  supabase: any,
  hs: any
): Promise<string> {
  const p    = hs.properties || {};
  const name = (p.name || "").trim() || `HubSpot-${hs.id}`;
  const domain: string | null = (p.domain || "").trim() || null;

  const industry   = (p.industry || "").toLowerCase();
  const domainLow  = (domain || "").toLowerCase();
  const nameLow    = name.toLowerCase();
  const schoolKeys = ["university", "college", "school", "academy", "education", "institute", "district", "k12", "edu"];
  const isSchool   =
    domainLow.includes(".edu") || domainLow.includes(".k12.") || domainLow.includes(".school") ||
    schoolKeys.some(k => nameLow.includes(k)) ||
    industry.includes("education") || industry.includes("higher education");

  if (domain) {
    const { data: existing } = await supabase
      .from("companies")
      .select("id, hubspot_properties")
      .eq("domain", domain)
      .maybeSingle();
    if (existing) {
      // ── Diff tracked fields ──────────────────────────────────────────────
      const TRACKED_FIELDS = [
        "lifecyclestage", "name", "numberofemployees",
        "industry", "country", "hubspot_owner_id",
      ];
      const oldProps = (existing.hubspot_properties as any) || {};
      const changes: Record<string, { from: any; to: any }> = {};
      for (const field of TRACKED_FIELDS) {
        const oldVal = oldProps[field] ?? null;
        const newVal = p[field] ?? null;
        if (String(oldVal ?? "") !== String(newVal ?? "")) {
          changes[field] = { from: oldVal, to: newVal };
        }
      }
      const hasChanges = Object.keys(changes).length > 0;

      const updateLifecycle = (p.lifecyclestage || "").toLowerCase();
      let updateLifecycleStage = "prospect";
      if (updateLifecycle === "customer" || updateLifecycle === "evangelist") updateLifecycleStage = "customer";
      else if (updateLifecycle === "opportunity" || updateLifecycle === "salesqualifiedlead") updateLifecycleStage = "opportunity";

      const updateAccountType = isSchool ? "school" : "company";
      const updateSalesMotion = updateLifecycleStage === "customer" ? "expansion" : updateLifecycleStage === "opportunity" ? "active-deal" : "new-logo";
      const updatePartnerValue = (p.partner || "").trim();
      const updateRelType = updatePartnerValue ? "partner-managed" : "direct";
      const updateBriefType = updateLifecycleStage === "customer" ? "expansionBrief" : updateLifecycleStage === "opportunity" ? "opportunityBrief" : "prospectBrief";

      await supabase.from("companies").update({
        hubspot_properties: p,
        name,
        account_type: updateAccountType,
        lifecycle_stage: updateLifecycleStage,
        sales_motion: updateSalesMotion,
        relationship_type: updateRelType,
        brief_type: updateBriefType,
        updated_at: new Date().toISOString(),
        last_sync_changes: hasChanges
          ? {
              changed_at: new Date().toISOString(),
              trigger: changes.lifecyclestage ? "lifecycle_change" : "crm_update",
              fields: changes,
              activity: {},
            }
          : {
              changed_at: new Date().toISOString(),
              trigger: "no_change",
              fields: {},
              activity: {},
            },
      }).eq("id", existing.id);
      return existing.id;
    }
  }
  const account_type = isSchool ? "school" : "company";

  const lifecycle = (p.lifecyclestage || "").toLowerCase();
  let lifecycle_stage = "prospect";
  if (lifecycle === "customer" || lifecycle === "evangelist") lifecycle_stage = "customer";
  else if (lifecycle === "opportunity" || lifecycle === "salesqualifiedlead") lifecycle_stage = "opportunity";

  const sales_motion =
    lifecycle_stage === "customer"    ? "expansion"    :
    lifecycle_stage === "opportunity" ? "active-deal"  : "new-logo";

  const partnerValue = (p.partner || "").trim();
  const relationship_type = partnerValue ? "partner-managed" : "direct";
  const brief_type =
    lifecycle_stage === "customer"    ? "expansionBrief"    :
    lifecycle_stage === "opportunity" ? "opportunityBrief"  : "prospectBrief";

  const headcount = p.numberofemployees ? parseInt(p.numberofemployees, 10) || null : null;

  const { data: inserted, error } = await supabase
    .from("companies")
    .insert({ name, domain, account_type, lifecycle_stage, sales_motion, relationship_type, brief_type,
              source_type: "hubspot",
              industry: p.industry || null, hq_country: p.country || null,
              headcount, hubspot_properties: p,
              last_sync_changes: { changed_at: new Date().toISOString(), trigger: "new_record", fields: {}, activity: {} } })
    .select("id")
    .single();

  if (error) throw new Error(`Insert failed: ${error.message}`);
  return inserted.id;
}

// ── Phase-1: upsert one batch of companies ────────────────────────────────────
async function runPhase1(supabase: any, apiKey: string, jobId: string, snap: any) {
  const after     = snap.phase1_cursor ?? null;
  const processed = snap.phase1_processed ?? 0;

  console.log(`pipeline phase1: cursor=${after ?? "start"}, processed so far=${processed}`);

  // Cache property names in snapshot to avoid extra API call per batch
  let properties: string;
  if (snap._cached_properties) {
    properties = snap._cached_properties;
  } else {
    const allProps = await getAllPropertyNames(apiKey);
    properties = allProps.length > 0
      ? allProps.join(",")
      : "name,domain,industry,country,numberofemployees,lifecyclestage";
  }

  const { companies, nextAfter } = await listHubSpotPage(apiKey, after, properties);

  let upserted = 0;
  let failed   = 0;

  for (const hs of companies) {
    try {
      const companyId = await upsertCompany(supabase, hs);
      upserted++;
      await logSyncEvent(supabase, {
        source: "hubspot_pipeline", job_id: jobId, entity_type: "company",
        entity_id: companyId,
        entity_name: (hs.properties?.name || "").trim() || `HubSpot-${hs.id}`,
        action: "updated", batch_seq: processed + upserted, cursor_val: nextAfter,
        meta: { phase: 1 },
      });
    } catch (e: any) {
      console.error(`phase1: failed to upsert ${hs.id}: ${e.message}`);
      failed++;
    }
  }

  const newProcessed = processed + upserted;
  const newSnap = {
    ...snap,
    phase: 1,
    phase1_cursor: nextAfter,
    phase1_processed: newProcessed,
    _cached_properties: properties,
  };

  // Update job progress
  await supabase.from("processing_jobs").update({
    companies_processed: newProcessed,
    companies_succeeded: newProcessed,
    companies_failed: (snap.phase1_failed ?? 0) + failed,
    settings_snapshot: newSnap,
  }).eq("id", jobId);

  if (nextAfter) {
    // More pages in Phase 1 — chain to next page
    await logSyncEvent(supabase, {
      source: "hubspot_pipeline", job_id: jobId, entity_type: "company",
      action: "heartbeat", entity_name: `Phase 1: ${newProcessed} companies upserted`,
      cursor_val: nextAfter, batch_seq: newProcessed,
      meta: { phase: 1, resume_function: "hubspot-pipeline", resume_payload: { job_id: jobId } },
    });
    chainSelf(jobId);
    console.log(`pipeline phase1: chaining next page, cursor=${nextAfter}`);
  } else {
    // Phase 1 complete — transition to Phase 2
    console.log(`pipeline phase1: DONE — ${newProcessed} companies upserted. Starting phase 2.`);
    const phase2Snap = { ...newSnap, phase: 2, phase2_offset: 0, phase2_processed: 0, phase2_failed: 0 };
    await supabase.from("processing_jobs").update({ settings_snapshot: phase2Snap }).eq("id", jobId);
    await logSyncEvent(supabase, {
      source: "hubspot_pipeline", job_id: jobId, entity_type: "company",
      action: "heartbeat", entity_name: `Phase 1 complete: ${newProcessed} companies. Starting phase 2.`,
      batch_seq: newProcessed,
      meta: { phase: 1, resume_function: "hubspot-pipeline", resume_payload: { job_id: jobId } },
    });
    chainSelf(jobId);
  }
}

// ── Contact helpers for Phase 2 ───────────────────────────────────────────────
const CONTACT_PROPS = [
  "firstname", "lastname", "email", "jobtitle", "hs_linkedin_url",
  "hs_last_contacted", "num_contacted_notes", "hs_email_open_count",
  "hs_email_click_count", "hubspot_score",
  "first_tutorial_create_date", "first_tutorial_view_date", "first_tutorial_learn_date",
  "answers_with_own_tutorial_month_count", "answers_with_own_tutorial_previous_month_count",
  "answers", "extension_connections",
  // iorad account info
  "plan_name", "account_type", "account__type",
];

async function importContactsForCompany(
  supabase: any,
  hubspotCompanyId: string,
  companyId: string,
  apiKey: string
): Promise<number> {
  const assocRes = await hubspotFetch(
    `https://api.hubapi.com/crm/v3/objects/companies/${hubspotCompanyId}/associations/contacts?limit=500`,
    { headers: { Authorization: `Bearer ${apiKey}` } }
  );
  if (!assocRes.ok) return 0;
  const assocData = await assocRes.json();
  const contactIds: string[] = (assocData.results || [])
    .map((r: any) => String(r.toObjectId || r.id))
    .filter(Boolean);
  if (contactIds.length === 0) return 0;

  console.log(`phase2: ${contactIds.length} contacts for hs company ${hubspotCompanyId}`);

  // Pre-load existing contacts for batch dedup
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

  let inserted = 0;
  for (let i = 0; i < contactIds.length; i += 100) {
    const batch = contactIds.slice(i, i + 100);
    const batchRes = await hubspotFetch("https://api.hubapi.com/crm/v3/objects/contacts/batch/read", {
      method : "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body   : JSON.stringify({ inputs: batch.map(id => ({ id })), properties: CONTACT_PROPS }),
    });
    if (!batchRes.ok) continue;
    const batchData = await batchRes.json();

    const toInsert: any[] = [];
    for (const contact of batchData.results || []) {
      const cp   = contact.properties || {};
      const name = [cp.firstname, cp.lastname].filter(Boolean).join(" ").trim();
      if (!name) continue;
      const hsId = String(contact.id || cp.hs_object_id || "").trim();
      const existingId =
        (hsId && byHubspotId.get(hsId)) ||
        (cp.email && byEmail.get(cp.email.toLowerCase())) ||
        null;
      if (existingId) continue;

      // Track in maps to prevent intra-batch duplicates
      if (hsId) byHubspotId.set(hsId, "pending");
      if (cp.email) byEmail.set(cp.email.toLowerCase(), "pending");
      toInsert.push({
        company_id: companyId, name,
        email: cp.email || null, title: cp.jobtitle || null,
        linkedin: cp.hs_linkedin_url || null,
        source: "hubspot", confidence: "high",
        hubspot_object_id: String(contact.id || cp.hs_object_id || "").trim() || null,
        hubspot_properties: {
          hs_last_contacted: cp.hs_last_contacted || null,
          num_contacted_notes: cp.num_contacted_notes || null,
          hs_email_open_count: cp.hs_email_open_count || null,
          hs_email_click_count: cp.hs_email_click_count || null,
          hubspot_score: cp.hubspot_score || null,
          first_tutorial_create_date: cp.first_tutorial_create_date || null,
          first_tutorial_view_date: cp.first_tutorial_view_date || null,
          first_tutorial_learn_date: cp.first_tutorial_learn_date || null,
          answers_with_own_tutorial_month_count: cp.answers_with_own_tutorial_month_count || null,
          answers_with_own_tutorial_previous_month_count: cp.answers_with_own_tutorial_previous_month_count || null,
          answers: cp.answers || null,
          extension_connections: cp.extension_connections || null,
          plan_name: cp.plan_name || null,
          account_type: cp.account_type || cp.account__type || null,
        },
      });
    }
    if (toInsert.length > 0) {
      const { error } = await supabase
        .from("contacts")
        .upsert(toInsert, {
          onConflict: "company_id,hubspot_object_id",
          ignoreDuplicates: true,
        });
      if (error) {
        console.warn(`phase2 upsert error: ${error.message}`);
      } else {
        inserted += toInsert.length;
      }
    }
  }
  return inserted;
}

// ── Phase-2: fetch contacts for companies with 0 contacts ─────────────────────
async function runPhase2(supabase: any, apiKey: string, jobId: string, snap: any) {
  const offset    = snap.phase2_offset ?? 0;
  const processed = snap.phase2_processed ?? 0;

  console.log(`pipeline phase2: offset=${offset}, processed so far=${processed}`);

  // Find companies with 0 contacts
  const { data: companies, error } = await supabase
    .from("companies")
    .select("id, name, hubspot_properties")
    .order("created_at", { ascending: false })
    .range(offset, offset + CONTACT_BATCH - 1);

  if (error) throw new Error(`phase2 query failed: ${error.message}`);

  // Filter to those with no contacts
  const noContactCompanies: any[] = [];
  for (const c of companies || []) {
    const { count } = await supabase
      .from("contacts").select("id", { count: "exact", head: true })
      .eq("company_id", c.id);
    if ((count ?? 0) === 0) noContactCompanies.push(c);
  }

  let contactsImported = 0;
  let failed = 0;
  for (const company of noContactCompanies) {
    const hsProps = (company.hubspot_properties as any) || {};
    const hubspotId = hsProps.hs_object_id || hsProps.id;
    if (!hubspotId) {
      console.warn(`phase2: no HubSpot ID for company ${company.name}`);
      continue;
    }
    try {
      const n = await importContactsForCompany(supabase, String(hubspotId), company.id, apiKey);
      if (n > 0) {
        contactsImported += n;
      }
    } catch (e: any) {
      console.error(`phase2: contacts failed for ${company.name}: ${e.message}`);
      failed++;
    }
  }

  const hasMore = (companies?.length || 0) === CONTACT_BATCH;
  const newOffset = offset + CONTACT_BATCH;
  const newProcessed = processed + noContactCompanies.length;
  const newSnap = {
    ...snap,
    phase: 2,
    phase2_offset: newOffset,
    phase2_processed: newProcessed,
    phase2_contacts_imported: (snap.phase2_contacts_imported ?? 0) + contactsImported,
    phase2_failed: (snap.phase2_failed ?? 0) + failed,
  };

  await supabase.from("processing_jobs").update({
    settings_snapshot: newSnap,
  }).eq("id", jobId);

  if (hasMore) {
    chainSelf(jobId);
    console.log(`pipeline phase2: chaining next batch, offset=${newOffset}`);
  } else {
    // Phase 2 complete — transition to Phase 3
    console.log(`pipeline phase2: DONE — checked ${newProcessed} companies, imported ${newSnap.phase2_contacts_imported} contacts. Starting phase 3.`);
    const phase3Snap = { ...newSnap, phase: 3, phase3_offset: 0, phase3_scored: 0, phase3_failed: 0 };
    await supabase.from("processing_jobs").update({ settings_snapshot: phase3Snap }).eq("id", jobId);
    chainSelf(jobId);
  }
}

// ── Scoring helpers (adapted from score-companies) ────────────────────────────
interface ScoreBreakdown {
  tutorial: number; commercial: number; recency: number; intent: number;
  expansion_signal: boolean; expansion_bonus: number; top_plan: string | null; total: number;
}

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

function calculateScoutScore(company: any, contacts: any[]): ScoreBreakdown {
  const now = Date.now();
  const DAY = 86_400_000;

  let tutorial = 0;
  const creators = contacts.filter(c => !!(c.hubspot_properties as any)?.first_tutorial_create_date);
  if (creators.length > 0) {
    tutorial += 20;
    const mostRecent = creators
      .map(c => { const d = (c.hubspot_properties as any)?.first_tutorial_create_date; return d ? new Date(d).getTime() : 0; })
      .filter(Boolean).sort((a, b) => b - a)[0];
    if (mostRecent && (now - mostRecent) <= 14 * DAY) tutorial += 15;
    tutorial += Math.min(creators.length - 1, 4) * 5;
  }
  if (contacts.some(c => { const d = (c.hubspot_properties as any)?.first_tutorial_view_date; return d && (now - new Date(d).getTime()) <= 30 * DAY; })) tutorial += 8;
  if (contacts.some(c => parseInt((c.hubspot_properties as any)?.answers_with_own_tutorial_month_count || "0", 10) > 0)) tutorial += 7;
  if (contacts.some(c => parseInt((c.hubspot_properties as any)?.extension_connections || "0", 10) > 0)) tutorial += 5;

  let commercial = 0;
  const lifecycle_stage = company.lifecycle_stage || "prospect";
  const sales_motion = company.sales_motion || "new-logo";
  if (lifecycle_stage === "customer" && sales_motion === "expansion") commercial = 20;
  else if (lifecycle_stage === "customer") commercial = 15;
  else if (lifecycle_stage === "opportunity") commercial = 10;
  else if (lifecycle_stage === "prospect" && company.is_existing_customer) commercial = 5;

  let recency = 0;
  const lastContacted = contacts
    .map(c => { const d = (c.hubspot_properties as any)?.hs_last_contacted; return d ? new Date(d).getTime() : 0; })
    .filter(Boolean).sort((a, b) => b - a)[0];
  if (lastContacted) {
    const daysAgo = (now - lastContacted) / DAY;
    if (daysAgo <= 7) recency = 15;
    else if (daysAgo <= 30) recency = 10;
    else if (daysAgo <= 90) recency = 5;
  }

  let intent = 0;
  const totalOpens   = contacts.reduce((s, c) => s + parseInt((c.hubspot_properties as any)?.hs_email_open_count  || "0", 10), 0);
  const totalClicks  = contacts.reduce((s, c) => s + parseInt((c.hubspot_properties as any)?.hs_email_click_count || "0", 10), 0);
  const totalAnswers = contacts.reduce((s, c) => s + parseInt((c.hubspot_properties as any)?.answers              || "0", 10), 0);
  if (totalOpens  > 10) intent += 5;
  if (totalClicks  > 3) intent += 5;
  if (totalAnswers > 0) intent += 5;

  // ── iorad Plan derivation ────────────────────────────────────────────────
  const planValues = contacts
    .map((c: any) => normalizePlan((c.hubspot_properties as any)?.plan_name || null))
    .filter(Boolean) as string[];
  const topPlan = planValues.length > 0
    ? planValues.reduce((best, cur) =>
        (PLAN_TIER[cur.toLowerCase()] || 0) > (PLAN_TIER[best.toLowerCase()] || 0) ? cur : best
      )
    : null;

  // ── Expansion Signal (max 20 bonus) ──────────────────────────────────────
  const hasPaidContact = contacts.some((c: any) => {
    const plan = normalizePlan((c.hubspot_properties as any)?.plan_name || null);
    return plan !== null && PAID_PLANS.includes(plan.toLowerCase());
  });
  const hasFreeCreator = contacts.some((c: any) => {
    const hp = (c.hubspot_properties as any) || {};
    const plan = normalizePlan(hp.plan_name || null);
    if (plan?.toLowerCase() !== "free") return false;

    // Active this month — strongest signal
    const monthlyAnswers = parseInt(hp.answers_with_own_tutorial_month_count || "0", 10);
    if (monthlyAnswers > 0) return true;

    // Created a tutorial within 90 days — still warm
    const createDate = hp.first_tutorial_create_date;
    if (createDate && (now - new Date(createDate).getTime()) <= 90 * DAY) return true;

    return false;
  });
  const expansion_signal = hasPaidContact && hasFreeCreator;
  const expansion_bonus = expansion_signal ? 20 : 0;

  const total = Math.min(100, Math.min(tutorial, 60) + Math.min(commercial, 25) + Math.min(recency, 15) + Math.min(intent, 15) + expansion_bonus);
  return { tutorial: Math.min(tutorial, 60), commercial: Math.min(commercial, 25), recency: Math.min(recency, 15), intent: Math.min(intent, 15), expansion_signal, expansion_bonus, top_plan: topPlan, total };
}

async function scoreOneCompany(supabase: any, companyId: string): Promise<boolean> {
  const { data: company } = await supabase
    .from("companies").select("id, name, lifecycle_stage, sales_motion, iorad_plan, expansion_signal, expansion_signal_at, is_existing_customer, scout_score")
    .eq("id", companyId).maybeSingle();
  if (!company) return false;

  const { data: contacts = [] } = await supabase
    .from("contacts").select("id, hubspot_properties")
    .eq("company_id", companyId);
  if (!contacts || contacts.length === 0) return false;

  const breakdown = calculateScoutScore(company, contacts);
  await supabase.from("companies").update({
    scout_score: breakdown.total,
    scout_score_breakdown: breakdown,
    scout_scored_at: new Date().toISOString(),
    iorad_plan: breakdown.top_plan,
    expansion_signal: breakdown.expansion_signal,
    expansion_signal_at: breakdown.expansion_signal
      ? (company.expansion_signal_at || new Date().toISOString())
      : null,
  }).eq("id", companyId);

  return true;
}

// ── Phase-3: score companies (DB query, no touched_ids) ──────────────────────
async function runPhase3(supabase: any, jobId: string, snap: any) {
  const offset = snap.phase3_offset ?? 0;
  const totalScored = snap.phase3_scored ?? 0;

  // Query companies that need scoring: never scored, or scored before
  // this pipeline job started. Replaces the in-memory touched_ids approach.
  const { data: companies, error } = await supabase
    .from("companies")
    .select("id")
    .or("scout_scored_at.is.null,scout_scored_at.lt." + (snap.pipeline_started_at || new Date().toISOString()))
    .order("created_at", { ascending: false })
    .range(offset, offset + SCORE_BATCH - 1);

  if (error) throw new Error(`phase3 query failed: ${error.message}`);

  const slice = companies || [];
  console.log(`pipeline phase3: scoring ${slice.length} companies (offset=${offset})`);

  if (slice.length === 0) {
    // All done
    console.log(`pipeline: COMPLETE — ${snap.phase1_processed ?? 0} companies upserted, ${snap.phase2_contacts_imported ?? 0} contacts imported, ${totalScored} scored.`);
    await supabase.from("processing_jobs").update({
      status: "completed",
      finished_at: new Date().toISOString(),
      companies_succeeded: snap.phase1_processed ?? 0,
      companies_processed: snap.phase1_processed ?? 0,
      settings_snapshot: { ...snap, phase: "done" },
    }).eq("id", jobId);
    return;
  }

  let scored = 0;
  let failed = 0;

  for (const { id } of slice) {
    try {
      const ok = await scoreOneCompany(supabase, id);
      if (ok) scored++;
    } catch (e: any) {
      console.error(`phase3: score failed for ${id}: ${e.message}`);
      failed++;
    }
  }

  const newOffset = offset + SCORE_BATCH;
  const newScored = totalScored + scored;
  const hasMore = slice.length === SCORE_BATCH;

  const newSnap = {
    ...snap,
    phase: 3,
    phase3_offset: newOffset,
    phase3_scored: newScored,
    phase3_failed: (snap.phase3_failed ?? 0) + failed,
  };

  if (hasMore) {
    await supabase.from("processing_jobs").update({ settings_snapshot: newSnap }).eq("id", jobId);
    chainSelf(jobId);
    console.log(`pipeline phase3: chaining next batch, offset=${newOffset}`);
  } else {
    console.log(`pipeline: COMPLETE — ${snap.phase1_processed ?? 0} companies upserted, ${snap.phase2_contacts_imported ?? 0} contacts imported, ${newScored} scored.`);
    await supabase.from("processing_jobs").update({
      status: "completed",
      finished_at: new Date().toISOString(),
      companies_succeeded: snap.phase1_processed ?? 0,
      companies_processed: snap.phase1_processed ?? 0,
      settings_snapshot: { ...newSnap, phase: "done" },
    }).eq("id", jobId);
  }
}

// ── Main handler ──────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl    = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const apiKey         = Deno.env.get("HUBSPOT_API_KEY");
    if (!apiKey) throw new Error("HUBSPOT_API_KEY not configured");

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    let body: any = {};
    try { body = await req.json(); } catch { /* ignore */ }

    let jobId = body.job_id || null;

    // ── First call: create the job record ────────────────────────────────────
    if (!jobId) {
      const initSnap = {
        phase: 1,
        phase1_cursor: null,
        phase1_processed: 0,
        pipeline_started_at: new Date().toISOString(),
      };
      const { data: job, error: jobErr } = await supabase
        .from("processing_jobs")
        .insert({
          trigger : "hubspot_pipeline",
          status  : "running",
          settings_snapshot: initSnap,
          total_companies_targeted: 0,
        })
        .select("id")
        .single();
      if (jobErr) throw new Error(`Failed to create job: ${jobErr.message}`);
      jobId = job.id;
      console.log(`pipeline: started job ${jobId}`);
    }

    // ── ALWAYS read snapshot from DB — single source of truth ──────────────
    const { data: jobRow, error: jobReadErr } = await supabase
      .from("processing_jobs")
      .select("status, settings_snapshot")
      .eq("id", jobId)
      .single();

    if (jobReadErr || !jobRow) {
      throw new Error(`Failed to read job ${jobId}: ${jobReadErr?.message || "not found"}`);
    }

    // Check for cancellation
    if (jobRow.status === "canceled" || jobRow.status === "failed") {
      console.log(`pipeline: job ${jobId} is ${jobRow.status} — stopping.`);
      return new Response(
        JSON.stringify({ status: "stopped", reason: jobRow.status, job_id: jobId }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const snap  = (jobRow.settings_snapshot as any) ?? {};
    const phase = snap.phase ?? 1;

    console.log(`pipeline: job=${jobId} phase=${phase}`);

    if (phase === 1)             await runPhase1(supabase, apiKey, jobId, snap);
    else if (phase === 2)        await runPhase2(supabase, apiKey, jobId, snap);
    else if (phase === 3)        await runPhase3(supabase, jobId, snap);

    return new Response(
      JSON.stringify({ status: "ok", job_id: jobId, phase }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("hubspot-pipeline error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
