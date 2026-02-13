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
  const greeting = customer.contactName || "there";
  const mailSubject = encodeURIComponent(`Interested in embedded iorad via ${pm.label}`);
  const mailBody = encodeURIComponent(
    `Hi Kate, I saw the ${customer.name} embedded iorad page and want to learn more about how this could work for us.`
  );
  const mailto = `mailto:kate@iorad.com?subject=${mailSubject}&body=${mailBody}`;

  return (
    <section className="max-w-5xl mx-auto px-6 py-24" id="cta">
      <motion.div {...fade} className="text-center">
        <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
          {customer.contactName ? `${customer.contactName}, ready` : "Ready"} to unlock more value inside {pm.label}?
        </h2>
        <p className="text-white/50 max-w-xl mx-auto mb-2 leading-relaxed">
          {customer.name}'s partner enablement can move faster with iorad embedded directly inside {pm.label}.
        </p>
        <p className="text-sm text-white/30 mb-8">
          See how iorad embeds inside {pm.label} for {customer.name}.
        </p>
        <a
          href={mailto}
          className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl bg-emerald-500 text-black font-semibold text-base hover:bg-emerald-400 transition-colors shadow-lg shadow-emerald-500/20"
        >
          <Mail className="w-5 h-5" />
          Get in touch with Kate to learn more
        </a>
      </motion.div>
    </section>
  );
}
