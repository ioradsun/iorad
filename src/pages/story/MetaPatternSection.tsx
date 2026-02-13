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
      <div className="rounded-xl p-6 mb-8" style={{ border: "1px solid rgba(245,158,11,0.10)", background: "rgba(245,158,11,0.03)" }}>
        <p className="text-xs font-mono uppercase tracking-widest mb-3" style={{ color: "rgb(251,191,36)" }}>Root Pattern</p>
        <p className="leading-relaxed" style={{ color: "var(--story-muted)" }}>{metaPattern.description}</p>
      </div>

      {/* Friction points */}
      <div className="space-y-4">
        {friction.map((f, i) => (
          <motion.div
            key={i}
            {...fade}
            transition={{ ...fade.transition, delay: i * 0.1 }}
            className="rounded-xl p-5"
            style={{ border: "1px solid rgba(239,68,68,0.10)", background: "rgba(239,68,68,0.03)" }}
          >
            <h4 className="font-semibold text-sm mb-2" style={{ color: "rgb(248,113,113)" }}>{f.title}</h4>
            <p className="text-sm leading-relaxed" style={{ color: "var(--story-muted)" }}>{f.detail}</p>
          </motion.div>
        ))}
      </div>
    </StorySection>
  );
}
