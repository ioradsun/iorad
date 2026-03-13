import { forwardRef } from "react";
import { Mail } from "lucide-react";
import type { Customer } from "@/data/customers";
import type { PartnerMeta } from "@/data/partnerMeta";
import { EditableText } from "./EditableText";
import { useStoryEdit } from "./EditContext";
import { useFadeIn } from "./useFadeIn";

interface Props {
  customer: Customer;
  pm: PartnerMeta;
}

const StoryCTA = forwardRef<HTMLElement, Props>(function StoryCTA({ customer, pm }, _ref) {
  const ctx = useStoryEdit();
  const ref = useFadeIn();

  const mailSubject = encodeURIComponent(`Following up — ${customer.name} operating brief`);
  const mailBody = encodeURIComponent(
    `Hi,\n\nI reviewed the brief you put together for ${customer.name}. I'd like to compare notes on some of the patterns you identified — particularly around reinforcement and adoption.\n\nWould be great to find 15 minutes.\n\nBest,\n${customer.contactName || ""}`
  );
  const mailto = `mailto:kate@iorad.com?subject=${mailSubject}&body=${mailBody}`;

  const defaultTitle = "Continue the conversation";
  const defaultDesc = "If this perspective reflects what you're navigating internally, we'd welcome a meeting to walk through these ideas together and compare notes on where reinforcement could reduce friction.";

  const title = ctx?.editedCustomer?.overrides?.["cta.title"] || defaultTitle;
  const desc = ctx?.editedCustomer?.overrides?.["cta.desc"] || defaultDesc;

  return (
    <section className="max-w-5xl mx-auto px-6 py-24" id="cta">
      <div ref={ref} className="fade-in text-center">
        {ctx?.isEditing ? (
          <EditableText value={title} field="overrides.cta.title" as="h2" className="text-2xl md:text-3xl font-bold tracking-tight mb-4" />
        ) : (
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-4">{title}</h2>
        )}
        {ctx?.isEditing ? (
          <EditableText value={desc} field="overrides.cta.desc" as="p" className="max-w-xl mx-auto mb-8 leading-relaxed text-sm" style={{ color: "var(--story-muted)" }} />
        ) : (
          <p className="max-w-xl mx-auto mb-8 leading-relaxed text-sm" style={{ color: "var(--story-muted)" }}>{desc}</p>
        )}
        <a
          href={mailto}
          className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl font-semibold text-base transition-colors shadow-lg"
          style={{ background: "var(--story-cta-bg)", color: "var(--story-cta-fg)" }}
        >
          <Mail className="w-5 h-5" />
          Let's find 15 minutes
        </a>
      </div>
    </section>
  );
});

export default StoryCTA;
