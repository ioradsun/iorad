import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, X, Download, Zap, CheckCircle2 } from "lucide-react";

interface ActiveJob {
  id: string;
  trigger: string;
  status: string;
  companies_processed: number;
  companies_succeeded: number;
  companies_failed: number;
  total_companies_targeted: number;
  started_at: string;
}

type Phase = "importing" | "scoring" | "done";

function getPhase(job: ActiveJob): Phase {
  if (job.status === "completed") return "done";
  if (job.trigger === "bulk_import") return "importing";
  return "scoring";
}

export default function ImportStatusBanner() {
  const [job, setJob] = useState<ActiveJob | null>(null);
  const [dismissed, setDismissed] = useState<string | null>(null); // job id that was dismissed

  // Poll every 4 seconds for active jobs
  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;

    const fetchJob = async () => {
      const { data } = await supabase
        .from("processing_jobs")
        .select("id, trigger, status, companies_processed, companies_succeeded, companies_failed, total_companies_targeted, started_at")
        .in("trigger", ["bulk_import", "score_all"])
        .in("status", ["running", "queued", "completed"])
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!data) { setJob(null); return; }

      // Auto-dismiss completed job after 8 seconds
      if (data.status === "completed" && data.id !== dismissed) {
        setJob(data as ActiveJob);
        setTimeout(() => {
          setJob(prev => prev?.id === data.id ? null : prev);
        }, 8000);
      } else if (data.status !== "completed") {
        setJob(data as ActiveJob);
      }
    };

    fetchJob();
    timer = setInterval(fetchJob, 4000);
    return () => clearInterval(timer);
  }, [dismissed]);

  if (!job || job.id === dismissed) return null;

  const phase = getPhase(job);
  const processed = job.companies_processed || 0;
  const total = job.total_companies_targeted || 0;
  const failed = job.companies_failed || 0;
  const pct = total > 0 ? Math.round((processed / total) * 100) : null;

  // Elapsed time
  const elapsed = Math.round((Date.now() - new Date(job.started_at).getTime()) / 1000);
  const elapsedStr = elapsed < 60 ? `${elapsed}s` : `${Math.floor(elapsed / 60)}m ${elapsed % 60}s`;

  const isDone = phase === "done";

  return (
    <div
      className="rounded-lg border px-4 py-3 flex items-center gap-3 text-sm transition-all"
      style={{
        background: isDone
          ? "hsl(var(--success) / 0.08)"
          : "hsl(var(--primary) / 0.06)",
        borderColor: isDone
          ? "hsl(var(--success) / 0.25)"
          : "hsl(var(--primary) / 0.2)",
      }}
    >
      {/* Icon */}
      <div className="shrink-0">
        {isDone ? (
          <CheckCircle2 className="w-4 h-4 text-success" />
        ) : phase === "importing" ? (
          <Download className="w-4 h-4 text-primary animate-pulse" />
        ) : (
          <Zap className="w-4 h-4 text-primary animate-pulse" />
        )}
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-foreground">
            {isDone
              ? "Import complete"
              : phase === "importing"
              ? "Importing from HubSpot…"
              : "Calculating Scout Scores…"}
          </span>
          {!isDone && (
            <span className="text-xs text-muted-foreground font-mono">
              {elapsed > 0 && `${elapsedStr} elapsed`}
            </span>
          )}
        </div>

        {/* Progress line */}
        <div className="flex items-center gap-2 mt-1">
          {total > 0 ? (
            <>
              {/* Progress bar */}
              <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden max-w-[200px]">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${pct ?? 0}%`,
                    background: isDone
                      ? "hsl(var(--success))"
                      : "hsl(var(--primary))",
                  }}
                />
              </div>
              <span className="text-xs text-muted-foreground tabular-nums">
                {processed}/{total}
                {failed > 0 && <span className="text-destructive ml-1">({failed} err)</span>}
              </span>
            </>
          ) : (
            <div className="flex items-center gap-1.5">
              {!isDone && <Loader2 className="w-3 h-3 animate-spin text-primary" />}
              <span className="text-xs text-muted-foreground">
                {isDone
                  ? `${processed} companies processed`
                  : "Starting — fetching first batch…"}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Dismiss */}
      <button
        onClick={() => { setDismissed(job.id); setJob(null); }}
        className="shrink-0 p-1 rounded hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Dismiss"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
