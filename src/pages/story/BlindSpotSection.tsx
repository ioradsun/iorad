import { Lightbulb } from "lucide-react";
import { EditableText } from "./EditableText";
import { useStoryEdit } from "./EditContext";
import { useSectionAnnotation } from "./sectionAnnotations";
import { useFadeIn } from "./useFadeIn";

interface Props {
  text: string;
}

export default function BlindSpotSection({ text }: Props) {
  const ctx = useStoryEdit();
  const val = ctx?.isEditing ? ctx.editedCustomer.blindSpot : text;
  const defaultLabel = "A Common Blind Spot";
  const label = ctx?.editedCustomer.overrides?.["blindspot.label"] || defaultLabel;
  const annotation = useSectionAnnotation("blindSpot");
  const ref = useFadeIn();

  return (
    <section className="max-w-5xl mx-auto px-6 py-16">
      {annotation && <div className="mb-1">{annotation.element}</div>}
      <div
        ref={ref}
        className="fade-in rounded-2xl p-8 md:p-10"
        style={{ border: "1px solid var(--story-accent-border)", background: "var(--story-accent-dim)" }}
      >
        <div className="flex items-center gap-2 mb-4">
          <Lightbulb className="w-4 h-4" style={{ color: "var(--story-accent)" }} />
          {ctx?.isEditing ? (
            <EditableText value={label} field="overrides.blindspot.label" as="p" className="text-xs font-mono uppercase tracking-[0.2em]" style={{ color: "var(--story-accent)" }} />
          ) : (
            <p className="text-xs font-mono uppercase tracking-[0.2em]" style={{ color: "var(--story-accent)" }}>{label}</p>
          )}
        </div>
        <EditableText value={val} field="blindSpot" as="p" className="text-base md:text-lg leading-relaxed max-w-3xl" style={{ color: "var(--story-muted)" }} />
      </div>
    </section>
  );
}
