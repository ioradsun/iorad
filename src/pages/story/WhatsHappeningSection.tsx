import { TrendingUp } from "lucide-react";
import StorySection from "./StorySection";
import type { InitiativeItem } from "@/data/customers";
import { EditableText, EditableListItemWrapper } from "./EditableText";
import { useStoryEdit } from "./EditContext";
import { useSectionAnnotation } from "./sectionAnnotations";
import { useFadeIn } from "./useFadeIn";

interface Props {
  companyName: string;
  items: InitiativeItem[];
}

function FadeInItem({ children, delay }: { children: React.ReactNode; delay: number }) {
  const ref = useFadeIn();

  return (
    <div
      ref={ref}
      className="fade-in rounded-xl p-6"
      style={{ border: "1px solid var(--story-border)", background: "var(--story-surface)", transitionDelay: `${delay}s` }}
    >
      {children}
    </div>
  );
}

export default function WhatsHappeningSection({ companyName, items }: Props) {
  const ctx = useStoryEdit();
  const data = ctx?.isEditing ? ctx.editedCustomer.whatsHappening : items;
  const annotation = useSectionAnnotation("whatsHappening");

  return (
    <StorySection
      icon={TrendingUp}
      label="Current Initiatives"
      labelField="overrides.whatsHappening.label"
      title={`What's happening at ${companyName}`}
      titleField="overrides.whatsHappening.title"
      annotation={annotation?.element}
    >
      <div className="space-y-5 max-w-3xl">
        {data.map((item, i) => (
          <EditableListItemWrapper key={i} arrayPath="whatsHappening" index={i}>
            <FadeInItem delay={i * 0.12}>
              <EditableText value={item.title} field={`whatsHappening.${i}.title`} as="h4" className="font-semibold mb-2" />
              <EditableText value={item.detail} field={`whatsHappening.${i}.detail`} as="p" className="text-sm leading-relaxed" style={{ color: "var(--story-muted)" }} />
            </FadeInItem>
          </EditableListItemWrapper>
        ))}
      </div>
    </StorySection>
  );
}
