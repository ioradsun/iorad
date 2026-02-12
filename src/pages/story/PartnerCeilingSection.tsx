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
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
          <h4 className="text-xs font-mono uppercase tracking-widest text-emerald-400 mb-4">Platform Strengths</h4>
          <ul className="space-y-3">
            {customer.partnerPlatform.strengths.map((s, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm text-white/60">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                {s}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
          <h4 className="text-xs font-mono uppercase tracking-widest text-amber-400 mb-4">Execution Gaps</h4>
          <ul className="space-y-3">
            {customer.partnerPlatform.executionGaps.map((g, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm text-white/60">
                <XCircle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                {g}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Key Insight */}
      <div className="rounded-xl border border-emerald-500/10 bg-emerald-500/[0.03] p-5 text-center">
        <p className="text-sm font-semibold text-emerald-300">{customer.partnerPlatform.keyInsight}</p>
      </div>
    </StorySection>
  );
}
