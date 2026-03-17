import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { AlertCircle, CheckCircle2, Loader2, RefreshCw, Signal, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

type SyncLogRow = {
  id: string;
  started_at: string;
  finished_at: string | null;
  hours_back: number;
  contacts_found: number;
  companies_created: number;
  companies_updated: number;
  contacts_created: number;
  contacts_updated: number;
  companies_scored: number;
  error_count: number;
  errors: any;
  has_more: boolean;
  status: "running" | "completed" | "failed";
};

function useLatestSyncLog() {
  return useQuery({
    queryKey: ["sync_log_latest"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("sync_log")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return (data || null) as SyncLogRow | null;
    },
    refetchInterval: 15_000,
  });
}

function useSyncHistory() {
  return useQuery({
    queryKey: ["sync_log_history"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("sync_log")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(20);
      return (data || []) as SyncLogRow[];
    },
    refetchInterval: 30_000,
  });
}

function useRecentlyUpdatedCompanies() {
  return useQuery({
    queryKey: ["recent_companies_24h"],
    queryFn: async () => {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from("companies")
        .select("id, name, domain, account_type, lifecycle_stage, sales_motion, scout_score, last_sync_changes, updated_at, created_at")
        .gte("updated_at", since)
        .not("last_sync_changes->>trigger", "eq", "no_change")
        .order("updated_at", { ascending: false })
        .limit(50);
      return data || [];
    },
    refetchInterval: 30_000,
  });
}

function useRecentlyUpdatedContacts() {
  return useQuery({
    queryKey: ["recent_contacts_24h"],
    queryFn: async () => {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from("contacts")
        .select("id, name, email, title, company_id, source, updated_at, created_at, hubspot_properties")
        .eq("source", "hubspot")
        .gte("updated_at", since)
        .order("updated_at", { ascending: false })
        .limit(100);
      return data || [];
    },
    refetchInterval: 30_000,
  });
}

function useCompanyContactCounts() {
  return useQuery({
    queryKey: ["sync_counts"],
    queryFn: async () => {
      const [compRes, contRes] = await Promise.all([
        supabase.from("companies").select("id", { count: "exact", head: true }),
        supabase.from("contacts").select("id", { count: "exact", head: true }),
      ]);
      return {
        companies: compRes.count ?? 0,
        contacts: contRes.count ?? 0,
      };
    },
    refetchInterval: 60_000,
  });
}

function pillClass(value?: string | null) {
  if (value === "school") return "bg-blue-500/10 text-blue-400 border-blue-500/20";
  if (value === "partner") return "bg-purple-500/10 text-purple-400 border-purple-500/20";
  if (value === "company") return "bg-secondary text-foreground/60 border-border";
  if (value === "opportunity") return "bg-amber-500/10 text-amber-400 border-amber-500/20";
  if (value === "customer") return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
  if (value === "prospect") return "bg-secondary text-foreground/60 border-border";
  return "bg-secondary text-foreground/60 border-border";
}

function formatDuration(start?: string, end?: string | null) {
  if (!start || !end) return "—";
  const ms = Math.max(0, new Date(end).getTime() - new Date(start).getTime());
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

export default function HubSpotStatus() {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState<string | null>(null);
  const { data: latest } = useLatestSyncLog();
  const { data: history = [] } = useSyncHistory();
  const { data: companies = [] } = useRecentlyUpdatedCompanies();
  const { data: contacts = [] } = useRecentlyUpdatedContacts();
  const { data: counts } = useCompanyContactCounts();

  const completedLatest = useMemo(
    () => history.find((h) => h.status === "completed") || null,
    [history],
  );

  const companyMapQuery = useQuery({
    queryKey: ["recent_contacts_company_map", contacts.map((c: any) => c.company_id).filter(Boolean).sort().join(",")],
    enabled: contacts.length > 0,
    queryFn: async () => {
      const ids = [...new Set(contacts.map((c: any) => c.company_id).filter(Boolean))];
      if (ids.length === 0) return {} as Record<string, string>;
      const { data } = await supabase.from("companies").select("id, name").in("id", ids);
      return Object.fromEntries((data || []).map((c: any) => [c.id, c.name])) as Record<string, string>;
    },
    refetchInterval: 30_000,
  });

  const syncNow = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.functions.invoke("hubspot-daily-sync", { body: { hours_back: 24 } });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Sync triggered");
      qc.invalidateQueries({ queryKey: ["sync_log_latest"] });
      qc.invalidateQueries({ queryKey: ["sync_log_history"] });
      qc.invalidateQueries({ queryKey: ["recent_companies_24h"] });
      qc.invalidateQueries({ queryKey: ["recent_contacts_24h"] });
      qc.invalidateQueries({ queryKey: ["sync_counts"] });
    },
    onError: (err: any) => toast.error(`Sync failed: ${err?.message}`),
  });

  const { data: backfillStatus } = useQuery({
    queryKey: ["backfill_log_latest"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("backfill_log")
        .select("*")
        .eq("job_type", "plan_names")
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    refetchInterval: (query: any) =>
      query.state.data?.status === "running" ? 2_000 : 30_000,
  });

  const backfillPlans = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("backfill-plan-names", {
        body: { offset: 0 },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["backfill_log_latest"] });
      toast.success("Plan backfill started");
    },
    onError: (err: any) => toast.error(`Backfill failed: ${err?.message}`),
  });

  const health = (() => {
    if (!history.length) return { label: "Never synced", tone: "neutral" as const };
    if (latest?.status === "running") return { label: "Sync in progress…", tone: "running" as const };
    if (latest?.status === "failed") return { label: "Down", tone: "down" as const };
    if (!completedLatest?.started_at) return { label: "Never synced", tone: "neutral" as const };
    const hoursAgo = (Date.now() - new Date(completedLatest.started_at).getTime()) / 3_600_000;
    if (hoursAgo < 5) return { label: "Healthy", tone: "healthy" as const };
    if (hoursAgo < 12) return { label: "Stale", tone: "stale" as const };
    return { label: "Down", tone: "down" as const };
  })();

  return (
    <div className="max-w-4xl space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-display font-semibold tracking-tight">HubSpot Sync</h1>
        <Button className="gap-1.5" onClick={() => syncNow.mutate()} disabled={syncNow.isPending}>
          {syncNow.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Sync Now
        </Button>
        <Button variant="outline" className="gap-1.5" onClick={() => backfillPlans.mutate()} disabled={backfillPlans.isPending}>
          {backfillPlans.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Backfill Plans
        </Button>
      </div>

      {/* Backfill progress panel */}
      {backfillStatus && (
        <div className="rounded-xl border border-border bg-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {backfillStatus.status === "running" && (
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
              )}
              {backfillStatus.status === "completed" && (
                <CheckCircle2 className="w-4 h-4 text-success" />
              )}
              {backfillStatus.status === "failed" && (
                <AlertCircle className="w-4 h-4 text-destructive" />
              )}
              <span className="text-caption font-medium">
                {backfillStatus.status === "running"  && "Backfilling plan names…"}
                {backfillStatus.status === "completed" && "Plan backfill complete"}
                {backfillStatus.status === "failed"    && "Backfill failed"}
              </span>
            </div>
            <span className="text-micro text-foreground/40">
              {formatDistanceToNow(new Date(backfillStatus.started_at), { addSuffix: true })}
            </span>
          </div>

          {backfillStatus.contacts_total > 0 && (
            <div>
              <div className="flex justify-between text-micro text-foreground/40 mb-1.5">
                <span>
                  {backfillStatus.contacts_processed.toLocaleString()} / {backfillStatus.contacts_total.toLocaleString()} contacts
                </span>
                <span>
                  {Math.round((backfillStatus.contacts_processed / backfillStatus.contacts_total) * 100)}%
                </span>
              </div>
              <div className="h-1.5 bg-foreground/[0.06] rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(100, Math.round(
                      (backfillStatus.contacts_processed / backfillStatus.contacts_total) * 100
                    ))}%`
                  }}
                />
              </div>
            </div>
          )}

          <div className="flex items-center gap-5 text-micro text-foreground/50">
            <span>
              <span className="text-foreground font-medium tabular-nums">
                {backfillStatus.contacts_updated.toLocaleString()}
              </span> updated
            </span>
            <span>
              <span className="text-foreground font-medium tabular-nums">
                {backfillStatus.contacts_skipped.toLocaleString()}
              </span> skipped
            </span>
            <span>
              <span className="text-foreground font-medium tabular-nums">
                {backfillStatus.companies_rescored.toLocaleString()}
              </span> companies rescored
            </span>
          </div>

          {backfillStatus.status === "failed" && backfillStatus.error && (
            <p className="text-micro text-destructive/70">{backfillStatus.error}</p>
          )}
        </div>
      )}

      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <div className="flex items-center gap-3">
          {health.tone === "healthy" && <CheckCircle2 className="w-5 h-5 text-success" />}
          {(health.tone === "stale" || health.tone === "down" || health.tone === "neutral") && <AlertCircle className={`w-5 h-5 ${health.tone === "down" ? "text-destructive" : health.tone === "stale" ? "text-warning" : "text-foreground/25"}`} />}
          {health.tone === "running" && <Loader2 className="w-5 h-5 animate-spin text-primary" />}
          <div>
            <h2 className="text-title font-semibold">{health.label}</h2>
            <p className="text-caption text-foreground/40">
              {completedLatest?.started_at
                ? `Last sync ${formatDistanceToNow(new Date(completedLatest.started_at), { addSuffix: true })}`
                : "No completed runs yet"}
            </p>
          </div>
        </div>
        {completedLatest && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-caption">
            <div><span className="field-label">Contacts found</span><div>{completedLatest.contacts_found}</div></div>
            <div><span className="field-label">Companies</span><div>+{completedLatest.companies_created} / {completedLatest.companies_updated} updated</div></div>
            <div><span className="field-label">Contacts</span><div>+{completedLatest.contacts_created} / {completedLatest.contacts_updated} updated</div></div>
            <div><span className="field-label">Scored</span><div>{completedLatest.companies_scored}</div></div>
            <div><span className="field-label">Errors</span><div>{completedLatest.error_count}</div></div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div>
          <div className="field-label">Companies</div>
          <div className="text-display font-semibold tabular-nums mt-1">{(counts?.companies || 0).toLocaleString()}</div>
        </div>
        <div>
          <div className="field-label">Contacts</div>
          <div className="text-display font-semibold tabular-nums mt-1">{(counts?.contacts || 0).toLocaleString()}</div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 space-y-3">
        <h3 className="text-title font-semibold">Recently synced companies (24h)</h3>
        {companies.map((company: any) => {
          const isNew = Date.now() - new Date(company.created_at).getTime() < 24 * 60 * 60 * 1000;

          function getSyncLabel(c: any): { label: string; tone: "new" | "hot" | "warm" | "neutral" } {
            const changes = c.last_sync_changes;
            const trigger = changes?.trigger;
            if (!trigger || trigger === "no_change") return { label: "No changes", tone: "neutral" };
            if (trigger === "new_record")       return { label: "New",               tone: "new"  };
            if (trigger === "product_activity") return { label: "Product activity",  tone: "hot"  };
            if (trigger === "lifecycle_change") return { label: "Lifecycle changed", tone: "warm" };
            if (trigger === "crm_update")       return { label: "CRM updated",       tone: "neutral" };
            if (trigger === "contact_update")   return { label: "Contact updated",   tone: "neutral" };
            return { label: "Updated", tone: "neutral" };
          }

          const TONE_STYLES: Record<string, string> = {
            hot:     "text-amber-400",
            warm:    "text-primary",
            new:     "text-emerald-400",
            neutral: "text-foreground/40",
          };

          const { label: triggerLabel, tone } = getSyncLabel(company);

          return (
            <div key={company.id} className="flex items-start justify-between gap-3 border-b border-border/40 pb-2 last:border-0">
              <div className="min-w-0">
                <Link to={`/company/${company.id}`} className="text-caption font-medium hover:underline">{company.name || "Unnamed"}</Link>
                <div className="text-micro text-foreground/40">{company.domain || "—"}</div>
                <div className="flex items-center gap-1 mt-1 text-micro">
                  <span className={`px-1.5 py-0.5 rounded border ${pillClass(company.account_type)}`}>{company.account_type || "company"}</span>
                  <span className={`px-1.5 py-0.5 rounded border ${pillClass(company.lifecycle_stage)}`}>{company.lifecycle_stage || "prospect"}</span>
                  {isNew && <span className="px-1.5 py-0.5 rounded border border-emerald-500/20 bg-emerald-500/10 text-emerald-400">NEW</span>}
                </div>
                {/* What changed in this sync */}
                {(() => {
                  const changes = (company as any).last_sync_changes;
                  if (!changes || changes.trigger === "no_change") return null;

                  const FIELD_LABELS: Record<string, string> = {
                    lifecyclestage:                        "lifecycle",
                    numberofemployees:                     "headcount",
                    industry:                              "industry",
                    country:                               "country",
                    hubspot_owner_id:                      "owner",
                    name:                                  "name",
                    first_tutorial_create_date:            "new tutorial creator",
                    answers_with_own_tutorial_month_count: "monthly usage",
                    extension_connections:                 "extension installed",
                    first_tutorial_view_date:              "new viewer",
                    plan_name:                             "plan changed",
                  };

                  const fieldEntries = Object.entries(changes.fields || {}) as [string, { from: any; to: any }][];
                  const activityEntries: { contact: string; field: string; from: any; to: any }[] = [];
                  for (const [contactName, fieldChanges] of Object.entries(changes.activity || {})) {
                    for (const [field, diff] of Object.entries(fieldChanges as any)) {
                      activityEntries.push({ contact: contactName, field, ...(diff as any) });
                    }
                  }

                  if (fieldEntries.length === 0 && activityEntries.length === 0 && changes.trigger !== "new_record") return null;

                  return (
                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                      {fieldEntries.map(([field, { from, to }]) => (
                        field === "lifecyclestage" ? (
                          <span key={field} className="text-micro px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                            {from || "—"} → {to}
                          </span>
                        ) : (
                          <span key={field} className="text-micro px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border">
                            {FIELD_LABELS[field] || field} changed
                          </span>
                        )
                      ))}
                      {activityEntries.map(({ contact, field }, i) => (
                        <span key={i} className="text-micro px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          {contact.split(" ")[0]}: {FIELD_LABELS[field] || field}
                        </span>
                      ))}
                      {changes.trigger === "new_record" && (
                        <span className="text-micro px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          new
                        </span>
                      )}
                    </div>
                  );
                })()}
              </div>
              <div className="text-right shrink-0 space-y-0.5">
                <div className={`text-micro font-medium ${TONE_STYLES[tone]}`}>{triggerLabel}</div>
                {company.scout_score != null && (
                  <div className="text-micro text-foreground/40">Score {company.scout_score}</div>
                )}
                <div className="text-micro text-foreground/30">
                  {formatDistanceToNow(new Date(company.updated_at), { addSuffix: true })}
                </div>
              </div>
            </div>
          );
        })}
        {companies.length === 0 && <p className="text-caption text-foreground/40">No companies updated in the last 24 hours.</p>}
      </div>

      <div className="rounded-xl border border-border bg-card p-6 space-y-3">
        <h3 className="text-title font-semibold">Recently synced contacts (24h)</h3>
        {contacts.map((contact: any) => {
          const props = (contact.hubspot_properties || {}) as any;
          const rank = Number(props.rank || 0);
          const updatedAt = new Date(contact.updated_at);
          const createdAt = new Date(contact.created_at);
          const label = updatedAt.getTime() === createdAt.getTime() ? "Created" : "Updated";
          return (
            <div key={contact.id} className="flex items-start justify-between gap-3 border-b border-border/40 pb-2 last:border-0">
              <div className="min-w-0">
                <div className="text-caption font-medium">{contact.name || "Unnamed"}</div>
                <div className="text-micro text-foreground/40">{contact.title || "—"}</div>
                <div className="text-micro text-foreground/40">
                  {contact.company_id && (
                    <Link to={`/company/${contact.company_id}`} className="hover:underline">
                      {companyMapQuery.data?.[contact.company_id] || "Company"}
                    </Link>
                  )}
                  {contact.email ? ` · ${contact.email}` : ""}
                </div>
                <div className="flex items-center gap-1 mt-1 text-micro">
                  {rank > 0 && <span className="px-1.5 py-0.5 rounded border border-border bg-secondary">Rank {rank}</span>}
                  {props.first_tutorial_create_date && <span className="px-1.5 py-0.5 rounded border border-border bg-secondary">Creator</span>}
                  {props.first_tutorial_view_date && <span className="px-1.5 py-0.5 rounded border border-border bg-secondary">Viewer</span>}
                  {Number(props.extension_connections || 0) > 0 && <span className="px-1.5 py-0.5 rounded border border-border bg-secondary">Extension</span>}
                </div>
              </div>
              <div className="text-right text-micro text-foreground/40">
                <div>{label} {formatDistanceToNow(new Date(label === "Created" ? contact.created_at : contact.updated_at), { addSuffix: true })}</div>
              </div>
            </div>
          );
        })}
        {contacts.length === 0 && <p className="text-caption text-foreground/40">No HubSpot contacts updated in the last 24 hours.</p>}
      </div>

      <div className="rounded-xl border border-border bg-card p-6 space-y-3">
        <h3 className="text-title font-semibold">Sync history (last 20 runs)</h3>
        {history.map((run) => (
          <div key={run.id} className="border-b border-border/40 pb-2 last:border-0">
            <button className="w-full flex items-center justify-between text-left" onClick={() => setExpanded(expanded === run.id ? null : run.id)}>
              <div className="flex items-center gap-2 text-caption">
                {run.status === "completed" && <CheckCircle2 className="w-4 h-4 text-success" />}
                {run.status === "failed" && <XCircle className="w-4 h-4 text-destructive" />}
                {run.status === "running" && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
                <span>{formatDistanceToNow(new Date(run.started_at), { addSuffix: true })}</span>
                <span className="text-foreground/40">· {formatDuration(run.started_at, run.finished_at)}</span>
              </div>
              <div className="text-micro text-foreground/50">
                {run.contacts_found} contacts → {run.companies_updated + run.companies_created} companies ({run.companies_created} new)
                {run.error_count > 0 && <span className="text-destructive"> · {run.error_count} errors</span>}
              </div>
            </button>
            {expanded === run.id && Array.isArray(run.errors) && run.errors.length > 0 && (
              <pre className="mt-2 text-micro text-destructive whitespace-pre-wrap">{JSON.stringify(run.errors, null, 2)}</pre>
            )}
          </div>
        ))}
        {history.length === 0 && <p className="text-caption text-foreground/40">No sync runs yet.</p>}
      </div>

      <p className="text-micro text-foreground/20 leading-relaxed">
        Sync runs automatically every 4 hours with a 24-hour lookback window. Records are idempotent — overlapping runs are safe.
      </p>
    </div>
  );
}
