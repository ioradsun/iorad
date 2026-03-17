import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { AlertCircle, Loader2, RefreshCw, RotateCcw, Signal } from "lucide-react";
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
  diff: any;
  batch_seq: number | null;
  cursor_val: string | null;
  meta: any;
};

const SOURCE_LABELS: Record<string, string> = {
  hubspot_pipeline: "Pipeline",
  daily_sync: "Daily Sync",
  watch_signups: "Watch Signups",
  backfill_plans: "Backfill Plans",
  import_webhook: "Webhook",
  import_bulk: "Bulk Import",
  import_backfill_contacts: "Contact Backfill",
  import_fix_contacts: "Fix Contacts",
  watchdog: "Watchdog",
};

const ACTION_STYLES: Record<string, string> = {
  created: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  updated: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  scored: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  error: "bg-red-500/10 text-red-400 border-red-500/20",
  heartbeat: "bg-secondary text-foreground/40 border-border",
  job_start: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  job_complete: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  job_failed: "bg-red-500/10 text-red-400 border-red-500/20",
  restarted: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  skipped: "bg-secondary text-foreground/40 border-border",
};

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

export default function HubSpotStatus() {
  const qc = useQueryClient();
  const [events, setEvents] = useState<SyncEvent[]>([]);
  const [sourceFilter, setSourceFilter] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const { data: counts } = useCompanyContactCounts();

  // Tick every second for live relative timestamps
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Initial load
  const { data: initialEvents } = useQuery({
    queryKey: ["sync_events_initial"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("sync_events")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      return (data || []) as SyncEvent[];
    },
  });

  // Seed events from initial load
  useEffect(() => {
    if (initialEvents && initialEvents.length > 0) {
      setEvents(initialEvents);
    }
  }, [initialEvents]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel("sync_events_realtime")
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "sync_events",
      }, (payload) => {
        setEvents(prev => [payload.new as SyncEvent, ...prev].slice(0, 100));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  // Mutations
  const syncNow = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.functions.invoke("hubspot-daily-sync", { body: { hours_back: 24 } });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Sync triggered");
      qc.invalidateQueries({ queryKey: ["sync_events_initial"] });
      qc.invalidateQueries({ queryKey: ["sync_counts"] });
    },
    onError: (err: any) => toast.error(`Sync failed: ${err?.message}`),
  });

  const watchSignups = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("watch-signups", {
        body: { hours_back: 24 },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ["sync_events_initial"] });
      toast.success(
        `Signups: ${data.signups_found} found · ${data.expansion} expansion · ${data.pql} PQL · ${data.watchlist} watching`
      );
    },
    onError: (err: any) => toast.error(`Watch signups failed: ${err?.message}`),
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
      qc.invalidateQueries({ queryKey: ["sync_events_initial"] });
      toast.success("Plan backfill started");
    },
    onError: (err: any) => toast.error(`Backfill failed: ${err?.message}`),
  });

  // Derived state
  const lastEvent = events[0] || null;
  const lastEventAge = lastEvent
    ? (now - new Date(lastEvent.created_at).getTime()) / 1000
    : Infinity;

  const isTerminal = lastEvent?.action === "job_complete" || lastEvent?.action === "job_failed";
  const dotColor =
    lastEventAge < 60 ? "bg-emerald-400 animate-pulse" :
    lastEventAge < 300 ? "bg-amber-400" :
    (!isTerminal && lastEventAge < Infinity) ? "bg-red-400" :
    "bg-foreground/20";

  // Stall detection
  const isStalled = lastEvent && !isTerminal && lastEventAge > 60;
  const recentWatchdogRestart = events.slice(0, 5).find(
    e => e.source === "watchdog" && e.action === "restarted"
  );

  // Filter
  const sources = useMemo(() => [...new Set(events.map(e => e.source))], [events]);
  const filteredEvents = sourceFilter ? events.filter(e => e.source === sourceFilter) : events;

  function relativeTime(dateStr: string) {
    const seconds = Math.max(0, Math.floor((now - new Date(dateStr).getTime()) / 1000));
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    return formatDistanceToNow(new Date(dateStr), { addSuffix: true });
  }

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-display font-semibold tracking-tight">HubSpot Sync</h1>
        <div className="flex items-center gap-2">
          <Button className="gap-1.5" onClick={() => syncNow.mutate()} disabled={syncNow.isPending}>
            {syncNow.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Sync Now
          </Button>
          <Button variant="outline" className="gap-1.5" onClick={() => watchSignups.mutate()} disabled={watchSignups.isPending}>
            {watchSignups.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Signal className="w-4 h-4" />}
            Watch Signups
          </Button>
          <Button variant="outline" className="gap-1.5" onClick={() => backfillPlans.mutate()} disabled={backfillPlans.isPending}>
            {backfillPlans.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Backfill Plans
          </Button>
        </div>
      </div>

      {/* Hero banner */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-3">
          <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${dotColor}`} />
          <div className="min-w-0">
            {lastEvent ? (
              <>
                <div className="text-caption font-medium truncate">
                  {lastEvent.action === "job_start" ? "Job started" :
                   lastEvent.action === "job_complete" ? "Job completed" :
                   lastEvent.action === "heartbeat" ? "Processing…" :
                   lastEvent.entity_name || lastEvent.action}
                </div>
                <div className="text-micro text-foreground/40">
                  {lastEvent.entity_type} {lastEvent.action} via {SOURCE_LABELS[lastEvent.source] || lastEvent.source} · {relativeTime(lastEvent.created_at)}
                </div>
              </>
            ) : (
              <div className="text-caption text-foreground/40">No sync events yet</div>
            )}
          </div>
        </div>
      </div>

      {/* Stall/watchdog banner */}
      {recentWatchdogRestart ? (
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-2.5 flex items-center gap-2">
          <RotateCcw className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="text-caption text-emerald-400">
            Watchdog auto-restarted {SOURCE_LABELS[recentWatchdogRestart.meta?.original_source] || "sync"} · {relativeTime(recentWatchdogRestart.created_at)}
          </span>
        </div>
      ) : isStalled ? (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-2.5 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
          <div>
            <span className="text-caption text-amber-400">
              Sync may have stalled — last activity {relativeTime(lastEvent!.created_at)}
            </span>
            <div className="text-micro text-amber-400/60">Watchdog will auto-restart within 60 seconds</div>
          </div>
        </div>
      ) : null}

      {/* Stats */}
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

      {/* Filter pills */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <button
          onClick={() => setSourceFilter(null)}
          className={`text-micro px-2.5 py-1 rounded-full border transition-colors ${
            !sourceFilter
              ? "bg-primary/15 text-primary border-primary/30"
              : "text-foreground/40 border-border hover:text-foreground/70"
          }`}
        >
          All
        </button>
        {sources.map(s => (
          <button
            key={s}
            onClick={() => setSourceFilter(sourceFilter === s ? null : s)}
            className={`text-micro px-2.5 py-1 rounded-full border transition-colors ${
              sourceFilter === s
                ? "bg-primary/15 text-primary border-primary/30"
                : "text-foreground/40 border-border hover:text-foreground/70"
            }`}
          >
            {SOURCE_LABELS[s] || s}
          </button>
        ))}
      </div>

      {/* Live feed */}
      <div className="rounded-xl border border-border bg-card">
        <ScrollArea className="h-[480px]">
          <div className="p-4 space-y-0">
            {filteredEvents.length === 0 && (
              <p className="text-caption text-foreground/40 text-center py-8">No sync events yet. Trigger a sync to see activity.</p>
            )}
            {filteredEvents.map((event) => {
              const isHeartbeat = event.action === "heartbeat";
              const isWatchdog = event.source === "watchdog";
              const actionStyle = ACTION_STYLES[event.action] || "bg-secondary text-foreground/40 border-border";

              return (
                <div
                  key={event.id}
                  className="flex items-start gap-3 border-b border-border/40 py-2.5 last:border-0"
                >
                  {/* Action pill */}
                  <span className={`text-micro px-2 py-0.5 rounded border shrink-0 mt-0.5 ${actionStyle}`}>
                    {isWatchdog && event.action === "restarted" && "↻ "}
                    {isWatchdog && event.action === "job_failed" ? "gave up" : event.action.replace("_", " ")}
                  </span>

                  {/* Center */}
                  <div className="min-w-0 flex-1">
                    <div className={`truncate ${isHeartbeat ? "text-micro text-foreground/40" : "text-caption font-medium"}`}>
                      {event.entity_name || event.entity_type}
                    </div>
                    {!isHeartbeat && (
                      <div className="text-micro text-foreground/40">
                        {event.entity_type}
                        {event.entity_id && (
                          <>
                            {" · "}
                            <Link to={`/company/${event.entity_id}`} className="hover:underline">
                              View
                            </Link>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Right */}
                  <div className="text-right shrink-0">
                    <div className="text-micro text-foreground/40">
                      {SOURCE_LABELS[event.source] || event.source}
                    </div>
                    <div className="text-micro text-foreground/30">
                      {relativeTime(event.created_at)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </div>

      <p className="text-micro text-foreground/20 leading-relaxed">
        Sync events stream in real-time. Watchdog auto-restarts stalled jobs within 60 seconds. Events are retained for 7 days.
      </p>
    </div>
  );
}
