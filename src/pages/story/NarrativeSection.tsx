import { FileText } from "lucide-react";
import { motion } from "framer-motion";
import { fade } from "./StorySection";
import StorySection from "./StorySection";

interface Props {
  paragraphs: string[];
}

export default function NarrativeSection({ paragraphs }: Props) {
  return (
    <StorySection icon={FileText} label="Executive Narrative" title="The board-level view">
      <div className="space-y-5 max-w-3xl">
        {paragraphs.map((para, i) => (
          <motion.p
            key={i}
            {...fade}
            transition={{ ...fade.transition, delay: i * 0.1 }}
            className="text-white/55 leading-relaxed"
          >
            {para}
          </motion.p>
        ))}
      </div>
    </StorySection>
  );
}
