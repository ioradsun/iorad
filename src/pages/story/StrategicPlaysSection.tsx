import { Layout } from "lucide-react";
import StorySection from "./StorySection";
import type { StrategicPlay } from "@/data/customers";
import { EditableText, EditableListItemWrapper } from "./EditableText";
import { useStoryEdit } from "./EditContext";
import { useSectionAnnotation } from "./sectionAnnotations";
import { useFadeIn } from "./useFadeIn";

interface Props {
  plays: StrategicPlay[];
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

export default function StrategicPlaysSection({ plays }: Props) {
  const ctx = useStoryEdit();
  const data = ctx?.isEditing ? ctx.editedCustomer.plays : plays;
  const annotation = useSectionAnnotation("strategicPlays");

  return (
    <StorySection
      icon={Layout}
      label="Strategic Plays"
      labelField="overrides.plays.label"
      title="Four plays to consider"
      titleField="overrides.plays.title"
      annotation={annotation?.element}
    >
      <div className="space-y-6">
        {data.map((play, i) => (
          <EditableListItemWrapper key={i} arrayPath="plays" index={i}>
            <FadeInItem delay={i * 0.15}>
              <EditableText value={play.name} field={`plays.${i}.name`} as="h4" className="font-semibold text-lg mb-4" />
              <div className="grid md:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs font-mono uppercase tracking-wider mb-1" style={{ color: "var(--story-accent)" }}>Objective</p>
                  <EditableText value={play.objective} field={`plays.${i}.objective`} as="p" className="leading-relaxed" style={{ color: "var(--story-muted)" }} />
                </div>
                <div>
                  <p className="text-xs font-mono uppercase tracking-wider mb-1" style={{ color: "var(--story-accent)" }}>Why Now</p>
                  <EditableText value={play.whyNow} field={`plays.${i}.whyNow`} as="p" className="leading-relaxed" style={{ color: "var(--story-muted)" }} />
                </div>
                <div>
                  <p className="text-xs font-mono uppercase tracking-wider mb-1" style={{ color: "var(--story-accent)" }}>What It Looks Like</p>
                  <EditableText value={play.whatItLooksLike} field={`plays.${i}.whatItLooksLike`} as="p" className="leading-relaxed" style={{ color: "var(--story-muted)" }} />
                </div>
                <div>
                  <p className="text-xs font-mono uppercase tracking-wider mb-1" style={{ color: "var(--story-accent)" }}>Expected Impact</p>
                  <EditableText value={play.expectedImpact} field={`plays.${i}.expectedImpact`} as="p" className="leading-relaxed" style={{ color: "var(--story-muted)" }} />
                </div>
              </div>
            </FadeInItem>
          </EditableListItemWrapper>
        ))}
      </div>
    </StorySection>
  );
}
