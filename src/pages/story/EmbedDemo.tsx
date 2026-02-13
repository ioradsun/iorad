import { motion } from "framer-motion";
import { fade } from "./StorySection";

export default function EmbedDemo() {
  return (
    <section className="max-w-5xl mx-auto px-6 py-16">
      <motion.div {...fade}>
        <p className="text-xs font-mono uppercase tracking-[0.2em] text-emerald-400 mb-3">Embedded Walkthrough</p>
        <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-4">See it in action</h2>
        <p className="max-w-2xl mb-8 leading-relaxed" style={{ color: "var(--story-muted)" }}>
          This is what embedded execution feels like. Partners don't leave the platform — they learn by doing, right where they work.
        </p>
        <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--story-border)", background: "var(--story-surface)", aspectRatio: "16/9" }}>
          <iframe
            src="https://ior.ad/b973?iframeHash=trysteps-1"
            className="w-full h-full border-0"
            allow="clipboard-read; clipboard-write"
            title="iorad embedded tutorial"
          />
        </div>
      </motion.div>
    </section>
  );
}
