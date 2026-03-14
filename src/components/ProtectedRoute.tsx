import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        {/* Skeleton header matching AppLayout */}
        <div className="hidden md:flex border-b border-border/30 bg-card/50 h-14 items-center px-6">
          <div className="h-5 w-24 bg-foreground/[0.06] rounded animate-pulse" />
          <div className="ml-6 flex gap-3">
            <div className="h-4 w-28 bg-foreground/[0.04] rounded animate-pulse" />
            <div className="h-4 w-24 bg-foreground/[0.04] rounded animate-pulse" />
          </div>
          <div className="ml-auto h-8 w-8 bg-foreground/[0.04] rounded-full animate-pulse" />
        </div>
        <div className="md:hidden h-12 border-b border-border/30 bg-card/50 flex items-center px-4">
          <div className="h-5 w-5 bg-foreground/[0.06] rounded animate-pulse" />
        </div>
        {/* Skeleton content area */}
        <div className="max-w-5xl mx-auto px-4 md:px-6 py-6 md:py-8">
          <div className="flex gap-3 mb-6">
            <div className="h-9 w-24 bg-foreground/[0.06] rounded-md animate-pulse" />
            <div className="h-9 w-24 bg-foreground/[0.04] rounded-md animate-pulse" />
            <div className="h-9 w-24 bg-foreground/[0.04] rounded-md animate-pulse" />
            <div className="flex-1" />
            <div className="h-9 w-40 bg-foreground/[0.04] rounded-md animate-pulse" />
          </div>
          <div className="rounded-lg border border-border/30 bg-card overflow-hidden">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-4 border-b border-border/20">
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-foreground/[0.06] rounded w-48" />
                  <div className="h-3 bg-foreground/[0.03] rounded w-32" />
                </div>
                <div className="h-5 bg-foreground/[0.04] rounded w-16" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
