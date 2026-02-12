import { Link } from "react-router-dom";
import { mockJobs, mockJobItems } from "@/data/mockData";
import StatusBadge from "@/components/StatusBadge";
import { Clock, ChevronRight, AlertTriangle, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";
import { useState } from "react";

export default function JobHistory() {
  const [expandedJob, setExpandedJob] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Processing Jobs</h1>
        <p className="text-sm text-muted-foreground mt-1">View job history, per-company results, and errors.</p>
      </div>

      <div className="space-y-3">
        {mockJobs.map(job => {
          const expanded = expandedJob === job.id;
          const items = mockJobItems.filter(i => i.job_id === job.id);
          const duration = job.finished_at
            ? Math.round((new Date(job.finished_at).getTime() - new Date(job.started_at).getTime()) / 60000)
            : null;

          return (
            <motion.div
              key={job.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="panel"
            >
              <button
                onClick={() => setExpandedJob(expanded ? null : job.id)}
                className="w-full flex items-center justify-between"
              >
                <div className="flex items-center gap-4">
                  <StatusBadge status={job.status} />
                  <div className="text-left">
                    <div className="text-sm font-medium">
                      {job.trigger === "manual" ? "Manual Run" : "Scheduled Run"}
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-2">
                      <Clock className="w-3 h-3" />
                      {new Date(job.started_at).toLocaleString()}
                      {duration !== null && <span>· {duration}m</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right hidden sm:block">
                    <div className="text-xs text-muted-foreground">
                      <span className="text-primary font-mono">{job.companies_succeeded}</span>
                      <span> / {job.total_companies_targeted}</span>
                      {job.companies_failed > 0 && (
                        <span className="text-destructive ml-2">({job.companies_failed} failed)</span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform ${expanded ? "rotate-90" : ""}`} />
                </div>
              </button>

              {expanded && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} className="mt-4 border-t pt-3 space-y-2">
                  {job.error_summary && (
                    <div className="flex items-start gap-2 text-xs text-destructive/80 bg-destructive/10 rounded p-2">
                      <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                      {job.error_summary}
                    </div>
                  )}
                  <div className="space-y-1">
                    {items.map(item => (
                      <div key={item.id} className="flex items-center justify-between text-sm py-1.5 px-2 rounded hover:bg-secondary/30">
                        <div className="flex items-center gap-3">
                          {item.status === "succeeded" ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
                          ) : item.status === "failed" ? (
                            <AlertTriangle className="w-3.5 h-3.5 text-destructive" />
                          ) : (
                            <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                          )}
                          <Link to={`/company/${item.company_id}`} className="hover:text-primary transition-colors">
                            {item.company_name || item.company_id}
                          </Link>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="font-mono">{item.signals_found_count} signals</span>
                          {item.snapshot_status && <StatusBadge status={item.snapshot_status} />}
                          {item.error_message && (
                            <span className="text-destructive max-w-[200px] truncate">{item.error_message}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
