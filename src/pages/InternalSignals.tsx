import { useState, useMemo } from "react";
import { useSignals, useCreateSignal, type Signal } from "@/hooks/useSignals";
import SignalCard from "@/components/signals/SignalCard";
import CommentPanel from "@/components/signals/CommentPanel";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export default function InternalSignals() {
  const [tab, setTab] = useState<"open" | "closed">("open");
  const [activeSignal, setActiveSignal] = useState<Signal | null>(null);
  const { data: signals = [], isLoading } = useSignals(tab);
  const { user } = useAuth();
  const create = useCreateSignal();

  // Compose state
  const [composeOpen, setComposeOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const displayName =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email?.split("@")[0] ||
    "User";
  const avatarUrl =
    user?.user_metadata?.avatar_url || user?.user_metadata?.picture || undefined;
  const initials = displayName
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const handlePost = async () => {
    if (!title.trim() || !body.trim()) return;
    try {
      await create.mutateAsync({ title: title.trim(), description: body.trim() });
      toast.success("Signal posted");
      setTitle("");
      setBody("");
      setComposeOpen(false);
    } catch {
      toast.error("Failed to post signal");
    }
  };

  return (
    <div className="max-w-xl mx-auto">
      {/* Compose box */}
      <div className="border rounded-xl bg-card mb-4 overflow-hidden">
        {!composeOpen ? (
          <button
            className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors"
            onClick={() => setComposeOpen(true)}
          >
            <Avatar className="h-10 w-10 flex-shrink-0">
              {avatarUrl && <AvatarImage src={avatarUrl} alt={displayName} />}
              <AvatarFallback className="text-sm bg-primary/10 text-primary font-medium">
                {initials}
              </AvatarFallback>
            </Avatar>
      <span className="text-muted-foreground text-sm flex-1">
              What's your idea or problem with Scout?
            </span>
          </button>
        ) : (
          <div className="p-4 space-y-3">
            <div className="flex items-start gap-3">
              <Avatar className="h-10 w-10 flex-shrink-0 mt-0.5">
                {avatarUrl && <AvatarImage src={avatarUrl} alt={displayName} />}
                <AvatarFallback className="text-sm bg-primary/10 text-primary font-medium">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 space-y-2">
                <span className="text-sm font-semibold text-foreground">{displayName}</span>
                <input
                  autoFocus
                  className="w-full bg-transparent text-foreground font-semibold text-base placeholder:text-muted-foreground/60 placeholder:font-normal outline-none"
                  placeholder="Signal title…"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
                <textarea
                  className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground/60 outline-none resize-none min-h-[60px]"
                  placeholder="Describe the idea or improvement…"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
            <div className="flex items-center justify-between pt-2 border-t">
              <button
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => {
                  setComposeOpen(false);
                  setTitle("");
                  setBody("");
                }}
              >
                Cancel
              </button>
              <button
                className="px-5 py-1.5 rounded-full bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-40 hover:bg-primary/90 transition-colors"
                disabled={!title.trim() || !body.trim() || create.isPending}
                onClick={handlePost}
              >
                {create.isPending ? "Posting…" : "Post"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Subtle underline tabs */}
      <div className="flex items-center border-b mb-5">
        {([
          { key: "open" as const, label: "Recent" },
          { key: "closed" as const, label: "Resolved" },
        ]).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-semibold transition-colors relative ${
              tab === t.key
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground/70"
            }`}
          >
            {t.label}
            {tab === t.key && (
              <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-foreground rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* Feed */}
      {isLoading ? (
        <div className="text-center text-muted-foreground py-16 text-sm">Loading…</div>
      ) : signals.length === 0 ? (
        <div className="text-center text-muted-foreground py-16 text-sm">
          No {tab} signals yet — be the first to post!
        </div>
      ) : (
        <div className="space-y-4">
          {signals.map((signal) => (
            <SignalCard key={signal.id} signal={signal} onOpenComments={setActiveSignal} />
          ))}
        </div>
      )}

      <CommentPanel signal={activeSignal} onClose={() => setActiveSignal(null)} />
    </div>
  );
}
