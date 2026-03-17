import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { AlertCircle, CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";

type SyncEvent = {
  id: number;
  created_at: string;
  source: string;
  job_id: string | null;
  entity_type: string;
  entity_id: string | null;
  entity_name: string | null;
  action: string;
  meta: any;
  // Enriched client-side
  _email?: string | null;
  _company_name?: string | null;
};

export default function HubSpotStatus() {
  const qc = useQueryClient();
  const [now, setNow] = useState(Date.now());
  const [events, setEvents] = useState<SyncEvent[]>([]);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 5_000);
    return () => clearInterval(interval);
  }, []);

  // ── Initial event load (only created/updated contact/company) ───────────
  const { data: initialEvents } = useQuery({
    queryKey: ["sync_events_initial"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("sync_events")
        .select("*")
        .in("action", ["created", "updated"])
        .in("entity_type", ["contact", "company"])
        .order("created_at", { ascending: false })
        .limit(100);
      return (data || []) as SyncEvent[];
    },
  });

  // Enrich events with company names and emails
  useEffect(() => {
    if (!initialEvents?.length) return;

    const enrichEvents = async (evts: SyncEvent[]) => {
      // Collect unique company IDs and contact IDs
      const companyIds = new Set<string>();
      const contactIds = new Set<string>();
      for (const e of evts) {
        if (e.entity_type === "contact" && e.meta?.company_id) companyIds.add(e.meta.company_id);
        if (e.entity_type === "company" && e.entity_id) companyIds.add(e.entity_id);
        if (e.entity_type === "contact" && e.entity_id) contactIds.add(e.entity_id);
      }

      const [companyRes, contactRes] = await Promise.all([
        companyIds.size > 0
          ? supabase.from("companies").select("id, name").in("id", [...companyIds])
          : { data: [] },
        contactIds.size > 0
          ? supabase.from("contacts").select("id, email").in("id", [...contactIds])
          : { data: [] },
      ]);

      const companyMap = new Map((companyRes.data || []).map((c: any) => [c.id, c.name]));
      const contactMap = new Map((contactRes.data || []).map((c: any) => [c.id, c.email]));

      return evts.map(e => ({
        ...e,
        _company_name: e.entity_type === "contact"
          ? companyMap.get(e.meta?.company_id) || null
          : e.entity_type === "company" ? e.entity_name : null,
        _email: e.entity_type === "contact" ? contactMap.get(e.entity_id!) || null : null,
      }));
    };

    enrichEvents(initialEvents).then(setEvents);
  }, [initialEvents]);

  // ── Realtime — only contact/company creates and updates ─────────────────
  useEffect(() => {
    const channel = supabase
      .channel("sync_imports")
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "sync_events",
      }, (payload) => {
        const e = payload.new as SyncEvent;
        if (
          ["created", "updated"].includes(e.action) &&
          ["contact", "company"].includes(e.entity_type)
        ) {
          setEvents(prev => [e, ...prev].slice(0, 100));
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  // ── Health query ────────────────────────────────────────────────────────
  const { data: health } = useQuery({
    queryKey: ["sync_health_v2"],
    queryFn: async () => {
      const [
        dbContactsRes, dbCompaniesRes,
        hsContactRes, hsCompanyRes,
        lastSyncRes,
        expansionRes, pqlRes,
        rescoreRes,
      ] = await Promise.all([
        supabase.from("contacts").select("id", { count: "exact", head: true }),
        supabase.from("companies").select("id", { count: "exact", head: true }),
        (supabase as any).from("sync_checkpoints").select("value, updated_at").eq("key", "hubspot_contact_count").maybeSingle(),
        (supabase as any).from("sync_checkpoints").select("value, updated_at").eq("key", "hubspot_company_count").maybeSingle(),
        (supabase as any).from("sync_checkpoints").select("value, updated_at").eq("key", "last_contact_sync_result").maybeSingle(),
        supabase.from("companies").select("id", { count: "exact", head: true }).eq("expansion_signal", true),
        supabase.from("companies").select("id", { count: "exact", head: true }).eq("pql_signal", true),
        (supabase as any).from("backfill_log").select("*").eq("job_type", "score_all").order("started_at", { ascending: false }).limit(1).maybeSingle(),
      ]);

      const dbContacts  = dbContactsRes.count  ?? 0;
      const dbCompanies = dbCompaniesRes.count  ?? 0;
      const hsContacts  = hsContactRes.data ? parseInt(hsContactRes.data.value || "0", 10) : null;
      const hsCompanies = hsCompanyRes.data ? parseInt(hsCompanyRes.data.value || "0", 10) : null;
      const lastSync = lastSyncRes.data
        ? { ...JSON.parse(lastSyncRes.data.value || "{}"), at: lastSyncRes.data.updated_at }
        : null;

      return {
        dbContacts, dbCompanies, hsContacts, hsCompanies, lastSync,
        contactGap:  hsContacts  ? hsContacts  - dbContacts  : null,
        companyGap:  hsCompanies ? hsCompanies - dbCompanies : null,
        contactPct:  hsContacts  ? Math.round(dbContacts  / hsContacts  * 100) : null,
        companyPct:  hsCompanies ? Math.round(dbCompanies / hsCompanies * 100) : null,
        expansion:   expansionRes.count  ?? 0,
        pql:         pqlRes.count        ?? 0,
        rescoreLog:  rescoreRes.data,
      };
    },
    refetchInterval: (query) => {
      const d = query.state.data;
      if (d?.rescoreLog?.status === "running") return 2_000;
      return 30_000;
    },
  });

  // ── Mutations ───────────────────────────────────────────────────────────
  const syncNow = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.functions.invoke("hubspot-daily-sync", { body: { hours_back: 2 } });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Sync started");
      qc.invalidateQueries({ queryKey: ["sync_health_v2"] });
      qc.invalidateQueries({ queryKey: ["sync_events_initial"] });
    },
    onError: (err: any) => toast.error(`Sync failed: ${err?.message}`),
  });

  const rescoreAll = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.functions.invoke("score-companies", { body: { action: "score_all", offset: 0 } });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Rescore started");
      qc.invalidateQueries({ queryKey: ["sync_health_v2"] });
    },
    onError: (err: any) => toast.error(`Rescore failed: ${err?.message}`),
  });

  // ── Helpers ─────────────────────────────────────────────────────────────
  function relativeTime(dateStr: string) {
    const s = Math.max(0, Math.floor((now - new Date(dateStr).getTime()) / 1000));
    if (s < 60) return `${s}s ago`;
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    return formatDistanceToNow(new Date(dateStr), { addSuffix: true });
  }

  function StatPair({ label, db, hs, gap, pct }: {
    label: string; db: number; hs: number | null; gap: number | null; pct: number | null;
  }) {
    return (
      <div>
        <div className="field-label">{label}</div>
        <div className="flex items-end gap-2 mt-1">
          <span className="text-display font-semibold tabular-nums">{db.toLocaleString()}</span>
          {hs !== null && (
            <span className="text-title font-medium tabular-nums text-foreground/40 pb-0.5">
              / {hs.toLocaleString()}
            </span>
          )}
          {pct !== null && pct >= 99 && (
            <span className="text-micro text-emerald-400 font-medium pb-0.5">✓</span>
          )}
          {gap !== null && gap > 0 && (
            <span className="text-micro text-amber-400 font-medium pb-0.5">
              −{gap.toLocaleString()}
            </span>
          )}
        </div>

        {hs !== null && gap !== null && gap > 0 && (
          <div className="h-1 bg-foreground/[0.06] rounded-full overflow-hidden mt-2">
            <div
              className="h-full bg-primary rounded-full transition-all"
              style={{ width: `${Math.min(100, pct ?? 0)}%` }}
            />
          </div>
        )}
        {hs !== null && (
          <div className="text-micro text-foreground/25 mt-1">HubSpot (2yr active)</div>
        )}
      </div>
    );
  }

  // Today's import counts
  const todayEvents = useMemo(() => {
    const cutoff = now - 24 * 60 * 60 * 1000;
    return events.filter(e => new Date(e.created_at).getTime() > cutoff);
  }, [events, now]);

  const todayCreated = todayEvents.filter(e => e.action === "created").length;
  const todayUpdated = todayEvents.filter(e => e.action === "updated").length;
  const isSyncing = health?.lastSync?.has_more;

  return (
    <div className="max-w-4xl space-y-6">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-display font-semibold tracking-tight">HubSpot Sync</h1>
          <p className="text-caption text-foreground/35 mt-1">
            Syncs automatically every hour · watchdog monitors every 2 min
          </p>
        </div>
        <Button variant="outline" className="gap-1.5" onClick={() => syncNow.mutate()} disabled={syncNow.isPending}>
          {syncNow.isPending
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <RefreshCw className="w-4 h-4" />}
          Sync Now
        </Button>
      </div>

      {/* Auto-sync health indicator */}
      {health?.lastSync?.at && (
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full shrink-0 ${
            (() => {
              const mins = (now - new Date(health.lastSync.at).getTime()) / 60_000;
              if (mins < 70)  return "bg-emerald-400";
              if (mins < 130) return "bg-amber-400";
              return "bg-red-400";
            })()
          }`} />
          <span className="text-micro text-foreground/40">
            Last sync {formatDistanceToNow(new Date(health.lastSync.at), { addSuffix: true })}
            {health.lastSync.has_more && (
              <span className="text-amber-400 ml-1">· backlog syncing…</span>
            )}
          </span>
        </div>
      )}

      {/* ── 1. The numbers ── */}
      <div className="grid grid-cols-2 gap-6">
        <StatPair
          label="Contacts"
          db={health?.dbContacts ?? 0}
          hs={health?.hsContacts ?? null}
          gap={health?.contactGap ?? null}
          pct={health?.contactPct ?? null}
        />
        <StatPair
          label="Companies"
          db={health?.dbCompanies ?? 0}
          hs={health?.hsCompanies ?? null}
          gap={health?.companyGap ?? null}
          pct={health?.companyPct ?? null}
        />
      </div>

      {/* ── 2. What's coming in ── */}
      <div className="rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between p-4 pb-0">
          <span className="text-caption font-medium">Importing</span>
          {(todayCreated > 0 || todayUpdated > 0) && (
            <span className="text-micro text-foreground/30">
              {todayCreated > 0 && `${todayCreated} new`}
              {todayCreated > 0 && todayUpdated > 0 && " · "}
              {todayUpdated > 0 && `${todayUpdated} updated`}
              {" today"}
            </span>
          )}
        </div>

        <ScrollArea className="h-[400px]">
          <div className="p-4 space-y-0">
            {events.length === 0 ? (
              <p className="text-caption text-foreground/40 text-center py-8">
                No imports yet — trigger a sync to see activity
              </p>
            ) : (
              events.slice(0, 40).map(event => (
                <div key={event.id} className="flex items-center gap-3 border-b border-border/40 py-2.5 last:border-0">
                  {/* Action pill */}
                  <span className={`text-micro px-2 py-0.5 rounded border shrink-0 ${
                    event.action === "created"
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                      : "bg-blue-500/10 text-blue-400 border-blue-500/20"
                  }`}>
                    {event.action}
                  </span>

                  {/* Name + email + company */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {event.entity_id ? (
                        <Link
                          to={event.entity_type === "company" ? `/company/${event.entity_id}` : `/company/${event.meta?.company_id || event.entity_id}`}
                          className="text-caption font-medium hover:underline truncate"
                        >
                          {event.entity_name || "—"}
                        </Link>
                      ) : (
                        <span className="text-caption font-medium truncate">
                          {event.entity_name || "—"}
                        </span>
                      )}
                      {event._email && (
                        <span className="text-micro text-foreground/25 truncate hidden sm:inline">
                          {event._email}
                        </span>
                      )}
                    </div>
                    {event.entity_type === "contact" && event._company_name && (
                      <div className="text-micro text-foreground/30 truncate">
                        {event._company_name}
                      </div>
                    )}
                  </div>

                  {/* Type + time */}
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-micro text-foreground/30">{event.entity_type}</span>
                    <span className="text-micro text-foreground/20 tabular-nums">{relativeTime(event.created_at)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      {/* ── 3. Scoring ── */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <span className="text-caption font-medium">Scoring</span>

        <div className="space-y-3">
          {/* Signal counts */}
          <div className="grid grid-cols-2 gap-6">
            <div>
              <div className="field-label mb-0.5">Expansion signals</div>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                <span className="text-body font-semibold tabular-nums">{(health?.expansion ?? 0).toLocaleString()}</span>
                <span className="text-caption text-foreground/40">companies</span>
              </div>
            </div>
            <div>
              <div className="field-label mb-0.5">PQL signals</div>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                <span className="text-body font-semibold tabular-nums">{(health?.pql ?? 0).toLocaleString()}</span>
                <span className="text-caption text-foreground/40">companies</span>
              </div>
            </div>
          </div>

          {/* Rescore progress */}
          {health?.rescoreLog && health.rescoreLog.status === "running" && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-caption text-foreground/60 flex items-center gap-1.5">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Rescoring…
                </span>
                <span className="text-micro tabular-nums text-foreground/40">
                  {(health.rescoreLog.contacts_processed ?? 0).toLocaleString()}
                  {" / "}
                  {(health.rescoreLog.contacts_total ?? 0).toLocaleString()}
                </span>
              </div>
              <div className="h-1 bg-foreground/[0.06] rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(100, Math.round(
                      ((health.rescoreLog.contacts_processed ?? 0) /
                       Math.max(1, health.rescoreLog.contacts_total ?? 1)) * 100
                    ))}%`,
                  }}
                />
              </div>
            </div>
          )}

          {/* Rescore complete */}
          {health?.rescoreLog?.status === "completed" && (
            <div className="text-micro text-foreground/30 flex items-center gap-1.5">
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              Rescore complete ·{" "}
              {health.rescoreLog.finished_at &&
                formatDistanceToNow(new Date(health.rescoreLog.finished_at), { addSuffix: true })}
            </div>
          )}

          {/* Rescore button */}
          <button
            onClick={() => rescoreAll.mutate()}
            disabled={rescoreAll.isPending}
            className="text-micro text-foreground/30 hover:text-foreground/60 transition-colors flex items-center gap-1"
          >
            {rescoreAll.isPending && <Loader2 className="w-3 h-3 animate-spin" />}
            Rescore all companies
          </button>
        </div>
      </div>
    </div>
  );
}
