import { Clock } from "lucide-react";
import { motion } from "framer-motion";
import { fade } from "./StorySection";
import { EditableText } from "./EditableText";
import { useStoryEdit } from "./EditContext";
import { useSectionAnnotation } from "./sectionAnnotations";

interface Props {
  text: string;
}

export default function WhyNowSection({ text }: Props) {
  const ctx = useStoryEdit();
  const val = ctx?.isEditing ? ctx.editedCustomer.whyNow : text;
  const defaultLabel = "Why This Matters Now";
  const label = ctx?.editedCustomer.overrides?.["whynow.label"] || defaultLabel;
  const annotation = useSectionAnnotation("whyNow");

  return (
    <section className="max-w-5xl mx-auto px-6 py-12">
      {annotation && <div className="mb-1">{annotation.element}</div>}
      <motion.div
        {...fade}
        className="rounded-xl p-6"
        style={{ border: "1px solid var(--story-border)", background: "var(--story-surface)" }}
      >
        <div className="flex items-center gap-2 mb-3">
          <Clock className="w-4 h-4" style={{ color: "var(--story-accent)" }} />
          {ctx?.isEditing ? (
            <EditableText value={label} field="overrides.whynow.label" as="p" className="text-xs font-mono uppercase tracking-[0.2em]" style={{ color: "var(--story-accent)" }} />
          ) : (
            <p className="text-xs font-mono uppercase tracking-[0.2em]" style={{ color: "var(--story-accent)" }}>{label}</p>
          )}
        </div>
        <EditableText value={val} field="whyNow" as="p" className="text-sm leading-relaxed max-w-3xl" style={{ color: "var(--story-muted)" }} />
      </motion.div>
    </section>
  );
}
