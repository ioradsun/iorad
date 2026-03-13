import { EditableText } from "./EditableText";
import { useStoryEdit } from "./EditContext";
import { useFadeIn } from "./useFadeIn";

interface StorySectionProps {
  icon: React.ElementType;
  label: string;
  labelField?: string;
  title: string;
  titleField?: string;
  children: React.ReactNode;
  /** Optional annotation rendered above the section title */
  annotation?: React.ReactNode;
}

export default function StorySection({ icon: Icon, label, labelField, title, titleField, children, annotation }: StorySectionProps) {
  const ctx = useStoryEdit();
  const isEditing = ctx?.isEditing;
  const ref = useFadeIn();

  return (
    <section className="max-w-5xl mx-auto px-6 py-16">
      <div ref={ref} className="fade-in">
        {annotation && <div className="mb-1">{annotation}</div>}
        <div className="flex items-center gap-2 mb-3">
          <Icon className="w-4 h-4" style={{ color: "var(--story-accent)" }} />
          {isEditing && labelField ? (
            <EditableText value={label} field={labelField} as="p" className="text-xs font-mono uppercase tracking-[0.2em]" style={{ color: "var(--story-accent)" }} />
          ) : (
            <p className="text-xs font-mono uppercase tracking-[0.2em]" style={{ color: "var(--story-accent)" }}>{label}</p>
          )}
        </div>
        {isEditing && titleField ? (
          <EditableText value={title} field={titleField} as="h2" className="text-2xl md:text-3xl font-bold tracking-tight mb-8" />
        ) : (
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-8">{title}</h2>
        )}
        {children}
      </div>
    </section>
  );
}
