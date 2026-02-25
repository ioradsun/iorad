import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { useSignalComments, useAddComment, type Signal, type SignalComment } from "@/hooks/useSignals";
import { useAuth } from "@/hooks/useAuth";
import { Send } from "lucide-react";

interface CommentPanelProps {
  signal: Signal | null;
  onClose: () => void;
}

export default function CommentPanel({ signal, onClose }: CommentPanelProps) {
  const { data: comments = [] } = useSignalComments(signal?.id ?? null);
  const addComment = useAddComment();
  const { user } = useAuth();
  const [body, setBody] = useState("");
  const [replyTo, setReplyTo] = useState<SignalComment | null>(null);

  const avatarUrl =
    user?.user_metadata?.avatar_url || user?.user_metadata?.picture || undefined;
  const displayName =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email?.split("@")[0] ||
    "User";
  const userInitials = displayName
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const handleSubmit = async () => {
    if (!body.trim() || !signal) return;
    await addComment.mutateAsync({
      signalId: signal.id,
      body: body.trim(),
      parentId: replyTo?.id ?? null,
      signalAuthorId: signal.author_id,
      parentCommentAuthorId: replyTo?.author_id ?? null,
    });
    setBody("");
    setReplyTo(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Threaded
  const topLevel = comments.filter((c) => !c.parent_id);
  const repliesMap: Record<string, SignalComment[]> = {};
  comments
    .filter((c) => c.parent_id)
    .forEach((c) => {
      repliesMap[c.parent_id!] = [...(repliesMap[c.parent_id!] || []), c];
    });

  const ini = (name: string) =>
    name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

  return (
    <Sheet open={!!signal} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-md flex flex-col p-0 gap-0">
        {signal && (
          <>
            {/* Post recap */}
            <SheetHeader className="p-4 pb-3 border-b space-y-2">
              <div className="flex items-center gap-3">
                <Avatar className="h-8 w-8">
                  {signal.author_avatar && <AvatarImage src={signal.author_avatar} />}
                  <AvatarFallback className="text-[10px] bg-primary/10 text-primary font-medium">
                    {ini(signal.author_name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-semibold text-foreground">{signal.author_name}</span>
                  <span className="text-xs text-muted-foreground ml-2">
                    {formatDistanceToNow(new Date(signal.created_at), { addSuffix: true })}
                  </span>
                </div>
                <Badge variant={signal.status === "open" ? "default" : "secondary"} className="text-[10px] h-5">
                  {signal.status}
                </Badge>
              </div>
              <SheetTitle className="text-left text-sm">{signal.title}</SheetTitle>
              <p className="text-xs text-muted-foreground leading-relaxed">{signal.description}</p>
            </SheetHeader>

            {/* Comments */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
              {topLevel.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-10">
                  No comments yet — start the conversation.
                </p>
              )}
              {topLevel.map((c) => (
                <div key={c.id}>
                  <CommentRow comment={c} initials={ini} onReply={() => setReplyTo(c)} />
                  {(repliesMap[c.id] || []).map((r) => (
                    <div key={r.id} className="ml-10 mt-3">
                      <CommentRow comment={r} initials={ini} onReply={() => setReplyTo(r)} />
                    </div>
                  ))}
                </div>
              ))}
            </div>

            {/* Compose — Instagram-style input */}
            <div className="border-t px-4 py-3">
              {replyTo && (
                <div className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                  Replying to <strong>{replyTo.author_name}</strong>
                  <button className="ml-auto text-xs underline" onClick={() => setReplyTo(null)}>
                    Cancel
                  </button>
                </div>
              )}
              <div className="flex items-center gap-3">
                <Avatar className="h-8 w-8 flex-shrink-0">
                  {avatarUrl && <AvatarImage src={avatarUrl} />}
                  <AvatarFallback className="text-[10px] bg-primary/10 text-primary font-medium">
                    {userInitials}
                  </AvatarFallback>
                </Avatar>
                <input
                  className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
                  placeholder="Add a comment…"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  onKeyDown={handleKeyDown}
                />
                <button
                  className="text-primary font-semibold text-sm disabled:opacity-30 transition-opacity"
                  disabled={!body.trim() || addComment.isPending}
                  onClick={handleSubmit}
                >
                  Post
                </button>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function CommentRow({
  comment,
  initials,
  onReply,
}: {
  comment: SignalComment;
  initials: (name: string) => string;
  onReply: () => void;
}) {
  return (
    <div className="flex gap-2.5">
      <Avatar className="h-7 w-7 flex-shrink-0 mt-0.5">
        {comment.author_avatar && <AvatarImage src={comment.author_avatar} />}
        <AvatarFallback className="text-[10px] bg-primary/10 text-primary font-medium">
          {initials(comment.author_name)}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <p className="text-sm">
          <span className="font-semibold text-foreground">{comment.author_name}</span>{" "}
          <span className="text-foreground/85">{comment.body}</span>
        </p>
        <div className="flex items-center gap-3 mt-1">
          <span className="text-[11px] text-muted-foreground">
            {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
          </span>
          <button className="text-[11px] font-semibold text-muted-foreground hover:text-foreground" onClick={onReply}>
            Reply
          </button>
        </div>
      </div>
    </div>
  );
}
