import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
const MAX_CONTACTS_PER_RUN = 50; // Cap to stay within CPU limits

function normalizePlan(raw: string | null): string | null {
  if (!raw) return null;
  const l = raw.toLowerCase().trim();
  if (l.includes("enterprise")) return "Enterprise";
  if (l.includes("team")) return "Team";
  if (l.includes("free")) return "Free";
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

    // ── Step 1: Find recently created contacts in HubSpot (single page) ───
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
      return new Response(
        JSON.stringify({ success: true, signups_found: 0, message: "No new signups in window" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── Step 2: Batch-load company lookup data ────────────────────────────
    // Collect all HubSpot company IDs and email domains we need to resolve
    const hsCompanyIds = new Set<string>();
    const emailDomains = new Set<string>();

    for (const contact of newSignups) {
      const cp = contact.properties || {};
      if (cp.associatedcompanyid) hsCompanyIds.add(String(cp.associatedcompanyid));
      const email = cp.email || "";
      if (email.includes("@")) {
        const domain = email.split("@")[1];
        if (domain && !FREE_EMAIL_DOMAINS.includes(domain)) emailDomains.add(domain);
      }
    }

    // Load companies by domain (batch)
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

    // Load companies by hubspot hs_object_id (batch) — stored in hubspot_properties jsonb
    const companyByHsId: Record<string, { id: string; expansion_signal_at: string | null }> = {};
    if (hsCompanyIds.size > 0) {
      // Companies table doesn't have hubspot_object_id column, so query all and filter
      // But limit to avoid huge scans — use domain match as primary, hs_id as fallback
      const { data: allCompanies } = await supabase
        .from("companies")
        .select("id, hubspot_properties, expansion_signal_at")
        .limit(1000);

      for (const c of allCompanies || []) {
        const hp = (c.hubspot_properties as any) || {};
        const hsId = String(hp.hs_object_id || "");
        if (hsId && hsCompanyIds.has(hsId)) {
          companyByHsId[hsId] = { id: c.id, expansion_signal_at: c.expansion_signal_at };
        }
      }
    }

    // ── Step 3: Process each signup ───────────────────────────────────────
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    let pqlCount = 0;
    let expansionCount = 0;
    let watchlistCount = 0;
    let skipped = 0;
    const errors: string[] = [];

    // Batch: collect all contact upserts and company updates
    const contactUpserts: any[] = [];
    const companyUpdates: Map<string, any> = new Map();
    const companiesToScore: string[] = [];
    const companiesToBrief: string[] = [];

    // Pre-load contacts for companies we'll need to classify
    const companyIdsToClassify = new Set<string>();

    for (const contact of newSignups) {
      const cp = contact.properties || {};
      const name = [cp.firstname, cp.lastname].filter(Boolean).join(" ").trim();
      if (!name) { skipped++; continue; }

      const hsCompanyId = cp.associatedcompanyid ? String(cp.associatedcompanyid) : null;
      let companyId: string | null = null;
      let existingExpansionAt: string | null = null;

      if (hsCompanyId && companyByHsId[hsCompanyId]) {
        companyId = companyByHsId[hsCompanyId].id;
        existingExpansionAt = companyByHsId[hsCompanyId].expansion_signal_at;
      } else if (!hsCompanyId) {
        const email = cp.email || "";
        const domain = email.includes("@") ? email.split("@")[1] : null;
        if (domain && companyByDomain[domain]) {
          companyId = companyByDomain[domain];
        }
      } else {
        // Company not in DB — fire async import, skip
        fetch(`${supabaseUrl}/functions/v1/import-from-hubspot`, {
          method: "POST",
          headers: { Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ action: "import_company", hubspot_id: hsCompanyId }),
        }).catch(() => {});
        skipped++;
        continue;
      }

      if (!companyId) { skipped++; continue; }
      companyIdsToClassify.add(companyId);

      const hsObjectId = String(contact.id || cp.hs_object_id || "").trim() || null;
      contactUpserts.push({
        company_id: companyId,
        name,
        email: cp.email || null,
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
        _meta: { companyId, existingExpansionAt, contactName: name },
      });
    }

    // Batch upsert contacts (strip _meta first)
    if (contactUpserts.length > 0) {
      const toInsert = contactUpserts.map(({ _meta, ...rest }) => rest);

      // Upsert in chunks of 20 to avoid payload limits
      for (let i = 0; i < toInsert.length; i += 20) {
        const chunk = toInsert.slice(i, i + 20);
        // Try upsert by hubspot_object_id — for those without, just insert
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
      // Load in batches of 50 company IDs
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
      const { companyId, existingExpansionAt, contactName } = upsert._meta;
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
        updates.expansion_signal_at = existingExpansionAt || new Date().toISOString();
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

    return new Response(
      JSON.stringify({
        success: true,
        signups_found: newSignups.length,
        processed: contactUpserts.length,
        skipped,
        expansion: expansionCount,
        pql: pqlCount,
        watchlist: watchlistCount,
        errors: errors.slice(0, 10),
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
