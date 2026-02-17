import { statusColors } from "./types";

export function TruthBadge({ status }: { status?: string }) {
  if (!status) return null;
  const cls = statusColors[status] || statusColors.Unknown;
  return <span className={`text-[10px] px-1.5 py-0.5 rounded border ${cls}`}>{status}</span>;
}
