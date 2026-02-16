import { HelpCircle } from "lucide-react";
import { motion } from "framer-motion";
import { fade } from "./StorySection";
import StorySection from "./StorySection";

interface Props {
  items: string[];
  persona: string;
}

export default function LeadersAskedSection({ items, persona }: Props) {
  return (
    <StorySection icon={HelpCircle} label="The Questions That Come Up" title="What leaders in this role are usually asked">
      <div className="space-y-3 max-w-3xl">
        {items.map((item, i) => (
          <motion.p
            key={i}
            {...fade}
            transition={{ ...fade.transition, delay: i * 0.1 }}
            className="text-sm italic pl-4 leading-relaxed"
            style={{ color: "var(--story-muted)", borderLeft: "2px solid var(--story-accent-border)" }}
          >
            "{item}"
          </motion.p>
        ))}
      </div>
    </StorySection>
  );
}
