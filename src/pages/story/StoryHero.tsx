import { motion } from "framer-motion";
import { PartnerMeta } from "@/data/partnerMeta";
import { Customer } from "@/data/customers";

interface StoryHeroProps {
  customer: Customer;
  pm: PartnerMeta;
}

export default function StoryHero({ customer, pm }: StoryHeroProps) {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, var(--story-accent-dim), transparent, transparent)" }} />
      <div className="max-w-5xl mx-auto px-6 pt-16 pb-20 relative">
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
          <span
            className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-[0.2em] px-3 py-1 rounded-full border mb-6"
            style={{ borderColor: pm.color + "50", color: pm.color, background: pm.color + "10" }}
          >
            Prepared for {customer.name}
          </span>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight leading-[1.15] mb-6 max-w-3xl">
            {customer.contactName ? (
              <>
                {customer.contactName}, here's what we're seeing at{" "}
                <span style={{ backgroundImage: `linear-gradient(to right, var(--story-gradient-from), var(--story-gradient-to))`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                  {customer.name}
                </span>
              </>
            ) : (
              <>
                An operating brief for{" "}
                <span style={{ backgroundImage: `linear-gradient(to right, var(--story-gradient-from), var(--story-gradient-to))`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                  {customer.name}
                </span>
              </>
            )}
          </h1>
          <p className="text-lg max-w-2xl leading-relaxed" style={{ color: "var(--story-muted)" }}>
            Based on public signals, here's a grounded look at where {customer.name} is heading — and where reinforcement gaps typically show up at this stage.
          </p>
        </motion.div>
      </div>
    </section>
  );
}
