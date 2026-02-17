import { Target } from "lucide-react";
import StorySection from "./StorySection";
import { EditableText } from "./EditableText";
import { useStoryEdit } from "./EditContext";
import { useSectionAnnotation } from "./sectionAnnotations";

interface Props {
  text: string;
  contactName?: string;
}

export default function FunctionalImplicationsSection({ text, contactName }: Props) {
  const ctx = useStoryEdit();
  const data = ctx?.isEditing ? ctx.editedCustomer.functionalImplications : text;
  const annotation = useSectionAnnotation("functionalImplications");

  const title = contactName
    ? `What this likely means for ${contactName}'s function`
    : "What this likely means for your function";

  return (
    <StorySection
      icon={Target}
      label="Functional Impact"
      labelField="overrides.implications.label"
      title={title}
      titleField="overrides.implications.title"
      annotation={annotation?.element}
    >
      <div className="max-w-3xl space-y-4">
        {data
          .split(/\n|(?=\d+[\.\)\]\s]\s)/)
          .map(s => s.trim())
          .filter(Boolean)
          .map((paragraph, i) => (
          <EditableText
            key={i}
            value={paragraph}
            field={`functionalImplications`}
            as="p"
            className="text-sm leading-relaxed"
            style={{ color: "var(--story-muted)" }}
          />
        ))}
      </div>
    </StorySection>
  );
}
