import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export function useIsAdmin() {
  const { user } = useAuth();

  const { data: isAdmin = false } = useQuery({
    queryKey: ["is-admin", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("has_role", {
        _user_id: user!.id,
        _role: "admin",
      });
      if (error) return false;
      return !!data;
    },
    staleTime: 5 * 60 * 1000,
  });

  return isAdmin;
}
