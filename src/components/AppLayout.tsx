import { Link, useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, LogOut, Shield, Loader2 } from "lucide-react";
import ioradLogoDark from "@/assets/iorad-logo-new.png";
import ioradLogoLight from "@/assets/iorad-logo-light.png";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useActiveJob } from "@/hooks/useSupabase";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const menuItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
];

const NEW_THRESHOLD_HOURS = 48;

function useWaitingCount() {
  return useQuery({
    queryKey: ["banner_waiting_count"],
    queryFn: async () => {
      const cutoff = new Date(Date.now() - NEW_THRESHOLD_HOURS * 60 * 60 * 1000).toISOString();
      const [{ data: cards }, { data: newCompanies }] = await Promise.all([
        supabase.from("company_cards").select("company_id"),
        // Only count recent imports with no snapshot status (truly unprocessed)
        supabase.from("companies").select("id").gte("created_at", cutoff).is("snapshot_status", null),
      ]);
      const cardIds = new Set((cards || []).map((c: any) => c.company_id));
      const waiting = (newCompanies || []).filter((c: any) => !cardIds.has(c.id));
      return waiting.length;
    },
    refetchInterval: 15_000,
  });
}

function ActiveJobBanner() {
  const { data: job } = useActiveJob();
  const { data: waitingCount } = useWaitingCount();
  const location = useLocation();
  const navigate = useNavigate();
  const isOnJobsPage = location.pathname === "/jobs";

  const { data: currentItem } = useQuery({
    queryKey: ["banner_current_item", job?.id],
    enabled: !!job?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("processing_job_items")
        .select("*, companies(name)")
        .eq("job_id", job!.id)
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    refetchInterval: 3_000,
  });

  if (!job && (waitingCount === undefined || waitingCount === 0)) return null;

  const currentCompany =
    job
      ? ((currentItem?.companies as any)?.name ??
         (job.settings_snapshot as any)?.current_company ??
         null)
      : null;

  return (
    <div
      className="w-full px-6 py-2 flex items-center gap-3 text-xs font-medium"
      style={{
        background: "hsl(var(--primary) / 0.08)",
        borderBottom: "1px solid hsl(var(--primary) / 0.15)",
        color: "hsl(var(--primary))",
      }}
    >
      {job && <Loader2 className="w-3.5 h-3.5 animate-spin flex-shrink-0" />}
      <span>
        {job
          ? <>Generating stories{currentCompany ? ` — ${currentCompany}` : ""}</>
          : null}
        {waitingCount !== undefined && waitingCount > 0 && (
          <span className={job ? "ml-3 opacity-70" : ""}>
            {waitingCount} waiting
          </span>
        )}
      </span>
      <button
        onClick={() => isOnJobsPage ? navigate(-1) : navigate("/jobs")}
        className="ml-auto underline underline-offset-2 opacity-70 hover:opacity-100 transition-opacity cursor-pointer"
      >
        {isOnJobsPage ? "Close Status" : "View status"}
      </button>
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();
  const isAdmin = useIsAdmin();
  const { theme } = useTheme();
  const ioradLogo = theme === "light" ? ioradLogoLight : ioradLogoDark;

  const displayName =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email?.split("@")[0] ||
    "User";

  const avatarUrl =
    user?.user_metadata?.avatar_url ||
    user?.user_metadata?.picture ||
    undefined;

  const initials = displayName
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto px-6 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <img src={ioradLogo} alt="iorad" className="h-6" />
            <span className="font-display text-sm font-bold tracking-tight text-foreground">
              Scout
            </span>
          </Link>

          {user && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded-full p-1 hover:bg-secondary transition-colors focus:outline-none">
                  <Avatar className="h-8 w-8">
                    {avatarUrl && <AvatarImage src={avatarUrl} alt={displayName} />}
                    <AvatarFallback className="text-xs bg-primary/10 text-primary">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium text-foreground hidden sm:inline pr-1">
                    {displayName}
                  </span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {menuItems.map(({ to, label, icon: Icon }) => (
                  <DropdownMenuItem key={to} asChild>
                    <Link to={to} className="flex items-center gap-2 cursor-pointer">
                      <Icon className="w-4 h-4" />
                      {label}
                    </Link>
                  </DropdownMenuItem>
                ))}
                {isAdmin && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link to="/settings" className="flex items-center gap-2 cursor-pointer">
                        <Shield className="w-4 h-4" />
                        Admin
                      </Link>
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={signOut} className="flex items-center gap-2 cursor-pointer text-destructive focus:text-destructive">
                  <LogOut className="w-4 h-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
        <ActiveJobBanner />
      </header>
      <main className="max-w-[1600px] mx-auto px-6 py-6">
        {children}
      </main>
    </div>
  );
}
