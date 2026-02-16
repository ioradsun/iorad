import { AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";
import { fade } from "./StorySection";
import StorySection from "./StorySection";

interface Props {
  items: string[];
}

export default function ExecutionFrictionSection({ items }: Props) {
  return (
    <StorySection icon={AlertTriangle} label="Pattern Recognition" title="Where execution friction usually emerges">
      <div className="space-y-4 max-w-3xl">
        {items.map((item, i) => (
          <motion.div
            key={i}
            {...fade}
            transition={{ ...fade.transition, delay: i * 0.1 }}
            className="flex items-start gap-4 rounded-xl p-5"
            style={{ border: "1px solid var(--story-border)", background: "var(--story-surface)" }}
          >
            <span
              className="mt-1 w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs font-mono font-semibold"
              style={{ background: "var(--story-accent-dim)", color: "var(--story-accent)", border: "1px solid var(--story-accent-border)" }}
            >
              {i + 1}
            </span>
            <p className="text-sm leading-relaxed" style={{ color: "var(--story-muted)" }}>{item}</p>
          </motion.div>
        ))}
      </div>
    </StorySection>
  );
}
