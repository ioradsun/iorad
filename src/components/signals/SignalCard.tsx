import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MessageCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useAuth } from "@/hooks/useAuth";
import { useToggleReaction, type Signal } from "@/hooks/useSignals";

const EMOJI_MAP: Record<string, string> = {
  thumbsup: "👍",
  heart: "❤️",
  fire: "🔥",
  eyes: "👀",
};

interface SignalCardProps {
  signal: Signal;
  onOpenComments: (signal: Signal) => void;
}

export default function SignalCard({ signal, onOpenComments }: SignalCardProps) {
  const { user } = useAuth();
  const toggleReaction = useToggleReaction();

  const initials = signal.author_name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div
      className="border rounded-lg p-5 bg-card hover:shadow-md transition-shadow cursor-pointer"
      onClick={() => onOpenComments(signal)}
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-3">
        <Avatar className="h-8 w-8">
          {signal.author_avatar && <AvatarImage src={signal.author_avatar} alt={signal.author_name} />}
          <AvatarFallback className="text-xs bg-primary/10 text-primary">{initials}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium text-foreground">{signal.author_name}</span>
          <span className="text-xs text-muted-foreground ml-2">
            {formatDistanceToNow(new Date(signal.created_at), { addSuffix: true })}
          </span>
        </div>
        <Badge variant={signal.status === "open" ? "default" : "secondary"} className="text-[10px] px-2">
          {signal.status === "open" ? "Open" : "Closed"}
        </Badge>
      </div>

      {/* Content */}
      <h3 className="font-semibold text-foreground mb-1">{signal.title}</h3>
      <p className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-4">{signal.description}</p>

      {/* Footer */}
      <div className="flex items-center gap-1 mt-4 pt-3 border-t" onClick={(e) => e.stopPropagation()}>
        {Object.entries(EMOJI_MAP).map(([key, emoji]) => {
          const voters = signal.reactions[key] || [];
          const active = user ? voters.includes(user.id) : false;
          return (
            <Button
              key={key}
              variant="ghost"
              size="sm"
              className={`h-7 px-2 text-xs gap-1 ${active ? "bg-primary/10 text-primary" : "text-muted-foreground"}`}
              onClick={() =>
                toggleReaction.mutate({
                  signalId: signal.id,
                  emoji: key,
                  currentReactions: signal.reactions,
                })
              }
            >
              {emoji}
              {voters.length > 0 && <span>{voters.length}</span>}
            </Button>
          );
        })}
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs gap-1 text-muted-foreground ml-auto"
          onClick={() => onOpenComments(signal)}
        >
          <MessageCircle className="w-3.5 h-3.5" />
          {(signal.comment_count ?? 0) > 0 && <span>{signal.comment_count}</span>}
        </Button>
      </div>
    </div>
  );
}
