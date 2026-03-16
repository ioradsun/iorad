import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tables, TablesInsert } from "@/integrations/supabase/types";

export type DbAppSettings = Tables<"app_settings">;
const COMPANY_LIST_COLUMNS = "id, name, domain, partner, partner_rep_email, partner_rep_name, snapshot_status, created_at, account_type, lifecycle_stage, scout_score, source_type, last_score_total, industry, headcount";

// ---- Companies ----
// Fast first page for immediate render — server-side lifecycle_stage filter
export function useCompaniesPage(stage: string, limit = 50) {
  return useQuery({
    queryKey: ["companies_page", stage, limit],
    queryFn: async () => {
      let query = (supabase
        .from("companies")
        .select(COMPANY_LIST_COLUMNS) as any)
        .order("scout_score", { ascending: false, nullsFirst: false })
        .limit(limit);

      // Server-side lifecycle_stage filter
      query = query.eq("lifecycle_stage", stage);

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as any[];
    },
    staleTime: 60_000,
  });
}

export function useCompanies() {
  return useQuery({
    queryKey: ["companies"],
    queryFn: async () => {
      const PAGE = 1000;
      let allData: any[] = [];
      let from = 0;
      while (true) {
        const { data, error } = await (supabase
          .from("companies")
          .select("id, name, domain, partner, partner_rep_email, partner_rep_name, snapshot_status, created_at, account_type, lifecycle_stage, scout_score, source_type, last_score_total, industry, headcount") as any)
          .order("last_score_total", { ascending: false, nullsFirst: false })
          .range(from, from + PAGE - 1);
        if (error) throw error;
        allData = allData.concat(data || []);
        if (!data || data.length < PAGE) break;
        from += PAGE;
      }
      return allData;
    },
    staleTime: 2 * 60 * 1000,
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
      return data as Tables<"signals">[];
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

export function useContactIdsWithStories(companyId: string | undefined) {
  return useQuery({
    queryKey: ["contact_story_ids", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_cards")
        .select("contact_id, account_json")
        .eq("company_id", companyId!)
        .not("contact_id", "is", null);

      if (error) throw error;

      const ids = new Set<string>();
      for (const row of data || []) {
        if (!row.contact_id) continue;
        const json = row.account_json as Record<string, unknown> | null;
        if (!json) continue;
        if ((json as any)._type || (json as any).opening_hook || (json as any).behavior_acknowledged) {
          ids.add(row.contact_id);
        }
      }

      return ids;
    },
    staleTime: 30_000,
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
      return data as Tables<"snapshots">[];
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
      return data as Tables<"processing_jobs">[];
    },
    refetchInterval: 30_000,
  });
}

// ---- Company Cards ----
export function useCompanyCards(companyId: string | undefined, contactId?: string) {
  return useQuery({
    queryKey: ["company_cards", companyId, contactId ?? null],
    enabled: !!companyId,
    queryFn: async () => {
      const query = contactId
        ? supabase
          .from("company_cards")
          .select("*")
          .eq("company_id", companyId!)
          .eq("contact_id", contactId)
        : supabase
          .from("company_cards")
          .select("*")
          .eq("company_id", companyId!)
          .is("contact_id", null);

      const { data, error } = await query.maybeSingle();
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
        .select("company_id")
        .limit(5000);
      if (error) throw error;
      const counts: Record<string, number> = {};
      (data || []).forEach((s) => {
        counts[s.company_id] = (counts[s.company_id] || 0) + 1;
      });
      return counts;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useCompanyStats() {
  return useQuery({
    queryKey: ["company_stats"],
    queryFn: async () => {
      const totalRes = await supabase.from("companies").select("id", { count: "exact", head: true });
      const schoolRes = await (supabase.from("companies").select("id", { count: "exact", head: true }) as any).eq("account_type", "school");
      const businessRes = await (supabase.from("companies").select("id", { count: "exact", head: true }) as any).or("account_type.eq.company,account_type.is.null");
      const partnerRes = await (supabase.from("companies").select("id", { count: "exact", head: true }) as any).eq("account_type", "partner");
      const recentRes = await supabase.from("companies").select("id", { count: "exact", head: true }).gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());
      const prospectRes = await (supabase.from("companies").select("id", { count: "exact", head: true }) as any).eq("lifecycle_stage", "prospect");
      const oppRes = await (supabase.from("companies").select("id", { count: "exact", head: true }) as any).eq("lifecycle_stage", "opportunity");
      const custRes = await (supabase.from("companies").select("id", { count: "exact", head: true }) as any).eq("lifecycle_stage", "customer");

      return {
        total: totalRes.count ?? 0,
        school: schoolRes.count ?? 0,
        business: businessRes.count ?? 0,
        partner: partnerRes.count ?? 0,
        newThisWeek: recentRes.count ?? 0,
        stageCounts: {
          prospect: prospectRes.count ?? 0,
          opportunity: oppRes.count ?? 0,
          customer: custRes.count ?? 0,
        },
      };
    },
    staleTime: 60_000,
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
