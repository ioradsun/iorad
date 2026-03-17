import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

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

// hubspot-daily-sync: the master sync orchestrator
// Called by cron every hour. Runs in sequence:
//   1. sync_contacts (incremental from HubSpot)
//   2. score_recent (score companies updated in the window)
//   3. watch-signups (classify new signups)

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const body = await req.json().catch(() => ({}));
  const hoursBack = Math.max(1, Number(body.hours_back || 2));

  // Create sync_log row
  const { data: logRow } = await (supabase as any)
    .from("sync_log")
    .insert({ hours_back: hoursBack, status: "running" })
    .select("id")
    .single();
  const logId = logRow?.id || null;

  await logSyncEvent(supabase, {
    source: "daily_sync", job_id: logId,
    entity_type: "system", action: "job_start",
    meta: { hours_back: hoursBack },
  });

  const stats = {
    contacts_synced: 0,
    companies_scored: 0,
    signups_processed: 0,
    errors: [] as string[],
  };

  try {
    // ── Step 1: Incremental contact sync from HubSpot ──────────────────────
    const syncRes = await fetch(`${supabaseUrl}/functions/v1/import-from-hubspot`, {
      method: "POST",
      headers: { Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ action: "sync_contacts" }),
    });
    if (syncRes.ok) {
      const syncData = await syncRes.json();
      stats.contacts_synced = syncData.processed || 0;
    } else {
      stats.errors.push(`sync_contacts failed: ${syncRes.status}`);
    }

    // ── Step 2: Score companies touched by contact sync ────────────────────
    const scoreRes = await fetch(`${supabaseUrl}/functions/v1/score-companies`, {
      method: "POST",
      headers: { Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ action: "score_recent", hours_back: hoursBack }),
    });
    if (scoreRes.ok) {
      const scoreData = await scoreRes.json();
      stats.companies_scored = scoreData.scored || 0;
    } else {
      stats.errors.push(`scoring failed: ${scoreRes.status}`);
    }

    // ── Step 3: Watch signups ─────────────────────────────────────────────
    const watchRes = await fetch(`${supabaseUrl}/functions/v1/watch-signups`, {
      method: "POST",
      headers: { Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ hours_back: hoursBack }),
    });
    if (watchRes.ok) {
      const watchData = await watchRes.json();
      stats.signups_processed = watchData.signups_found || 0;
    } else {
      stats.errors.push(`watch-signups failed: ${watchRes.status}`);
    }

    // Complete
    if (logId) {
      await (supabase as any).from("sync_log").update({
        status: "completed",
        finished_at: new Date().toISOString(),
        contacts_found: stats.contacts_synced,
        companies_scored: stats.companies_scored,
        error_count: stats.errors.length,
        errors: stats.errors.slice(0, 50),
      }).eq("id", logId);
    }

    await logSyncEvent(supabase, {
      source: "daily_sync", job_id: logId,
      entity_type: "system", action: "job_complete",
      meta: stats,
    });

    return new Response(
      JSON.stringify({ success: true, log_id: logId, ...stats }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    console.error("hubspot-daily-sync error:", err);

    if (logId) {
      await (supabase as any).from("sync_log").update({
        status: "failed",
        finished_at: new Date().toISOString(),
        error_count: 1,
        errors: [err.message],
      }).eq("id", logId).catch(() => {});
    }

    await logSyncEvent(supabase, {
      source: "daily_sync", job_id: logId,
      entity_type: "system", action: "job_failed",
      meta: { error: err.message },
    });

    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
