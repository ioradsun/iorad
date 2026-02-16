import { Zap } from "lucide-react";
import { motion } from "framer-motion";
import { fade } from "./StorySection";
import StorySection from "./StorySection";
import type { InitiativeItem } from "@/data/customers";

interface Props {
  items: InitiativeItem[];
}

export default function HowIoradHelpsSection({ items }: Props) {
  return (
    <StorySection icon={Zap} label="Where iorad Fits" title="What this looks like with iorad in the stack">
      <div className="grid md:grid-cols-2 gap-5">
        {items.map((item, i) => (
          <motion.div
            key={i}
            {...fade}
            transition={{ ...fade.transition, delay: i * 0.12 }}
            className="rounded-xl p-6"
            style={{ border: "1px solid var(--story-border)", background: "var(--story-surface)" }}
          >
            <h4 className="font-semibold mb-2" style={{ color: "var(--story-accent)" }}>{item.title}</h4>
            <p className="text-sm leading-relaxed" style={{ color: "var(--story-muted)" }}>{item.detail}</p>
          </motion.div>
        ))}
      </div>
    </StorySection>
  );
}
