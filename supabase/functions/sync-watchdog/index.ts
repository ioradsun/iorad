import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const STALL_THRESHOLD_MS = 60_000; // 1 minute with no heartbeat = stalled
const MAX_RESTARTS_PER_JOB = 5;   // Give up after 5 restarts of the same job

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // ── Step 1: Find all job_start events from the last 24h ─────────────
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: jobStarts } = await supabase
      .from("sync_events")
      .select("job_id, source, created_at")
      .eq("action", "job_start")
      .gte("created_at", twentyFourHoursAgo)
      .not("job_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(50);

    if (!jobStarts || jobStarts.length === 0) {
      return new Response(
        JSON.stringify({ status: "ok", message: "No active jobs", restarted: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Deduplicate by job_id (take the most recent start)
    const uniqueJobs = new Map<string, { job_id: string; source: string }>();
    for (const js of jobStarts) {
      if (js.job_id && !uniqueJobs.has(js.job_id)) {
        uniqueJobs.set(js.job_id, { job_id: js.job_id, source: js.source });
      }
    }

    let restarted = 0;
    let skipped = 0;
    const actions: string[] = [];

    for (const [jobId, { source }] of uniqueJobs) {
      // ── Step 2: Check if this job already finished ──────────────────
      const { data: terminalEvents } = await supabase
        .from("sync_events")
        .select("id")
        .eq("job_id", jobId)
        .in("action", ["job_complete", "job_failed"])
        .limit(1);

      if (terminalEvents && terminalEvents.length > 0) continue;

      // ── Step 3: Check if the job is stalled ─────────────────────────
      const { data: lastEvents } = await supabase
        .from("sync_events")
        .select("id, created_at, action, meta, cursor_val")
        .eq("job_id", jobId)
        .order("created_at", { ascending: false })
        .limit(1);

      const lastEvent = lastEvents?.[0];
      if (!lastEvent) continue;

      const age = Date.now() - new Date(lastEvent.created_at).getTime();
      if (age < STALL_THRESHOLD_MS) continue; // Still active

      // ── Step 4: Find the last heartbeat with resume payload ─────────
      const { data: heartbeats } = await supabase
        .from("sync_events")
        .select("meta, cursor_val, created_at")
        .eq("job_id", jobId)
        .eq("action", "heartbeat")
        .order("created_at", { ascending: false })
        .limit(1);

      const lastHeartbeat = heartbeats?.[0];
      const resumeMeta = lastHeartbeat?.meta || lastEvent?.meta || {};
      const resumeFunction = resumeMeta.resume_function;
      const resumePayload = resumeMeta.resume_payload;

      if (!resumeFunction || !resumePayload) {
        await supabase.from("sync_events").insert({
          source: "watchdog",
          job_id: jobId,
          entity_type: "system",
          action: "error",
          entity_name: `Stalled job has no resume payload`,
          meta: { original_source: source, age_seconds: Math.floor(age / 1000) },
        });
        skipped++;
        continue;
      }

      // ── Step 5: Check restart count ─────────────────────────────────
      const { count: restartCount } = await supabase
        .from("sync_events")
        .select("id", { count: "exact", head: true })
        .eq("job_id", jobId)
        .eq("source", "watchdog")
        .eq("action", "restarted");

      if ((restartCount ?? 0) >= MAX_RESTARTS_PER_JOB) {
        await supabase.from("sync_events").insert({
          source: "watchdog",
          job_id: jobId,
          entity_type: "system",
          action: "job_failed",
          entity_name: `Gave up after ${MAX_RESTARTS_PER_JOB} restarts`,
          meta: { original_source: source, restart_count: restartCount },
        });
        skipped++;
        continue;
      }

      // ── Step 6: Fire the restart ────────────────────────────────────
      console.log(`watchdog: restarting ${resumeFunction} for job ${jobId} (stalled ${Math.floor(age / 1000)}s)`);

      const restartRes = await fetch(`${supabaseUrl}/functions/v1/${resumeFunction}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${serviceRoleKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(resumePayload),
      });

      const restartOk = restartRes.ok;

      await supabase.from("sync_events").insert({
        source: "watchdog",
        job_id: jobId,
        entity_type: "system",
        action: "restarted",
        entity_name: `Restarted ${resumeFunction} (stalled ${Math.floor(age / 1000)}s)`,
        meta: {
          original_source: source,
          resume_function: resumeFunction,
          resume_payload: resumePayload,
          restart_http_status: restartRes.status,
          restart_ok: restartOk,
          age_seconds: Math.floor(age / 1000),
          restart_number: (restartCount ?? 0) + 1,
        },
      });

      if (restartOk) {
        restarted++;
        actions.push(`Restarted ${resumeFunction} for job ${jobId}`);
      } else {
        const text = await restartRes.text().catch(() => "");
        console.error(`watchdog: restart failed for ${jobId}: ${restartRes.status} ${text.slice(0, 200)}`);
        actions.push(`Failed to restart ${resumeFunction} for job ${jobId}: ${restartRes.status}`);
      }
    }

    return new Response(
      JSON.stringify({ status: "ok", restarted, skipped, actions }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("sync-watchdog error:", err.message);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
