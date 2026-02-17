import { motion } from "framer-motion";
import { EditableText } from "./EditableText";
import { useStoryEdit } from "./EditContext";

const fade = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-60px" },
  transition: { duration: 0.6 },
};

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

export { fade };

export default function StorySection({ icon: Icon, label, labelField, title, titleField, children, annotation }: StorySectionProps) {
  const ctx = useStoryEdit();
  const isEditing = ctx?.isEditing;

  return (
    <section className="max-w-5xl mx-auto px-6 py-16">
      <motion.div {...fade}>
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
      </motion.div>
    </section>
  );
}
