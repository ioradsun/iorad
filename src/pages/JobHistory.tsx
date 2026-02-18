import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CheckCircle2, Clock, XCircle, Inbox } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Link } from "react-router-dom";

// Companies created within the last 48 hours are considered "new" (recently
// imported from HubSpot and queued for auto-generation).
const NEW_THRESHOLD_HOURS = 48;

// ── Data hooks ─────────────────────────────────────────────────────────────

function useCompanyQueueData() {
  return useQuery({
    queryKey: ["company_queue_data"],
    queryFn: async () => {
      const { data: companies } = await supabase
        .from("companies")
        .select("id, name, domain, source_type, created_at, snapshot_status")
        .order("created_at", { ascending: false });

      const { data: cards } = await supabase
        .from("company_cards")
        .select("company_id");

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

      // "Waiting" = no story + imported within threshold (new HubSpot imports)
      const waiting = noStory.filter((c) => new Date(c.created_at) >= cutoff);
      // "Not Started" = no story + older than threshold (pre-existing records)
      const notStarted = noStory.filter((c) => new Date(c.created_at) < cutoff);

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

// ── Company list ────────────────────────────────────────────────────────────

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

// ── Main page ───────────────────────────────────────────────────────────────

export default function JobHistory() {
  const { data: queueData, isLoading: loadingQueue } = useCompanyQueueData();
  const { data: activeJob, isLoading: loadingActive } = useActiveRunningJob();
  const { data: currentItem } = useCurrentlyProcessingCompany(activeJob?.id);

  const isLoading = loadingQueue || loadingActive;
  const currentCompany =
    (currentItem?.companies as any)?.name ??
    (activeJob?.settings_snapshot as any)?.current_company ??
    null;

  const completed  = queueData?.completed  ?? [];
  const waiting    = queueData?.waiting    ?? [];
  const notStarted = queueData?.notStarted ?? [];
  const failed     = queueData?.failed     ?? [];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Processing Status</h1>
        <p className="text-sm text-muted-foreground mt-1">Story generation queue</p>
      </div>

      {activeJob && (
        <div className="panel flex items-center gap-3">
          <Loader2 className="w-4 h-4 animate-spin text-primary flex-shrink-0" />
          <div className="min-w-0">
            <div className="text-xs text-muted-foreground">Currently processing</div>
            <div className="text-sm font-medium truncate">{currentCompany ?? "—"}</div>
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
              <Clock className="w-3.5 h-3.5 shrink-0" />
              Waiting
              <span className="tabular-nums opacity-70">({waiting.length})</span>
            </TabsTrigger>
            <TabsTrigger value="not_started" className="gap-1.5 text-xs">
              <Inbox className="w-3.5 h-3.5 shrink-0" />
              Not Started
              <span className="tabular-nums opacity-70">({notStarted.length})</span>
            </TabsTrigger>
            <TabsTrigger value="completed" className="gap-1.5 text-xs">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              Done
              <span className="tabular-nums opacity-70">({completed.length})</span>
            </TabsTrigger>
            <TabsTrigger value="failed" className="gap-1.5 text-xs">
              <XCircle className="w-3.5 h-3.5 shrink-0" />
              Failed
              {failed.length > 0 ? (
                <span className="tabular-nums text-destructive">({failed.length})</span>
              ) : (
                <span className="tabular-nums opacity-70">(0)</span>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="waiting" className="mt-4 panel max-h-[60vh] overflow-y-auto">
            <p className="text-xs text-muted-foreground mb-3 pb-3 border-b border-border/50">
              New HubSpot imports from the last {NEW_THRESHOLD_HOURS}h — stories are queued for auto-generation.
            </p>
            <CompanyList
              companies={waiting}
              emptyMessage="No new imports waiting for generation."
            />
          </TabsContent>

          <TabsContent value="not_started" className="mt-4 panel max-h-[60vh] overflow-y-auto">
            <p className="text-xs text-muted-foreground mb-3 pb-3 border-b border-border/50">
              Older records without a story. These won't be auto-generated — open the company to generate manually.
            </p>
            <CompanyList
              companies={notStarted}
              emptyMessage="All older records have stories."
            />
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
