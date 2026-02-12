import { AlertTriangle } from "lucide-react";
import StorySection from "./StorySection";
import type { MetaPattern, CustomerSignal } from "@/data/customers";
import { motion } from "framer-motion";
import { fade } from "./StorySection";

const patternLabels: Record<MetaPattern["type"], string> = {
  "adoption weak after rollout": "Adoption weak after rollout",
  "avoiding chaos before rollout": "Avoiding chaos before rollout",
  "drowning in repeat questions/manual training": "Drowning in repeat questions",
};

interface Props {
  metaPattern: MetaPattern;
  friction: CustomerSignal[];
}

export default function MetaPatternSection({ metaPattern, friction }: Props) {
  return (
    <StorySection icon={AlertTriangle} label="Why This Breaks at Scale" title={patternLabels[metaPattern.type]}>
      {/* Meta-pattern diagnosis */}
      <div className="rounded-xl border border-amber-500/10 bg-amber-500/[0.03] p-6 mb-8">
        <p className="text-xs font-mono uppercase tracking-widest text-amber-400 mb-3">Root Pattern</p>
        <p className="text-white/60 leading-relaxed">{metaPattern.description}</p>
      </div>

      {/* Friction points */}
      <div className="space-y-4">
        {friction.map((f, i) => (
          <motion.div
            key={i}
            {...fade}
            transition={{ ...fade.transition, delay: i * 0.1 }}
            className="rounded-xl border border-red-500/10 bg-red-500/[0.03] p-5"
          >
            <h4 className="font-semibold text-sm mb-2 text-red-400">{f.title}</h4>
            <p className="text-sm text-white/50 leading-relaxed">{f.detail}</p>
          </motion.div>
        ))}
      </div>
    </StorySection>
  );
}
