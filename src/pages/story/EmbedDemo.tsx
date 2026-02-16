import { motion } from "framer-motion";
import { fade } from "./StorySection";
import { EditableText } from "./EditableText";
import { useStoryEdit } from "./EditContext";

export default function EmbedDemo() {
  const ctx = useStoryEdit();

  const defaultLabel = "Try It Yourself";
  const defaultTitle = "This is what iorad feels like";
  const defaultDesc = "Instead of reading documentation or watching a video, your team follows the steps right inside the application. No context switching. No guessing.";

  const label = ctx?.editedCustomer?.overrides?.["embed.label"] || defaultLabel;
  const title = ctx?.editedCustomer?.overrides?.["embed.title"] || defaultTitle;
  const desc = ctx?.editedCustomer?.overrides?.["embed.desc"] || defaultDesc;

  return (
    <section className="max-w-5xl mx-auto px-6 py-16">
      <motion.div {...fade}>
        {ctx?.isEditing ? (
          <EditableText value={label} field="overrides.embed.label" as="p" className="text-xs font-mono uppercase tracking-[0.2em] mb-3" style={{ color: "var(--story-accent)" }} />
        ) : (
          <p className="text-xs font-mono uppercase tracking-[0.2em] mb-3" style={{ color: "var(--story-accent)" }}>{label}</p>
        )}
        {ctx?.isEditing ? (
          <EditableText value={title} field="overrides.embed.title" as="h2" className="text-2xl md:text-3xl font-bold tracking-tight mb-4" />
        ) : (
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-4">{title}</h2>
        )}
        {ctx?.isEditing ? (
          <EditableText value={desc} field="overrides.embed.desc" as="p" className="max-w-2xl mb-8 leading-relaxed" style={{ color: "var(--story-muted)" }} />
        ) : (
          <p className="max-w-2xl mb-8 leading-relaxed" style={{ color: "var(--story-muted)" }}>{desc}</p>
        )}
        <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--story-border)", background: "var(--story-surface)", aspectRatio: "16/9" }}>
          <iframe
            src="https://ior.ad/b973?iframeHash=trysteps-1"
            className="w-full h-full border-0"
            allow="clipboard-read; clipboard-write"
            title="iorad interactive walkthrough"
          />
        </div>
      </motion.div>
    </section>
  );
}
