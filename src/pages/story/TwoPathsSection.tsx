import { GitBranch } from "lucide-react";
import { motion } from "framer-motion";
import { fade } from "./StorySection";
import StorySection from "./StorySection";

interface Props {
  pathA: string;
  pathB: string;
}

export default function TwoPathsSection({ pathA, pathB }: Props) {
  return (
    <StorySection icon={GitBranch} label="Two Paths" title="Two ways this typically evolves">
      <div className="grid md:grid-cols-2 gap-6 max-w-4xl">
        <motion.div
          {...fade}
          className="rounded-xl p-6"
          style={{ border: "1px solid var(--story-border)", background: "var(--story-surface)" }}
        >
          <p className="text-xs font-mono uppercase tracking-widest mb-3" style={{ color: "var(--story-subtle)" }}>Path A — More of the same</p>
          <p className="text-sm leading-relaxed" style={{ color: "var(--story-muted)" }}>{pathA}</p>
        </motion.div>
        <motion.div
          {...fade}
          transition={{ ...fade.transition, delay: 0.15 }}
          className="rounded-xl p-6"
          style={{ border: "1px solid var(--story-accent-border)", background: "var(--story-accent-dim)" }}
        >
          <p className="text-xs font-mono uppercase tracking-widest mb-3" style={{ color: "var(--story-accent)" }}>Path B — Reinforcement built in</p>
          <p className="text-sm leading-relaxed" style={{ color: "var(--story-muted)" }}>{pathB}</p>
        </motion.div>
      </div>
    </StorySection>
  );
}
