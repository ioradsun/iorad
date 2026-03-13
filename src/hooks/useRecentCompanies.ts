import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface RecentCompany {
  company_id: string;
  visited_at: string;
  company_name: string;
  company_domain: string | null;
}

export function useRecentCompanies(limit = 10) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["recent_companies", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recent_companies" as any)
        .select("company_id, visited_at, companies(name, domain)")
        .eq("user_id", user!.id)
        .order("visited_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data || []).map((r: any) => ({
        company_id: r.company_id,
        visited_at: r.visited_at,
        company_name: r.companies?.name || "Unknown",
        company_domain: r.companies?.domain || null,
      })) as RecentCompany[];
    },
    staleTime: 30_000,
  });
}

export function useTrackRecent() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (companyId: string) => {
      if (!user) return;
      // Upsert: insert or update visited_at
      const { error } = await supabase
        .from("recent_companies" as any)
        .upsert(
          { user_id: user.id, company_id: companyId, visited_at: new Date().toISOString() },
          { onConflict: "user_id,company_id" }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recent_companies"] });
    },
  });
}
