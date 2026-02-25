import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useUnreadNotifications, useMarkNotificationsRead } from "@/hooks/useSignals";
import { formatDistanceToNow } from "date-fns";

interface NotificationBellProps {
  onSelectSignal?: (signalId: string) => void;
}

export default function NotificationBell({ onSelectSignal }: NotificationBellProps) {
  const { data: notifications = [] } = useUnreadNotifications();
  const markRead = useMarkNotificationsRead();
  const count = notifications.length;

  const handleClick = (n: (typeof notifications)[0]) => {
    markRead.mutate([n.id]);
    onSelectSignal?.(n.signal_id);
  };

  const handleMarkAll = () => {
    if (notifications.length > 0) {
      markRead.mutate(notifications.map((n) => n.id));
    }
  };

  const typeLabel: Record<string, string> = {
    comment: "commented on your signal",
    reply: "replied to your comment",
    status_change: "changed the status of your signal",
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-8 w-8">
          <Bell className="w-4 h-4" />
          {count > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
              {count > 9 ? "9+" : count}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        {notifications.length === 0 ? (
          <div className="px-3 py-4 text-sm text-muted-foreground text-center">No new notifications</div>
        ) : (
          <>
            {notifications.slice(0, 8).map((n) => (
              <DropdownMenuItem key={n.id} className="flex flex-col items-start gap-0.5 cursor-pointer" onClick={() => handleClick(n)}>
                <span className="text-sm">
                  <strong>{n.actor_name}</strong> {typeLabel[n.type] || n.type}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                </span>
              </DropdownMenuItem>
            ))}
            <DropdownMenuItem className="text-xs text-center justify-center text-muted-foreground" onClick={handleMarkAll}>
              Mark all as read
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
