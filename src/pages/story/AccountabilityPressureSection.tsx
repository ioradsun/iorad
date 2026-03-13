import { HelpCircle } from "lucide-react";
import StorySection from "./StorySection";
import { EditableText, EditableListItemWrapper } from "./EditableText";
import { useStoryEdit } from "./EditContext";
import { useSectionAnnotation } from "./sectionAnnotations";
import { useFadeIn } from "./useFadeIn";

interface Props {
  items: string[];
}

function FadeInQuote({ children, delay }: { children: React.ReactNode; delay: number }) {
  const ref = useFadeIn<HTMLParagraphElement>();

  return (
    <p
      ref={ref}
      className="fade-in text-sm italic pl-4 leading-relaxed"
      style={{ color: "var(--story-muted)", borderLeft: "2px solid var(--story-accent-border)", transitionDelay: `${delay}s` }}
    >
      {children}
    </p>
  );
}

export default function AccountabilityPressureSection({ items }: Props) {
  const ctx = useStoryEdit();
  const data = ctx?.isEditing ? ctx.editedCustomer.accountabilityPressure : items;
  const annotation = useSectionAnnotation("accountabilityPressure");

  return (
    <StorySection
      icon={HelpCircle}
      label="The Accountability Pressure"
      labelField="overrides.accountability.label"
      title="The questions that are already being asked"
      titleField="overrides.accountability.title"
      annotation={annotation?.element}
    >
      <div className="space-y-3 max-w-3xl">
        {data.map((item, i) => (
          <EditableListItemWrapper key={i} arrayPath="accountabilityPressure" index={i}>
            <FadeInQuote delay={i * 0.1}>
              "<EditableText value={item} field={`accountabilityPressure.${i}`} as="span" />"
            </FadeInQuote>
          </EditableListItemWrapper>
        ))}
      </div>
    </StorySection>
  );
}
