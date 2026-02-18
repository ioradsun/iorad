import { Link } from "react-router-dom";
import { useProcessingJobs, useJobItems } from "@/hooks/useSupabase";
import { Clock, ChevronRight, AlertTriangle, CheckCircle2, Loader2, Zap, Users, Activity } from "lucide-react";
import { motion } from "framer-motion";
import { useState, useMemo } from "react";
import StatusBadge from "@/components/StatusBadge";

// ── Helpers ────────────────────────────────────────────────────────

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
  return `${Math.round(ms / 60_000)}m`;
}

// ── Group jobs that are really individual per-company auto-triggers ──
// A "batch" job has total_companies_targeted > 1.
// A "single" job has total_companies_targeted <= 1 (HubSpot auto-trigger).
function categoriseJobs(jobs: any[]) {
  const batches = jobs.filter(j => (j.total_companies_targeted ?? 0) > 1);
  const singles = jobs.filter(j => (j.total_companies_targeted ?? 0) <= 1);
  return { batches, singles };
}

// ── Main page ──────────────────────────────────────────────────────

export default function JobHistory() {
  const { data: jobs = [], isLoading } = useProcessingJobs();
  const [expandedJob, setExpandedJob] = useState<string | null>(null);
  const [showAllSingles, setShowAllSingles] = useState(false);

  const { batches, singles } = useMemo(() => categoriseJobs(jobs), [jobs]);

  // Summarise the singles as one aggregate row
  const singlesSummary = useMemo(() => {
    if (!singles.length) return null;
    const succeeded = singles.filter(j => j.companies_succeeded > 0).length;
    const failed = singles.filter(j => j.companies_failed > 0).length;
    const latest = singles[0];
    return { succeeded, failed, total: singles.length, latest };
  }, [singles]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Processing Jobs</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Batch runs and per-company auto-triggers from HubSpot.
        </p>
      </div>

      {jobs.length === 0 && (
        <div className="panel text-center py-12 text-muted-foreground text-sm">
          No processing jobs yet. Run a signal scan to get started.
        </div>
      )}

      {/* ── HubSpot Auto-trigger Summary ── */}
      {singlesSummary && (
        <section className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            <Zap className="w-3.5 h-3.5" />
            HubSpot Auto-triggers
          </div>
          <div className="panel">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2.5">
                  <Users className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <span className="text-sm font-medium">
                    {singlesSummary.total} companies auto-processed from HubSpot
                  </span>
                </div>
                <div className="text-xs text-muted-foreground pl-6">
                  {singlesSummary.succeeded} succeeded
                  {singlesSummary.failed > 0 && (
                    <span className="text-destructive ml-2">· {singlesSummary.failed} failed</span>
                  )}
                  {" · "}Last: {fmtDate(singlesSummary.latest.started_at)}
                </div>
              </div>
              <button
                onClick={() => setShowAllSingles(v => !v)}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 flex-shrink-0 mt-0.5"
              >
                {showAllSingles ? "Hide" : "Show all"}
                <ChevronRight className={`w-3.5 h-3.5 transition-transform ${showAllSingles ? "rotate-90" : ""}`} />
              </button>
            </div>

            {showAllSingles && (
              <div className="mt-4 border-t pt-3 space-y-1 max-h-72 overflow-y-auto">
                {singles.map(job => (
                  <SingleJobRow key={job.id} job={job} />
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── Batch Jobs ── */}
      {batches.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            <Activity className="w-3.5 h-3.5" />
            Batch Runs
          </div>
          <div className="space-y-3">
            {batches.map(job => (
              <BatchJobCard
                key={job.id}
                job={job}
                expanded={expandedJob === job.id}
                onToggle={() => setExpandedJob(expandedJob === job.id ? null : job.id)}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ── Single (per-company) job row ───────────────────────────────────

function SingleJobRow({ job }: { job: any }) {
  const duration = fmtDuration(job.started_at, job.finished_at);
  return (
    <div className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-secondary/40 text-sm">
      <div className="flex items-center gap-2">
        {job.status === "running" ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin text-primary flex-shrink-0" />
        ) : job.companies_failed > 0 ? (
          <AlertTriangle className="w-3.5 h-3.5 text-destructive flex-shrink-0" />
        ) : (
          <CheckCircle2 className="w-3.5 h-3.5 text-primary flex-shrink-0" />
        )}
        <span className="text-foreground">{fmtDate(job.started_at)}</span>
      </div>
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        {duration && <span>{duration}</span>}
        <StatusBadge status={job.status} />
      </div>
    </div>
  );
}

// ── Batch job card ─────────────────────────────────────────────────

function BatchJobCard({ job, expanded, onToggle }: { job: any; expanded: boolean; onToggle: () => void }) {
  const { data: items = [] } = useJobItems(expanded ? job.id : undefined);
  const duration = fmtDuration(job.started_at, job.finished_at);
  const isRunning = job.status === "running";

  const pct = job.total_companies_targeted > 0
    ? Math.round((job.companies_processed / job.total_companies_targeted) * 100)
    : 0;

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="panel overflow-hidden">
      <button onClick={onToggle} className="w-full flex items-center justify-between gap-4">
        {/* Left: status + label */}
        <div className="flex items-center gap-3 min-w-0">
          {isRunning
            ? <Loader2 className="w-4 h-4 animate-spin text-primary flex-shrink-0" />
            : job.status === "failed"
            ? <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0" />
            : <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
          }
          <div className="text-left min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">
                {isRunning ? "Running" : "Batch Complete"}
              </span>
              <StatusBadge status={job.status} />
            </div>
            <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
              <Clock className="w-3 h-3" />
              {fmtDate(job.started_at)}
              {duration && <span>· {duration}</span>}
            </div>
          </div>
        </div>

        {/* Right: progress */}
        <div className="flex items-center gap-4 flex-shrink-0">
          <div className="text-right hidden sm:block">
            <div className="text-xs font-mono">
              <span className="text-foreground font-semibold">{job.companies_succeeded}</span>
              <span className="text-muted-foreground"> / {job.total_companies_targeted} companies</span>
            </div>
            {job.companies_failed > 0 && (
              <div className="text-xs text-destructive">{job.companies_failed} failed</div>
            )}
          </div>
          <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform ${expanded ? "rotate-90" : ""}`} />
        </div>
      </button>

      {/* Progress bar — only while running */}
      {isRunning && job.total_companies_targeted > 0 && (
        <div className="mt-3 space-y-1">
          <div className="w-full h-1.5 rounded-full bg-secondary overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${pct}%`, background: "hsl(var(--primary))" }}
            />
          </div>
          <div className="text-xs text-muted-foreground">{pct}% — {job.companies_processed} processed</div>
        </div>
      )}

      {/* Error summary */}
      {job.error_summary && (
        <div className="mt-3 flex items-start gap-2 text-xs text-destructive/80 bg-destructive/10 rounded p-2">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />{job.error_summary}
        </div>
      )}

      {/* Per-company items */}
      {expanded && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          className="mt-4 border-t pt-3"
        >
          {items.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">No company-level records for this job.</p>
          ) : (
            <div className="space-y-0.5 max-h-80 overflow-y-auto">
              {items.map((item: any) => (
                <div key={item.id} className="flex items-center justify-between text-sm py-1.5 px-2 rounded hover:bg-secondary/30">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {item.status === "succeeded"
                      ? <CheckCircle2 className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                      : item.status === "failed"
                      ? <AlertTriangle className="w-3.5 h-3.5 text-destructive flex-shrink-0" />
                      : <Clock className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />}
                    <Link
                      to={`/company/${item.company_id}`}
                      className="hover:text-primary transition-colors truncate"
                      onClick={e => e.stopPropagation()}
                    >
                      {item.companies?.name || item.company_id}
                    </Link>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground flex-shrink-0">
                    <span className="font-mono">{item.signals_found_count} signals</span>
                    {item.snapshot_status && <StatusBadge status={item.snapshot_status} />}
                    {item.error_message && (
                      <span className="text-destructive max-w-[180px] truncate" title={item.error_message}>
                        {item.error_message}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      )}
    </motion.div>
  );
}
