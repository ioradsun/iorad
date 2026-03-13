import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Building2, Signal, Clock, ChevronLeft, ChevronRight,
  LogOut, Shield, Briefcase, GraduationCap, Handshake, Menu,
} from "lucide-react";
import ioradLogoDark from "@/assets/iorad-logo-new.png";
import ioradLogoLight from "@/assets/iorad-logo-light.png";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useRecentCompanies } from "@/hooks/useRecentCompanies";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from "@/components/ui/tooltip";

const categoryItems = [
  { key: "business", label: "Business", icon: Briefcase },
  { key: "school", label: "School", icon: GraduationCap },
  { key: "partner", label: "Partner", icon: Handshake },
];

export default function AppSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const { user, signOut } = useAuth();
  const isAdmin = useIsAdmin();
  const { theme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const ioradLogo = theme === "light" ? ioradLogoLight : ioradLogoDark;
  const { data: recents = [] } = useRecentCompanies(8);

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

  const isActive = (path: string) => location.pathname === path;
  const isCompanyCategory = (cat: string) => {
    const params = new URLSearchParams(location.search);
    return location.pathname === "/" && params.get("category") === cat;
  };

  const w = collapsed ? "w-14" : "w-56";

  const NavItem = ({ to, icon: Icon, label, active }: { to: string; icon: any; label: string; active: boolean }) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          to={to}
          className={`flex items-center gap-3 px-3 py-2 rounded-lg text-caption font-medium transition-colors ${
            active
              ? "bg-secondary text-foreground"
              : "text-foreground/45 hover:text-foreground hover:bg-secondary/50"
          }`}
        >
          <Icon className="w-4 h-4 shrink-0" />
          {!collapsed && <span className="truncate">{label}</span>}
        </Link>
      </TooltipTrigger>
      {collapsed && (
        <TooltipContent side="right" className="text-xs">{label}</TooltipContent>
      )}
    </Tooltip>
  );

  return (
    <aside
      className={`${w} shrink-0 border-r border-border/50 bg-background flex flex-col h-screen sticky top-0 transition-all duration-200 overflow-hidden`}
    >
      {/* Logo + collapse */}
      <div className="flex items-center justify-between px-3 h-12 border-b border-border/30">
        {!collapsed ? (
          <Link to="/" className="flex items-center gap-2">
            <img src={ioradLogo} alt="iorad" className="h-5" />
          </Link>
        ) : (
          <Link to="/" className="mx-auto">
            <img src={ioradLogo} alt="iorad" className="h-5" />
          </Link>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="text-foreground/30 hover:text-foreground/60 transition-colors p-1"
        >
          {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-1">
        {/* Companies section */}
        {!collapsed && (
          <div className="text-micro font-medium uppercase tracking-wider text-foreground/25 px-3 pb-1">
            Companies
          </div>
        )}
        {categoryItems.map(({ key, label, icon }) => (
          <NavItem
            key={key}
            to={`/?category=${key}`}
            icon={icon}
            label={label}
            active={isCompanyCategory(key) || (key === "business" && location.pathname === "/" && !location.search)}
          />
        ))}

        <div className="my-3 border-t border-border/30" />

        <NavItem to="/signals" icon={Signal} label="Signals" active={isActive("/signals")} />
        <NavItem to="/jobs" icon={Clock} label="HubSpot" active={isActive("/jobs")} />

        {/* Recent companies */}
        {recents.length > 0 && (
          <>
            <div className="my-3 border-t border-border/30" />
            {!collapsed && (
              <div className="text-micro font-medium uppercase tracking-wider text-foreground/25 px-3 pb-1">
                Recent
              </div>
            )}
            {recents.map((r) => (
              <Tooltip key={r.company_id}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => navigate(`/company/${r.company_id}`)}
                    className={`w-full flex items-center gap-3 px-3 py-1.5 rounded-lg text-caption transition-colors text-left ${
                      location.pathname === `/company/${r.company_id}`
                        ? "bg-secondary text-foreground font-medium"
                        : "text-foreground/40 hover:text-foreground/70 hover:bg-secondary/50"
                    }`}
                  >
                    <Building2 className="w-3.5 h-3.5 shrink-0" />
                    {!collapsed && (
                      <span className="truncate">{r.company_name}</span>
                    )}
                  </button>
                </TooltipTrigger>
                {collapsed && (
                  <TooltipContent side="right" className="text-xs">{r.company_name}</TooltipContent>
                )}
              </Tooltip>
            ))}
          </>
        )}
      </nav>

      {/* Profile at bottom */}
      {user && (
        <div className="border-t border-border/30 p-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className={`w-full flex items-center gap-2 rounded-lg p-2 hover:bg-secondary transition-colors focus:outline-none ${collapsed ? "justify-center" : ""}`}>
                <Avatar className="h-7 w-7 shrink-0">
                  {avatarUrl && <AvatarImage src={avatarUrl} alt={displayName} />}
                  <AvatarFallback className="text-xs bg-primary/10 text-primary">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                {!collapsed && (
                  <span className="text-caption text-foreground/50 truncate">{displayName}</span>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="top" className="w-48">
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
        </div>
      )}
    </aside>
  );
}
