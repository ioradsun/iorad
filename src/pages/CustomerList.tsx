import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { customers } from "@/data/customers";
import { partnerMeta } from "@/data/partnerMeta";
import { ArrowRight, ExternalLink, Upload, LayoutDashboard, Settings, History, BookOpen, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
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
    <div className="min-h-screen bg-[#0A0A0F] text-white">
      <StoryNav />
      <main className="max-w-5xl mx-auto px-6 py-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <p className="text-sm font-mono tracking-[0.3em] uppercase text-emerald-400 mb-4">
            Account Stories
          </p>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
            iorad Expansion Analysis
          </h1>
          <p className="text-lg text-white/50 max-w-2xl mx-auto">
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
                <div className="group relative rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm hover:border-white/[0.12] hover:bg-white/[0.04] transition-all duration-300 p-6 flex items-center justify-between gap-6">
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
                    <p className="text-sm text-white/40">{c.persona}</p>
                  </div>
                  <a
                    href={`/${c.partner}/${c.id}/stories`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-[#0A0A0F] font-medium text-sm hover:bg-white/90 transition-colors group-hover:shadow-lg group-hover:shadow-white/5"
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
    <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#0A0A0F]/80 backdrop-blur-xl">
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
        <Link to="/stories" className="font-bold text-lg tracking-tight">
          <span className="text-emerald-400">iorad</span>
        </Link>
        <nav className="flex items-center gap-6 text-sm">
          <Link to="/stories" className="text-white/60 hover:text-white transition-colors">
            Customers
          </Link>
          <a
            href="https://www.iorad.com/use-cases"
            target="_blank"
            rel="noopener noreferrer"
            className="text-white/60 hover:text-white transition-colors flex items-center gap-1"
          >
            Use cases <ExternalLink className="w-3 h-3" />
          </a>
          <a
            href="https://www.iorad.com/demo"
            target="_blank"
            rel="noopener noreferrer"
            className="text-white/60 hover:text-white transition-colors flex items-center gap-1"
          >
            Schedule demo <ExternalLink className="w-3 h-3" />
          </a>
          <a
            href="mailto:kate@iorad.com?subject=Interested%20in%20iorad"
            className="px-4 py-1.5 rounded-lg bg-emerald-500 text-black font-medium hover:bg-emerald-400 transition-colors text-sm"
          >
            Get in touch
          </a>

          {user && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded-full p-1 hover:bg-white/10 transition-colors focus:outline-none">
                  <Avatar className="h-8 w-8">
                    {avatarUrl && <AvatarImage src={avatarUrl} alt={displayName} />}
                    <AvatarFallback className="text-xs bg-emerald-500/20 text-emerald-400">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 bg-[#1a1a24] border-white/10 text-white">
                <div className="px-3 py-2 text-xs text-white/50 truncate">{user.email}</div>
                <DropdownMenuSeparator className="bg-white/10" />
                {profileMenuItems.map(({ to, label, icon: Icon }) => (
                  <DropdownMenuItem key={to} asChild className="text-white/80 focus:bg-white/10 focus:text-white">
                    <Link to={to} className="flex items-center gap-2 cursor-pointer">
                      <Icon className="w-4 h-4" />
                      {label}
                    </Link>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator className="bg-white/10" />
                <DropdownMenuItem
                  onClick={signOut}
                  className="flex items-center gap-2 cursor-pointer text-red-400 focus:bg-white/10 focus:text-red-400"
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
