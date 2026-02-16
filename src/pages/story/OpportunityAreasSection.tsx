import { Target } from "lucide-react";
import { motion } from "framer-motion";
import { fade } from "./StorySection";
import StorySection from "./StorySection";
import type { InitiativeItem } from "@/data/customers";

interface Props {
  companyName: string;
  items: InitiativeItem[];
}

export default function OpportunityAreasSection({ companyName, items }: Props) {
  return (
    <StorySection icon={Target} label="Opportunity Areas" title={`Opportunity areas for ${companyName}`}>
      <div className="grid md:grid-cols-2 gap-5">
        {items.map((item, i) => (
          <motion.div
            key={i}
            {...fade}
            transition={{ ...fade.transition, delay: i * 0.12 }}
            className="rounded-xl p-6"
            style={{ border: "1px solid var(--story-accent-border)", background: "var(--story-accent-dim)" }}
          >
            <h4 className="font-semibold mb-2">{item.title}</h4>
            <p className="text-sm leading-relaxed" style={{ color: "var(--story-muted)" }}>{item.detail}</p>
          </motion.div>
        ))}
      </div>
    </StorySection>
  );
}
