import { useState } from "react";
import { Info, ChevronDown, ChevronRight, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface AnnotationData {
  sectionKey: string;
  sectionLabel: string;
  /** Which snapshot_json fields this section reads from */
  jsonFields: string[];
  /** What the AI generated (or null if empty) */
  hasContent: boolean;
  /** Matched signals — inferred from evidence or signal types */
  matchedSignals?: { type: string; title: string; url: string }[];
  /** Why this section might be empty or limited */
  reasoning?: string;
  /** Additional detection info (e.g., enterprise systems, library match) */
  detections?: { label: string; value: string; status: "found" | "missing" | "inferred" }[];
  /** Optional children for interactive elements like LibraryPicker */
  children?: React.ReactNode;
}

export default function SectionAnnotation({
  sectionKey,
  sectionLabel,
  jsonFields,
  hasContent,
  matchedSignals = [],
  reasoning,
  detections = [],
  children,
}: AnnotationData) {
  const { user } = useAuth();
  const isIorad = user?.email?.endsWith("@iorad.com");
  const [open, setOpen] = useState(false);

  if (!isIorad) return null;

  return (
    <div className="mb-3">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-mono transition-all hover:scale-[1.02]"
        style={{
          background: hasContent ? "var(--story-accent-dim, rgba(16,185,129,0.1))" : "rgba(234,179,8,0.1)",
          color: hasContent ? "var(--story-accent)" : "#EAB308",
          border: `1px solid ${hasContent ? "var(--story-accent-border, rgba(16,185,129,0.2))" : "rgba(234,179,8,0.2)"}`,
        }}
      >
        <Info className="w-3 h-3" />
        <span>AI Justification</span>
        {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
      </button>

      {open && (
        <div
          className="mt-2 rounded-lg p-4 text-xs space-y-3"
          style={{
            background: "var(--story-surface)",
            border: "1px solid var(--story-border)",
            color: "var(--story-fg)",
          }}
        >
          {/* Section mapping */}
          <div>
            <p className="font-mono uppercase text-[10px] tracking-wider mb-1" style={{ color: "var(--story-subtle)" }}>
              Data Source
            </p>
            <p className="font-mono" style={{ color: "var(--story-muted)" }}>
              snapshot_json → {jsonFields.join(", ")}
            </p>
          </div>

          {/* Content status */}
          <div className="flex items-center gap-2">
            {hasContent ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            ) : (
              <XCircle className="w-3.5 h-3.5 text-yellow-500" />
            )}
            <span style={{ color: "var(--story-muted)" }}>
              {hasContent ? "Content generated successfully" : "No content generated for this section"}
            </span>
          </div>

          {/* Detections */}
          {detections.length > 0 && (
            <div>
              <p className="font-mono uppercase text-[10px] tracking-wider mb-1.5" style={{ color: "var(--story-subtle)" }}>
                Detections
              </p>
              <div className="space-y-1">
                {detections.map((d, i) => (
                  <div key={i} className="flex items-center gap-2">
                    {d.status === "found" && <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />}
                    {d.status === "missing" && <XCircle className="w-3 h-3 text-red-400 shrink-0" />}
                    {d.status === "inferred" && <AlertTriangle className="w-3 h-3 text-yellow-500 shrink-0" />}
                    <span style={{ color: "var(--story-muted)" }}>
                      <strong>{d.label}:</strong> {d.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Matched signals */}
          {matchedSignals.length > 0 && (
            <div>
              <p className="font-mono uppercase text-[10px] tracking-wider mb-1.5" style={{ color: "var(--story-subtle)" }}>
                Signals Used ({matchedSignals.length})
              </p>
              <div className="space-y-1">
                {matchedSignals.map((s, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span
                      className="shrink-0 px-1 py-0.5 rounded text-[9px] uppercase font-bold"
                      style={{ background: "var(--story-accent-dim)", color: "var(--story-accent)" }}
                    >
                      {s.type}
                    </span>
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="truncate hover:underline"
                      style={{ color: "var(--story-accent)" }}
                    >
                      {s.title}
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Reasoning */}
          {reasoning && (
            <div className="flex items-start gap-2 p-2 rounded" style={{ background: "var(--story-bg)" }}>
              <AlertTriangle className="w-3.5 h-3.5 text-yellow-500 shrink-0 mt-0.5" />
              <p style={{ color: "var(--story-muted)" }}>{reasoning}</p>
            </div>
          )}

          {/* Custom children (e.g., LibraryPicker) */}
          {children}
        </div>
      )}
    </div>
  );
}
