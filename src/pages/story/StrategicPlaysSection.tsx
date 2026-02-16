import { Layout } from "lucide-react";
import { motion } from "framer-motion";
import { fade } from "./StorySection";
import StorySection from "./StorySection";
import type { StrategicPlay } from "@/data/customers";
import { EditableText, EditableListItemWrapper } from "./EditableText";
import { useStoryEdit } from "./EditContext";

interface Props {
  plays: StrategicPlay[];
}

export default function StrategicPlaysSection({ plays }: Props) {
  const ctx = useStoryEdit();
  const data = ctx?.isEditing ? ctx.editedCustomer.plays : plays;

  return (
    <StorySection
      icon={Layout}
      label="Strategic Plays"
      labelField="overrides.plays.label"
      title="Four plays to consider"
      titleField="overrides.plays.title"
    >
      <div className="space-y-6">
        {data.map((play, i) => (
          <EditableListItemWrapper key={i} arrayPath="plays" index={i}>
            <motion.div
              {...fade}
              transition={{ ...fade.transition, delay: i * 0.15 }}
              className="rounded-xl p-6"
              style={{ border: "1px solid var(--story-border)", background: "var(--story-surface)" }}
            >
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
            </motion.div>
          </EditableListItemWrapper>
        ))}
      </div>
    </StorySection>
  );
}
