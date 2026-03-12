import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEffect } from "react";

export interface Signal {
  id: string;
  author_id: string;
  author_name: string;
  author_avatar: string | null;
  title: string;
  description: string;
  status: "open" | "closed";
  resolution: string | null;
  reactions: Record<string, string[]>;
  created_at: string;
  updated_at: string;
  comment_count?: number;
}

export interface SignalComment {
  id: string;
  signal_id: string;
  author_id: string;
  author_name: string;
  author_avatar: string | null;
  body: string;
  parent_id: string | null;
  created_at: string;
}

export function useSignals(status: "open" | "closed") {
  return useQuery({
    queryKey: ["internal_signals", status],
    queryFn: async () => {
      const { data: signals, error } = await supabase
        .from("internal_signals")
        .select("*")
        .eq("status", status)
        .order("created_at", { ascending: false });
      if (error) throw error;

      // Get comment counts
      const ids = (signals || []).map((s: any) => s.id);
      let commentCounts: Record<string, number> = {};
      if (ids.length > 0) {
        const { data: comments } = await supabase
          .from("signal_comments")
          .select("signal_id")
          .in("signal_id", ids);
        (comments || []).forEach((c: any) => {
          commentCounts[c.signal_id] = (commentCounts[c.signal_id] || 0) + 1;
        });
      }

      return (signals || []).map((s: any) => ({
        ...s,
        reactions: s.reactions || {},
        comment_count: commentCounts[s.id] || 0,
      })) as Signal[];
    },
  });
}

export function useSignalComments(signalId: string | null) {
  return useQuery({
    queryKey: ["signal_comments", signalId],
    enabled: !!signalId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("signal_comments")
        .select("*")
        .eq("signal_id", signalId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as SignalComment[];
    },
  });
}

export function useCreateSignal() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ title, description }: { title: string; description: string }) => {
      const { error } = await supabase.from("internal_signals").insert({
        author_id: user!.id,
        author_name:
          user!.user_metadata?.full_name ||
          user!.user_metadata?.name ||
          user!.email?.split("@")[0] ||
          "User",
        author_avatar: user!.user_metadata?.avatar_url || user!.user_metadata?.picture || null,
        title,
        description,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["internal_signals"] }),
  });
}

export function useAddComment() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({
      signalId,
      body,
      parentId,
      signalAuthorId,
      parentCommentAuthorId,
    }: {
      signalId: string;
      body: string;
      parentId?: string | null;
      signalAuthorId: string;
      parentCommentAuthorId?: string | null;
    }) => {
      const authorName =
        user!.user_metadata?.full_name ||
        user!.user_metadata?.name ||
        user!.email?.split("@")[0] ||
        "User";

      const { error } = await supabase.from("signal_comments").insert({
        signal_id: signalId,
        author_id: user!.id,
        author_name: authorName,
        author_avatar: user!.user_metadata?.avatar_url || user!.user_metadata?.picture || null,
        body,
        parent_id: parentId || null,
      });
      if (error) throw error;

      // Notify signal author (if not self)
      if (signalAuthorId !== user!.id) {
        await supabase.from("signal_notifications").insert({
          user_id: signalAuthorId,
          signal_id: signalId,
          type: parentId ? "reply" : "comment",
          actor_name: authorName,
        });
      }

      // Notify parent comment author (if reply and not self and not same as signal author)
      if (parentId && parentCommentAuthorId && parentCommentAuthorId !== user!.id && parentCommentAuthorId !== signalAuthorId) {
        await supabase.from("signal_notifications").insert({
          user_id: parentCommentAuthorId,
          signal_id: signalId,
          type: "reply",
          actor_name: authorName,
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["signal_comments"] });
      qc.invalidateQueries({ queryKey: ["internal_signals"] });
    },
  });
}

export function useToggleReaction() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ signalId, emoji, currentReactions }: { signalId: string; emoji: string; currentReactions: Record<string, string[]> }) => {
      const userId = user!.id;
      const updated = { ...currentReactions };
      const list = updated[emoji] || [];
      if (list.includes(userId)) {
        updated[emoji] = list.filter((id) => id !== userId);
        if (updated[emoji].length === 0) delete updated[emoji];
      } else {
        updated[emoji] = [...list, userId];
      }
      const { error } = await supabase
        .from("internal_signals")
        .update({ reactions: updated })
        .eq("id", signalId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["internal_signals"] }),
  });
}

export function useToggleSignalStatus() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ signalId, currentStatus, signalAuthorId, resolution }: { signalId: string; currentStatus: string; signalAuthorId: string; resolution?: string }) => {
      const newStatus = currentStatus === "open" ? "closed" : "open";
      const updatePayload: Record<string, any> = { status: newStatus, updated_at: new Date().toISOString() };
      if (newStatus === "closed" && resolution) {
        updatePayload.resolution = resolution;
      } else if (newStatus === "open") {
        updatePayload.resolution = null;
      }
      const { error } = await supabase
        .from("internal_signals")
        .update(updatePayload)
        .eq("id", signalId);
      if (error) throw error;

      // Notify signal author
      if (signalAuthorId !== user!.id) {
        const authorName =
          user!.user_metadata?.full_name ||
          user!.user_metadata?.name ||
          user!.email?.split("@")[0] ||
          "User";
        await supabase.from("signal_notifications").insert({
          user_id: signalAuthorId,
          signal_id: signalId,
          type: "status_change",
          actor_name: authorName,
        });
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["internal_signals"] }),
  });
}

export function useUnreadNotifications() {
  const { user } = useAuth();
  const qc = useQueryClient();

  // Realtime subscription
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("signal_notifications_realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "signal_notifications", filter: `user_id=eq.${user.id}` },
        () => qc.invalidateQueries({ queryKey: ["signal_notifications_unread"] })
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id, qc]);

  return useQuery({
    queryKey: ["signal_notifications_unread"],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("signal_notifications")
        .select("*")
        .eq("user_id", user!.id)
        .eq("read", false)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 30_000,
  });
}

export function useMarkNotificationsRead() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (notificationIds: string[]) => {
      const { error } = await supabase
        .from("signal_notifications")
        .update({ read: true })
        .in("id", notificationIds)
        .eq("user_id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["signal_notifications_unread"] }),
  });
}
