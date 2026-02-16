import { Users } from "lucide-react";
import { motion } from "framer-motion";
import { fade } from "./StorySection";
import StorySection from "./StorySection";
import type { CaseStudy } from "@/data/customers";

interface Props {
  studies: CaseStudy[];
}

export default function CaseStudiesSection({ studies }: Props) {
  return (
    <StorySection icon={Users} label="Similar Patterns" title="Patterns we've seen elsewhere">
      <div className="space-y-5">
        {studies.map((study, i) => (
          <motion.div
            key={i}
            {...fade}
            transition={{ ...fade.transition, delay: i * 0.12 }}
            className="rounded-xl p-6"
            style={{ border: "1px solid var(--story-border)", background: "var(--story-surface)" }}
          >
            <h4 className="font-semibold mb-3">{study.company}</h4>
            <div className="space-y-2 text-sm">
              <div>
                <span className="font-medium" style={{ color: "var(--story-accent)" }}>Similarity: </span>
                <span style={{ color: "var(--story-muted)" }}>{study.similarity}</span>
              </div>
              <div>
                <span className="font-medium" style={{ color: "var(--story-accent)" }}>Challenge: </span>
                <span style={{ color: "var(--story-muted)" }}>{study.challenge}</span>
              </div>
              <div>
                <span className="font-medium" style={{ color: "var(--story-accent)" }}>Outcome: </span>
                <span style={{ color: "var(--story-muted)" }}>{study.outcome}</span>
              </div>
              <p className="text-xs italic pt-1" style={{ color: "var(--story-subtle)" }}>{study.relevance}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </StorySection>
  );
}
