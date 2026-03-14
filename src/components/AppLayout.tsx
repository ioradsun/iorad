import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { Menu } from "lucide-react";
import AppSidebar from "@/components/AppSidebar";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useMobile } from "@/hooks/useMobile";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const isMobile = useMobile();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (drawerOpen) {
      setDrawerOpen(false);
    }
  }, [location.pathname, location.search, drawerOpen]);

  useEffect(() => {
    mainRef.current?.scrollTo(0, 0);
  }, [location.pathname, location.search]);

  return (
    <div className="h-screen bg-background flex overflow-hidden">
      {!isMobile && <AppSidebar />}

      {isMobile && (
        <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
          <SheetContent side="left" className="w-[280px] p-0 [&>button]:hidden">
            <AppSidebar onNavigate={() => setDrawerOpen(false)} />
          </SheetContent>
        </Sheet>
      )}

      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        {isMobile && (
          <header className="sticky top-0 z-40 flex items-center h-12 px-4 border-b border-border/30 bg-background safe-top">
            <button
              onClick={() => setDrawerOpen(true)}
              className="p-1.5 -ml-1.5 rounded-lg text-foreground/50 hover:text-foreground hover:bg-secondary/50 transition-colors"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>
          </header>
        )}

        <main ref={mainRef} className="flex-1 min-w-0 overflow-y-auto">
          <div className="px-4 md:px-6 py-6 md:py-8 max-w-5xl mx-auto w-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
