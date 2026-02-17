import { motion } from "framer-motion";
import { fade } from "./StorySection";
import { EditableText } from "./EditableText";
import { useStoryEdit } from "./EditContext";
import { useStoryDebug } from "./StoryDebugContext";
import { useSectionAnnotation } from "./sectionAnnotations";

export default function EmbedDemo({ ioradUrl }: { ioradUrl?: string | null }) {
  const ctx = useStoryEdit();
  const debug = useStoryDebug();
  const annotation = useSectionAnnotation("embedDemo");

  const HARDCODED_TUTORIAL = "https://ior.ad/b973?iframeHash=trysteps-1";
  const propUrl = ioradUrl || null;
  const savedUrl = propUrl || debug?.snapshotJson?.embed_url_override;
  const iframeSrc = savedUrl
    ? `${savedUrl}${savedUrl.includes('?') ? '&' : '?'}oembed=1`
    : HARDCODED_TUTORIAL;

  const defaultLabel = "Try It Yourself";
  const defaultTitle = "This is what iorad feels like";
  const defaultDesc = "Instead of reading documentation or watching a video, your team follows the steps right inside the application. No context switching. No guessing.";

  const label = ctx?.editedCustomer?.overrides?.["embed.label"] || defaultLabel;
  const title = ctx?.editedCustomer?.overrides?.["embed.title"] || defaultTitle;
  const desc = ctx?.editedCustomer?.overrides?.["embed.desc"] || defaultDesc;

  return (
    <section className="max-w-5xl mx-auto px-6 py-16">
      <motion.div {...fade}>
        {annotation?.element}
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
        <div className="rounded-2xl overflow-hidden border border-border" style={{ background: "var(--story-surface)", minWidth: "100%" }}>
          <iframe
            src={iframeSrc}
            width="100%"
            height="500px"
            style={{ width: "100%", height: "500px" }}
            referrerPolicy="strict-origin-when-cross-origin"
            frameBorder="0"
            allowFullScreen
            allow="camera; microphone; clipboard-write"
            sandbox="allow-scripts allow-forms allow-same-origin allow-presentation allow-downloads allow-modals allow-popups allow-popups-to-escape-sandbox allow-top-navigation allow-top-navigation-by-user-activation"
            title="iorad interactive walkthrough"
          />
        </div>
      </motion.div>
    </section>
  );
}
