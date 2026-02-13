import { Zap, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { fade } from "./StorySection";
import StorySection from "./StorySection";
import type { Customer } from "@/data/customers";
import type { PartnerMeta } from "@/data/partnerMeta";

interface Props {
  customer: Customer;
  pm: PartnerMeta;
}

export default function EmbeddedLeverageSection({ customer, pm }: Props) {
  const steps = [
    { label: "Situation", text: customer.embeddedIorad.situation, color: "text-blue-400" },
    { label: "Constraint", text: customer.embeddedIorad.constraint, color: "text-amber-400" },
    { label: "Intervention", text: customer.embeddedIorad.intervention, color: "text-emerald-400" },
    { label: "Transformation", text: customer.embeddedIorad.transformation, color: "text-teal-300" },
  ];

  return (
    <StorySection icon={Zap} label="Embedded iorad Leverage" title="From constraint to transformation">
      <div className="grid md:grid-cols-2 gap-4">
        {steps.map((item, i) => (
          <motion.div
            key={i}
            {...fade}
            transition={{ ...fade.transition, delay: i * 0.12 }}
            className="rounded-xl p-5" style={{ border: "1px solid var(--story-border)", background: "var(--story-surface)" }}
          >
            <p className={`text-xs font-mono uppercase tracking-widest ${item.color} mb-2`}>{item.label}</p>
            <p className="text-sm leading-relaxed" style={{ color: "var(--story-muted)" }}>{item.text}</p>
          </motion.div>
        ))}
      </div>
      <div className="mt-8">
        <h4 className="text-xs font-mono uppercase tracking-widest mb-3" style={{ color: "var(--story-subtle)" }}>
          Where iorad embeds inside {pm.label}
        </h4>
        <ul className="space-y-2">
          {pm.embedBullets.map((b, i) => (
            <li key={i} className="flex items-start gap-2.5 text-sm" style={{ color: "var(--story-muted)" }}>
              <ArrowRight className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
              {b}
            </li>
          ))}
        </ul>
      </div>
    </StorySection>
  );
}
