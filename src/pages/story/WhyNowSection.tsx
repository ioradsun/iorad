import { Clock } from "lucide-react";
import { motion } from "framer-motion";
import { fade } from "./StorySection";

interface Props {
  text: string;
}

export default function WhyNowSection({ text }: Props) {
  return (
    <section className="max-w-5xl mx-auto px-6 py-12">
      <motion.div
        {...fade}
        className="rounded-xl p-6"
        style={{ border: "1px solid var(--story-border)", background: "var(--story-surface)" }}
      >
        <div className="flex items-center gap-2 mb-3">
          <Clock className="w-4 h-4" style={{ color: "var(--story-accent)" }} />
          <p className="text-xs font-mono uppercase tracking-[0.2em]" style={{ color: "var(--story-accent)" }}>Why This Matters Now</p>
        </div>
        <p className="text-sm leading-relaxed max-w-3xl" style={{ color: "var(--story-muted)" }}>{text}</p>
      </motion.div>
    </section>
  );
}
