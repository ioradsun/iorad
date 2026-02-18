import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

/**
 * backfill-hubspot
 * ─────────────────
 * Pages through ALL HubSpot companies and upserts any that are missing from
 * the local companies table.  Processes 20 companies per invocation then
 * immediately self-chains so we never hit the edge-function timeout.
 *
 * Triggered by:
 *   • pg_cron daily at 02:00 UTC  (catches anything webhooks missed)
 *   • Manual POST with {}          (one-time backfill)
 *   • Self-chain  { after: "…" }  (internal pagination)
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BATCH_SIZE = 20; // companies processed per invocation

// ── Fire-and-forget Scout scoring ────────────────────────────────────────────
function scoreCompanyAsync(companyId: string) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  fetch(`${supabaseUrl}/functions/v1/score-companies`, {
    method: "POST",
    headers: { Authorization: `Bearer ${serviceRoleKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ action: "score_one", company_id: companyId }),
  }).catch((err) => console.error(`score-companies error for ${companyId}:`, err.message));
}

// ── Self-chain: call ourselves with the next cursor ──────────────────────────
function chainNext(after: string, totalProcessed: number, totalSkipped: number, jobId: string | null) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  fetch(`${supabaseUrl}/functions/v1/backfill-hubspot`, {
    method: "POST",
    headers: { Authorization: `Bearer ${serviceRoleKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ after, total_processed: totalProcessed, total_skipped: totalSkipped, job_id: jobId }),
  }).catch((err) => console.error("chain error:", err.message));
}

// ── HubSpot helpers ──────────────────────────────────────────────────────────
async function getAllPropertyNames(apiKey: string): Promise<string[]> {
  try {
    const res = await fetch("https://api.hubapi.com/crm/v3/properties/companies", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results || []).map((p: any) => p.name).filter(Boolean);
  } catch {
    return [];
  }
}

// ── Import contacts for a company from HubSpot ───────────────────────────────
const CONTACT_PROPS = [
  "firstname", "lastname", "email", "jobtitle", "hs_linkedin_url",
  "hs_last_contacted", "num_contacted_notes", "hs_email_open_count",
  "hs_email_click_count", "hubspot_score",
  // iorad-specific activity fields
  "first_tutorial_create_date", "first_tutorial_view_date", "first_tutorial_learn_date",
  "answers_with_own_tutorial_month_count", "answers_with_own_tutorial_previous_month_count",
  "answers", "extension_connections",
];

async function importContactsForCompany(supabase: any, hubspotCompanyId: string | number, companyId: string, apiKey: string) {
  try {
    // Fetch associated contact IDs
    const assocRes = await fetch(
      `https://api.hubapi.com/crm/v3/objects/companies/${hubspotCompanyId}/associations/contacts?limit=500`,
      { headers: { Authorization: `Bearer ${apiKey}` } }
    );
    if (!assocRes.ok) return;
    const assocData = await assocRes.json();
    const contactIds: string[] = (assocData.results || []).map((r: any) => String(r.toObjectId || r.id)).filter(Boolean);
    if (contactIds.length === 0) return;

    console.log(`backfill: found ${contactIds.length} contacts for company ${hubspotCompanyId}`);

    // Batch-read contact details (100 per call)
    for (let i = 0; i < contactIds.length; i += 100) {
      const batch = contactIds.slice(i, i + 100);
      const batchRes = await fetch("https://api.hubapi.com/crm/v3/objects/contacts/batch/read", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ inputs: batch.map(id => ({ id })), properties: CONTACT_PROPS }),
      });
      if (!batchRes.ok) continue;
      const batchData = await batchRes.json();
      const contacts = batchData.results || [];

      const toInsert: any[] = [];
      for (const contact of contacts) {
        const cp = contact.properties || {};
        const name = [cp.firstname, cp.lastname].filter(Boolean).join(" ").trim();
        if (!name) continue;

        // Skip if already exists for this company+email
        if (cp.email) {
          const { data: existing } = await supabase
            .from("contacts")
            .select("id")
            .eq("company_id", companyId)
            .eq("email", cp.email)
            .maybeSingle();
          if (existing) continue;
        }

        toInsert.push({
          company_id: companyId,
          name,
          email: cp.email || null,
          title: cp.jobtitle || null,
          linkedin: cp.hs_linkedin_url || null,
          source: "hubspot",
          confidence: "high",
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
          },
        });
      }

      if (toInsert.length > 0) {
        const { error } = await supabase.from("contacts").insert(toInsert);
        if (error) console.warn(`Contact insert error for company ${companyId}: ${error.message}`);
        else console.log(`backfill: inserted ${toInsert.length} contacts for company ${companyId}`);
      }
    }
  } catch (err: any) {
    console.warn(`importContactsForCompany error for ${hubspotCompanyId}: ${err.message}`);
  }
}

async function listHubSpotPage(apiKey: string, after: string | null, properties: string): Promise<{ companies: any[]; nextAfter: string | null }> {
  const url = new URL("https://api.hubapi.com/crm/v3/objects/companies");
  url.searchParams.set("limit", String(BATCH_SIZE));
  url.searchParams.set("properties", properties);
  if (after) url.searchParams.set("after", after);

  const res = await fetch(url.toString(), {
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

// ── Minimal upsert (domain-based dedup) ─────────────────────────────────────
async function upsertCompany(supabase: any, hs: any): Promise<{ companyId: string; isNew: boolean }> {
  const p = hs.properties || {};
  const name: string = (p.name || "").trim() || `HubSpot-${hs.id}`;
  const domain: string | null = (p.domain || "").trim() || null;

  // Check for existing record by domain
  if (domain) {
    const { data: existing } = await supabase
      .from("companies")
      .select("id")
      .eq("domain", domain)
      .maybeSingle();
    if (existing) {
      // Update hubspot_properties and basic fields
      await supabase.from("companies").update({
        hubspot_properties: p,
        name,
        updated_at: new Date().toISOString(),
      }).eq("id", existing.id);
      return { companyId: existing.id, isNew: false };
    }
  }

  // Derive category
  const industry: string = (p.industry || "").toLowerCase();
  const domainLower = (domain || "").toLowerCase();
  const nameLower = name.toLowerCase();
  const schoolKeywords = ["university", "college", "school", "academy", "education", "institute", "district", "k12", "edu"];
  const isSchool =
    domainLower.includes(".edu") ||
    domainLower.includes(".k12.") ||
    domainLower.includes(".school") ||
    schoolKeywords.some((k) => nameLower.includes(k)) ||
    industry.includes("education") ||
    industry.includes("higher education");
  const category = isSchool ? "school" : "business";

  // Derive stage from lifecycle
  const lifecycle = (p.lifecyclestage || "").toLowerCase();
  let stage = "prospect";
  if (lifecycle === "customer") stage = "customer";
  else if (lifecycle === "opportunity" || lifecycle === "salesqualifiedlead") stage = "active_opp";

  const headcount = p.numberofemployees ? parseInt(p.numberofemployees, 10) || null : null;

  const { data: inserted, error } = await supabase
    .from("companies")
    .insert({
      name,
      domain,
      category,
      stage,
      source_type: "hubspot",
      industry: p.industry || null,
      hq_country: p.country || null,
      headcount,
      hubspot_properties: p,
    })
    .select("id")
    .single();

  if (error) throw new Error(`Insert failed: ${error.message}`);
  return { companyId: inserted.id, isNew: true };
}

// ── Main handler ─────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const apiKey = Deno.env.get("HUBSPOT_API_KEY");
    if (!apiKey) throw new Error("HUBSPOT_API_KEY not configured");

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    let body: any = {};
    try { body = await req.json(); } catch { /* ignore */ }

    const after: string | null = body.after ?? null;
    const totalProcessed: number = body.total_processed ?? 0;
    // job_id is passed along so all self-chain calls update the same job record
    let jobId: string | null = body.job_id ?? null;

    console.log(`backfill-hubspot: page after=${after ?? "start"}, total so far=${totalProcessed}`);

    // ── Create a processing_jobs record on the first call ─────────────────────
    if (!jobId) {
      const { data: job, error: jobErr } = await supabase
        .from("processing_jobs")
        .insert({
          trigger: "manual",
          status: "running",
          settings_snapshot: { type: "backfill", started: new Date().toISOString() },
          total_companies_targeted: 0,
        })
        .select("id")
        .single();
      if (jobErr) console.error("Failed to create job record:", jobErr.message);
      else jobId = job.id;
    }

    // Fetch property names
    const allProps = await getAllPropertyNames(apiKey);
    const properties = allProps.length > 0
      ? allProps.join(",")
      : "name,domain,industry,country,numberofemployees,lifecyclestage";

    const { companies, nextAfter } = await listHubSpotPage(apiKey, after, properties);

    let imported = 0;
    let skipped = 0;

    for (const hs of companies) {
      try {
        const { companyId, isNew } = await upsertCompany(supabase, hs);
        // Always import contacts — even for existing companies, contacts may be new
        await importContactsForCompany(supabase, hs.id, companyId, apiKey);
        imported++;
        if (isNew) {
          scoreCompanyAsync(companyId);
        } else {
          // Re-score existing companies now that contacts may have been added
          scoreCompanyAsync(companyId);
        }
      } catch (err: any) {
        console.error(`Failed to upsert company ${hs.id}:`, err.message);
        skipped++;
      }
    }

    const newTotal = totalProcessed + imported;
    const newSkipped = (body.total_skipped ?? 0) + skipped;
    console.log(`backfill-hubspot: imported=${imported} skipped=${skipped} total=${newTotal} nextAfter=${nextAfter ?? "done"}`);

    // ── Update job record with latest progress ────────────────────────────────
    if (jobId) {
      await supabase.from("processing_jobs").update({
        companies_processed: newTotal,
        companies_succeeded: newTotal,
        companies_failed: newSkipped,
        ...(nextAfter ? {} : { status: "completed", finished_at: new Date().toISOString() }),
      }).eq("id", jobId);
    }

    // Self-chain if there are more pages
    if (nextAfter) {
      chainNext(nextAfter, newTotal, newSkipped, jobId);
      return new Response(
        JSON.stringify({ status: "chaining", imported, skipped, total_so_far: newTotal, next_after: nextAfter }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`backfill-hubspot: COMPLETE — total companies processed: ${newTotal}`);
    return new Response(
      JSON.stringify({ status: "complete", total_processed: newTotal, skipped: newSkipped }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("backfill-hubspot error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
