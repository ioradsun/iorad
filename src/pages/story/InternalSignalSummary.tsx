import { ShieldCheck, MessageCircle } from "lucide-react";
import type { InternalSignals } from "@/data/customers";

interface Props {
  signals: InternalSignals;
  conversationStarters?: string[];
}

const urgencyColors: Record<string, string> = {
  "Emerging": "rgb(96,165,250)",
  "Active": "rgb(251,191,36)",
  "High Momentum": "rgb(239,68,68)",
};

export default function InternalSignalSummary({ signals, conversationStarters }: Props) {
  return (
    <section className="max-w-5xl mx-auto px-6 py-12">
      <div className="rounded-xl p-6" style={{ border: "1px dashed var(--story-border)", background: "var(--story-surface)" }}>
        <div className="flex items-center gap-2 mb-4">
          <ShieldCheck className="w-4 h-4" style={{ color: "var(--story-subtle)" }} />
          <p className="text-xs font-mono uppercase tracking-[0.2em]" style={{ color: "var(--story-subtle)" }}>
            Internal Signal Context
          </p>
        </div>

        <div className="grid md:grid-cols-4 gap-4 text-sm mb-6">
          <div>
            <p className="text-xs font-mono uppercase tracking-wider mb-1" style={{ color: "var(--story-subtle)" }}>Signal Types</p>
            <div className="flex flex-wrap gap-1.5">
              {signals.signalTypes.map((t, i) => (
                <span
                  key={i}
                  className="text-xs font-mono px-2 py-0.5 rounded-full"
                  style={{ background: "var(--story-accent-dim)", color: "var(--story-accent)", border: "1px solid var(--story-accent-border)" }}
                >
                  {t}
                </span>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-mono uppercase tracking-wider mb-1" style={{ color: "var(--story-subtle)" }}>Confidence</p>
            <p className="font-semibold">{signals.confidenceLevel}</p>
          </div>

          <div>
            <p className="text-xs font-mono uppercase tracking-wider mb-1" style={{ color: "var(--story-subtle)" }}>Urgency</p>
            <p className="font-semibold" style={{ color: urgencyColors[signals.urgency] || "var(--story-fg)" }}>
              {signals.urgency}
            </p>
          </div>

          <div>
            <p className="text-xs font-mono uppercase tracking-wider mb-1" style={{ color: "var(--story-subtle)" }}>Primary Persona</p>
            <p className="font-semibold">{signals.primaryPersona}</p>
          </div>
        </div>

        {conversationStarters && conversationStarters.length > 0 && (
          <div style={{ borderTop: "1px dashed var(--story-border)" }} className="pt-4">
            <div className="flex items-center gap-2 mb-3">
              <MessageCircle className="w-3.5 h-3.5" style={{ color: "var(--story-subtle)" }} />
              <p className="text-xs font-mono uppercase tracking-[0.2em]" style={{ color: "var(--story-subtle)" }}>
                Suggested Conversation Starters
              </p>
            </div>
            <div className="space-y-2">
              {conversationStarters.map((starter, i) => (
                <p key={i} className="text-sm italic pl-4 leading-relaxed" style={{ color: "var(--story-muted)", borderLeft: "2px solid var(--story-border)" }}>
                  "{starter}"
                </p>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
