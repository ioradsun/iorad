import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BATCH_SIZE = 100;
const PAGE_SIZE  = 500;

let _lastHubSpotCall = 0;
const MIN_DELAY_MS = 110;

async function hubspotFetch(url: string, options?: RequestInit): Promise<Response> {
  const now = Date.now();
  const elapsed = now - _lastHubSpotCall;
  if (elapsed < MIN_DELAY_MS) {
    await new Promise(r => setTimeout(r, MIN_DELAY_MS - elapsed));
  }
  _lastHubSpotCall = Date.now();
  return fetch(url, options);
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
    const offset = Number(body.offset || 0);
    const jobId  = body.job_id || null;

    // ── Load a page of contacts that have a hubspot_object_id ────────────────
    const { data: contacts, error } = await supabase
      .from("contacts")
      .select("id, company_id, hubspot_object_id, hubspot_properties")
      .not("hubspot_object_id", "is", null)
      .order("created_at", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) throw new Error(`DB query failed: ${error.message}`);
    if (!contacts || contacts.length === 0) {
      console.log("backfill-plan-names: all contacts processed, triggering score-companies");
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      fetch(`${supabaseUrl}/functions/v1/score-companies`, {
        method: "POST",
        headers: { Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ action: "score_all", offset: 0 }),
      }).catch(e => console.warn("score trigger failed:", e.message));

      return new Response(
        JSON.stringify({ done: true, message: "All contacts processed. Scoring triggered." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Batch-read plan_name from HubSpot in chunks of 100 ──────────────────
    let updated = 0;
    let skipped = 0;
    const companyIdsToRescore = new Set<string>();

    for (let i = 0; i < contacts.length; i += BATCH_SIZE) {
      const batch = contacts.slice(i, i + BATCH_SIZE);
      const inputs = batch
        .map((c: any) => ({ id: String(c.hubspot_object_id) }))
        .filter((c: any) => c.id && c.id !== "null");

      if (inputs.length === 0) continue;

      const res = await hubspotFetch(
        "https://api.hubapi.com/crm/v3/objects/contacts/batch/read",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            inputs,
            properties: ["plan_name", "account_type", "account__type"],
          }),
        }
      );

      if (!res.ok) {
        const text = await res.text();
        console.warn(`HubSpot batch failed (${res.status}): ${text.slice(0, 200)}`);
        skipped += batch.length;
        continue;
      }

      const data = await res.json();
      const hsById = new Map<string, any>();
      for (const result of data.results || []) {
        hsById.set(String(result.id), result.properties || {});
      }

      for (const contact of batch) {
        const hsProps = hsById.get(String((contact as any).hubspot_object_id));
        if (!hsProps) { skipped++; continue; }

        const planName = hsProps.plan_name || null;
        if (!planName) { skipped++; continue; }

        const existingProps = (contact.hubspot_properties as any) || {};
        const alreadyHasPlan = existingProps.plan_name === planName;
        if (alreadyHasPlan) { skipped++; continue; }

        const mergedProps = {
          ...existingProps,
          plan_name: planName,
          account_type: hsProps.account_type || hsProps.account__type || existingProps.account_type || null,
        };

        const { error: updateErr } = await supabase
          .from("contacts")
          .update({ hubspot_properties: mergedProps })
          .eq("id", contact.id);

        if (updateErr) {
          console.warn(`Failed to update contact ${contact.id}: ${updateErr.message}`);
          skipped++;
        } else {
          updated++;
          if (contact.company_id) companyIdsToRescore.add(contact.company_id);
        }
      }
    }

    // ── Re-score affected companies ───────────────────────────────────────
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    for (const companyId of companyIdsToRescore) {
      fetch(`${supabaseUrl}/functions/v1/score-companies`, {
        method: "POST",
        headers: { Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ action: "score_one", company_id: companyId }),
      }).catch(e => console.warn(`Rescore ${companyId} failed:`, e.message));
    }

    const hasMore = contacts.length === PAGE_SIZE;
    const nextOffset = offset + PAGE_SIZE;

    if (hasMore) {
      fetch(`${supabaseUrl}/functions/v1/backfill-plan-names`, {
        method: "POST",
        headers: { Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ offset: nextOffset, job_id: jobId }),
      }).catch(e => console.warn("Self-chain failed:", e.message));
    }

    console.log(`backfill-plan-names: offset=${offset}, updated=${updated}, skipped=${skipped}, hasMore=${hasMore}`);

    return new Response(
      JSON.stringify({
        offset,
        updated,
        skipped,
        companies_rescoring: companyIdsToRescore.size,
        has_more: hasMore,
        next_offset: hasMore ? nextOffset : null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    console.error("backfill-plan-names error:", err.message);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
