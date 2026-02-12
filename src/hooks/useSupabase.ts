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
      const { data, error } = await supabase
        .from("companies")
        .select("*")
        .order("last_score_total", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return data as DbCompany[];
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
