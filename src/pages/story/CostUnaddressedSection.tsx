import { Clock } from "lucide-react";
import StorySection from "./StorySection";
import { EditableText, EditableListItemWrapper } from "./EditableText";
import { useStoryEdit } from "./EditContext";

interface Props {
  items: string[];
}

export default function CostUnaddressedSection({ items }: Props) {
  const ctx = useStoryEdit();
  const data = ctx?.isEditing ? ctx.editedCustomer.costUnaddressed : items;

  return (
    <StorySection icon={Clock} label="What's at Stake" title="The cost of leaving this unaddressed">
      <div className="max-w-3xl">
        <p className="text-sm mb-5 leading-relaxed" style={{ color: "var(--story-subtle)" }}>
          Small inconsistencies compound. Over time this shows up as:
        </p>
        <ul className="space-y-3">
          {data.map((item, i) => (
            <EditableListItemWrapper key={i} arrayPath="costUnaddressed" index={i}>
              <li className="flex items-start gap-3 text-sm leading-relaxed" style={{ color: "var(--story-muted)" }}>
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "var(--story-accent)" }} />
                <EditableText value={item} field={`costUnaddressed.${i}`} as="span" />
              </li>
            </EditableListItemWrapper>
          ))}
        </ul>
      </div>
    </StorySection>
  );
}
