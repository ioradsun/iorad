import { TrendingUp } from "lucide-react";
import { motion } from "framer-motion";
import { fade } from "./StorySection";
import StorySection from "./StorySection";
import type { InitiativeItem } from "@/data/customers";
import { EditableText, EditableListItemWrapper } from "./EditableText";
import { useStoryEdit } from "./EditContext";

interface Props {
  companyName: string;
  items: InitiativeItem[];
}

export default function WhatsHappeningSection({ companyName, items }: Props) {
  const ctx = useStoryEdit();
  const data = ctx?.isEditing ? ctx.editedCustomer.whatsHappening : items;

  return (
    <StorySection
      icon={TrendingUp}
      label="Current Initiatives"
      labelField="overrides.whatsHappening.label"
      title={`What's happening at ${companyName}`}
      titleField="overrides.whatsHappening.title"
    >
      <div className="space-y-5 max-w-3xl">
        {data.map((item, i) => (
          <EditableListItemWrapper key={i} arrayPath="whatsHappening" index={i}>
            <motion.div
              {...fade}
              transition={{ ...fade.transition, delay: i * 0.12 }}
              className="rounded-xl p-6"
              style={{ border: "1px solid var(--story-border)", background: "var(--story-surface)" }}
            >
              <EditableText value={item.title} field={`whatsHappening.${i}.title`} as="h4" className="font-semibold mb-2" />
              <EditableText value={item.detail} field={`whatsHappening.${i}.detail`} as="p" className="text-sm leading-relaxed" style={{ color: "var(--story-muted)" }} />
            </motion.div>
          </EditableListItemWrapper>
        ))}
      </div>
    </StorySection>
  );
}
