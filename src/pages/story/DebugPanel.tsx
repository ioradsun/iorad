import { useState } from "react";
import { Bug, ChevronDown, ChevronRight, ExternalLink, Clock, Zap, Brain, Database } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface Signal {
  id: string;
  type: string;
  title: string;
  url: string;
  date: string | null;
  raw_excerpt: string | null;
  discovered_at: string;
}

interface DebugPanelProps {
  companyId: string;
  companyName: string;
  scoreTotal: number;
  scoreBreakdown: Record<string, number>;
  modelVersion: string | null;
  promptVersion: string | null;
  snapshotCreatedAt: string;
  snapshotJson: Record<string, any>;
  signals: Signal[];
}

function CollapsibleSection({ title, icon: Icon, children, defaultOpen = false }: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center gap-2 w-full py-2 text-left hover:opacity-80 transition-opacity">
        {open ? <ChevronDown className="w-3.5 h-3.5 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 shrink-0" />}
        <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--story-accent)" }} />
        <span className="text-xs font-mono uppercase tracking-[0.15em] font-semibold">{title}</span>
      </CollapsibleTrigger>
      <CollapsibleContent className="pl-7 pb-3">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}

export default function DebugPanel({
  companyName,
  scoreTotal,
  scoreBreakdown,
  modelVersion,
  promptVersion,
  snapshotCreatedAt,
  snapshotJson,
  signals,
}: DebugPanelProps) {
  const [open, setOpen] = useState(false);
  const [showRawJson, setShowRawJson] = useState(false);

  return (
    <div className="fixed bottom-4 left-4 z-[100] max-w-lg" style={{ fontFamily: "monospace" }}>
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-mono shadow-lg transition-all hover:scale-105"
          style={{
            background: "var(--story-surface)",
            border: "1px solid var(--story-border)",
            color: "var(--story-fg)",
          }}
        >
          <Bug className="w-4 h-4" style={{ color: "var(--story-accent)" }} />
          Debug
        </button>
      ) : (
        <div
          className="rounded-xl shadow-2xl overflow-hidden"
          style={{
            background: "var(--story-surface)",
            border: "1px solid var(--story-border)",
            color: "var(--story-fg)",
            maxHeight: "80vh",
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid var(--story-border)" }}>
            <div className="flex items-center gap-2">
              <Bug className="w-4 h-4" style={{ color: "var(--story-accent)" }} />
              <span className="text-xs font-mono font-bold uppercase tracking-wider">Story Debug — {companyName}</span>
            </div>
            <button onClick={() => setOpen(false)} className="text-xs hover:opacity-70 px-2 py-1 rounded" style={{ color: "var(--story-subtle)" }}>
              ✕
            </button>
          </div>

          {/* Content */}
          <div className="overflow-y-auto px-4 py-3 space-y-1" style={{ maxHeight: "70vh" }}>
            
            {/* Score Breakdown */}
            <CollapsibleSection title={`Score: ${scoreTotal}/100`} icon={Zap} defaultOpen>
              <div className="space-y-1.5 text-xs">
                {Object.entries(scoreBreakdown).map(([key, val]) => (
                  <div key={key} className="flex items-center justify-between">
                    <span style={{ color: "var(--story-muted)" }}>{key}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--story-border)" }}>
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${Math.min(val * 2, 100)}%`, background: "var(--story-accent)" }}
                        />
                      </div>
                      <span className="font-semibold w-6 text-right">{val}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CollapsibleSection>

            {/* Model Info */}
            <CollapsibleSection title="Generation Info" icon={Brain}>
              <div className="text-xs space-y-1" style={{ color: "var(--story-muted)" }}>
                <div className="flex justify-between">
                  <span>Model</span>
                  <span className="font-semibold" style={{ color: "var(--story-fg)" }}>{modelVersion || "unknown"}</span>
                </div>
                <div className="flex justify-between">
                  <span>Prompt Version</span>
                  <span className="font-semibold" style={{ color: "var(--story-fg)" }}>{promptVersion || "unknown"}</span>
                </div>
                <div className="flex justify-between">
                  <span>Generated</span>
                  <span className="font-semibold" style={{ color: "var(--story-fg)" }}>
                    {new Date(snapshotCreatedAt).toLocaleString()}
                  </span>
                </div>
              </div>
            </CollapsibleSection>

            {/* Signals Used */}
            <CollapsibleSection title={`Signals Used (${signals.length})`} icon={Database}>
              {signals.length === 0 ? (
                <p className="text-xs" style={{ color: "var(--story-subtle)" }}>No signals found in database.</p>
              ) : (
                <div className="space-y-2.5">
                  {signals.map((sig) => (
                    <div key={sig.id} className="text-xs space-y-0.5">
                      <div className="flex items-start gap-2">
                        <span
                          className="shrink-0 px-1.5 py-0.5 rounded text-[10px] uppercase font-bold"
                          style={{ background: "var(--story-accent-dim)", color: "var(--story-accent)", border: "1px solid var(--story-accent-border)" }}
                        >
                          {sig.type}
                        </span>
                        <span className="font-semibold leading-tight">{sig.title}</span>
                      </div>
                      {sig.raw_excerpt && (
                        <p className="text-[11px] leading-relaxed line-clamp-3 pl-1" style={{ color: "var(--story-subtle)" }}>
                          {sig.raw_excerpt.slice(0, 300)}…
                        </p>
                      )}
                      <div className="flex items-center gap-3 pl-1" style={{ color: "var(--story-subtle)" }}>
                        <a href={sig.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:underline" style={{ color: "var(--story-accent)" }}>
                          <ExternalLink className="w-3 h-3" /> source
                        </a>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(sig.discovered_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CollapsibleSection>

            {/* Raw JSON */}
            <CollapsibleSection title="Raw Snapshot JSON" icon={Database}>
              <button
                onClick={() => setShowRawJson(!showRawJson)}
                className="text-xs mb-2 underline"
                style={{ color: "var(--story-accent)" }}
              >
                {showRawJson ? "Hide" : "Show"} full JSON
              </button>
              {showRawJson && (
                <pre className="text-[10px] leading-tight overflow-x-auto p-2 rounded" style={{ background: "var(--story-bg)", maxHeight: "300px" }}>
                  {JSON.stringify(snapshotJson, null, 2)}
                </pre>
              )}
            </CollapsibleSection>
          </div>
        </div>
      )}
    </div>
  );
}
