import { useState, useMemo } from "react";
import { useSignals, type Signal } from "@/hooks/useSignals";
import SignalCard from "@/components/signals/SignalCard";
import NewSignalDialog from "@/components/signals/NewSignalDialog";
import CommentPanel from "@/components/signals/CommentPanel";
import NotificationBell from "@/components/signals/NotificationBell";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

export default function InternalSignals() {
  const [tab, setTab] = useState<"open" | "closed">("open");
  const [search, setSearch] = useState("");
  const [activeSignal, setActiveSignal] = useState<Signal | null>(null);
  const { data: signals = [], isLoading } = useSignals(tab);

  const filtered = useMemo(() => {
    if (!search.trim()) return signals;
    const q = search.toLowerCase();
    return signals.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.author_name.toLowerCase().includes(q)
    );
  }, [signals, search]);

  const handleNotificationSignal = (signalId: string) => {
    const found = signals.find((s) => s.id === signalId);
    if (found) setActiveSignal(found);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-foreground">Internal Signals</h1>
        <div className="flex items-center gap-2">
          <NotificationBell onSelectSignal={handleNotificationSignal} />
          <NewSignalDialog />
        </div>
      </div>

      {/* Tabs + Search */}
      <div className="flex items-center gap-3 flex-wrap">
        <Tabs value={tab} onValueChange={(v) => setTab(v as "open" | "closed")}>
          <TabsList>
            <TabsTrigger value="open">Open</TabsTrigger>
            <TabsTrigger value="closed">Closed</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search signals…"
            className="pl-8 h-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Feed */}
      {isLoading ? (
        <div className="text-center text-muted-foreground py-12">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center text-muted-foreground py-12">
          {search ? "No signals match your search" : "No signals yet — create the first one!"}
        </div>
      ) : (
        <div className="space-y-3 max-w-2xl">
          {filtered.map((signal) => (
            <SignalCard key={signal.id} signal={signal} onOpenComments={setActiveSignal} />
          ))}
        </div>
      )}

      <CommentPanel signal={activeSignal} onClose={() => setActiveSignal(null)} />
    </div>
  );
}
