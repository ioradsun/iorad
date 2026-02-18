import { statusColors } from "./types";
import { ExternalLink } from "lucide-react";

export function TruthBadge({ status, source }: { status?: string; source?: string }) {
  if (!status) return null;
  const cls = statusColors[status] || statusColors.Unknown;

  // For Source-backed, show the source name/URL inline
  if (status === "Source-backed" && source) {
    const isUrl = source.startsWith("http");
    return (
      <span className={`text-[10px] px-1.5 py-0.5 rounded border ${cls} flex items-center gap-1 whitespace-nowrap`}>
        {isUrl ? (
          <a
            href={source}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-0.5 hover:underline"
            onClick={e => e.stopPropagation()}
          >
            Source-backed <ExternalLink className="w-2.5 h-2.5" />
          </a>
        ) : (
          <>Source: {source}</>
        )}
      </span>
    );
  }

  return <span className={`text-[10px] px-1.5 py-0.5 rounded border ${cls}`}>{status}</span>;
}
