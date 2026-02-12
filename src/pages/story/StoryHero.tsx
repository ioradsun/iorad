import { motion } from "framer-motion";
import { PartnerMeta } from "@/data/partnerMeta";
import { Customer } from "@/data/customers";

const SIGNATURE = "If a workflow requires a human to explain it, you don't have scale — you have dependency.";

interface StoryHeroProps {
  customer: Customer;
  pm: PartnerMeta;
}

export default function StoryHero({ customer, pm }: StoryHeroProps) {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/[0.04] via-transparent to-transparent" />
      <div className="max-w-5xl mx-auto px-6 pt-16 pb-20 relative">
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
          <span
            className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-[0.2em] px-3 py-1 rounded-full border mb-6"
            style={{ borderColor: pm.color + "50", color: pm.color, background: pm.color + "10" }}
          >
            Embedded inside {pm.label}
          </span>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight leading-[1.1] mb-6 max-w-3xl">
            Unlock more value from {pm.label} at{" "}
            <span className="bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">
              {customer.name}
            </span>
          </h1>
          <p className="text-lg md:text-xl text-white/50 max-w-2xl leading-relaxed mb-8">
            {customer.whyNow}
          </p>
          <p className="text-sm italic text-white/30 border-l-2 border-emerald-500/30 pl-4 max-w-xl">
            "{SIGNATURE}"
          </p>
        </motion.div>
      </div>
    </section>
  );
}
