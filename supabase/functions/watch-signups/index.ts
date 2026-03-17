import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

let _lastHubSpotCall = 0;
const MIN_DELAY_MS = 110;

async function hubspotFetch(url: string, options?: RequestInit): Promise<Response> {
  const now = Date.now();
  const elapsed = now - _lastHubSpotCall;
  if (elapsed < MIN_DELAY_MS) await new Promise(r => setTimeout(r, MIN_DELAY_MS - elapsed));
  _lastHubSpotCall = Date.now();
  return fetch(url, options);
}

const CONTACT_PROPS = [
  "firstname", "lastname", "email", "jobtitle",
  "plan_name", "account_type", "account__type",
  "first_tutorial_create_date", "answers_with_own_tutorial_month_count",
  "extension_connections", "associatedcompanyid",
  "hs_object_id", "createdate", "hs_lastmodifieddate",
];

const FREE_EMAIL_DOMAINS = ["gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "aol.com", "icloud.com", "live.com"];
const PAID_PLANS = ["team", "enterprise"];
const DAY = 86_400_000;
const MAX_CONTACTS_PER_RUN = 50;

function normalizePlan(raw: string | null): string | null {
  if (!raw) return null;
  const l = raw.toLowerCase().trim();
  if (l.includes("enterprise")) return "Enterprise";
  if (l.includes("team")) return "Team";
  if (l.includes("free")) return "Free";
  return null;
}

// ── Fetch a HubSpot company by ID and create it in our DB ─────────────────
async function fetchAndCreateCompany(
  supabase: any,
  apiKey: string,
  hsCompanyId: string,
): Promise<{ id: string; name: string } | null> {
  try {
    const res = await hubspotFetch(
      "https://api.hubapi.com/crm/v3/objects/companies/batch/read",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inputs: [{ id: hsCompanyId }],
          properties: [
            "name", "domain", "industry", "country", "numberofemployees",
            "lifecyclestage", "hs_object_id", "createdate",
          ],
        }),
      },
    );

    if (!res.ok) {
      const text = await res.text();
      console.warn(`Failed to fetch HS company ${hsCompanyId}: ${res.status} ${text.slice(0, 100)}`);
      return null;
    }

    const data = await res.json();
    const hs = data.results?.[0];
    if (!hs) return null;

    const p = hs.properties || {};
    const name = (p.name || "").trim();
    if (!name || name.toLowerCase().startsWith("company ")) {
      console.log(`watch-signups: skipping placeholder company ${hsCompanyId}`);
      return null;
    }
    const domain = (p.domain || "").toLowerCase().replace(/^www\./, "").replace(/\/$/, "") || null;

    const JUNK_DOMAIN_PATTERNS = [
      /^gmai[^l]/, /^yaho[^o]/, /test\./, /^localhost/,
      /^\d+\./, /\.invalid$/, /\.test$/,
    ];
    if (domain && JUNK_DOMAIN_PATTERNS.some(rx => rx.test(domain))) {
      console.log(`watch-signups: skipping junk domain ${domain}`);
      return null;
    }

    const headcount = parseInt(p.numberofemployees || "0", 10) || null;

    // Determine if this is a school/edu
    const isEdu = domain && (/\.edu$|\.edu\.|\.k12\.|\.ac\./.test(domain));
    const accountType = isEdu ? "school" : "company";

    // Check if company already exists by domain
    if (domain) {
      const { data: existing } = await supabase
        .from("companies")
        .select("id, name")
        .eq("domain", domain)
        .limit(1)
        .maybeSingle();
      if (existing) {
        // Update hubspot_properties with hs_object_id for future lookups
        await supabase.from("companies").update({
          hubspot_properties: { hs_object_id: String(hs.id) },
        }).eq("id", existing.id);
        return existing;
      }
    }

    // Create the company
    const { data: newCompany, error } = await supabase
      .from("companies")
      .insert({
        name,
        domain,
        industry: p.industry || null,
        hq_country: p.country || null,
        headcount,
        account_type: accountType,
        hubspot_properties: { hs_object_id: String(hs.id) },
        source_type: "inbound",
        lifecycle_stage: "prospect",
        sales_motion: "new-logo",
        brief_type: "prospectBrief",
      })
      .select("id, name")
      .single();

    if (error) {
      console.warn(`Failed to insert company ${name}: ${error.message}`);
      return null;
    }

    console.log(`watch-signups: created company "${name}" (${newCompany.id}) from HS ${hsCompanyId}`);

    await logSyncEvent(supabase, {
      source: "watch_signups", entity_type: "company",
      entity_id: newCompany.id, entity_name: name,
      action: "created", meta: { hubspot_id: hsCompanyId },
    });

    return newCompany;
  } catch (err: any) {
    console.warn(`fetchAndCreateCompany error for ${hsCompanyId}: ${err.message}`);
    return null;
  }
}

// ── Resolve a contact's company — DB lookup first, then HubSpot fetch ─────
async function resolveCompany(
  supabase: any,
  apiKey: string,
  hsCompanyId: string | null,
  email: string | null,
  companyByDomain: Record<string, string>,
): Promise<string | null> {
  // 1. Try domain match from email
  if (email?.includes("@")) {
    const domain = email.split("@")[1];
    if (domain && !FREE_EMAIL_DOMAINS.includes(domain) && companyByDomain[domain]) {
      return companyByDomain[domain];
    }
  }

  // 2. Try DB lookup by hubspot_properties->hs_object_id
  if (hsCompanyId) {
    // Targeted query instead of loading all companies
    const { data: matches } = await supabase
      .from("companies")
      .select("id")
      .contains("hubspot_properties", { hs_object_id: hsCompanyId })
      .limit(1);

    if (matches && matches.length > 0) return matches[0].id;

    // 3. Not in DB — fetch from HubSpot and create
    const created = await fetchAndCreateCompany(supabase, apiKey, hsCompanyId);
    if (created) {
      // Also try domain match for future contacts
      return created.id;
    }
  }

  // 4. Try domain match by creating company from email domain
  if (email?.includes("@")) {
    const domain = email.split("@")[1];
    if (domain && !FREE_EMAIL_DOMAINS.includes(domain)) {
      // Check DB by domain
      const { data: domainMatch } = await supabase
        .from("companies")
        .select("id")
        .eq("domain", domain)
        .limit(1)
        .maybeSingle();
      if (domainMatch) {
        companyByDomain[domain] = domainMatch.id;
        return domainMatch.id;
      }
    }
  }

  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const apiKey = Deno.env.get("HUBSPOT_API_KEY");
    if (!apiKey) throw new Error("HUBSPOT_API_KEY not configured");

    const body = await req.json().catch(() => ({}));
    const hoursBack = Number(body.hours_back || 2);
    const since = new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString();

    console.log(`watch-signups: looking for new contacts since ${since}`);

    await logSyncEvent(supabase, {
      source: "watch_signups", entity_type: "contact",
      action: "job_start", meta: { hours_back: hoursBack },
    });

    // ── Step 1: Find recently created contacts in HubSpot ─────────────────
    const searchBody: any = {
      filterGroups: [{
        filters: [{
          propertyName: "createdate",
          operator: "GTE",
          value: since,
        }],
      }],
      properties: CONTACT_PROPS,
      limit: MAX_CONTACTS_PER_RUN,
      sorts: [{ propertyName: "createdate", direction: "DESCENDING" }],
    };

    const res = await hubspotFetch(
      "https://api.hubapi.com/crm/v3/objects/contacts/search",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(searchBody),
      },
    );

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`HubSpot search failed [${res.status}]: ${text.slice(0, 200)}`);
    }

    const data = await res.json();
    const newSignups = (data.results || []).slice(0, MAX_CONTACTS_PER_RUN);

    console.log(`watch-signups: found ${newSignups.length} new contacts`);

    if (newSignups.length === 0) {
      await logSyncEvent(supabase, {
        source: "watch_signups", entity_type: "contact",
        action: "job_complete", meta: { signups_found: 0 },
      });
      return new Response(
        JSON.stringify({ success: true, signups_found: 0, message: "No new signups in window" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── Step 2: Batch-load company lookup data by domain ──────────────────
    const emailDomains = new Set<string>();
    for (const contact of newSignups) {
      const email = (contact.properties || {}).email || "";
      if (email.includes("@")) {
        const domain = email.split("@")[1];
        if (domain && !FREE_EMAIL_DOMAINS.includes(domain)) emailDomains.add(domain);
      }
    }

    const companyByDomain: Record<string, string> = {};
    if (emailDomains.size > 0) {
      const { data: domainCompanies } = await supabase
        .from("companies")
        .select("id, domain")
        .in("domain", [...emailDomains]);
      for (const c of domainCompanies || []) {
        if (c.domain) companyByDomain[c.domain] = c.id;
      }
    }

    // ── Step 3: Process each signup ───────────────────────────────────────
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    let pqlCount = 0;
    let expansionCount = 0;
    let watchlistCount = 0;
    let skipped = 0;
    let companiesCreated = 0;

    const contactUpserts: any[] = [];
    const companyUpdates: Map<string, any> = new Map();
    const companiesToScore: string[] = [];
    const companiesToBrief: string[] = [];
    const companyIdsToClassify = new Set<string>();

    for (const contact of newSignups) {
      const cp = contact.properties || {};
      const name = [cp.firstname, cp.lastname].filter(Boolean).join(" ").trim();
      if (!name) { skipped++; continue; }

      const hsCompanyId = cp.associatedcompanyid ? String(cp.associatedcompanyid) : null;
      const email = cp.email || null;

      // Resolve company — will create from HubSpot if needed
      const companyId = await resolveCompany(supabase, apiKey, hsCompanyId, email, companyByDomain);

      if (!companyId) {
        console.log(`watch-signups: skipping "${name}" — no company resolved (hs=${hsCompanyId}, email=${email})`);
        skipped++;
        continue;
      }

      companyIdsToClassify.add(companyId);

      const hsObjectId = String(contact.id || cp.hs_object_id || "").trim() || null;
      contactUpserts.push({
        company_id: companyId,
        name,
        email,
        title: cp.jobtitle || null,
        source: "hubspot",
        hubspot_object_id: hsObjectId,
        hubspot_properties: {
          plan_name: cp.plan_name || null,
          account_type: cp.account_type || cp.account__type || null,
          first_tutorial_create_date: cp.first_tutorial_create_date || null,
          answers_with_own_tutorial_month_count: cp.answers_with_own_tutorial_month_count || null,
          extension_connections: cp.extension_connections || null,
          hs_object_id: hsObjectId,
        },
        _meta: { companyId, contactName: name },
      });
    }

    // Batch upsert contacts
    if (contactUpserts.length > 0) {
      const toInsert = contactUpserts.map(({ _meta, ...rest }) => rest);
      for (let i = 0; i < toInsert.length; i += 20) {
        const chunk = toInsert.slice(i, i + 20);
        const withHsId = chunk.filter(c => c.hubspot_object_id);
        const withoutHsId = chunk.filter(c => !c.hubspot_object_id);
        if (withHsId.length) {
          await supabase.from("contacts").upsert(withHsId, {
            onConflict: "company_id,hubspot_object_id",
            ignoreDuplicates: false,
          });
        }
        if (withoutHsId.length) {
          await supabase.from("contacts").insert(withoutHsId);
        }
      }
    }

    // Batch-load all contacts for classification
    const companyContactsMap: Record<string, any[]> = {};
    if (companyIdsToClassify.size > 0) {
      const ids = [...companyIdsToClassify];
      for (let i = 0; i < ids.length; i += 50) {
        const batch = ids.slice(i, i + 50);
        const { data: contacts } = await supabase
          .from("contacts")
          .select("company_id, hubspot_properties")
          .in("company_id", batch);
        for (const c of contacts || []) {
          if (!companyContactsMap[c.company_id]) companyContactsMap[c.company_id] = [];
          companyContactsMap[c.company_id].push(c);
        }
      }
    }

    // Classify each signup
    const now = Date.now();
    for (const upsert of contactUpserts) {
      const { companyId, contactName } = upsert._meta;
      const companyContacts = companyContactsMap[companyId] || [];

      const hasPaidContact = companyContacts.some((c: any) => {
        const plan = normalizePlan((c.hubspot_properties as any)?.plan_name || null);
        return plan !== null && PAID_PLANS.includes(plan.toLowerCase());
      });

      const hasFreeActiveCreator = companyContacts.some((c: any) => {
        const hp = (c.hubspot_properties as any) || {};
        const plan = normalizePlan(hp.plan_name || null);
        if (plan?.toLowerCase() !== "free") return false;
        const monthlyAnswers = parseInt(hp.answers_with_own_tutorial_month_count || "0", 10);
        if (monthlyAnswers > 0) return true;
        const createDate = hp.first_tutorial_create_date;
        if (createDate && (now - new Date(createDate).getTime()) <= 90 * DAY) return true;
        return false;
      });

      const isExpansion = hasPaidContact && hasFreeActiveCreator;
      const isPQL = !hasPaidContact && hasFreeActiveCreator;

      const updates: Record<string, any> = {
        last_sync_changes: {
          changed_at: new Date().toISOString(),
          trigger: isExpansion ? "expansion_signal" : isPQL ? "pql_signal" : "new_signup",
          new_contact: contactName,
          fields: {},
          activity: {},
        },
      };

      if (isExpansion) {
        expansionCount++;
        updates.expansion_signal = true;
        updates.expansion_signal_at = new Date().toISOString();
        if (!companiesToScore.includes(companyId)) companiesToScore.push(companyId);
        if (!companiesToBrief.includes(companyId)) companiesToBrief.push(companyId);
        console.log(`watch-signups: EXPANSION — ${contactName} at ${companyId}`);
      } else if (isPQL) {
        pqlCount++;
        if (!companiesToScore.includes(companyId)) companiesToScore.push(companyId);
        console.log(`watch-signups: PQL — ${contactName} at ${companyId}`);
      } else {
        watchlistCount++;
      }

      companyUpdates.set(companyId, updates);

      await logSyncEvent(supabase, {
        source: "watch_signups", entity_type: "contact",
        entity_name: contactName,
        action: isExpansion ? "created" : isPQL ? "created" : "updated",
        meta: { company_id: companyId, signal: isExpansion ? "expansion" : isPQL ? "pql" : "watchlist" },
      });
    }

    // Batch update companies
    for (const [companyId, updates] of companyUpdates) {
      await supabase.from("companies").update(updates).eq("id", companyId);
    }

    // Fire async scoring/briefs (non-blocking)
    for (const cid of companiesToScore) {
      fetch(`${supabaseUrl}/functions/v1/score-companies`, {
        method: "POST",
        headers: { Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ action: "score_one", company_id: cid }),
      }).catch(() => {});
    }
    for (const cid of companiesToBrief) {
      fetch(`${supabaseUrl}/functions/v1/generate-cards`, {
        method: "POST",
        headers: { Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ company_id: cid, tab: "strategy", auto_triggered: true }),
      }).catch(() => {});
    }

    await logSyncEvent(supabase, {
      source: "watch_signups", entity_type: "contact",
      action: "job_complete",
      meta: {
        signups_found: newSignups.length,
        processed: contactUpserts.length,
        skipped,
        companies_created: companiesCreated,
        expansion: expansionCount,
        pql: pqlCount,
        watchlist: watchlistCount,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        signups_found: newSignups.length,
        processed: contactUpserts.length,
        skipped,
        companies_created: companiesCreated,
        expansion: expansionCount,
        pql: pqlCount,
        watchlist: watchlistCount,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("watch-signups error:", err.message);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
