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

// ---- Run Signals (one company per call, loops on frontend) ----
export function useRunSignals() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (onProgress?: (processed: number, total: number, companyName: string) => void) => {
      let offset = 0;
      let jobId: string | null = null;
      let totalProcessed = 0;

      const { count } = await supabase
        .from("companies")
        .select("id", { count: "exact", head: true });
      const total = count || 0;

      while (true) {
        const { data, error } = await supabase.functions.invoke("run-signals", {
          body: { offset, job_id: jobId },
        });

        if (error) throw error;
        if (data.error) throw new Error(data.error);

        jobId = data.job_id || jobId;
        totalProcessed++;

        if (onProgress) onProgress(totalProcessed, total, data.company || "");

        if (data.done) break;
        offset = data.next_offset ?? offset + 1;
      }

      return { job_id: jobId, total_processed: totalProcessed };
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
    queryKey: ["company_cards", companyId, contactId || "default"],
    enabled: !!companyId,
    queryFn: async () => {
      let query = supabase
        .from("company_cards")
        .select("*")
        .eq("company_id", companyId!);
      if (contactId) {
        query = query.eq("contact_id", contactId);
      } else {
        query = query.is("contact_id", null);
      }
      const { data, error } = await query
        .order("created_at", { ascending: false })
        .limit(1)
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
