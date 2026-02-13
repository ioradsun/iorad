import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { customers } from "@/data/customers";
import { partnerMeta } from "@/data/partnerMeta";
import { ArrowRight, ExternalLink, Upload, LayoutDashboard, Settings, History, BookOpen, LogOut, Shield } from "lucide-react";
import ioradLogoDark from "@/assets/iorad-logo-new.png";
import ioradLogoLight from "@/assets/iorad-logo-light.png";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function CustomerList() {
  return (
    <div className="min-h-screen" style={{ background: "var(--story-bg)", color: "var(--story-fg)" }}>
      <StoryNav />
      <main className="max-w-5xl mx-auto px-6 py-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <p className="text-sm font-mono tracking-[0.3em] uppercase mb-4" style={{ color: "var(--story-accent)" }}>
            Account Stories
          </p>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
            iorad Expansion Analysis
          </h1>
          <p className="text-lg max-w-2xl mx-auto" style={{ color: "var(--story-muted)" }}>
            Bespoke analyses showing how iorad creates measurable value inside the platforms your customers already use.
          </p>
        </motion.div>

        <div className="space-y-4">
          {customers.map((c, i) => {
            const pm = partnerMeta[c.partner];
            return (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 * i, duration: 0.5 }}
              >
                <div
                  className="group relative rounded-2xl p-6 flex items-center justify-between gap-6 transition-all duration-300"
                  style={{ border: "1px solid var(--story-border)", background: "var(--story-surface)" }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1.5">
                      <h2 className="text-xl font-semibold tracking-tight truncate">
                        {c.name}
                      </h2>
                      <span
                        className="text-[11px] font-mono font-medium uppercase tracking-wider px-2.5 py-0.5 rounded-full border"
                        style={{
                          borderColor: pm?.color + "40",
                          color: pm?.color,
                          background: pm?.color + "10",
                        }}
                      >
                        {pm?.label}
                      </span>
                    </div>
                    <p className="text-sm" style={{ color: "var(--story-muted)" }}>{c.persona}</p>
                  </div>
                  <a
                    href={`/${c.partner}/${c.id}/stories`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm transition-colors"
                    style={{ background: "var(--story-btn-bg)", color: "var(--story-btn-fg)" }}
                  >
                    Open
                    <ArrowRight className="w-4 h-4" />
                  </a>
                </div>
              </motion.div>
            );
          })}
        </div>
      </main>
    </div>
  );
}

const profileMenuItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/upload", label: "Upload", icon: Upload },
  { to: "/jobs", label: "Jobs", icon: History },
  { to: "/stories", label: "Stories", icon: BookOpen },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function StoryNav() {
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
    <header className="sticky top-0 z-50 backdrop-blur-xl" style={{ borderBottom: "1px solid var(--story-border)", background: "color-mix(in srgb, var(--story-bg) 80%, transparent)" }}>
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
        <Link to="/stories" className="flex items-center gap-2">
          <img src={ioradLogo} alt="iorad" className="h-5" />
          <span className="font-display text-sm font-bold tracking-tight" style={{ color: "var(--story-fg)" }}>Scout</span>
        </Link>
        <nav className="flex items-center gap-6 text-sm">
          <Link to="/stories" className="hover:opacity-80 transition-colors" style={{ color: "var(--story-muted)" }}>
            Customers
          </Link>
          <a
            href="https://www.iorad.com/use-cases"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:opacity-80 transition-colors flex items-center gap-1"
            style={{ color: "var(--story-muted)" }}
          >
            Use cases <ExternalLink className="w-3 h-3" />
          </a>
          <a
            href="https://www.iorad.com/demo"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:opacity-80 transition-colors flex items-center gap-1"
            style={{ color: "var(--story-muted)" }}
          >
            Schedule demo <ExternalLink className="w-3 h-3" />
          </a>
          <a
            href="mailto:kate@iorad.com?subject=Interested%20in%20iorad"
            className="px-4 py-1.5 rounded-lg font-medium transition-colors text-sm"
            style={{ background: "var(--story-cta-bg)", color: "var(--story-cta-fg)" }}
          >
            Get in touch
          </a>

          {user && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded-full p-1 hover:opacity-80 transition-colors focus:outline-none">
                  <Avatar className="h-8 w-8">
                    {avatarUrl && <AvatarImage src={avatarUrl} alt={displayName} />}
                    <AvatarFallback className="text-xs" style={{ background: "var(--story-accent-dim)", color: "var(--story-accent)" }}>
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 bg-popover border-border text-foreground">
                <div className="px-3 py-2 text-xs text-muted-foreground truncate">{user.email}</div>
                {isAdmin && (
                  <>
                    {profileMenuItems.map(({ to, label, icon: Icon }) => (
                      <DropdownMenuItem key={to} asChild className="text-foreground/80 focus:bg-accent focus:text-foreground">
                        <Link to={to} className="flex items-center gap-2 cursor-pointer">
                          <Icon className="w-4 h-4" />
                          {label}
                        </Link>
                      </DropdownMenuItem>
                    ))}
                  </>
                )}
                <DropdownMenuSeparator className="bg-border" />
                <DropdownMenuItem
                  onClick={signOut}
                  className="flex items-center gap-2 cursor-pointer text-destructive focus:bg-accent focus:text-destructive"
                >
                  <LogOut className="w-4 h-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </nav>
      </div>
    </header>
  );
}
