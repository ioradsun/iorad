import { HelpCircle } from "lucide-react";
import { motion } from "framer-motion";
import { fade } from "./StorySection";
import StorySection from "./StorySection";
import { EditableText, EditableListItemWrapper } from "./EditableText";
import { useStoryEdit } from "./EditContext";

interface Props {
  items: string[];
}

export default function AccountabilityPressureSection({ items }: Props) {
  const ctx = useStoryEdit();
  const data = ctx?.isEditing ? ctx.editedCustomer.accountabilityPressure : items;

  return (
    <StorySection
      icon={HelpCircle}
      label="The Accountability Pressure"
      labelField="overrides.accountability.label"
      title="The questions that are already being asked"
      titleField="overrides.accountability.title"
    >
      <div className="space-y-3 max-w-3xl">
        {data.map((item, i) => (
          <EditableListItemWrapper key={i} arrayPath="accountabilityPressure" index={i}>
            <motion.p
              {...fade}
              transition={{ ...fade.transition, delay: i * 0.1 }}
              className="text-sm italic pl-4 leading-relaxed"
              style={{ color: "var(--story-muted)", borderLeft: "2px solid var(--story-accent-border)" }}
            >
              "<EditableText value={item} field={`accountabilityPressure.${i}`} as="span" />"
            </motion.p>
          </EditableListItemWrapper>
        ))}
      </div>
    </StorySection>
  );
}
