import { forwardRef } from "react";
import { Users } from "lucide-react";
import StorySection from "./StorySection";
import type { CaseStudy } from "@/data/customers";
import { EditableText, EditableListItemWrapper } from "./EditableText";
import { useStoryEdit } from "./EditContext";
import { useSectionAnnotation } from "./sectionAnnotations";
import { useFadeIn } from "./useFadeIn";

interface Props {
  studies: CaseStudy[];
}

const FadeInItem = forwardRef<HTMLDivElement, { children: React.ReactNode; delay: number }>(
  function FadeInItem({ children, delay }, _ref) {
    const ref = useFadeIn();

    return (
      <div
        ref={ref}
        className="fade-in rounded-xl p-6"
        style={{ border: "1px solid var(--story-border)", background: "var(--story-surface)", transitionDelay: `${delay}s` }}
      >
        {children}
      </div>
    );
  }
);

const CaseStudiesSection = forwardRef<HTMLElement, Props>(function CaseStudiesSection({ studies }: Props, _ref) {
  const ctx = useStoryEdit();
  const data = ctx?.isEditing ? ctx.editedCustomer.caseStudies : studies;
  const annotation = useSectionAnnotation("caseStudies");

  return (
    <StorySection
      icon={Users}
      label="Similar Patterns"
      labelField="overrides.cases.label"
      title="Patterns we've seen elsewhere"
      titleField="overrides.cases.title"
      annotation={annotation?.element}
    >
      <div className="space-y-5">
        {data.map((study, i) => (
          <EditableListItemWrapper key={i} arrayPath="caseStudies" index={i}>
            <FadeInItem delay={i * 0.12}>
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
            </FadeInItem>
          </EditableListItemWrapper>
        ))}
      </div>
    </StorySection>
  );
});


export default CaseStudiesSection;
