import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tables, TablesInsert } from "@/integrations/supabase/types";

export type DbCompany = Tables<"companies">;
export type DbSignal = Tables<"signals">;
export type DbSnapshot = Tables<"snapshots">;
export type DbProcessingJob = Tables<"processing_jobs">;
export type DbProcessingJobItem = Tables<"processing_job_items">;
export type DbAppSettings = Tables<"app_settings">;

// ---- Companies ----
export function useCompanies() {
  return useQuery({
    queryKey: ["companies"],
    queryFn: async () => {
      // Fetch all companies — paginate past the default 1000-row limit
      const PAGE = 1000;
      let allData: DbCompany[] = [];
      let from = 0;
      while (true) {
        const { data, error } = await supabase
          .from("companies")
          .select("*")
          .order("last_score_total", { ascending: false, nullsFirst: false })
          .range(from, from + PAGE - 1);
        if (error) throw error;
        allData = allData.concat(data as DbCompany[]);
        if (!data || data.length < PAGE) break;
        from += PAGE;
      }
      return allData;
    },
  });
}

export function useCompany(id: string | undefined) {
  return useQuery({
    queryKey: ["company", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("*")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useInsertCompanies() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rows: TablesInsert<"companies">[]) => {
      // Insert in batches of 100
      const batchSize = 100;
      let inserted = 0;
      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);
        const { error } = await supabase.from("companies").insert(batch);
        if (error) throw error;
        inserted += batch.length;
      }
      return inserted;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["companies"] }),
  });
}

// ---- Signals ----
export function useSignals(companyId: string | undefined) {
  return useQuery({
    queryKey: ["signals", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("signals")
        .select("*")
        .eq("company_id", companyId!)
        .order("discovered_at", { ascending: false });
      if (error) throw error;
      return data as DbSignal[];
    },
  });
}

// ---- Contacts ----
export function useContacts(companyId: string | undefined) {
  return useQuery({
    queryKey: ["contacts", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("*")
        .eq("company_id", companyId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

// ---- Snapshots ----
export function useSnapshots(companyId: string | undefined) {
  return useQuery({
    queryKey: ["snapshots", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("snapshots")
        .select("*")
        .eq("company_id", companyId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as DbSnapshot[];
    },
  });
}

// ---- App Settings ----
export function useAppSettings() {
  return useQuery({
    queryKey: ["app_settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("*")
        .eq("id", 1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (updates: Partial<DbAppSettings>) => {
      const { error } = await supabase
        .from("app_settings")
        .update(updates)
        .eq("id", 1);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["app_settings"] }),
  });
}

// ---- Processing Jobs ----
export function useProcessingJobs() {
  return useQuery({
    queryKey: ["processing_jobs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("processing_jobs")
        .select("*")
        .order("started_at", { ascending: false });
      if (error) throw error;
      return data as DbProcessingJob[];
    },
  });
}

// ---- Active running job (for persistent banner across all pages) ----
export function useActiveJob() {
  return useQuery({
    queryKey: ["active_job"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("processing_jobs")
        .select("*")
        .eq("status", "running")
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as DbProcessingJob | null;
    },
    refetchInterval: 5000,
  });
}

export function useJobItems(jobId: string | undefined) {
  return useQuery({
    queryKey: ["job_items", jobId],
    enabled: !!jobId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("processing_job_items")
        .select("*, companies(name)")
        .eq("job_id", jobId!);
      if (error) throw error;
      return data;
    },
  });
}

// ---- Run Signals (fires first call only — edge function self-chains in background) ----
export function useRunSignals() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (onProgress?: (processed: number, total: number, companyName: string) => void) => {
      const { count } = await supabase
        .from("companies")
        .select("id", { count: "exact", head: true });
      const total = count || 0;

      // Fire the first call only — the edge function self-chains for all subsequent companies
      const { data, error } = await supabase.functions.invoke("run-signals", {
        body: { offset: 0 },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (onProgress) onProgress(1, total, data?.company || "");

      return { job_id: data?.job_id, total_processed: total };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["companies"] });
      qc.invalidateQueries({ queryKey: ["processing_jobs"] });
      qc.invalidateQueries({ queryKey: ["signal_counts"] });
    },
  });
}

// ---- Company Cards ----
export function useCompanyCards(companyId: string | undefined, contactId?: string) {
  return useQuery({
    queryKey: ["company_cards", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      // company_cards has a unique constraint on company_id — one row per company
      const { data, error } = await supabase
        .from("company_cards")
        .select("*")
        .eq("company_id", companyId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

// ---- Update Company ----
export function useUpdateCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Record<string, unknown> }) => {
      const { error } = await supabase
        .from("companies")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["company", variables.id] });
      qc.invalidateQueries({ queryKey: ["companies"] });
    },
  });
}

// ---- Signal counts for dashboard (aggregated) ----
export function useSignalCounts() {
  return useQuery({
    queryKey: ["signal_counts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("signals")
        .select("company_id");
      if (error) throw error;
      const counts: Record<string, number> = {};
      (data || []).forEach((s) => {
        counts[s.company_id] = (counts[s.company_id] || 0) + 1;
      });
      return counts;
    },
  });
}

// ---- Meetings ----
export function useMeetings(companyId: string | undefined) {
  return useQuery({
    queryKey: ["meetings", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meetings")
        .select("*")
        .eq("company_id", companyId!)
        .order("meeting_date", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
}

// ---- Customer Activity ----
export function useCustomerActivity(companyId: string | undefined) {
  return useQuery({
    queryKey: ["customer_activity", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("customer_activity")
        .select("*")
        .eq("company_id", companyId!)
        .order("occurred_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data || [];
    },
  });
}

// ---- Score Companies (Scout Score) ----
export function useScoreCompanies() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (action: "score_all" | "score_one" | "auto_sync" = "score_all") => {
      const { data, error } = await supabase.functions.invoke("score-companies", {
        body: { action },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["companies"] });
    },
  });
}

// ---- Bulk Import from HubSpot (all companies) ----
export function useBulkImport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("import-from-hubspot", {
        body: { action: "bulk_import" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["companies"] });
      qc.invalidateQueries({ queryKey: ["processing_jobs"] });
    },
  });
}
