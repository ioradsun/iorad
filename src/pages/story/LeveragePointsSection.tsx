import { Wrench } from "lucide-react";
import StorySection from "./StorySection";
import { EditableText, EditableListItemWrapper } from "./EditableText";
import { useStoryEdit } from "./EditContext";

interface Props {
  items: string[];
}

export default function LeveragePointsSection({ items }: Props) {
  const ctx = useStoryEdit();
  const data = ctx?.isEditing ? ctx.editedCustomer.leveragePoints : items;

  return (
    <StorySection icon={Wrench} label="Leverage Points" title="Under-optimized leverage points">
      <div className="max-w-3xl">
        <ul className="space-y-3">
          {data.map((item, i) => (
            <EditableListItemWrapper key={i} arrayPath="leveragePoints" index={i}>
              <li className="flex items-start gap-3 text-sm leading-relaxed" style={{ color: "var(--story-muted)" }}>
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "var(--story-accent)" }} />
                <EditableText value={item} field={`leveragePoints.${i}`} as="span" />
              </li>
            </EditableListItemWrapper>
          ))}
        </ul>
      </div>
    </StorySection>
  );
}
