import { AlertTriangle } from "lucide-react";
import StorySection from "./StorySection";
import { EditableText, EditableListItemWrapper } from "./EditableText";
import { useStoryEdit } from "./EditContext";

interface Props {
  items: string[];
}

export default function RealCostSection({ items }: Props) {
  const ctx = useStoryEdit();
  const data = ctx?.isEditing ? ctx.editedCustomer.realCost : items;

  return (
    <StorySection
      icon={AlertTriangle}
      label="The Real Cost"
      labelField="overrides.realcost.label"
      title="What this friction is costing the organization"
      titleField="overrides.realcost.title"
    >
      <div className="max-w-3xl">
        <ul className="space-y-3">
          {data.map((item, i) => (
            <EditableListItemWrapper key={i} arrayPath="realCost" index={i}>
              <li className="flex items-start gap-3 text-sm leading-relaxed" style={{ color: "var(--story-muted)" }}>
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "var(--story-accent)" }} />
                <EditableText value={item} field={`realCost.${i}`} as="span" />
              </li>
            </EditableListItemWrapper>
          ))}
        </ul>
      </div>
    </StorySection>
  );
}
