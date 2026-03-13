import { forwardRef } from "react";
import { Layers } from "lucide-react";
import StorySection from "./StorySection";
import { EditableText } from "./EditableText";
import { useStoryEdit } from "./EditContext";
import { useSectionAnnotation } from "./sectionAnnotations";

interface Props {
  text: string;
}

const ReinforcementJourneySection = forwardRef<HTMLElement, Props>(function ReinforcementJourneySection({ text }: Props, _ref) {
  const ctx = useStoryEdit();
  const data = ctx?.isEditing ? ctx.editedCustomer.reinforcementJourney : text;
  const annotation = useSectionAnnotation("reinforcement");

  return (
    <StorySection
      icon={Layers}
      label="Reinforcement in Practice"
      labelField="overrides.reinforcement.label"
      title="What reinforcement could feel like inside the learner journey"
      titleField="overrides.reinforcement.title"
      annotation={annotation?.element}
    >
      <div className="max-w-3xl space-y-4">
        <EditableText
          value={data}
          field="reinforcementJourney"
          as="p"
          className="text-sm leading-relaxed"
          style={{ color: "var(--story-muted)" }}
        />
      </div>
    </StorySection>
  );
});


export default ReinforcementJourneySection;
