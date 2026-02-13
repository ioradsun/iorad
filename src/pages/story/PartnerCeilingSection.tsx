import { Layers, CheckCircle2, XCircle } from "lucide-react";
import StorySection from "./StorySection";
import type { PartnerMeta } from "@/data/partnerMeta";
import type { Customer } from "@/data/customers";

interface Props {
  customer: Customer;
  pm: PartnerMeta;
}

export default function PartnerCeilingSection({ customer, pm }: Props) {
  return (
    <StorySection icon={Layers} label={`The ${pm.label} Ceiling`} title={`Where ${pm.label} excels — and where it stops`}>
      <div className="grid md:grid-cols-2 gap-6 mb-8">
        <div className="rounded-xl p-6" style={{ border: "1px solid var(--story-border)", background: "var(--story-surface)" }}>
          <h4 className="text-xs font-mono uppercase tracking-widest mb-4" style={{ color: "var(--story-accent)" }}>Platform Strengths</h4>
          <ul className="space-y-3">
            {customer.partnerPlatform.strengths.map((s, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm" style={{ color: "var(--story-muted)" }}>
                <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "var(--story-accent)" }} />
                {s}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl p-6" style={{ border: "1px solid var(--story-border)", background: "var(--story-surface)" }}>
          <h4 className="text-xs font-mono uppercase tracking-widest mb-4" style={{ color: "rgb(251,191,36)" }}>Execution Gaps</h4>
          <ul className="space-y-3">
            {customer.partnerPlatform.executionGaps.map((g, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm" style={{ color: "var(--story-muted)" }}>
                <XCircle className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "rgb(245,158,11)" }} />
                {g}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Key Insight */}
      <div className="rounded-xl p-5 text-center" style={{ border: "1px solid var(--story-accent-border)", background: "var(--story-accent-dim)" }}>
        <p className="text-sm font-semibold" style={{ color: "var(--story-accent-strong)" }}>{customer.partnerPlatform.keyInsight}</p>
      </div>
    </StorySection>
  );
}
