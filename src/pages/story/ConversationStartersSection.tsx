import { MessageCircle } from "lucide-react";
import { motion } from "framer-motion";
import { fade } from "./StorySection";
import StorySection from "./StorySection";

interface Props {
  starters: string[];
}

export default function ConversationStartersSection({ starters }: Props) {
  return (
    <StorySection icon={MessageCircle} label="Discussion Prompts" title="Suggested conversation starters">
      <div className="space-y-4 max-w-3xl">
        {starters.map((starter, i) => (
          <motion.div
            key={i}
            {...fade}
            transition={{ ...fade.transition, delay: i * 0.12 }}
            className="rounded-xl p-5"
            style={{ border: "1px solid var(--story-border)", background: "var(--story-surface)" }}
          >
            <p className="text-sm leading-relaxed italic" style={{ color: "var(--story-muted)" }}>
              "{starter}"
            </p>
          </motion.div>
        ))}
      </div>
    </StorySection>
  );
}
