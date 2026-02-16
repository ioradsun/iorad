import { HelpCircle } from "lucide-react";
import { motion } from "framer-motion";
import { fade } from "./StorySection";
import StorySection from "./StorySection";
import { EditableText, EditableListItemWrapper } from "./EditableText";
import { useStoryEdit } from "./EditContext";

interface Props {
  items: string[];
  persona: string;
}

export default function LeadersAskedSection({ items, persona }: Props) {
  const ctx = useStoryEdit();
  const data = ctx?.isEditing ? ctx.editedCustomer.leadersAsked : items;

  return (
    <StorySection
      icon={HelpCircle}
      label="The Questions That Come Up"
      labelField="overrides.leaders.label"
      title="What leaders in this role are usually asked"
      titleField="overrides.leaders.title"
    >
      <div className="space-y-3 max-w-3xl">
        {data.map((item, i) => (
          <EditableListItemWrapper key={i} arrayPath="leadersAsked" index={i}>
            <motion.p
              {...fade}
              transition={{ ...fade.transition, delay: i * 0.1 }}
              className="text-sm italic pl-4 leading-relaxed"
              style={{ color: "var(--story-muted)", borderLeft: "2px solid var(--story-accent-border)" }}
            >
              "<EditableText value={item} field={`leadersAsked.${i}`} as="span" />"
            </motion.p>
          </EditableListItemWrapper>
        ))}
      </div>
    </StorySection>
  );
}
