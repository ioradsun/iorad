import { Users } from "lucide-react";
import { motion } from "framer-motion";
import { fade } from "./StorySection";
import StorySection from "./StorySection";
import type { CaseStudy } from "@/data/customers";
import { EditableText, EditableListItemWrapper } from "./EditableText";
import { useStoryEdit } from "./EditContext";

interface Props {
  studies: CaseStudy[];
}

export default function CaseStudiesSection({ studies }: Props) {
  const ctx = useStoryEdit();
  const data = ctx?.isEditing ? ctx.editedCustomer.caseStudies : studies;

  return (
    <StorySection icon={Users} label="Similar Patterns" title="Patterns we've seen elsewhere">
      <div className="space-y-5">
        {data.map((study, i) => (
          <EditableListItemWrapper key={i} arrayPath="caseStudies" index={i}>
            <motion.div
              {...fade}
              transition={{ ...fade.transition, delay: i * 0.12 }}
              className="rounded-xl p-6"
              style={{ border: "1px solid var(--story-border)", background: "var(--story-surface)" }}
            >
              <EditableText value={study.company} field={`caseStudies.${i}.company`} as="h4" className="font-semibold mb-3" />
              <div className="space-y-2 text-sm">
                <div>
                  <span className="font-medium" style={{ color: "var(--story-accent)" }}>Similarity: </span>
                  <EditableText value={study.similarity} field={`caseStudies.${i}.similarity`} as="span" style={{ color: "var(--story-muted)" }} />
                </div>
                <div>
                  <span className="font-medium" style={{ color: "var(--story-accent)" }}>Challenge: </span>
                  <EditableText value={study.challenge} field={`caseStudies.${i}.challenge`} as="span" style={{ color: "var(--story-muted)" }} />
                </div>
                <div>
                  <span className="font-medium" style={{ color: "var(--story-accent)" }}>Outcome: </span>
                  <EditableText value={study.outcome} field={`caseStudies.${i}.outcome`} as="span" style={{ color: "var(--story-muted)" }} />
                </div>
                <EditableText value={study.relevance} field={`caseStudies.${i}.relevance`} as="p" className="text-xs italic pt-1" style={{ color: "var(--story-subtle)" }} />
              </div>
            </motion.div>
          </EditableListItemWrapper>
        ))}
      </div>
    </StorySection>
  );
}
