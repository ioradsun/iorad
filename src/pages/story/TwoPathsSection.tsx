import { GitBranch } from "lucide-react";
import { motion } from "framer-motion";
import { fade } from "./StorySection";
import StorySection from "./StorySection";
import { EditableText } from "./EditableText";
import { useStoryEdit } from "./EditContext";

interface Props {
  pathA: string;
  pathB: string;
}

export default function TwoPathsSection({ pathA, pathB }: Props) {
  const ctx = useStoryEdit();
  const a = ctx?.isEditing ? ctx.editedCustomer.pathA : pathA;
  const b = ctx?.isEditing ? ctx.editedCustomer.pathB : pathB;

  return (
    <StorySection
      icon={GitBranch}
      label="Two Paths"
      labelField="overrides.paths.label"
      title="Two ways this typically evolves"
      titleField="overrides.paths.title"
    >
      <div className="grid md:grid-cols-2 gap-6 max-w-4xl">
        <motion.div {...fade} className="rounded-xl p-6" style={{ border: "1px solid var(--story-border)", background: "var(--story-surface)" }}>
          <p className="text-xs font-mono uppercase tracking-widest mb-3" style={{ color: "var(--story-subtle)" }}>Path A — More of the same</p>
          <EditableText value={a} field="pathA" as="p" className="text-sm leading-relaxed" style={{ color: "var(--story-muted)" }} />
        </motion.div>
        <motion.div {...fade} transition={{ ...fade.transition, delay: 0.15 }} className="rounded-xl p-6" style={{ border: "1px solid var(--story-accent-border)", background: "var(--story-accent-dim)" }}>
          <p className="text-xs font-mono uppercase tracking-widest mb-3" style={{ color: "var(--story-accent)" }}>Path B — Reinforcement built in</p>
          <EditableText value={b} field="pathB" as="p" className="text-sm leading-relaxed" style={{ color: "var(--story-muted)" }} />
        </motion.div>
      </div>
    </StorySection>
  );
}
