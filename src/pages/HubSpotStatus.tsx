import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { AlertCircle, CheckCircle2, Loader2, RefreshCw, XCircle } from "lucide-react";
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
        .select("id, name, domain, category, stage, scout_score, updated_at, created_at")
        .gte("updated_at", since)
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
  if (value === "active_opp") return "bg-amber-500/10 text-amber-400 border-amber-500/20";
  if (value === "customer") return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
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
      </div>

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
          const updatedAt = new Date(company.updated_at);
          const createdAt = new Date(company.created_at);
          const label = updatedAt.getTime() === createdAt.getTime() ? "Created" : "Updated";
          return (
            <div key={company.id} className="flex items-start justify-between gap-3 border-b border-border/40 pb-2 last:border-0">
              <div className="min-w-0">
                <Link to={`/company/${company.id}`} className="text-caption font-medium hover:underline">{company.name || "Unnamed"}</Link>
                <div className="text-micro text-foreground/40">{company.domain || "—"}</div>
                <div className="flex items-center gap-1 mt-1 text-micro">
                  <span className={`px-1.5 py-0.5 rounded border ${pillClass(company.category)}`}>{company.category || "business"}</span>
                  <span className={`px-1.5 py-0.5 rounded border ${pillClass(company.stage)}`}>{company.stage || "prospect"}</span>
                  {isNew && <span className="px-1.5 py-0.5 rounded border border-emerald-500/20 bg-emerald-500/10 text-emerald-400">NEW</span>}
                </div>
              </div>
              <div className="text-right text-micro text-foreground/40">
                {company.scout_score != null && <div>Score {company.scout_score}</div>}
                <div>{label} {formatDistanceToNow(new Date(label === "Created" ? company.created_at : company.updated_at), { addSuffix: true })}</div>
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
