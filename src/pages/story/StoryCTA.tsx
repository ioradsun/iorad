import { motion } from "framer-motion";
import { Mail } from "lucide-react";
import { fade } from "./StorySection";
import type { Customer } from "@/data/customers";
import type { PartnerMeta } from "@/data/partnerMeta";

interface Props {
  customer: Customer;
  pm: PartnerMeta;
}

export default function StoryCTA({ customer, pm }: Props) {
  const mailSubject = encodeURIComponent(`iorad + ${pm.label} for ${customer.name}`);
  const mailBody = encodeURIComponent(
    `Hi,\n\nI saw the page you put together for ${customer.name} — I'd like to learn more about how iorad works with ${pm.label}.\n\nBest,\n${customer.contactName || ""}`
  );
  const mailto = `mailto:kate@iorad.com?subject=${mailSubject}&body=${mailBody}`;

  return (
    <section className="max-w-5xl mx-auto px-6 py-24" id="cta">
      <motion.div {...fade} className="text-center">
        <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
          Want to see this for {customer.name}?
        </h2>
        <p className="max-w-xl mx-auto mb-8 leading-relaxed" style={{ color: "var(--story-muted)" }}>
          We can set up a quick walkthrough showing how iorad works inside {pm.label} — specifically for your team's workflows.
        </p>
        <a
          href={mailto}
          className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl font-semibold text-base transition-colors shadow-lg"
          style={{ background: "var(--story-cta-bg)", color: "var(--story-cta-fg)" }}
        >
          <Mail className="w-5 h-5" />
          Let's set up 15 minutes
        </a>
      </motion.div>
    </section>
  );
}
