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

    // ── Step 1: Find recently created contacts in HubSpot ──────────────────
    let after: string | null = null;
    const newSignups: any[] = [];

    do {
      const searchBody: any = {
        filterGroups: [{
          filters: [{
            propertyName: "createdate",
            operator: "GTE",
            value: since,
          }],
        }],
        properties: CONTACT_PROPS,
        limit: 100,
        sorts: [{ propertyName: "createdate", direction: "DESCENDING" }],
      };
      if (after) searchBody.after = after;

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
        throw new Error(`HubSpot contact search failed [${res.status}]: ${text.slice(0, 200)}`);
      }

      const data = await res.json();
      newSignups.push(...(data.results || []));
      after = data.paging?.next?.after || null;
    } while (after && newSignups.length < 500);

    console.log(`watch-signups: found ${newSignups.length} new contacts`);

    if (newSignups.length === 0) {
      return new Response(
        JSON.stringify({ success: true, signups_found: 0, message: "No new signups in window" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── Step 2: For each signup, resolve their company and classify ────────
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    let pqlCount = 0;
    let expansionCount = 0;
    let watchlistCount = 0;
    const errors: string[] = [];

    for (const contact of newSignups) {
      try {
        const cp = contact.properties || {};
        const name = [cp.firstname, cp.lastname].filter(Boolean).join(" ").trim();
        if (!name) continue;

        const hsCompanyId = cp.associatedcompanyid || null;

        // ── Resolve company in our DB ──────────────────────────────────────
        let companyId: string | null = null;

        if (hsCompanyId) {
          // Look up by hubspot_properties->hs_object_id since companies don't have hubspot_object_id column
          const { data: allCompanies } = await supabase
            .from("companies")
            .select("id, hubspot_properties")
            .limit(1000);

          const match = (allCompanies || []).find((c: any) => {
            const hp = (c.hubspot_properties as any) || {};
            return String(hp.hs_object_id) === String(hsCompanyId);
          });

          if (match) {
            companyId = match.id;
          } else {
            // Company not in DB yet — trigger import, skip for now
            fetch(`${supabaseUrl}/functions/v1/import-from-hubspot`, {
              method: "POST",
              headers: { Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
              body: JSON.stringify({ action: "import_company", hubspot_id: hsCompanyId }),
            }).catch(e => console.warn("company import failed:", e.message));
            continue; // Will be picked up on next run
          }
        } else {
          // No associated company — try to match by email domain
          const email = cp.email || "";
          const domain = email.includes("@") ? email.split("@")[1] : null;
          if (!domain || FREE_EMAIL_DOMAINS.includes(domain)) continue;

          const { data: dbCompany } = await supabase
            .from("companies")
            .select("id")
            .eq("domain", domain)
            .maybeSingle();

          if (dbCompany) companyId = dbCompany.id;
          else continue;
        }

        if (!companyId) continue;

        // ── Upsert the contact into our DB ─────────────────────────────────
        const hsObjectId = String(contact.id || cp.hs_object_id || "").trim() || null;
        const contactPayload: any = {
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
        };

        // Try upsert by hubspot_object_id match
        if (hsObjectId) {
          const { data: existing } = await supabase
            .from("contacts")
            .select("id")
            .eq("hubspot_object_id", hsObjectId)
            .maybeSingle();

          if (existing) {
            await supabase.from("contacts").update(contactPayload).eq("id", existing.id);
          } else {
            await supabase.from("contacts").insert(contactPayload);
          }
        } else {
          await supabase.from("contacts").insert(contactPayload);
        }

        // ── Step 3: Classify the signup ────────────────────────────────────
        const { data: allContacts } = await supabase
          .from("contacts")
          .select("hubspot_properties")
          .eq("company_id", companyId);

        const companyContacts = allContacts || [];
        const now = Date.now();

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
            new_contact: name,
            fields: {},
            activity: {},
          },
        };

        if (isExpansion) {
          expansionCount++;
          updates.expansion_signal = true;
          // Preserve first-seen date
          const { data: co } = await supabase.from("companies").select("expansion_signal_at").eq("id", companyId).maybeSingle();
          updates.expansion_signal_at = co?.expansion_signal_at || new Date().toISOString();

          // Auto-trigger scoring + brief
          fetch(`${supabaseUrl}/functions/v1/score-companies`, {
            method: "POST",
            headers: { Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({ action: "score_one", company_id: companyId }),
          }).catch(e => console.warn("score failed:", e.message));

          fetch(`${supabaseUrl}/functions/v1/generate-cards`, {
            method: "POST",
            headers: { Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({ company_id: companyId, tab: "strategy", auto_triggered: true }),
          }).catch(e => console.warn("brief failed:", e.message));

          console.log(`watch-signups: EXPANSION — ${name} at company ${companyId}`);
        } else if (isPQL) {
          pqlCount++;
          fetch(`${supabaseUrl}/functions/v1/score-companies`, {
            method: "POST",
            headers: { Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({ action: "score_one", company_id: companyId }),
          }).catch(e => console.warn("score failed:", e.message));
          console.log(`watch-signups: PQL — ${name} at company ${companyId}`);
        } else {
          watchlistCount++;
          console.log(`watch-signups: WATCHLIST — ${name} at company ${companyId}`);
        }

        await supabase.from("companies").update(updates).eq("id", companyId);
      } catch (err: any) {
        console.warn(`watch-signups: error processing contact: ${err.message}`);
        errors.push(err.message);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        signups_found: newSignups.length,
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
