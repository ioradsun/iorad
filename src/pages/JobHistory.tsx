import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  Loader2, CheckCircle2, Clock, XCircle, Inbox, Play, Pause, Trash2,
  Download, RefreshCw, AlertCircle, User, Building2, Zap, ChevronDown,
  ChevronRight, Circle, CheckCheck, SkipForward,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { formatDistanceToNow, format } from "date-fns";

const NEW_THRESHOLD_HOURS = 48;

// ── Shared helpers ────────────────────────────────────────────────────────────

function elapsed(from: string) {
  return formatDistanceToNow(new Date(from), { addSuffix: false, includeSeconds: true });
}

function fmt(ts: string | null | undefined) {
  if (!ts) return "—";
  return format(new Date(ts), "MMM d, h:mm a");
}

// ── Story Generation hooks ────────────────────────────────────────────────────

function useCompanyQueueData() {
  return useQuery({
    queryKey: ["company_queue_data"],
    queryFn: async () => {
      const { data: companies } = await supabase
        .from("companies")
        .select("id, name, domain, source_type, created_at, snapshot_status")
        .order("created_at", { ascending: false });

      const { data: cards } = await supabase.from("company_cards").select("company_id");

      const { data: failedItems } = await supabase
        .from("processing_job_items")
        .select("company_id, error_message, finished_at, companies(name)")
        .eq("status", "failed")
        .order("finished_at", { ascending: false });

      const cardIds = new Set((cards || []).map((c: any) => c.company_id));
      const cutoff = new Date(Date.now() - NEW_THRESHOLD_HOURS * 60 * 60 * 1000);
      const failedMap = new Map<string, any>();
      for (const item of failedItems || []) {
        if (!failedMap.has(item.company_id)) failedMap.set(item.company_id, item);
      }

      const noStory = (companies || []).filter((c) => !cardIds.has(c.id));
      const completed = (companies || []).filter((c) => cardIds.has(c.id));
      const waiting = noStory.filter((c) => new Date(c.created_at) >= cutoff && c.snapshot_status == null);
      const notStarted = noStory.filter((c) => new Date(c.created_at) < cutoff && c.snapshot_status !== "cleared");

      return { completed, waiting, notStarted, failed: Array.from(failedMap.values()) };
    },
    refetchInterval: 10_000,
  });
}

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

function useCurrentlyProcessingCompany(jobId: string | undefined) {
  return useQuery({
    queryKey: ["currently_processing_company", jobId],
    enabled: !!jobId,
    queryFn: async () => {
      const { data } = await supabase
        .from("processing_job_items")
        .select("*, companies(name)")
        .eq("job_id", jobId!)
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    refetchInterval: 3_000,
  });
}

// ── HubSpot Sync hooks ────────────────────────────────────────────────────────

function useHubspotJobs() {
  return useQuery({
    queryKey: ["hubspot_jobs"],
    queryFn: async () => {
      // All jobs with action=bulk_import or trigger=bulk_import, last 20
      const { data } = await supabase
        .from("processing_jobs")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(20);
      // Filter to import-related jobs by settings_snapshot or trigger
      return (data || []).filter((j: any) =>
        j.trigger === "bulk_import" ||
        j.trigger === "hubspot_sync" ||
        (j.settings_snapshot as any)?.action === "bulk_import" ||
        (j.settings_snapshot as any)?.action === "sync"
      );
    },
    refetchInterval: 5_000,
  });
}

function useRecentlyImported() {
  return useQuery({
    queryKey: ["recently_imported_companies"],
    queryFn: async () => {
      const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(); // last 7 days
      const { data: companies } = await supabase
        .from("companies")
        .select("id, name, domain, industry, headcount, category, stage, source_type, created_at, updated_at, snapshot_status, scout_score, scout_scored_at, scout_summary, hubspot_properties, scout_synced_at")
        .gte("created_at", cutoff)
        .order("created_at", { ascending: false })
        .limit(200);

      // Contact counts per company
      const companyIds = (companies || []).map((c: any) => c.id);
      let contactCounts: Record<string, number> = {};
      if (companyIds.length > 0) {
        const { data: contacts } = await supabase
          .from("contacts")
          .select("company_id")
          .in("company_id", companyIds);
        for (const c of contacts || []) {
          contactCounts[c.company_id] = (contactCounts[c.company_id] || 0) + 1;
        }
      }

      return (companies || []).map((c: any) => ({
        ...c,
        contact_count: contactCounts[c.id] || 0,
      }));
    },
    refetchInterval: 8_000,
  });
}

// ── Story Generation components ───────────────────────────────────────────────

function CompanyList({ companies, emptyMessage }: { companies: any[]; emptyMessage: string }) {
  if (companies.length === 0) {
    return <div className="text-sm text-muted-foreground py-10 text-center">{emptyMessage}</div>;
  }
  return (
    <div className="divide-y divide-border/40">
      {companies.map((c) => (
        <div key={c.id ?? c.company_id} className="flex items-center justify-between py-2.5">
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium truncate">
              {c.name ?? (c.companies as any)?.name ?? "—"}
            </div>
            {c.domain && <div className="text-xs text-muted-foreground">{c.domain}</div>}
            {c.error_message && (
              <div className="text-xs text-destructive mt-0.5 truncate">{c.error_message}</div>
            )}
          </div>
          {c.id && (
            <Link
              to={`/company/${c.id}`}
              className="text-xs text-primary underline underline-offset-2 ml-4 flex-shrink-0"
            >
              View
            </Link>
          )}
        </div>
      ))}
    </div>
  );
}

// ── HubSpot Sync components ───────────────────────────────────────────────────

function SyncJobSummary({ job }: { job: any }) {
  const snap = job.settings_snapshot as any || {};
  const isRunning = job.status === "running";
  const isCompleted = job.status === "completed";
  const isCanceled = job.status === "canceled" || job.status === "failed";
  const pct = job.total_companies_targeted > 0
    ? Math.round((job.companies_processed / job.total_companies_targeted) * 100)
    : null;

  return (
    <div className="rounded-lg border border-border bg-card/50 p-4 space-y-3">
      {/* Status row */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {isRunning && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
          {isCompleted && <CheckCircle2 className="w-4 h-4 text-success" />}
          {isCanceled && <XCircle className="w-4 h-4 text-destructive" />}
          <span className="text-sm font-semibold capitalize">
            {isRunning ? "Syncing…" : job.status}
          </span>
          <span className="text-xs text-muted-foreground">
            {snap.action === "bulk_import" ? "All companies" : snap.action ?? "HubSpot sync"}
          </span>
        </div>
        <span className="text-xs text-muted-foreground tabular-nums">
          {fmt(job.started_at)}
          {job.finished_at && ` → ${elapsed(job.started_at)} total`}
          {isRunning && ` · ${elapsed(job.started_at)} elapsed`}
        </span>
      </div>

      {/* Progress bar */}
      {job.total_companies_targeted > 0 && (
        <div className="space-y-1">
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${pct ?? 0}%`,
                background: isCompleted ? "hsl(var(--success))" : "hsl(var(--primary))",
              }}
            />
          </div>
          <div className="flex justify-between text-[11px] text-muted-foreground tabular-nums">
            <span>{job.companies_processed} / {job.total_companies_targeted} companies</span>
            <span>{pct}%</span>
          </div>
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-2 pt-1">
        {[
          { label: "Imported / Updated", value: `${job.companies_succeeded ?? 0}` },
          { label: "Failed", value: `${job.companies_failed ?? 0}`, warn: job.companies_failed > 0 },
          { label: "Processed", value: `${job.companies_processed ?? 0}` },
        ].map(({ label, value, warn }) => (
          <div key={label} className="rounded-md bg-muted/40 px-3 py-2 text-center">
            <div className={`text-base font-bold tabular-nums ${warn ? "text-destructive" : "text-foreground"}`}>{value}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {job.error_summary && (
        <div className="flex items-start gap-2 rounded-md bg-destructive/8 border border-destructive/20 px-3 py-2 text-xs text-destructive">
          <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          {job.error_summary}
        </div>
      )}
    </div>
  );
}

function ScoutScoreBadge({ score }: { score: number | null | undefined }) {
  if (score == null) return <span className="text-xs text-muted-foreground">—</span>;
  const color = score >= 70 ? "text-success" : score >= 40 ? "text-warning" : "text-muted-foreground";
  return <span className={`text-sm font-bold tabular-nums ${color}`}>{score}</span>;
}

function ImportedCompanyRow({ company }: { company: any }) {
  const [open, setOpen] = useState(false);
  const hsProps = company.hubspot_properties as any || {};
  const hasHsData = Object.keys(hsProps).length > 0;

  const stageColor: Record<string, string> = {
    prospect: "bg-muted text-muted-foreground",
    active_opp: "bg-info/10 text-info",
    customer: "bg-success/10 text-success",
    expansion: "bg-primary/10 text-primary",
  };

  return (
    <div className="border-b border-border/40 last:border-0">
      {/* Main row */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 py-3 px-1 text-left hover:bg-muted/30 transition-colors rounded"
      >
        {/* Expand toggle */}
        <span className="text-muted-foreground shrink-0">
          {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </span>

        {/* Company info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium truncate">{company.name}</span>
            {company.domain && (
              <span className="text-xs text-muted-foreground truncate">{company.domain}</span>
            )}
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${stageColor[company.stage] ?? "bg-muted text-muted-foreground"}`}>
              {company.stage ?? "prospect"}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-0.5 text-[11px] text-muted-foreground">
            {company.industry && <span>{company.industry.replace(/_/g, " ")}</span>}
            {company.headcount && <span>{company.headcount.toLocaleString()} employees</span>}
            <span className="flex items-center gap-1">
              <User className="w-2.5 h-2.5" />
              {company.contact_count} contact{company.contact_count !== 1 ? "s" : ""}
            </span>
          </div>
        </div>

        {/* Scout score */}
        <div className="text-right shrink-0 w-16">
          <ScoutScoreBadge score={company.scout_score} />
          {company.scout_scored_at && (
            <div className="text-[10px] text-muted-foreground mt-0.5">scored</div>
          )}
        </div>

        {/* Sync status indicators */}
        <div className="flex flex-col items-end gap-1 shrink-0 w-20">
          {/* Contacts synced */}
          <div className="flex items-center gap-1 text-[10px]">
            {company.contact_count > 0
              ? <CheckCheck className="w-3 h-3 text-success" />
              : <Circle className="w-3 h-3 text-muted-foreground/40" />}
            <span className={company.contact_count > 0 ? "text-success" : "text-muted-foreground"}>
              contacts
            </span>
          </div>
          {/* Scout scored */}
          <div className="flex items-center gap-1 text-[10px]">
            {company.scout_score != null
              ? <CheckCheck className="w-3 h-3 text-success" />
              : <Circle className="w-3 h-3 text-muted-foreground/40" />}
            <span className={company.scout_score != null ? "text-success" : "text-muted-foreground"}>
              scored
            </span>
          </div>
        </div>

        {/* View link */}
        <Link
          to={`/company/${company.id}`}
          onClick={e => e.stopPropagation()}
          className="text-xs text-primary underline underline-offset-2 shrink-0"
        >
          View
        </Link>
      </button>

      {/* Expanded detail */}
      {open && (
        <div className="ml-6 mb-3 space-y-3">
          {/* Scout summary */}
          {company.scout_summary && (
            <div className="rounded-md bg-primary/5 border border-primary/10 px-3 py-2">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-primary mb-1 flex items-center gap-1">
                <Zap className="w-3 h-3" /> Scout AI Summary
              </div>
              <p className="text-xs text-foreground leading-relaxed">{company.scout_summary}</p>
            </div>
          )}
          {!company.scout_summary && !company.scout_scored_at && (
            <div className="text-xs text-muted-foreground italic">Scout scoring not yet run for this company.</div>
          )}

          {/* HubSpot properties snapshot */}
          {hasHsData && (
            <div className="rounded-md bg-muted/40 px-3 py-2 space-y-1.5">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                HubSpot Data
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                {[
                  ["Lifecycle Stage", hsProps.lifecyclestage],
                  ["HubSpot Owner", hsProps.hubspot_owner_id],
                  ["Create Date", hsProps.createdate ? fmt(hsProps.createdate) : null],
                  ["Modified", hsProps.hs_lastmodifieddate ? fmt(hsProps.hs_lastmodifieddate) : null],
                  ["Employees", hsProps.numberofemployees],
                  ["Country", hsProps.country],
                  ["Industry", hsProps.industry],
                  ["Deal Count", hsProps.num_associated_deals],
                ].filter(([, v]) => v != null && v !== "").map(([label, value]) => (
                  <div key={label as string} className="flex gap-1">
                    <span className="text-muted-foreground shrink-0">{label}:</span>
                    <span className="font-medium truncate">{String(value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Timestamps */}
          <div className="text-[10px] text-muted-foreground flex flex-wrap gap-x-4 gap-y-0.5">
            <span>Imported: {fmt(company.created_at)}</span>
            {company.scout_synced_at && <span>HS Synced: {fmt(company.scout_synced_at)}</span>}
            {company.scout_scored_at && <span>Scored: {fmt(company.scout_scored_at)}</span>}
          </div>
        </div>
      )}
    </div>
  );
}

// ── HubSpot Sync tab ──────────────────────────────────────────────────────────

function HubSpotSyncTab() {
  const { data: jobs = [], isLoading: loadingJobs } = useHubspotJobs();
  const { data: companies = [], isLoading: loadingCompanies } = useRecentlyImported();

  const activeJob = jobs.find((j: any) => j.status === "running");
  const recentJobs = jobs.slice(0, 5);

  // Categorise companies
  const scored = companies.filter((c: any) => c.scout_score != null);
  const notScored = companies.filter((c: any) => c.scout_score == null);
  const withContacts = companies.filter((c: any) => c.contact_count > 0);
  const noContacts = companies.filter((c: any) => c.contact_count === 0);

  const [companyTab, setCompanyTab] = useState<"all" | "scored" | "no_contacts">("all");

  const displayCompanies =
    companyTab === "scored" ? scored :
    companyTab === "no_contacts" ? noContacts :
    companies;

  if (loadingJobs && loadingCompanies) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Active job card */}
      {activeJob ? (
        <SyncJobSummary job={activeJob} />
      ) : (
        <div className="rounded-lg border border-border bg-card/50 px-4 py-3 flex items-center gap-2 text-sm text-muted-foreground">
          <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
          No HubSpot sync currently running.
          {recentJobs.length > 0 && (
            <span className="ml-1">Last run: {fmt(recentJobs[0].started_at)}</span>
          )}
        </div>
      )}

      {/* Recent job history */}
      {recentJobs.length > 1 && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Recent Sync Runs</h3>
          <div className="space-y-1.5">
            {recentJobs.filter((j: any) => j.id !== activeJob?.id).slice(0, 4).map((job: any) => {
              const snap = job.settings_snapshot as any || {};
              const isOk = job.status === "completed";
              const icon = isOk
                ? <CheckCircle2 className="w-3.5 h-3.5 text-success" />
                : job.status === "running"
                ? <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                : <XCircle className="w-3.5 h-3.5 text-destructive" />;
              return (
                <div key={job.id} className="flex items-center gap-2 text-xs px-2 py-1.5 rounded-md hover:bg-muted/40">
                  {icon}
                  <span className="text-muted-foreground">{fmt(job.started_at)}</span>
                  <span className="text-foreground">{snap.action ?? job.trigger}</span>
                  <span className="ml-auto text-muted-foreground tabular-nums">
                    {job.companies_processed} processed · {job.companies_succeeded} ok · {job.companies_failed} err
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Summary stats */}
      {companies.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            Last 7 Days — {companies.length} Companies Imported
          </h3>
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: "Total imported", value: companies.length, icon: <Download className="w-3.5 h-3.5" /> },
              { label: "With contacts", value: withContacts.length, icon: <User className="w-3.5 h-3.5" /> },
              { label: "Scout scored", value: scored.length, icon: <Zap className="w-3.5 h-3.5" /> },
              { label: "Missing contacts", value: noContacts.length, icon: <AlertCircle className="w-3.5 h-3.5" />, warn: noContacts.length > 0 },
            ].map(({ label, value, icon, warn }) => (
              <div key={label} className="rounded-lg border border-border bg-card/50 p-3 text-center">
                <div className={`flex justify-center mb-1 ${warn ? "text-warning" : "text-muted-foreground"}`}>{icon}</div>
                <div className={`text-xl font-bold tabular-nums ${warn && value > 0 ? "text-warning" : "text-foreground"}`}>{value}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">{label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Company detail list */}
      {companies.length > 0 && (
        <div>
          {/* Sub-filter pills */}
          <div className="flex items-center gap-2 mb-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mr-1">Companies</h3>
            {(["all", "scored", "no_contacts"] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setCompanyTab(tab)}
                className={`text-xs px-2.5 py-1 rounded-full border transition-all ${
                  companyTab === tab
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground/40"
                }`}
              >
                {tab === "all" ? `All (${companies.length})`
                  : tab === "scored" ? `Scored (${scored.length})`
                  : `No Contacts (${noContacts.length})`}
              </button>
            ))}
          </div>

          <div className="rounded-lg border border-border bg-card/30 px-3 max-h-[55vh] overflow-y-auto">
            {displayCompanies.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">No companies in this view.</div>
            ) : (
              displayCompanies.map((c: any) => (
                <ImportedCompanyRow key={c.id} company={c} />
              ))
            )}
          </div>
        </div>
      )}

      {companies.length === 0 && !loadingCompanies && (
        <div className="py-10 text-center text-sm text-muted-foreground">
          No companies imported in the last 7 days.
        </div>
      )}
    </div>
  );
}

// ── Story Generation tab ──────────────────────────────────────────────────────

function StoryGenerationTab() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [actionLoading, setActionLoading] = useState(false);

  const { data: queueData, isLoading: loadingQueue } = useCompanyQueueData();
  const { data: activeJob, isLoading: loadingActive } = useActiveRunningJob();
  const { data: currentItem } = useCurrentlyProcessingCompany(activeJob?.id);

  const isLoading = loadingQueue || loadingActive;
  const isRunning = !!activeJob;
  const currentCompany =
    (currentItem?.companies as any)?.name ??
    (activeJob?.settings_snapshot as any)?.current_company ??
    null;
  const triggeredBy = (activeJob as any)?.triggered_by ?? null;

  const completed  = queueData?.completed  ?? [];
  const waiting    = queueData?.waiting    ?? [];
  const notStarted = queueData?.notStarted ?? [];
  const failed     = queueData?.failed     ?? [];

  const handleStart = async () => {
    setActionLoading(true);
    try {
      const { error } = await supabase.functions.invoke("run-signals", {
        body: {
          offset: 0,
          triggered_by: user?.email ?? user?.user_metadata?.full_name ?? "Unknown",
        },
      });
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["active_running_job"] });
      await qc.invalidateQueries({ queryKey: ["company_queue_data"] });
      toast.success("Processing started — new imports will be generated first.");
    } catch (err: any) {
      toast.error(`Failed to start: ${err?.message || "Unknown error"}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handlePause = async () => {
    if (!activeJob) return;
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from("processing_jobs")
        .update({ status: "canceled", finished_at: new Date().toISOString() })
        .eq("id", activeJob.id);
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["active_running_job"] });
      await qc.invalidateQueries({ queryKey: ["active_job"] });
      toast.success("Paused — current company will finish, then the queue stops.");
    } catch (err: any) {
      toast.error(`Failed to pause: ${err?.message || "Unknown error"}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleClearJob = async () => {
    setActionLoading(true);
    try {
      if (activeJob) {
        await supabase
          .from("processing_jobs")
          .update({ status: "canceled", finished_at: new Date().toISOString() })
          .eq("id", activeJob.id);
        await supabase
          .from("processing_job_items")
          .update({ status: "failed", finished_at: new Date().toISOString(), error_message: "Cleared by user" })
          .eq("job_id", activeJob.id)
          .in("status", ["running", "queued"]);
      }
      const { data: cardsData } = await supabase.from("company_cards").select("company_id");
      const cardIds = (cardsData || []).map((c: any) => c.company_id);
      const { data: toClear } = await supabase.from("companies").select("id").is("snapshot_status", null);
      const noCardIds = (toClear || []).map((c: any) => c.id).filter((id: string) => !new Set(cardIds).has(id));
      if (noCardIds.length > 0) {
        const BATCH = 500;
        for (let i = 0; i < noCardIds.length; i += BATCH) {
          await supabase.from("companies").update({ snapshot_status: "cleared" }).in("id", noCardIds.slice(i, i + BATCH));
        }
      }
      await qc.invalidateQueries({ queryKey: ["active_running_job"] });
      await qc.invalidateQueries({ queryKey: ["active_job"] });
      await qc.invalidateQueries({ queryKey: ["company_queue_data"] });
      await qc.invalidateQueries({ queryKey: ["banner_waiting_count"] });
      toast.success(`Queue cleared — ${noCardIds.length} companies removed.${activeJob ? " Running job canceled." : ""}`);
    } catch (err: any) {
      toast.error(`Failed to clear: ${err?.message || "Unknown error"}`);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Controls */}
      {!isLoading && (
        <div className="flex items-center gap-2">
          {isRunning ? (
            <Button
              variant="outline"
              size="sm"
              className="gap-2 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={handlePause}
              disabled={actionLoading}
            >
              {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Pause className="w-4 h-4" />}
              Pause
            </Button>
          ) : (
            <Button size="sm" className="gap-2" onClick={handleStart} disabled={actionLoading || waiting.length === 0}>
              {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              Start{waiting.length > 0 ? ` (${waiting.length})` : ""}
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="gap-2 text-muted-foreground hover:text-destructive"
            onClick={handleClearJob}
            disabled={actionLoading || (waiting.length === 0 && notStarted.length === 0 && !isRunning)}
          >
            <Trash2 className="w-4 h-4" />
            Clear Queue
          </Button>
        </div>
      )}

      {/* Running indicator */}
      {isRunning && (
        <div className="panel flex items-center gap-3">
          <Loader2 className="w-4 h-4 animate-spin text-primary flex-shrink-0" />
          <div className="min-w-0 flex-1 flex items-center justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <div className="text-xs text-muted-foreground">Currently processing</div>
              <div className="text-sm font-medium truncate">{currentCompany ?? "Starting…"}</div>
            </div>
            {(triggeredBy || activeJob?.started_at) && (
              <div className="text-right shrink-0">
                {triggeredBy && (
                  <div className="text-xs font-medium text-foreground flex items-center gap-1 justify-end">
                    <User className="w-3 h-3 text-muted-foreground" />
                    {triggeredBy}
                  </div>
                )}
                {activeJob?.started_at && (
                  <div className="text-[11px] text-muted-foreground">
                    Started {fmt(activeJob.started_at)}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <Tabs defaultValue="waiting">
          <TabsList className="w-full grid grid-cols-4">
            <TabsTrigger value="waiting" className="gap-1.5 text-xs">
              <Clock className="w-3.5 h-3.5 shrink-0" />Waiting
              <span className="tabular-nums opacity-70">({waiting.length})</span>
            </TabsTrigger>
            <TabsTrigger value="not_started" className="gap-1.5 text-xs">
              <Inbox className="w-3.5 h-3.5 shrink-0" />Not Started
              <span className="tabular-nums opacity-70">({notStarted.length})</span>
            </TabsTrigger>
            <TabsTrigger value="completed" className="gap-1.5 text-xs">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />Done
              <span className="tabular-nums opacity-70">({completed.length})</span>
            </TabsTrigger>
            <TabsTrigger value="failed" className="gap-1.5 text-xs">
              <XCircle className="w-3.5 h-3.5 shrink-0" />Failed
              {failed.length > 0
                ? <span className="tabular-nums text-destructive">({failed.length})</span>
                : <span className="tabular-nums opacity-70">(0)</span>}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="waiting" className="mt-4 panel max-h-[60vh] overflow-y-auto">
            <CompanyList companies={waiting} emptyMessage="No new imports waiting for generation." />
          </TabsContent>
          <TabsContent value="not_started" className="mt-4 panel max-h-[60vh] overflow-y-auto">
            <p className="text-xs text-muted-foreground mb-3 pb-3 border-b border-border/50">
              Older records without a story. These won't be auto-generated — open the company to generate manually.
            </p>
            <CompanyList companies={notStarted} emptyMessage="All older records have stories." />
          </TabsContent>
          <TabsContent value="completed" className="mt-4 panel max-h-[60vh] overflow-y-auto">
            <CompanyList companies={completed} emptyMessage="No completed stories yet." />
          </TabsContent>
          <TabsContent value="failed" className="mt-4 panel max-h-[60vh] overflow-y-auto">
            <CompanyList companies={failed} emptyMessage="No failed items — great!" />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function JobHistory() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Processing Status</h1>
        <p className="text-sm text-muted-foreground mt-1">Monitor story generation and HubSpot sync activity</p>
      </div>

      <Tabs defaultValue="hubspot">
        <TabsList className="gap-1">
          <TabsTrigger value="hubspot" className="gap-2 text-sm">
            <Download className="w-4 h-4" />
            HubSpot Sync
          </TabsTrigger>
          <TabsTrigger value="stories" className="gap-2 text-sm">
            <Zap className="w-4 h-4" />
            Story Generation
          </TabsTrigger>
        </TabsList>

        <TabsContent value="hubspot" className="mt-5">
          <HubSpotSyncTab />
        </TabsContent>

        <TabsContent value="stories" className="mt-5">
          <StoryGenerationTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
