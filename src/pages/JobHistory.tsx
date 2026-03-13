import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Loader2, CheckCircle2, XCircle,
  Download, AlertCircle, User, Zap, ChevronDown,
  ChevronRight, Circle, CheckCheck,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Link } from "react-router-dom";
import { formatDistanceToNow, format } from "date-fns";
import { toast } from "sonner";



// ── Shared helpers ────────────────────────────────────────────────────────────

function elapsed(from: string) {
  return formatDistanceToNow(new Date(from), { addSuffix: false, includeSeconds: true });
}

function fmt(ts: string | null | undefined) {
  if (!ts) return "—";
  return format(new Date(ts), "MMM d, h:mm a");
}

// ── Story Generation hooks ────────────────────────────────────────────────────

function useStoryGenerationData() {
  return useQuery({
    queryKey: ["story_generation_data"],
    queryFn: async () => {
      // Active single-company story job
      const { data: activeJobs } = await supabase
        .from("processing_jobs")
        .select("*")
        .eq("status", "running")
        .eq("trigger", "manual")
        .order("started_at", { ascending: false })
        .limit(1);

      const activeJob = activeJobs?.[0] ?? null;

      // Get company name for the active job if present
      let activeCompany: { name: string; id: string } | null = null;
      if (activeJob) {
        const snap = activeJob.settings_snapshot as any;
        const companyId = snap?.company_id;
        if (companyId) {
          const { data: item } = await supabase
            .from("processing_job_items")
            .select("company_id, companies(name, id)")
            .eq("job_id", activeJob.id)
            .limit(1)
            .maybeSingle();
          if (item?.companies) {
            activeCompany = { name: (item.companies as any).name, id: (item.companies as any).id };
          }
        }
      }

      // Companies with stories (cards)
      // REFACTOR: (c) existence-check — this only discovers which companies have any cards.
      const { data: cards } = await supabase
        .from("company_cards")
        .select("company_id, created_at")
        .order("created_at", { ascending: false })
        .limit(200);

      const cardCompanyIds = (cards || []).map((c: any) => c.company_id);
      let completedCompanies: any[] = [];
      if (cardCompanyIds.length > 0) {
        const { data: companies } = await supabase
          .from("companies")
          .select("id, name, domain")
          .in("id", cardCompanyIds);
        const cardMap = new Map((cards || []).map((c: any) => [c.company_id, c.created_at]));
        completedCompanies = (companies || []).map((c: any) => ({
          ...c,
          story_created_at: cardMap.get(c.id),
        }));
      }

      // Failed items
      const { data: failedItems } = await supabase
        .from("processing_job_items")
        .select("company_id, error_message, finished_at, companies(name, id)")
        .eq("status", "failed")
        .order("finished_at", { ascending: false })
        .limit(50);

      const failedMap = new Map<string, any>();
      for (const item of failedItems || []) {
        if (!failedMap.has(item.company_id)) failedMap.set(item.company_id, item);
      }

      return {
        activeJob,
        activeCompany,
        completed: completedCompanies,
        failed: Array.from(failedMap.values()),
      };
    },
    refetchInterval: 5_000,
  });
}



function useHubspotJobs() {
  return useQuery({
    queryKey: ["hubspot_jobs"],
    queryFn: async () => {
      const { data } = await supabase
        .from("processing_jobs")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(30);
      // Include all HubSpot-related jobs: bulk import, sync, backfill, and
      // manual per-company syncs (trigger="manual" with current_company in snapshot)
      return (data || []).filter((j: any) => {
        const snap = (j.settings_snapshot as any) || {};
        return (
          j.trigger === "hubspot_pipeline" ||
          j.trigger === "bulk_import" ||
          j.trigger === "hubspot_sync" ||
          j.trigger === "hubspot_backfill" ||
          snap.action === "bulk_import" ||
          snap.action === "sync" ||
          snap.action === "fix_missing_contacts" ||
          snap.type === "backfill" ||
          (j.trigger === "manual" && snap.current_company != null)
        );
      });
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
    return <div className="text-sm text-foreground/45 py-10 text-center">{emptyMessage}</div>;
  }
  return (
    <div className="divide-y divide-border/40">
      {companies.map((c) => (
        <div key={c.id ?? c.company_id} className="flex items-center justify-between py-2.5">
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium truncate">
              {c.name ?? (c.companies as any)?.name ?? "—"}
            </div>
            {c.domain && <div className="text-xs text-foreground/45">{c.domain}</div>}
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

function useJobStats(job: any) {
  return useQuery({
    queryKey: ["job_stats", job?.id],
    enabled: !!job,
    queryFn: async () => {
      if (!job) return { upserted: 0, withContacts: 0, scored: 0, failed: 0 };
      const since = job.started_at;

      // Companies upserted/updated since job started
      const { count: upserted } = await supabase
        .from("companies")
        .select("id", { count: "exact", head: true })
        .gte("updated_at", since);

      // Of those, how many have at least one contact
      const { data: companiesWithContacts } = await supabase
        .from("contacts")
        .select("company_id")
        .gte("created_at", since);
      const withContacts = new Set((companiesWithContacts || []).map((c: any) => c.company_id)).size;

      // Of those, how many have a scout score recorded since job started
      const { count: scored } = await supabase
        .from("companies")
        .select("id", { count: "exact", head: true })
        .gte("scout_scored_at", since)
        .not("scout_score", "is", null);

      return {
        upserted: upserted ?? 0,
        withContacts,
        scored: scored ?? 0,
        failed: job.companies_failed ?? 0,
      };
    },
    refetchInterval: 5_000,
  });
}

function SyncJobSummary({ job, onCancel }: { job: any; onCancel?: () => void }) {
  const snap = job.settings_snapshot as any || {};
  const isRunning = job.status === "running";
  const isCompleted = job.status === "completed";
  const isCanceled = job.status === "canceled" || job.status === "failed";
  const isPipeline = job.trigger === "hubspot_pipeline";

  // Detect stall: running for >30 min
  const minutesRunning = (Date.now() - new Date(job.started_at).getTime()) / 60_000;
  const isStalled = isRunning && minutesRunning > 30;

  const { data: stats } = useJobStats(job);

  // Phase info for pipeline jobs
  const phase: number | string = snap.phase ?? 0;
  const PHASE_LABELS: Record<string | number, { label: string; detail: string }> = {
    1: { label: "Phase 1 — Companies", detail: `Upserting companies from HubSpot (${snap.phase1_processed ?? 0} so far)` },
    2: { label: "Phase 2 — Contacts",  detail: `Fetching contacts for companies with none (${snap.phase2_contacts_imported ?? 0} imported)` },
    3: { label: "Phase 3 — Scoring",   detail: `Scoring touched companies (${snap.phase3_scored ?? 0}/${(snap.touched_ids ?? []).length})` },
    done: { label: "Complete", detail: "All 3 phases finished successfully" },
  };
  const phaseInfo = PHASE_LABELS[phase] ?? null;

  // Phase progress bar for pipeline
  const phaseNum = typeof phase === "number" ? phase : 3;
  const phasePct = isPipeline ? Math.round(((phaseNum - 1) / 3) * 100) : null;

  const statCells = [
    {
      label: "Upserted",
      value: isPipeline ? (snap.phase1_processed ?? 0) : (stats?.upserted ?? job.companies_processed ?? 0),
      icon: <Download className="w-3 h-3" />,
      description: "Company records created or updated",
    },
    {
      label: "Contacts Imported",
      value: isPipeline ? (snap.phase2_contacts_imported ?? 0) : (stats?.withContacts ?? 0),
      icon: <User className="w-3 h-3" />,
      description: "Contacts fetched from HubSpot",
    },
    {
      label: "Scout Scored",
      value: isPipeline ? (snap.phase3_scored ?? 0) : (stats?.scored ?? 0),
      icon: <Zap className="w-3 h-3" />,
      description: "Companies with a fresh Scout Score",
    },
    {
      label: "Errors",
      value: job.companies_failed ?? 0,
      icon: <AlertCircle className="w-3 h-3" />,
      warn: (job.companies_failed ?? 0) > 0,
    },
  ];

  return (
    <div className={`rounded-lg border p-4 space-y-3 ${isStalled ? "border-warning/50 bg-warning/5" : "border-border bg-card/50"}`}>
      {/* Stall warning banner */}
      {isStalled && (
        <div className="flex items-center gap-2 rounded-md bg-warning/10 border border-warning/30 px-3 py-2 text-xs text-warning">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span className="flex-1">
            This job has been running for <strong>{Math.round(minutesRunning)} minutes</strong> — the background worker may have stalled.
          </span>
          {onCancel && (
            <button
              onClick={onCancel}
              className="ml-2 px-2.5 py-1 rounded bg-warning/20 hover:bg-warning/30 border border-warning/40 font-medium transition-colors whitespace-nowrap"
            >
              Cancel job
            </button>
          )}
        </div>
      )}

      {/* Phase progress strip for pipeline jobs */}
      {isPipeline && isRunning && phaseInfo && (
        <div className="rounded-md bg-primary/5 border border-primary/15 px-3 py-2">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold text-primary">{phaseInfo.label}</span>
            <span className="text-xs text-foreground/45">Phase {phaseNum} of 3</span>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden mb-1">
            <div className="h-full rounded-full bg-primary transition-all duration-700" style={{ width: `${phasePct}%` }} />
          </div>
          <p className="text-micro text-foreground/45">{phaseInfo.detail}</p>
        </div>
      )}

      {/* Status row */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {isRunning && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
          {isCompleted && <CheckCircle2 className="w-4 h-4 text-success" />}
          {isCanceled && <XCircle className="w-4 h-4 text-destructive" />}
          <span className="text-sm font-semibold capitalize">
            {isStalled ? "Stalled" : isRunning ? (isPipeline ? "Pipeline running…" : "Syncing…") : job.status}
          </span>
          <span className="text-xs text-foreground/45">
            {job.trigger === "hubspot_pipeline"
              ? "Full 3-phase sync"
              : job.trigger === "hubspot_backfill"
              ? "Full backfill"
              : snap.action === "fix_missing_contacts"
              ? "Fix missing contacts"
              : snap.action === "bulk_import"
              ? "All companies"
              : snap.current_company
              ? snap.current_company
              : snap.action ?? "HubSpot sync"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {isRunning && !isStalled && onCancel && (
            <button
              onClick={onCancel}
              className="text-xs px-2 py-0.5 rounded border border-border text-foreground/45 hover:text-destructive hover:border-destructive/50 transition-colors"
            >
              Cancel
            </button>
          )}
          <span className="text-xs text-foreground/45 tabular-nums">
            {fmt(job.started_at)}
            {job.finished_at && ` · ${elapsed(job.started_at)} total`}
            {isRunning && ` · ${elapsed(job.started_at)} elapsed`}
          </span>
        </div>
      </div>

      {/* Progress bar */}
      {job.total_companies_targeted > 0 && (() => {
        const barPct = Math.round((job.companies_processed / job.total_companies_targeted) * 100);
        return (
          <div className="space-y-1">
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${isCompleted ? "bg-success" : "bg-primary"}`}
                style={{ width: `${barPct ?? 0}%` }}
              />
            </div>
            <div className="flex justify-between text-micro text-foreground/45 tabular-nums">
              <span>{job.companies_processed} / {job.total_companies_targeted} companies</span>
              <span>{barPct}%</span>
            </div>
          </div>
        );
      })()}

      {/* Stats grid — 4 meaningful counters */}
      <div className="grid grid-cols-4 gap-2 pt-1">
        {statCells.map(({ label, value, icon, warn }) => (
          <div key={label} className="rounded-md bg-muted/40 px-3 py-2 text-center">
            <div className={`flex justify-center mb-1 ${warn ? "text-destructive" : "text-foreground/45"}`}>
              {icon}
            </div>
            <div className={`text-base font-bold tabular-nums ${warn && value > 0 ? "text-destructive" : "text-foreground"}`}>
              {value}
            </div>
            <div className="text-micro text-foreground/45 mt-0.5 leading-tight">{label}</div>
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
  if (score == null) return <span className="text-xs text-foreground/45">—</span>;
  const color = score >= 70 ? "text-success" : score >= 40 ? "text-warning" : "text-foreground/45";
  return <span className={`text-sm font-bold tabular-nums ${color}`}>{score}</span>;
}

function ImportedCompanyRow({ company }: { company: any }) {
  const [open, setOpen] = useState(false);
  const hsProps = company.hubspot_properties as any || {};
  const hasHsData = Object.keys(hsProps).length > 0;

  const stageColor: Record<string, string> = {
    prospect: "bg-muted text-foreground/45",
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
        <span className="text-foreground/45 shrink-0">
          {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </span>

        {/* Company info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium truncate">{company.name}</span>
            {company.domain && (
              <span className="text-xs text-foreground/45 truncate">{company.domain}</span>
            )}
            <span className={`text-micro px-1.5 py-0.5 rounded-full font-medium ${stageColor[company.stage] ?? "bg-muted text-foreground/45"}`}>
              {company.stage ?? "prospect"}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-0.5 text-micro text-foreground/45">
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
            <div className="text-micro text-foreground/45 mt-0.5">scored</div>
          )}
        </div>

        {/* Sync status indicators */}
        <div className="flex flex-col items-end gap-1 shrink-0 w-20">
          {/* Contacts synced */}
          <div className="flex items-center gap-1 text-micro">
            {company.contact_count > 0
              ? <CheckCheck className="w-3 h-3 text-success" />
              : <Circle className="w-3 h-3 text-foreground/25" />}
            <span className={company.contact_count > 0 ? "text-success" : "text-foreground/45"}>
              contacts
            </span>
          </div>
          {/* Scout scored */}
          <div className="flex items-center gap-1 text-micro">
            {company.scout_score != null
              ? <CheckCheck className="w-3 h-3 text-success" />
              : <Circle className="w-3 h-3 text-foreground/25" />}
            <span className={company.scout_score != null ? "text-success" : "text-foreground/45"}>
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
              <div className="text-micro font-medium uppercase tracking-wide text-primary mb-1 flex items-center gap-1">
                <Zap className="w-3 h-3" /> Scout AI Summary
              </div>
              <p className="text-xs text-foreground leading-relaxed">{company.scout_summary}</p>
            </div>
          )}
          {!company.scout_summary && !company.scout_scored_at && (
            <div className="text-xs text-foreground/45 italic">Scout scoring not yet run for this company.</div>
          )}

          {/* HubSpot properties snapshot */}
          {hasHsData && (
            <div className="rounded-md bg-muted/40 px-3 py-2 space-y-1.5">
              <div className="text-micro font-medium uppercase tracking-wide text-foreground/45 mb-1">
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
                    <span className="text-foreground/45 shrink-0">{label}:</span>
                    <span className="font-medium truncate">{String(value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Timestamps */}
          <div className="text-micro text-foreground/45 flex flex-wrap gap-x-4 gap-y-0.5">
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
  const qc = useQueryClient();
  const { data: jobs = [], isLoading: loadingJobs } = useHubspotJobs();
  const { data: companies = [], isLoading: loadingCompanies } = useRecentlyImported();

  // ── Single pipeline trigger (replaces old bulk_import + fix_missing_contacts) ─
  const runPipeline = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("hubspot-pipeline", {
        body: {},
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast.success("Full HubSpot sync started — companies → contacts → scoring. Running in background.");
      qc.invalidateQueries({ queryKey: ["hubspot_jobs"] });
    },
    onError: (err: any) => {
      toast.error(`Pipeline failed to start: ${err?.message || "Unknown error"}`);
    },
  });

  const cancelJob = useMutation({
    mutationFn: async (jobId: string) => {
      const { error } = await supabase
        .from("processing_jobs")
        .update({ status: "canceled", finished_at: new Date().toISOString(), error_summary: "Manually canceled by user." })
        .eq("id", jobId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Job canceled.");
      qc.invalidateQueries({ queryKey: ["hubspot_jobs"] });
    },
    onError: (err: any) => {
      toast.error(`Cancel failed: ${err?.message || "Unknown error"}`);
    },
  });

  const activeJob = jobs.find((j: any) => j.status === "running");
  const recentJobs = jobs.slice(0, 5);

  // Categorise companies
  const scored = companies.filter((c: any) => c.scout_score != null);
  const noContacts = companies.filter((c: any) => c.contact_count === 0);

  const [companyTab, setCompanyTab] = useState<"all" | "scored" | "no_contacts">("all");

  const displayCompanies =
    companyTab === "scored" ? scored :
    companyTab === "no_contacts" ? noContacts :
    companies;

  if (loadingJobs && loadingCompanies) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-5 h-5 animate-spin text-foreground/45" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header row — single pipeline button */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-foreground/45 uppercase tracking-wider">HubSpot Sync</h2>
          <p className="text-micro text-foreground/45 mt-0.5">
            Runs sequentially: Phase 1 companies → Phase 2 contacts → Phase 3 scoring
          </p>
        </div>
        <button
          onClick={() => runPipeline.mutate()}
          disabled={runPipeline.isPending || !!activeJob}
          className="flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {runPipeline.isPending || activeJob ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Download className="w-3.5 h-3.5" />
          )}
          {activeJob ? "Sync running…" : "Run Full Sync"}
        </button>
      </div>

      {/* Active job card */}
      {activeJob ? (
        <SyncJobSummary job={activeJob} onCancel={() => cancelJob.mutate(activeJob.id)} />
      ) : (
        <div className="rounded-lg border border-border bg-card/50 px-4 py-3 flex items-center gap-2 text-sm text-foreground/45">
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
          <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground/45 mb-2">Recent Sync Runs</h3>
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
                  <span className="text-foreground/45">{fmt(job.started_at)}</span>
                  <span className="text-foreground">
                    {job.trigger === "hubspot_pipeline"
                      ? "Full pipeline (3 phases)"
                      : snap.current_company
                      ? snap.current_company
                      : snap.action === "bulk_import"
                      ? "All companies"
                      : job.trigger === "hubspot_backfill"
                      ? "Full backfill"
                      : snap.action ?? job.trigger}
                  </span>
                  <span className="ml-auto text-foreground/45 tabular-nums">
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
          <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground/45 mb-2">
            Last 7 Days — {companies.length} Companies Imported
          </h3>
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: "Total imported", value: companies.length, icon: <Download className="w-3.5 h-3.5" /> },
              { label: "With contacts", value: companies.filter((c: any) => c.contact_count > 0).length, icon: <User className="w-3.5 h-3.5" /> },
              { label: "Scout scored", value: scored.length, icon: <Zap className="w-3.5 h-3.5" /> },
              { label: "Missing contacts", value: noContacts.length, icon: <AlertCircle className="w-3.5 h-3.5" />, warn: noContacts.length > 0 },
            ].map(({ label, value, icon, warn }) => (
              <div key={label} className="rounded-lg border border-border bg-card/50 p-3 text-center">
                <div className={`flex justify-center mb-1 ${warn ? "text-warning" : "text-foreground/45"}`}>{icon}</div>
                <div className={`text-xl font-bold tabular-nums ${warn && value > 0 ? "text-warning" : "text-foreground"}`}>{value}</div>
                <div className="text-micro text-foreground/45 mt-0.5">{label}</div>
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
            <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground/45 mr-1">Companies</h3>
            {(["all", "scored", "no_contacts"] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setCompanyTab(tab)}
                className={`text-xs px-2.5 py-1 rounded-full border transition-all ${
                  companyTab === tab
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border text-foreground/45 hover:text-foreground hover:border-muted-foreground/40"
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
              <div className="py-8 text-center text-sm text-foreground/45">No companies in this view.</div>
            ) : (
              displayCompanies.map((c: any) => (
                <ImportedCompanyRow key={c.id} company={c} />
              ))
            )}
          </div>
        </div>
      )}

      {companies.length === 0 && !loadingCompanies && (
        <div className="py-10 text-center text-sm text-foreground/45">
          No companies imported in the last 7 days.
        </div>
      )}
    </div>
  );
}

// ── Story Generation tab ──────────────────────────────────────────────────────

function StoryGenerationTab() {
  const { data, isLoading } = useStoryGenerationData();

  const activeJob   = data?.activeJob   ?? null;
  const activeCompany = data?.activeCompany ?? null;
  const completed   = data?.completed   ?? [];
  const failed      = data?.failed      ?? [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-5 h-5 animate-spin text-foreground/45" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Info banner */}
      <div className="rounded-lg border border-border bg-card/50 px-4 py-3 flex items-center gap-2 text-sm text-foreground/45">
        <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
        Stories are generated per-company from the company detail page. No bulk generation.
      </div>

      {/* Waiting — only shown when a job is actively running */}
      {activeJob && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground/45 mb-2">Waiting</h3>
          <div className="rounded-lg border border-border bg-card/50 p-4 flex items-center gap-3">
            <Loader2 className="w-4 h-4 animate-spin text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              {activeCompany ? (
                <Link
                  to={`/company/${activeCompany.id}`}
                  className="text-sm font-medium hover:underline underline-offset-2"
                >
                  {activeCompany.name}
                </Link>
              ) : (
                <span className="text-sm font-medium text-foreground/45">Generating story…</span>
              )}
              <div className="flex items-center gap-3 mt-0.5 text-xs text-foreground/45">
                {activeJob.triggered_by && (
                  <span className="flex items-center gap-1">
                    <User className="w-3 h-3" />
                    {activeJob.triggered_by}
                  </span>
                )}
                <span>Started {formatDistanceToNow(new Date(activeJob.started_at), { addSuffix: true, includeSeconds: true })}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      <Tabs defaultValue="completed">
        <TabsList className="w-full grid grid-cols-2">
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
        <TabsContent value="completed" className="mt-4 max-h-[60vh] overflow-y-auto">
          <CompanyList companies={completed} emptyMessage="No completed stories yet." />
        </TabsContent>
        <TabsContent value="failed" className="mt-4 max-h-[60vh] overflow-y-auto">
          <CompanyList companies={failed} emptyMessage="No failed items — great!" />
        </TabsContent>
      </Tabs>
    </div>
  );
}
// ── Main page ─────────────────────────────────────────────────────────────────

export default function JobHistory() {
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Processing Status</h1>
        <p className="text-sm text-foreground/45 mt-1">Monitor story generation and HubSpot sync activity</p>
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
