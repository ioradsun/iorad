import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CheckCircle2, XCircle, Clock, AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";

// How many companies have no story yet
function useMissingStoriesCount() {
  return useQuery({
    queryKey: ["missing_stories_count"],
    queryFn: async () => {
      const { data: cards } = await supabase.from("company_cards").select("company_id");
      const existingIds = new Set((cards || []).map((r: any) => r.company_id));
      const { count } = await supabase.from("companies").select("id", { count: "exact", head: true });
      return (count ?? 0) - existingIds.size;
    },
    refetchInterval: 10_000,
  });
}

// The single active running job (if any)
function useActiveRunningJob() {
  return useQuery({
    queryKey: ["active_running_job"],
    queryFn: async () => {
      const { data } = await supabase
        .from("processing_jobs")
        .select("*")
        .eq("status", "running")
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    refetchInterval: (q) => (q.state.data ? 5_000 : 10_000),
  });
}

// Recent completed/canceled runs
function useRecentJobs() {
  return useQuery({
    queryKey: ["recent_jobs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("processing_jobs")
        .select("*")
        .in("status", ["completed", "canceled", "failed"])
        .order("started_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data ?? [];
    },
  });
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true,
  });
}

function fmtDuration(start: string, end: string | null) {
  if (!end) return null;
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  const mins = Math.floor(ms / 60_000);
  const hrs = Math.floor(mins / 60);
  if (hrs > 0) return `${hrs}h ${mins % 60}m`;
  return `${mins}m`;
}

export default function JobHistory() {
  const { data: missingCount, isLoading: loadingCount } = useMissingStoriesCount();
  const { data: activeJob, isLoading: loadingActive } = useActiveRunningJob();
  const { data: recentJobs = [], isLoading: loadingRecent } = useRecentJobs();

  const isLoading = loadingCount || loadingActive || loadingRecent;

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Processing Status</h1>
        <p className="text-sm text-muted-foreground mt-1">Story generation progress</p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-6">

          {/* ── Missing stories count ── */}
          <div className="panel flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-muted-foreground">Companies without stories</div>
              <div className="text-3xl font-bold tracking-tight mt-0.5">
                {missingCount ?? "—"}
              </div>
            </div>
            <Link
              to="/settings?tab=processing"
              className="text-xs text-primary hover:underline underline-offset-2"
            >
              Generate stories →
            </Link>
          </div>

          {/* ── Active job ── */}
          {activeJob ? (
            <div className="panel space-y-3">
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                <span className="font-semibold text-sm">Running now</span>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>
                    <span className="text-foreground font-medium">{activeJob.companies_processed}</span>
                    {" / "}
                    <span className="text-foreground font-medium">{activeJob.total_companies_targeted}</span>
                    {" companies processed"}
                  </span>
                  <span>
                    {activeJob.companies_succeeded > 0 && (
                      <span className="text-primary">{activeJob.companies_succeeded} done</span>
                    )}
                    {activeJob.companies_failed > 0 && (
                      <span className="text-destructive ml-2">{activeJob.companies_failed} failed</span>
                    )}
                  </span>
                </div>
                <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: activeJob.total_companies_targeted > 0
                        ? `${Math.round((activeJob.companies_processed / activeJob.total_companies_targeted) * 100)}%`
                        : "0%",
                      background: "hsl(var(--primary))",
                    }}
                  />
                </div>
              </div>

              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Started {fmtDate(activeJob.started_at)}
              </div>
            </div>
          ) : (
            <div className="panel text-center py-8 text-muted-foreground text-sm">
              No active run. Start one from{" "}
              <Link to="/settings?tab=processing" className="text-primary hover:underline">
                Admin → Processing
              </Link>.
            </div>
          )}

          {/* ── Recent runs ── */}
          {recentJobs.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Recent Runs
              </div>
              <div className="panel divide-y divide-border/50">
                {recentJobs.map((job: any) => {
                  const duration = fmtDuration(job.started_at, job.finished_at);
                  const pct = job.total_companies_targeted > 0
                    ? Math.round((job.companies_succeeded / job.total_companies_targeted) * 100)
                    : 0;

                  return (
                    <div key={job.id} className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-2.5 min-w-0">
                        {job.status === "completed" && job.companies_failed === 0
                          ? <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
                          : job.status === "failed"
                          ? <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0" />
                          : job.status === "canceled"
                          ? <XCircle className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                          : <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
                        }
                        <div className="min-w-0">
                          <div className="text-sm text-muted-foreground">{fmtDate(job.started_at)}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground flex-shrink-0">
                        <span className="font-mono">
                          <span className="text-foreground">{job.companies_succeeded}</span>
                          /{job.total_companies_targeted}
                          {job.companies_failed > 0 && (
                            <span className="text-destructive ml-1">({job.companies_failed} failed)</span>
                          )}
                        </span>
                        {duration && <span>{duration}</span>}
                        {job.status === "canceled" && (
                          <span className="text-muted-foreground italic">canceled</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
}
