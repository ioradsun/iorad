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
  const mailSubject = encodeURIComponent(`Exploring iorad for ${customer.name}`);
  const mailBody = encodeURIComponent(
    `Hi Kate,\n\nI reviewed the insight brief for ${customer.name} and would love to explore how iorad could support our initiatives.\n\nLooking forward to connecting.`
  );
  const mailto = `mailto:kate@iorad.com?subject=${mailSubject}&body=${mailBody}`;

  return (
    <section className="max-w-5xl mx-auto px-6 py-24" id="cta">
      <motion.div {...fade} className="text-center">
        <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
          {customer.contactName ? `${customer.contactName}, let's` : "Let's"} explore this together
        </h2>
        <p className="max-w-xl mx-auto mb-8 leading-relaxed" style={{ color: "var(--story-muted)" }}>
          We'd love to walk through these insights with you and discuss how interactive process reinforcement could support {customer.name}'s current initiatives.
        </p>
        <a
          href={mailto}
          className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl font-semibold text-base transition-colors shadow-lg"
          style={{ background: "var(--story-cta-bg)", color: "var(--story-cta-fg)" }}
        >
          <Mail className="w-5 h-5" />
          Start a conversation with Kate
        </a>
      </motion.div>
    </section>
  );
}
