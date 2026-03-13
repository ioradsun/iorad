import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Loader2, CheckCircle2, XCircle, AlertCircle, Download, RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow, format } from "date-fns";
import { toast } from "sonner";

// ── Data ─────────────────────────────────────────────────────────────────────

function useRecentJobs() {
  return useQuery({
    queryKey: ["hubspot_sync_status"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("processing_jobs")
        .select("id, status, started_at, finished_at, companies_processed, companies_failed, settings_snapshot, trigger")
        .in("trigger", ["hubspot_pipeline", "manual", "hubspot_sync", "hubspot_backfill"])
        .order("started_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return (data || []) as any[];
    },
    refetchInterval: 10_000,
  });
}

// ── Stalled detection ────────────────────────────────────────────────────────
// Compare companies_processed across polls. If the count hasn't increased
// in 5 minutes, the job is stalled — regardless of how long it's been running.

function useStallDetection(job: any) {
  const lastProgress = useRef<{ count: number; at: number } | null>(null);
  const [isStalled, setIsStalled] = useState(false);

  useEffect(() => {
    if (!job || job.status !== "running") {
      lastProgress.current = null;
      setIsStalled(false);
      return;
    }

    const currentCount = job.companies_processed ?? 0;
    const now = Date.now();

    if (!lastProgress.current) {
      // First observation
      lastProgress.current = { count: currentCount, at: now };
      setIsStalled(false);
      return;
    }

    if (currentCount > lastProgress.current.count) {
      // Progress! Reset the clock.
      lastProgress.current = { count: currentCount, at: now };
      setIsStalled(false);
    } else {
      // No progress — check how long
      const stuckMs = now - lastProgress.current.at;
      setIsStalled(stuckMs > 5 * 60 * 1000); // 5 minutes
    }
  }, [job?.id, job?.status, job?.companies_processed]);

  return isStalled;
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function JobHistory() {
  const qc = useQueryClient();
  const { data: jobs = [], isLoading } = useRecentJobs();

  const activeJob = jobs.find((j: any) => j.status === "running") || null;
  const lastCompleted = jobs.find((j: any) => j.status === "completed") || null;
  const recentHistory = jobs.slice(0, 3);

  const isStalled = useStallDetection(activeJob);

  // Derive current phase from snapshot
  const snap = (activeJob?.settings_snapshot as any) ?? {};
  const phase = snap.phase ?? 0;
  const phaseLabel =
    phase === 1 ? "Syncing companies" :
    phase === 2 ? "Importing contacts" :
    phase === 3 ? "Scoring companies" :
    "Processing";
  const processed = activeJob?.companies_processed ?? 0;

  const runPipeline = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("hubspot-pipeline", { body: {} });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast.success("HubSpot sync started");
      qc.invalidateQueries({ queryKey: ["hubspot_sync_status"] });
    },
    onError: (err: any) => toast.error(`Sync failed: ${err?.message}`),
  });

  const cancelJob = useMutation({
    mutationFn: async (jobId: string) => {
      await supabase
        .from("processing_jobs")
        .update({ status: "canceled", finished_at: new Date().toISOString() })
        .eq("id", jobId);
    },
    onSuccess: () => {
      toast.success("Sync canceled");
      qc.invalidateQueries({ queryKey: ["hubspot_sync_status"] });
    },
  });

  const resumeJob = useMutation({
    mutationFn: async (jobId: string) => {
      const { error } = await supabase.functions.invoke("hubspot-pipeline", {
        body: { job_id: jobId },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Sync resumed");
      qc.invalidateQueries({ queryKey: ["hubspot_sync_status"] });
    },
    onError: (err: any) => toast.error(`Resume failed: ${err?.message}`),
  });

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto flex items-center justify-center py-32">
        <Loader2 className="w-5 h-5 animate-spin text-foreground/25" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-display font-semibold tracking-tight">HubSpot Sync</h1>
      </div>

      {/* ── Status card ───────────────────────────────────────────── */}
      <div className={`rounded-xl border p-6 space-y-4 ${
        isStalled
          ? "border-warning/40 bg-warning/[0.04]"
          : activeJob
          ? "border-primary/30 bg-primary/[0.03]"
          : "border-border bg-card"
      }`}>

        {/* Status headline */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {activeJob && !isStalled && (
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
            )}
            {activeJob && isStalled && (
              <AlertCircle className="w-5 h-5 text-warning" />
            )}
            {!activeJob && lastCompleted && (
              <CheckCircle2 className="w-5 h-5 text-success" />
            )}
            {!activeJob && !lastCompleted && (
              <Download className="w-5 h-5 text-foreground/25" />
            )}

            <div>
              <h2 className="text-title font-semibold">
                {isStalled
                  ? "Sync stalled"
                  : activeJob
                  ? phaseLabel
                  : lastCompleted
                  ? "In sync"
                  : "Not synced yet"}
              </h2>
              <p className="text-caption text-foreground/45 mt-0.5">
                {isStalled
                  ? "No progress in the last 5 minutes"
                  : activeJob
                  ? `${processed.toLocaleString()} companies processed`
                  : lastCompleted
                  ? `Last synced ${formatDistanceToNow(new Date(lastCompleted.finished_at!), { addSuffix: true })}`
                  : "Run a full sync to import companies and contacts from HubSpot"}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {activeJob && isStalled && (
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={() => resumeJob.mutate(activeJob.id)}
                disabled={resumeJob.isPending}
              >
                {resumeJob.isPending
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <RefreshCw className="w-3.5 h-3.5" />}
                Resume
              </Button>
            )}
            {activeJob && (
              <Button
                size="sm"
                variant={isStalled ? "destructive" : "outline"}
                className="gap-1.5"
                onClick={() => cancelJob.mutate(activeJob.id)}
                disabled={cancelJob.isPending}
              >
                Cancel
              </Button>
            )}
            {!activeJob && (
              <Button
                className="gap-1.5"
                onClick={() => runPipeline.mutate()}
                disabled={runPipeline.isPending}
              >
                {runPipeline.isPending
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <Download className="w-4 h-4" />}
                Run Full Sync
              </Button>
            )}
          </div>
        </div>

        {/* Progress bar — only while syncing */}
        {activeJob && !isStalled && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-micro text-foreground/25">
              <span>{phaseLabel}</span>
              <span>Phase {typeof phase === "number" ? phase : "?"} of 3</span>
            </div>
            <div className="h-1.5 rounded-full bg-foreground/[0.06] overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all duration-1000"
                style={{ width: `${Math.round(((typeof phase === "number" ? phase - 1 : 0) / 3) * 100)}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* ── Recent activity (compact) ─────────────────────────────── */}
      {recentHistory.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-caption text-foreground/45 font-medium">Recent activity</h3>
          {recentHistory.map((job: any) => {
            const isOk = job.status === "completed";
            const isRunning = job.status === "running";
            return (
              <div key={job.id} className="flex items-center gap-2 text-caption">
                {isOk && <CheckCircle2 className="w-3.5 h-3.5 text-success shrink-0" />}
                {isRunning && <Loader2 className="w-3.5 h-3.5 animate-spin text-primary shrink-0" />}
                {!isOk && !isRunning && <XCircle className="w-3.5 h-3.5 text-destructive shrink-0" />}
                <span className="text-foreground/45">
                  {format(new Date(job.started_at), "MMM d, h:mm a")}
                </span>
                <span className="text-foreground/65">
                  {job.companies_processed?.toLocaleString() ?? 0} companies
                  {job.companies_failed > 0 && ` · ${job.companies_failed} errors`}
                </span>
                {isOk && job.finished_at && (
                  <span className="ml-auto text-foreground/25">
                    {formatDistanceToNow(new Date(job.finished_at), { addSuffix: true })}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
