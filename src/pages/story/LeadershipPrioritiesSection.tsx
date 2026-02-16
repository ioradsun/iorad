import { Compass } from "lucide-react";
import StorySection from "./StorySection";
import { EditableText, EditableListItemWrapper } from "./EditableText";
import { useStoryEdit } from "./EditContext";

interface Props {
  items: string[];
}

export default function LeadershipPrioritiesSection({ items }: Props) {
  const ctx = useStoryEdit();
  const data = ctx?.isEditing ? ctx.editedCustomer.leadershipPriorities : items;

  return (
    <StorySection icon={Compass} label="Leadership Focus" title="What this usually signals about priorities">
      <div className="max-w-3xl">
        <p className="text-sm mb-5 leading-relaxed" style={{ color: "var(--story-subtle)" }}>
          When companies hit this stage, leadership usually focuses on:
        </p>
        <ul className="space-y-3">
          {data.map((item, i) => (
            <EditableListItemWrapper key={i} arrayPath="leadershipPriorities" index={i}>
              <li className="flex items-start gap-3 text-sm leading-relaxed" style={{ color: "var(--story-muted)" }}>
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "var(--story-accent)" }} />
                <EditableText value={item} field={`leadershipPriorities.${i}`} as="span" />
              </li>
            </EditableListItemWrapper>
          ))}
        </ul>
      </div>
    </StorySection>
  );
}
