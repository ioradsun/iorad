import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { formatDistanceToNow } from "date-fns";
import { useSignalComments, useAddComment, useToggleSignalStatus, type Signal, type SignalComment } from "@/hooks/useSignals";
import { useAuth } from "@/hooks/useAuth";
import { Send, Reply, Lock, Unlock } from "lucide-react";

interface CommentPanelProps {
  signal: Signal | null;
  onClose: () => void;
}

export default function CommentPanel({ signal, onClose }: CommentPanelProps) {
  const { data: comments = [] } = useSignalComments(signal?.id ?? null);
  const addComment = useAddComment();
  const toggleStatus = useToggleSignalStatus();
  const { user } = useAuth();
  const [body, setBody] = useState("");
  const [replyTo, setReplyTo] = useState<SignalComment | null>(null);

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
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSubmit();
  };

  // Build threaded structure
  const topLevel = comments.filter((c) => !c.parent_id);
  const repliesMap: Record<string, SignalComment[]> = {};
  comments.filter((c) => c.parent_id).forEach((c) => {
    repliesMap[c.parent_id!] = [...(repliesMap[c.parent_id!] || []), c];
  });

  const initials = (name: string) =>
    name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

  return (
    <Sheet open={!!signal} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-lg flex flex-col p-0">
        {signal && (
          <>
            {/* Header */}
            <SheetHeader className="p-5 pb-3 border-b">
              <div className="flex items-center justify-between gap-2">
                <SheetTitle className="text-left flex-1">{signal.title}</SheetTitle>
                <Badge variant={signal.status === "open" ? "default" : "secondary"} className="text-[10px]">
                  {signal.status}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{signal.description}</p>
              <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                <span>{signal.author_name}</span>
                <span>·</span>
                <span>{formatDistanceToNow(new Date(signal.created_at), { addSuffix: true })}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-auto h-6 text-xs gap-1"
                  onClick={() =>
                    toggleStatus.mutate({
                      signalId: signal.id,
                      currentStatus: signal.status,
                      signalAuthorId: signal.author_id,
                    })
                  }
                >
                  {signal.status === "open" ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                  {signal.status === "open" ? "Close" : "Reopen"}
                </Button>
              </div>
            </SheetHeader>

            {/* Comments */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {topLevel.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">No comments yet</p>
              )}
              {topLevel.map((comment) => (
                <div key={comment.id}>
                  <CommentBubble comment={comment} initials={initials} onReply={() => setReplyTo(comment)} />
                  {(repliesMap[comment.id] || []).map((reply) => (
                    <div key={reply.id} className="ml-8 mt-2">
                      <CommentBubble comment={reply} initials={initials} onReply={() => setReplyTo(reply)} />
                    </div>
                  ))}
                </div>
              ))}
            </div>

            {/* Input */}
            <div className="border-t p-4 space-y-2">
              {replyTo && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Reply className="w-3 h-3" />
                  <span>Replying to {replyTo.author_name}</span>
                  <button className="ml-auto underline" onClick={() => setReplyTo(null)}>Cancel</button>
                </div>
              )}
              <div className="flex gap-2">
                <Textarea
                  placeholder="Add a comment… (⌘+Enter to send)"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  onKeyDown={handleKeyDown}
                  rows={2}
                  className="resize-none"
                />
                <Button
                  size="icon"
                  className="h-auto aspect-square"
                  disabled={!body.trim() || addComment.isPending}
                  onClick={handleSubmit}
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function CommentBubble({
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
        <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
          {initials(comment.author_name)}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-medium text-foreground">{comment.author_name}</span>
          <span className="text-[11px] text-muted-foreground">
            {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
          </span>
        </div>
        <p className="text-sm text-foreground/90 mt-0.5 whitespace-pre-wrap">{comment.body}</p>
        <button className="text-[11px] text-muted-foreground hover:text-foreground mt-1" onClick={onReply}>
          Reply
        </button>
      </div>
    </div>
  );
}
