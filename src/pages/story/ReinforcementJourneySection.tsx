import { Layers } from "lucide-react";
import StorySection from "./StorySection";
import { EditableText } from "./EditableText";
import { useStoryEdit } from "./EditContext";

interface Props {
  text: string;
}

export default function ReinforcementJourneySection({ text }: Props) {
  const ctx = useStoryEdit();
  const data = ctx?.isEditing ? ctx.editedCustomer.reinforcementJourney : text;

  return (
    <StorySection
      icon={Layers}
      label="Reinforcement in Practice"
      labelField="overrides.reinforcement.label"
      title="What reinforcement could feel like inside the learner journey"
      titleField="overrides.reinforcement.title"
    >
      <div className="max-w-3xl space-y-4">
        {data.split("\n").filter(Boolean).map((paragraph, i) => (
          <EditableText
            key={i}
            value={paragraph}
            field="reinforcementJourney"
            as="p"
            className="text-sm leading-relaxed"
            style={{ color: "var(--story-muted)" }}
          />
        ))}
      </div>
    </StorySection>
  );
}
