import { Link, useLocation } from "react-router-dom";
import { Upload, LayoutDashboard, Settings, History, BookOpen, Zap, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/upload", label: "Upload", icon: Upload },
  { to: "/jobs", label: "Jobs", icon: History },
  { to: "/stories", label: "Stories", icon: BookOpen },
  { to: "/settings", label: "Settings", icon: Settings },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { user, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto px-6 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded bg-primary/20 flex items-center justify-center">
              <Zap className="w-4 h-4 text-primary" />
            </div>
            <span className="font-display text-sm font-bold tracking-tight text-foreground">
              DEAL SIGNAL
            </span>
            <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground hidden sm:block">
              Intelligence
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <nav className="flex items-center gap-1">
              {navItems.map(({ to, label, icon: Icon }) => {
                const active = location.pathname === to;
                return (
                  <Link
                    key={to}
                    to={to}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm transition-colors ${
                      active
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="hidden sm:inline">{label}</span>
                  </Link>
                );
              })}
            </nav>
            {user && (
              <div className="flex items-center gap-2 border-l pl-4 border-border">
                <span className="text-xs text-muted-foreground hidden md:inline">{user.email}</span>
                <button
                  onClick={signOut}
                  className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                  title="Sign out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </header>
      <main className="max-w-[1600px] mx-auto px-6 py-6">
        {children}
      </main>
    </div>
  );
}
