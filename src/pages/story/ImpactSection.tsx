import { BarChart3 } from "lucide-react";
import { motion } from "framer-motion";
import { fade } from "./StorySection";
import StorySection from "./StorySection";
import type { QuantifiedImpactItem } from "@/data/customers";

interface Props {
  items: QuantifiedImpactItem[];
}

export default function ImpactSection({ items }: Props) {
  return (
    <StorySection icon={BarChart3} label="Quantified Impact" title="The numbers behind the narrative">
      <div className="grid md:grid-cols-2 gap-6">
        {items.map((q, i) => (
          <motion.div
            key={i}
            {...fade}
            transition={{ ...fade.transition, delay: i * 0.15 }}
            className="rounded-2xl border border-emerald-500/10 bg-emerald-500/[0.03] p-6"
          >
            <h4 className="font-semibold mb-3">{q.title}</h4>
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-xs font-mono uppercase tracking-wider text-white/30 mb-1">Assumptions</p>
                <p className="text-white/50">{q.assumptions}</p>
              </div>
              <div>
                <p className="text-xs font-mono uppercase tracking-wider text-white/30 mb-1">Calculation</p>
                <p className="font-mono text-emerald-400 text-xs">{q.math}</p>
              </div>
              <div className="pt-2 border-t border-white/[0.06]">
                <p className="font-semibold text-emerald-300">{q.result}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </StorySection>
  );
}
