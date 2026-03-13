import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

function useSyncStatus() {
  return useQuery({
    queryKey: ["sync_status"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sync_checkpoints")
        .select("key, value, updated_at")
        .in("key", [
          "company_sync_cursor",
          "contact_sync_cursor",
          "last_company_sync_result",
          "last_contact_sync_result",
        ]);
      if (error) throw error;

      const map: Record<string, any> = {};
      for (const row of data || []) {
        map[row.key] = { value: row.value, updated_at: row.updated_at };
      }
      return map;
    },
    refetchInterval: 15_000,
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
    staleTime: 60_000,
  });
}

export default function JobHistory() {
  const qc = useQueryClient();
  const { data: status, isLoading } = useSyncStatus();
  const { data: counts } = useCompanyContactCounts();

  const syncNow = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.functions.invoke("import-from-hubspot", {
        body: { action: "sync_all" },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Sync complete");
      qc.invalidateQueries({ queryKey: ["sync_status"] });
      qc.invalidateQueries({ queryKey: ["sync_counts"] });
    },
    onError: (err: any) => toast.error(`Sync failed: ${err?.message}`),
  });

  const companyCursor = status?.company_sync_cursor;
  const contactCursor = status?.contact_sync_cursor;
  const lastCompanyResult = (() => {
    try {
      return JSON.parse(status?.last_company_sync_result?.value || "null");
    } catch {
      return null;
    }
  })();
  const lastContactResult = (() => {
    try {
      return JSON.parse(status?.last_contact_sync_result?.value || "null");
    } catch {
      return null;
    }
  })();

  const lastCompanySync = companyCursor?.updated_at ? new Date(companyCursor.updated_at) : null;
  const lastContactSync = contactCursor?.updated_at ? new Date(contactCursor.updated_at) : null;
  const lastSync = [lastCompanySync, lastContactSync]
    .filter(Boolean)
    .sort((a, b) => b!.getTime() - a!.getTime())[0] || null;

  const minutesSinceSync = lastSync ? (Date.now() - lastSync.getTime()) / 60_000 : Infinity;
  const isHealthy = minutesSinceSync < 150;
  const isStale = minutesSinceSync >= 150 && minutesSinceSync < 720;
  const isDown = minutesSinceSync >= 720;
  const neverSynced = !lastSync;

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto flex items-center justify-center py-32">
        <Loader2 className="w-5 h-5 animate-spin text-foreground/25" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <h1 className="text-display font-semibold tracking-tight">HubSpot Sync</h1>

      <div
        className={`rounded-xl border p-6 ${
          neverSynced ? "border-border bg-card" : isHealthy ? "border-border bg-card" : isStale ? "border-warning/30 bg-warning/[0.03]" : "border-destructive/30 bg-destructive/[0.03]"
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {neverSynced && <AlertCircle className="w-5 h-5 text-foreground/25" />}
            {isHealthy && <CheckCircle2 className="w-5 h-5 text-success" />}
            {isStale && <AlertCircle className="w-5 h-5 text-warning" />}
            {isDown && <AlertCircle className="w-5 h-5 text-destructive" />}
            <div>
              <h2 className="text-title font-semibold">
                {neverSynced ? "Not synced yet" : isHealthy ? "In sync" : isStale ? "Sync overdue" : "Sync down"}
              </h2>
              <p className="text-caption text-foreground/40 mt-0.5">
                {neverSynced
                  ? "Run your first sync to import companies and contacts"
                  : `Last data received ${formatDistanceToNow(lastSync!, { addSuffix: true })}`}
              </p>
            </div>
          </div>

          <Button className="gap-1.5" onClick={() => syncNow.mutate()} disabled={syncNow.isPending}>
            {syncNow.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Syncing…
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" /> Sync Now
              </>
            )}
          </Button>
        </div>
      </div>

      {counts && (
        <div className="grid grid-cols-2 gap-6">
          <div>
            <div className="field-label">Companies</div>
            <div className="text-display font-semibold tabular-nums mt-1">{counts.companies.toLocaleString()}</div>
            {lastCompanyResult && (
              <div className="text-micro text-foreground/25 mt-1">
                {lastCompanyResult.processed} updated in last sync
                {lastCompanyResult.has_more && " · more pending"}
              </div>
            )}
          </div>
          <div>
            <div className="field-label">Contacts</div>
            <div className="text-display font-semibold tabular-nums mt-1">{counts.contacts.toLocaleString()}</div>
            {lastContactResult && (
              <div className="text-micro text-foreground/25 mt-1">
                {lastContactResult.processed} updated in last sync
                {lastContactResult.has_more && " · more pending"}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="space-y-3">
        <div className="field-label">Sync details</div>

        <div className="flex items-center justify-between text-caption">
          <span className="text-foreground/40">Company checkpoint</span>
          <span className="text-foreground/60">
            {companyCursor?.updated_at
              ? formatDistanceToNow(new Date(companyCursor.updated_at), { addSuffix: true })
              : "Never"}
          </span>
        </div>

        <div className="flex items-center justify-between text-caption">
          <span className="text-foreground/40">Contact checkpoint</span>
          <span className="text-foreground/60">
            {contactCursor?.updated_at
              ? formatDistanceToNow(new Date(contactCursor.updated_at), { addSuffix: true })
              : "Never"}
          </span>
        </div>

        <div className="flex items-center justify-between text-caption">
          <span className="text-foreground/40">Schedule</span>
          <span className="text-foreground/60">Every 2 hours (automatic)</span>
        </div>

        <div className="flex items-center justify-between text-caption">
          <span className="text-foreground/40">Mode</span>
          <span className="text-foreground/60">Incremental (changes only)</span>
        </div>
      </div>

      <p className="text-micro text-foreground/20 leading-relaxed">
        Sync runs automatically every 2 hours, importing only companies and contacts that changed since the
        last sync. Individual companies are also synced on-demand when you visit them. To import a specific
        company from HubSpot, search for it on the Dashboard.
      </p>
    </div>
  );
}
