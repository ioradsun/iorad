import { Eye } from "lucide-react";
import StorySection from "./StorySection";
import { EditableText, EditableListItemWrapper } from "./EditableText";
import { useStoryEdit } from "./EditContext";
import { useSectionAnnotation } from "./sectionAnnotations";
import { useFadeIn } from "./useFadeIn";

interface Props {
  items: string[];
}

function FadeInItem({ children, delay }: { children: React.ReactNode; delay: number }) {
  const ref = useFadeIn();

  return (
    <div
      ref={ref}
      className="fade-in flex items-start gap-4 rounded-xl p-5"
      style={{ border: "1px solid var(--story-border)", background: "var(--story-surface)", transitionDelay: `${delay}s` }}
    >
      {children}
    </div>
  );
}

export default function ExecutionFrictionSection({ items }: Props) {
  const ctx = useStoryEdit();
  const data = ctx?.isEditing ? ctx.editedCustomer.executionFriction : items;
  const annotation = useSectionAnnotation("executionFriction");

  return (
    <StorySection
      icon={Eye}
      label="What We Typically See"
      labelField="overrides.friction.label"
      title="When companies are at this stage, here's what usually happens"
      titleField="overrides.friction.title"
      annotation={annotation?.element}
    >
      <div className="space-y-4 max-w-3xl">
        {data.map((item, i) => (
          <EditableListItemWrapper key={i} arrayPath="executionFriction" index={i}>
            <FadeInItem delay={i * 0.1}>
              <span
                className="mt-1 w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs font-mono font-semibold"
                style={{ background: "var(--story-accent-dim)", color: "var(--story-accent)", border: "1px solid var(--story-accent-border)" }}
              >
                {i + 1}
              </span>
              <EditableText value={item} field={`executionFriction.${i}`} as="p" className="text-sm leading-relaxed" style={{ color: "var(--story-muted)" }} />
            </FadeInItem>
          </EditableListItemWrapper>
        ))}
      </div>
    </StorySection>
  );
}
