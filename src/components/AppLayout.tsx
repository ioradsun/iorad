import { Link, useLocation, useNavigate } from "react-router-dom";
import { LogOut, Shield, Loader2, CheckCircle2, Download } from "lucide-react";
import ioradLogoDark from "@/assets/iorad-logo-new.png";
import ioradLogoLight from "@/assets/iorad-logo-light.png";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useActiveJob } from "@/hooks/useSupabase";
import { useUnreadNotifications } from "@/hooks/useSignals";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { formatDistanceToNow } from "date-fns";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const topTabs = [
  { to: "/", label: "Customer Signals" },
  { to: "/signals", label: "Product Signals" },
];

function useLastHubspotSync() {
  return useQuery({
    queryKey: ["last_hubspot_sync"],
    queryFn: async () => {
      const { data } = await supabase
        .from("processing_jobs")
        .select("id, status, started_at, finished_at, companies_processed, companies_succeeded, settings_snapshot, trigger")
        .order("started_at", { ascending: false })
        .limit(50);
      // Find the most recent job that represents a HubSpot sync
      const syncs = (data || []).filter((j: any) => {
        const snap = (j.settings_snapshot as any) || {};
        return (
          j.trigger === "bulk_import" ||
          j.trigger === "hubspot_sync" ||
          j.trigger === "hubspot_backfill" ||
          snap.action === "bulk_import" ||
          (j.trigger === "manual" && snap.current_company != null)
        );
      });
      return syncs[0] ?? null;
    },
    refetchInterval: 15_000,
  });
}

function ActiveJobBanner() {
  const { data: job } = useActiveJob();
  const { data: lastSync } = useLastHubspotSync();
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

  const currentCompany =
    (currentItem?.companies as any)?.name ??
    (job?.settings_snapshot as any)?.current_company ??
    null;

  const handleClick = () => isOnJobsPage ? navigate(-1) : navigate("/jobs");

  if (job) {
    // Active job — spinning banner
    return (
      <div
        className="w-full px-6 py-2 flex items-center gap-3 text-xs font-medium cursor-pointer"
        style={{
          background: "hsl(var(--primary) / 0.08)",
          borderBottom: "1px solid hsl(var(--primary) / 0.15)",
          color: "hsl(var(--primary))",
        }}
        onClick={handleClick}
      >
        <Loader2 className="w-3.5 h-3.5 animate-spin flex-shrink-0" />
        <span>
          {(job.trigger === "bulk_import" || (job.settings_snapshot as any)?.action === "bulk_import")
            ? <>
                Syncing with HubSpot
                {job.companies_processed > 0
                  ? ` — ${job.companies_processed}${job.total_companies_targeted > 0 ? `/${job.total_companies_targeted}` : ""} companies`
                  : "…"}
              </>
            : <>Syncing HubSpot{currentCompany ? ` — ${currentCompany}` : "…"}</>}
        </span>
        <span className="ml-auto underline underline-offset-2 opacity-70 hover:opacity-100 transition-opacity">
          {isOnJobsPage ? "Close" : "View status"}
        </span>
      </div>
    );
  }

  // Idle — always show last sync info so user can always navigate to jobs
  const lastSyncSnap = (lastSync?.settings_snapshot as any) || {};
  const lastSyncLabel = lastSyncSnap.current_company
    ? lastSyncSnap.current_company
    : lastSyncSnap.action === "bulk_import"
    ? "all companies"
    : lastSync?.trigger === "hubspot_backfill"
    ? "full backfill"
    : null;

  const lastSyncAgo = lastSync?.finished_at
    ? formatDistanceToNow(new Date(lastSync.finished_at), { addSuffix: true })
    : lastSync?.started_at
    ? formatDistanceToNow(new Date(lastSync.started_at), { addSuffix: true })
    : null;

  return (
    <button
      onClick={handleClick}
      className="w-full px-6 py-1.5 flex items-center gap-2 text-xs transition-colors hover:bg-muted/30"
      style={{
        borderBottom: "1px solid hsl(var(--border) / 0.6)",
        color: "hsl(var(--muted-foreground))",
      }}
    >
      <Download className="w-3 h-3 flex-shrink-0" />
      <span className="flex items-center gap-1.5">
        <span className="font-medium" style={{ color: "hsl(var(--foreground))" }}>HubSpot</span>
        {lastSyncAgo
          ? <>
              <span>·</span>
              <CheckCircle2 className="w-3 h-3" style={{ color: "hsl(var(--success, 142 71% 45%))" }} />
              <span>Last sync {lastSyncAgo}{lastSyncLabel ? ` · ${lastSyncLabel}` : ""}</span>
            </>
          : <span>· No syncs recorded</span>}
      </span>
      <span className="ml-auto underline underline-offset-2 opacity-60 hover:opacity-100 transition-opacity">
        View activity
      </span>
    </button>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();
  const isAdmin = useIsAdmin();
  const { theme } = useTheme();
  const location = useLocation();
  const ioradLogo = theme === "light" ? ioradLogoLight : ioradLogoDark;
  const { data: unread = [] } = useUnreadNotifications();

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

  const isActiveTab = (to: string) => {
    if (to === "/") return location.pathname === "/" || location.pathname.startsWith("/company") || location.pathname === "/upload";
    return location.pathname.startsWith(to);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link to="/" className="flex items-center gap-2.5">
              <img src={ioradLogo} alt="iorad" className="h-6" />
              <span className="font-display text-sm font-bold tracking-tight text-foreground">
                Scout
              </span>
            </Link>

            {user && (
              <nav className="flex items-center gap-1">
                {topTabs.map(({ to, label }) => (
                  <Link
                    key={to}
                    to={to}
                    className={`relative px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                      isActiveTab(to)
                        ? "text-foreground bg-secondary"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                    }`}
                  >
                    {label}
                    {to === "/signals" && unread.length > 0 && (
                      <span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
                        {unread.length > 9 ? "9+" : unread.length}
                      </span>
                    )}
                  </Link>
                ))}
              </nav>
            )}
          </div>

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
                {isAdmin && (
                  <>
                    <DropdownMenuItem asChild>
                      <Link to="/settings" className="flex items-center gap-2 cursor-pointer">
                        <Shield className="w-4 h-4" />
                        Admin
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
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
