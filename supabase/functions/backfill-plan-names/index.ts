import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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

const BATCH_SIZE = 100;
const PAGE_SIZE = 500;

let _lastHubSpotCall = 0;
const MIN_DELAY_MS = 110;

async function hubspotFetch(url: string, options?: RequestInit): Promise<Response> {
  const now = Date.now();
  const elapsed = now - _lastHubSpotCall;
  if (elapsed < MIN_DELAY_MS) {
    await new Promise((r) => setTimeout(r, MIN_DELAY_MS - elapsed));
  }
  _lastHubSpotCall = Date.now();
  return fetch(url, options);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  let activeLogId: string | null = null;

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const apiKey = Deno.env.get("HUBSPOT_API_KEY");
    if (!apiKey) throw new Error("HUBSPOT_API_KEY not configured");

    const body = await req.json().catch(() => ({}));
    const offset = Number(body.offset || 0);
    activeLogId = body.log_id || null;

    // First invocation — create the log row
    if (offset === 0) {
      const { count } = await supabase.from("contacts").select("id", { count: "exact", head: true });

      const { data: logRow } = await supabase
        .from("backfill_log")
        .insert({
          job_type: "plan_names",
          status: "running",
          contacts_total: count || 0,
        })
        .select("id")
        .single();

      activeLogId = logRow?.id || null;

      await logSyncEvent(supabase, {
        source: "backfill_plans", job_id: activeLogId, entity_type: "contact",
        action: "job_start", meta: { contacts_total: count || 0 },
      });
    }

    // Load a page of contacts (all), HubSpot ID can come from column OR hubspot_properties.hs_object_id
    const { data: contacts, error } = await supabase
      .from("contacts")
      .select("id, company_id, email, hubspot_object_id, hubspot_properties")
      .order("created_at", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) throw new Error(`DB query failed: ${error.message}`);

    if (!contacts || contacts.length === 0) {
      console.log("backfill-plan-names: all contacts processed, triggering score-companies");

      await logSyncEvent(supabase, {
        source: "backfill_plans", job_id: activeLogId, entity_type: "contact",
        action: "job_complete",
        meta: { total_processed: body.cumulative_processed, total_updated: body.cumulative_updated || 0 },
      });

      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

      fetch(`${supabaseUrl}/functions/v1/score-companies`, {
        method: "POST",
        headers: { Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ action: "score_all", offset: 0 }),
      }).catch((e) => console.warn("score trigger failed:", e.message));

      if (activeLogId) {
        const finalUpdate: Record<string, any> = {
          status: "completed",
          finished_at: new Date().toISOString(),
          current_offset: offset,
        };
        if (body.cumulative_processed != null) {
          finalUpdate.contacts_processed = body.cumulative_processed;
          finalUpdate.contacts_updated = body.cumulative_updated || 0;
          finalUpdate.contacts_skipped = body.cumulative_skipped || 0;
          finalUpdate.companies_rescored = body.cumulative_rescored || 0;
        }
        await supabase.from("backfill_log").update(finalUpdate).eq("id", activeLogId);
      }

      return new Response(
        JSON.stringify({ done: true, log_id: activeLogId, message: "All contacts processed. Scoring triggered." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Batch-read plan_name from HubSpot in chunks of 100 using derived HubSpot IDs and email fallback
    let updated = 0;
    let skipped = 0;
    const companyIdsToRescore = new Set<string>();

    for (let i = 0; i < contacts.length; i += BATCH_SIZE) {
      const batch = contacts.slice(i, i + BATCH_SIZE);
      const hsResultByContactId = new Map<string, { hsId: string; props: any }>();

      const withHsId = batch
        .map((c: any) => {
          const hsId = c.hubspot_object_id || (c.hubspot_properties as any)?.hs_object_id || null;
          return hsId ? { contactId: c.id, hsId: String(hsId) } : null;
        })
        .filter(Boolean) as Array<{ contactId: string; hsId: string }>;

      const withoutHsId = batch
        .map((c: any) => ({ contactId: c.id, email: c.email ? String(c.email).trim().toLowerCase() : null }))
        .filter((c: any) => c.email) as Array<{ contactId: string; email: string }>;

      // Strategy A: batch read by HubSpot object ID
      if (withHsId.length > 0) {
        const idToContact = new Map<string, string>();
        for (const item of withHsId) idToContact.set(item.hsId, item.contactId);

        const res = await hubspotFetch("https://api.hubapi.com/crm/v3/objects/contacts/batch/read", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            inputs: withHsId.map((i) => ({ id: i.hsId })),
            properties: ["plan_name", "account_type", "account__type"],
          }),
        });

        if (res.ok) {
          const data = await res.json();
          for (const result of data.results || []) {
            const hsId = String(result.id);
            const contactId = idToContact.get(hsId);
            if (contactId) {
              hsResultByContactId.set(contactId, { hsId, props: result.properties || {} });
            }
          }
        } else {
          const text = await res.text();
          console.warn(`HubSpot batch by ID failed (${res.status}): ${text.slice(0, 200)}`);
        }
      }

      // Strategy B: batch read by email for contacts still unmatched
      const unmatchedById = withoutHsId.filter((c) => !hsResultByContactId.has(c.contactId));
      if (unmatchedById.length > 0) {
        const emailToContact = new Map<string, string>();
        for (const item of unmatchedById) emailToContact.set(item.email, item.contactId);

        const res = await hubspotFetch("https://api.hubapi.com/crm/v3/objects/contacts/batch/read", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            idProperty: "email",
            inputs: unmatchedById.map((i) => ({ id: i.email })),
            properties: ["plan_name", "account_type", "account__type", "email"],
          }),
        });

        if (res.ok) {
          const data = await res.json();
          for (const result of data.results || []) {
            const props = result.properties || {};
            const email = String(props.email || "").trim().toLowerCase();
            if (!email) continue;
            const contactId = emailToContact.get(email);
            if (contactId) {
              hsResultByContactId.set(contactId, { hsId: String(result.id), props });
            }
          }
        } else {
          const text = await res.text();
          console.warn(`HubSpot batch by email failed (${res.status}): ${text.slice(0, 200)}`);
        }
      }

      for (const contact of batch as any[]) {
        const hs = hsResultByContactId.get(contact.id);
        if (!hs) {
          skipped++;
          continue;
        }

        const hsId = hs.hsId;
        const hsProps = hs.props || {};
        const planName = hsProps.plan_name || null;
        if (!planName) {
          skipped++;
          continue;
        }

        const existingProps = (contact.hubspot_properties as any) || {};
        const alreadyHasPlan = existingProps.plan_name === planName;
        if (alreadyHasPlan && contact.hubspot_object_id) {
          skipped++;
          continue;
        }

        const mergedProps = {
          ...existingProps,
          plan_name: planName,
          account_type: hsProps.account_type || hsProps.account__type || existingProps.account_type || null,
        };

        const { error: updateErr } = await supabase
          .from("contacts")
          .update({
            hubspot_properties: mergedProps,
            hubspot_object_id: contact.hubspot_object_id || String(hsId),
          })
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

    // Re-score affected companies
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    for (const companyId of companyIdsToRescore) {
      fetch(`${supabaseUrl}/functions/v1/score-companies`, {
        method: "POST",
        headers: { Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ action: "score_one", company_id: companyId }),
      }).catch((e) => console.warn(`Rescore ${companyId} failed:`, e.message));
    }

    const hasMore = contacts.length === PAGE_SIZE;
    const nextOffset = offset + PAGE_SIZE;

    const cumulativeUpdated = (body.cumulative_updated || 0) + updated;
    const cumulativeSkipped = (body.cumulative_skipped || 0) + skipped;
    const cumulativeRescored = (body.cumulative_rescored || 0) + companyIdsToRescore.size;
    const cumulativeProcessed = offset + contacts.length;

    if (activeLogId) {
      await supabase
        .from("backfill_log")
        .update({
          contacts_processed: cumulativeProcessed,
          contacts_updated: cumulativeUpdated,
          contacts_skipped: cumulativeSkipped,
          companies_rescored: cumulativeRescored,
          current_offset: offset,
          status: hasMore ? "running" : "completed",
          finished_at: hasMore ? null : new Date().toISOString(),
        })
        .eq("id", activeLogId);
    }

    // Emit heartbeat with resume payload before self-chaining
    if (hasMore && activeLogId) {
      await supabase.from("sync_events").insert({
        source: "backfill-plan-names",
        job_id: activeLogId,
        entity_type: "system",
        action: "heartbeat",
        entity_name: `Backfill: offset ${offset}, updated ${cumulativeUpdated}`,
        meta: {
          resume_function: "backfill-plan-names",
          resume_payload: {
            offset: nextOffset,
            log_id: activeLogId,
            cumulative_updated: cumulativeUpdated,
            cumulative_skipped: cumulativeSkipped,
            cumulative_rescored: cumulativeRescored,
            cumulative_processed: cumulativeProcessed,
          },
        },
      }).catch(e => console.warn("heartbeat insert failed:", e.message));
    }

    if (hasMore) {
      fetch(`${supabaseUrl}/functions/v1/backfill-plan-names`, {
        method: "POST",
        headers: { Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          offset: nextOffset,
          log_id: activeLogId,
          cumulative_updated: cumulativeUpdated,
          cumulative_skipped: cumulativeSkipped,
          cumulative_rescored: cumulativeRescored,
          cumulative_processed: cumulativeProcessed,
        }),
      }).catch((e) => console.warn("Self-chain failed:", e.message));
    }

    console.log(`backfill-plan-names: offset=${offset}, updated=${updated}, skipped=${skipped}, hasMore=${hasMore}`);

    return new Response(
      JSON.stringify({
        log_id: activeLogId,
        offset,
        updated,
        skipped,
        companies_rescoring: companyIdsToRescore.size,
        has_more: hasMore,
        next_offset: hasMore ? nextOffset : null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("backfill-plan-names error:", err.message);

    if (activeLogId) {
      try {
        const supabase = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        );
        await supabase
          .from("backfill_log")
          .update({
            status: "failed",
            error: err.message,
            finished_at: new Date().toISOString(),
          })
          .eq("id", activeLogId);
      } catch {
        // best effort
      }
    }

    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});