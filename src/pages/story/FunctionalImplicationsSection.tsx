import { forwardRef } from "react";
import { Target } from "lucide-react";
import StorySection from "./StorySection";
import { EditableText } from "./EditableText";
import { useStoryEdit } from "./EditContext";
import { useSectionAnnotation } from "./sectionAnnotations";

interface Props {
  text: string;
  contactName?: string;
}

const FunctionalImplicationsSection = forwardRef<HTMLElement, Props>(function FunctionalImplicationsSection({ text, contactName }: Props, _ref) {
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
        <EditableText
          value={data}
          field="functionalImplications"
          as="p"
          className="text-sm leading-relaxed"
          style={{ color: "var(--story-muted)" }}
        />
      </div>
    </StorySection>
  );
});


export default FunctionalImplicationsSection;
