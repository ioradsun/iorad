import { SnapshotStatus, JobStatus, JobItemStatus } from "@/types";

interface StatusBadgeProps {
  status: SnapshotStatus | JobStatus | JobItemStatus | string | null;
}

const statusMap: Record<string, string> = {
  Generated: "status-generated",
  "Low Signal": "status-low-signal",
  "No Change": "status-no-change",
  Error: "status-error",
  completed: "status-generated",
  running: "status-running",
  queued: "status-low-signal",
  failed: "status-error",
  canceled: "status-no-change",
  succeeded: "status-generated",
  skipped: "status-low-signal",
};

export default function StatusBadge({ status }: StatusBadgeProps) {
  if (!status) return <span className="text-xs text-muted-foreground">—</span>;
  const cls = statusMap[status] || "status-low-signal";
  return (
    <span className={`status-badge ${cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${
        cls === "status-generated" ? "bg-primary" :
        cls === "status-running" ? "bg-info animate-pulse-glow" :
        cls === "status-error" ? "bg-destructive" :
        cls === "status-no-change" ? "bg-warning" : "bg-muted-foreground"
      }`} />
      {status}
    </span>
  );
}
