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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const startedAt = Date.now();
  let logId: string | null = null;

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json().catch(() => ({}));
    const hoursBack = Math.max(1, Number(body?.hours_back || 24));

    const { data: logRow } = await (supabase as any)
      .from("sync_log")
      .insert({ hours_back: hoursBack, status: "running" })
      .select("id")
      .single();
    logId = logRow?.id || null;

    const since = new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString();

    const stats = {
      companies_created: 0,
      companies_updated: 0,
      contacts_created: 0,
      contacts_updated: 0,
      companies_scored: 0,
      errors: [] as string[],
    };

    const { data: hsContacts } = await supabase
      .from("contacts")
      .select("id, name, email, title, company_id, hubspot_object_id, hubspot_properties, updated_at, created_at")
      .eq("source", "hubspot")
      .gte("updated_at", since)
      .limit(1000);

    const allContacts = hsContacts || [];

    const { data: companies } = await supabase
      .from("companies")
      .select("id, name, scout_score")
      .gte("updated_at", since)
      .limit(1000);

    const touchedCompanies = companies || [];
    stats.companies_updated = touchedCompanies.length;

    if (allContacts.length > 0) {
      const now = new Date().toISOString();
      const toInsert: any[] = [];
      const toUpdate: { id: string; data: any }[] = [];

      for (const c of allContacts) {
        const payload = {
          name: c.name,
          email: c.email,
          title: c.title,
          company_id: c.company_id,
          source: "hubspot",
          hubspot_object_id: c.hubspot_object_id,
          hubspot_properties: c.hubspot_properties || {},
          updated_at: now,
        };
        if (c.id) {
          toUpdate.push({ id: c.id, data: payload });
        } else {
          toInsert.push(payload);
        }
      }

      if (toInsert.length) {
        const { error } = await supabase.from("contacts").upsert(toInsert, {
          onConflict: "company_id,hubspot_object_id",
          ignoreDuplicates: false,
        });
        if (error) stats.errors.push(error.message);
        else stats.contacts_created += toInsert.length;
      }

      if (toUpdate.length) {
        await Promise.all(
          toUpdate.map(({ id, data }) => supabase.from("contacts").update(data).eq("id", id)),
        );
        stats.contacts_updated += toUpdate.length;
      }
    }

    const companyTouchAt = new Date().toISOString();
    for (const co of touchedCompanies) {
      const { error } = await supabase.from("companies").update({
        scout_synced_at: companyTouchAt,
        updated_at: companyTouchAt,
      }).eq("id", co.id);
      if (error) stats.errors.push(error.message);
      else stats.companies_scored += 1;
    }

    const hasMore = false;

    if (logId) {
      await (supabase as any).from("sync_log").update({
        finished_at: new Date().toISOString(),
        contacts_found: allContacts.length,
        companies_created: stats.companies_created,
        companies_updated: stats.companies_updated,
        contacts_created: stats.contacts_created,
        contacts_updated: stats.contacts_updated,
        companies_scored: stats.companies_scored,
        error_count: stats.errors.length,
        errors: stats.errors.slice(0, 50),
        has_more: hasMore,
        status: "completed",
      }).eq("id", logId);
    }

    // Persist sync result for the status page
    await (supabase as any).from("sync_checkpoints").upsert({
      key: "daily_sync_last_result",
      value: JSON.stringify({
        contacts_found: allContacts.length,
        companies_created: stats.companies_created,
        companies_updated: stats.companies_updated,
        contacts_created: stats.contacts_created,
        contacts_updated: stats.contacts_updated,
        companies_scored: stats.companies_scored,
        errors: stats.errors.length,
        has_more: hasMore,
        hours_back: hoursBack,
        at: new Date().toISOString(),
      }),
      updated_at: new Date().toISOString(),
    });

    const elapsed = Date.now() - startedAt;
    return new Response(JSON.stringify({
      success: true,
      log_id: logId,
      elapsed_ms: elapsed,
      contacts_found: allContacts.length,
      ...stats,
      has_more: hasMore,
      hours_back: hoursBack,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: any) {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    if (logId) {
      await (supabase as any).from("sync_log").update({
        finished_at: new Date().toISOString(),
        status: "failed",
        errors: [err.message],
        error_count: 1,
      }).eq("id", logId).catch(() => {});
    }

    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
