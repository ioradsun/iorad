import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

function useMissingStoriesCount() {
  return useQuery({
    queryKey: ["missing_stories_count"],
    queryFn: async () => {
      const { data: cards } = await supabase.from("company_cards").select("company_id");
      const existingIds = new Set((cards || []).map((r: any) => r.company_id));
      const { count } = await supabase.from("companies").select("id", { count: "exact", head: true });
      return (count ?? 0) - existingIds.size;
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
      // Find the most recently started item that is still pending/processing
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

export default function JobHistory() {
  const { data: missingCount, isLoading: loadingCount } = useMissingStoriesCount();
  const { data: activeJob, isLoading: loadingActive } = useActiveRunningJob();
  const { data: currentItem } = useCurrentlyProcessingCompany(activeJob?.id);

  const isLoading = loadingCount || loadingActive;
  const currentCompany = (currentItem?.companies as any)?.name ?? (activeJob?.settings_snapshot as any)?.current_company ?? null;

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Processing Status</h1>
        <p className="text-sm text-muted-foreground mt-1">Story generation queue</p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-4">

          {/* ── Missing stories count ── */}
          <div className="panel flex items-center gap-4">
            <div className="text-4xl font-bold tracking-tight tabular-nums">
              {missingCount ?? "—"}
            </div>
            <div className="text-sm text-muted-foreground leading-snug">
              companies still<br />need stories
            </div>
          </div>

          {/* ── Active job ── */}
          {activeJob ? (
            <div className="panel flex items-center gap-3">
              <Loader2 className="w-4 h-4 animate-spin text-primary flex-shrink-0" />
              <div className="min-w-0">
                <div className="text-xs text-muted-foreground">Currently processing</div>
                <div className="text-sm font-medium truncate">
                  {currentCompany ?? "—"}
                </div>
              </div>
            </div>
          ) : (
            <div className="panel text-sm text-muted-foreground py-6 text-center">
              No active run — new companies will be queued automatically.
            </div>
          )}

        </div>
      )}
    </div>
  );
}
