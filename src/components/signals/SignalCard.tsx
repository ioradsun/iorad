import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { MessageCircle, MoreHorizontal } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useToggleReaction, useToggleSignalStatus, type Signal } from "@/hooks/useSignals";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const REACTIONS: { key: string; emoji: string }[] = [
  { key: "thumbsup", emoji: "👍" },
  { key: "heart", emoji: "❤️" },
  { key: "fire", emoji: "🔥" },
  { key: "eyes", emoji: "👀" },
];

interface SignalCardProps {
  signal: Signal;
  onOpenComments: (signal: Signal) => void;
}

export default function SignalCard({ signal, onOpenComments }: SignalCardProps) {
  const { user } = useAuth();
  const isAdmin = useIsAdmin();
  const toggleReaction = useToggleReaction();
  const toggleStatus = useToggleSignalStatus();

  const initials = signal.author_name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const totalReactions = Object.values(signal.reactions).reduce((sum, arr) => sum + arr.length, 0);

  return (
    <article className="border rounded-xl bg-card overflow-hidden">
      {/* Header row — avatar, name, time, status, menu */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-2">
        <Avatar className="h-9 w-9 flex-shrink-0">
          {signal.author_avatar && <AvatarImage src={signal.author_avatar} alt={signal.author_name} />}
          <AvatarFallback className="text-xs bg-primary/10 text-primary font-medium">{initials}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground truncate">{signal.author_name}</span>
            <span className="text-xs text-muted-foreground">·</span>
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(signal.created_at), { addSuffix: true })}
            </span>
          </div>
        </div>
        {signal.status === "closed" && signal.resolution && (
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
            signal.resolution === "complete"
              ? "bg-green-500/10 text-green-600 dark:text-green-400"
              : "bg-muted text-muted-foreground"
          }`}>
            {signal.resolution === "complete" ? "Completed" : "Ignored"}
          </span>
        )}
        {isAdmin && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="p-1 rounded-full hover:bg-muted transition-colors text-muted-foreground">
                <MoreHorizontal className="w-4 h-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              {signal.status === "open" ? (
                <>
                  <DropdownMenuItem
                    onClick={() =>
                      toggleStatus.mutate({
                        signalId: signal.id,
                        currentStatus: signal.status,
                        signalAuthorId: signal.author_id,
                        resolution: "complete",
                      })
                    }
                  >
                    Close as Complete
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() =>
                      toggleStatus.mutate({
                        signalId: signal.id,
                        currentStatus: signal.status,
                        signalAuthorId: signal.author_id,
                        resolution: "ignored",
                      })
                    }
                  >
                    Close as Ignored
                  </DropdownMenuItem>
                </>
              ) : (
                <DropdownMenuItem
                  onClick={() =>
                    toggleStatus.mutate({
                      signalId: signal.id,
                      currentStatus: signal.status,
                      signalAuthorId: signal.author_id,
                    })
                  }
                >
                  Reopen signal
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Content */}
      <div className="px-4 pb-3">
        <h3 className="font-semibold text-foreground text-[15px] leading-snug">{signal.title}</h3>
        <p className="text-sm text-foreground/80 mt-1 whitespace-pre-wrap leading-relaxed line-clamp-5">
          {signal.description}
        </p>
      </div>

      {/* Action bar — Instagram style */}
      <div className="px-4 pb-1 flex items-center gap-0.5">
        {REACTIONS.map(({ key, emoji }) => {
          const voters = signal.reactions[key] || [];
          const active = user ? voters.includes(user.id) : false;
          return (
            <button
              key={key}
              onClick={() =>
                toggleReaction.mutate({
                  signalId: signal.id,
                  emoji: key,
                  currentReactions: signal.reactions,
                })
              }
              className={`h-9 w-9 flex items-center justify-center rounded-full transition-all text-base hover:scale-110 active:scale-95 ${
                active ? "bg-primary/10" : "hover:bg-muted"
              }`}
            >
              {emoji}
            </button>
          );
        })}
        <div className="flex-1" />
        <button
          onClick={() => onOpenComments(signal)}
          className="h-9 w-9 flex items-center justify-center rounded-full hover:bg-muted transition-colors text-muted-foreground"
        >
          <MessageCircle className="w-5 h-5" />
        </button>
      </div>

      {/* Likes / comments count — Instagram style */}
      <div className="px-4 pb-3 space-y-0.5">
        {totalReactions > 0 && (
          <p className="text-xs font-semibold text-foreground">
            {totalReactions} reaction{totalReactions !== 1 ? "s" : ""}
          </p>
        )}
        {(signal.comment_count ?? 0) > 0 && (
          <button
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => onOpenComments(signal)}
          >
            View all {signal.comment_count} comment{signal.comment_count !== 1 ? "s" : ""}
          </button>
        )}
      </div>
    </article>
  );
}
