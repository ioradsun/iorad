import { motion } from "framer-motion";

const fade = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-60px" },
  transition: { duration: 0.6 },
};

interface StorySectionProps {
  icon: React.ElementType;
  label: string;
  title: string;
  children: React.ReactNode;
}

export { fade };

export default function StorySection({ icon: Icon, label, title, children }: StorySectionProps) {
  return (
    <section className="max-w-5xl mx-auto px-6 py-16">
      <motion.div {...fade}>
        <div className="flex items-center gap-2 mb-3">
          <Icon className="w-4 h-4" style={{ color: "var(--story-accent)" }} />
          <p className="text-xs font-mono uppercase tracking-[0.2em]" style={{ color: "var(--story-accent)" }}>{label}</p>
        </div>
        <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-8">{title}</h2>
        {children}
      </motion.div>
    </section>
  );
}
