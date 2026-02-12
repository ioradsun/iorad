import { Link } from "react-router-dom";
import { useProcessingJobs, useJobItems } from "@/hooks/useSupabase";
import StatusBadge from "@/components/StatusBadge";
import { Clock, ChevronRight, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { useState } from "react";

export default function JobHistory() {
  const { data: jobs = [], isLoading } = useProcessingJobs();
  const [expandedJob, setExpandedJob] = useState<string | null>(null);

  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Processing Jobs</h1>
        <p className="text-sm text-muted-foreground mt-1">View job history, per-company results, and errors.</p>
      </div>

      {jobs.length === 0 ? (
        <div className="panel text-center py-12 text-muted-foreground">No processing jobs yet. Run a signal scan to get started.</div>
      ) : (
        <div className="space-y-3">
          {jobs.map(job => (
            <JobCard key={job.id} job={job} expanded={expandedJob === job.id} onToggle={() => setExpandedJob(expandedJob === job.id ? null : job.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function JobCard({ job, expanded, onToggle }: { job: any; expanded: boolean; onToggle: () => void }) {
  const { data: items = [] } = useJobItems(expanded ? job.id : undefined);
  const duration = job.finished_at
    ? Math.round((new Date(job.finished_at).getTime() - new Date(job.started_at).getTime()) / 60000)
    : null;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="panel">
      <button onClick={onToggle} className="w-full flex items-center justify-between">
        <div className="flex items-center gap-4">
          <StatusBadge status={job.status} />
          <div className="text-left">
            <div className="text-sm font-medium">{job.trigger === "manual" ? "Manual Run" : "Scheduled Run"}</div>
            <div className="text-xs text-muted-foreground flex items-center gap-2">
              <Clock className="w-3 h-3" />{new Date(job.started_at).toLocaleString()}
              {duration !== null && <span>· {duration}m</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <div className="text-xs text-muted-foreground">
              <span className="text-primary font-mono">{job.companies_succeeded}</span>
              <span> / {job.total_companies_targeted}</span>
              {job.companies_failed > 0 && <span className="text-destructive ml-2">({job.companies_failed} failed)</span>}
            </div>
          </div>
          <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform ${expanded ? "rotate-90" : ""}`} />
        </div>
      </button>

      {expanded && (
        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} className="mt-4 border-t pt-3 space-y-2">
          {job.error_summary && (
            <div className="flex items-start gap-2 text-xs text-destructive/80 bg-destructive/10 rounded p-2">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />{job.error_summary}
            </div>
          )}
          <div className="space-y-1">
            {items.map((item: any) => (
              <div key={item.id} className="flex items-center justify-between text-sm py-1.5 px-2 rounded hover:bg-secondary/30">
                <div className="flex items-center gap-3">
                  {item.status === "succeeded" ? <CheckCircle2 className="w-3.5 h-3.5 text-primary" /> :
                   item.status === "failed" ? <AlertTriangle className="w-3.5 h-3.5 text-destructive" /> :
                   <Clock className="w-3.5 h-3.5 text-muted-foreground" />}
                  <Link to={`/company/${item.company_id}`} className="hover:text-primary transition-colors">
                    {item.companies?.name || item.company_id}
                  </Link>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="font-mono">{item.signals_found_count} signals</span>
                  {item.snapshot_status && <StatusBadge status={item.snapshot_status} />}
                  {item.error_message && <span className="text-destructive max-w-[200px] truncate">{item.error_message}</span>}
                </div>
              </div>
            ))}
            {items.length === 0 && <div className="text-xs text-muted-foreground py-2">No items for this job.</div>}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
