import { Pencil, Save, X, Loader2 } from "lucide-react";
import { useStoryEdit } from "./EditContext";

interface Props {
  onSave: () => Promise<void>;
}

export default function EditToolbar({ onSave }: Props) {
  const ctx = useStoryEdit();
  if (!ctx) return null;

  const handleSave = async () => {
    ctx.setIsSaving(true);
    try {
      await onSave();
      // Don't call cancelEditing here — parent will handle state refresh
    } finally {
      ctx.setIsSaving(false);
    }
  };

  if (!ctx.isEditing) {
    return (
      <button
        onClick={ctx.startEditing}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-2.5 rounded-full font-medium text-sm shadow-lg transition-all hover:scale-105"
        style={{ background: "var(--story-cta-bg)", color: "var(--story-cta-fg)" }}
      >
        <Pencil className="w-4 h-4" />
        Edit Story
      </button>
    );
  }

  return (
    <div
      className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-2 py-2 rounded-full shadow-lg"
      style={{ background: "var(--story-surface)", border: "1px solid var(--story-border)", backdropFilter: "blur(12px)" }}
    >
      <button
        onClick={ctx.cancelEditing}
        className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-colors hover:opacity-80"
        style={{ color: "var(--story-muted)" }}
        disabled={ctx.isSaving}
      >
        <X className="w-4 h-4" />
        Cancel
      </button>
      <button
        onClick={handleSave}
        disabled={ctx.isSaving}
        className="flex items-center gap-1.5 px-5 py-2 rounded-full text-sm font-semibold transition-all hover:scale-105"
        style={{ background: "var(--story-cta-bg)", color: "var(--story-cta-fg)" }}
      >
        {ctx.isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        Save
      </button>
    </div>
  );
}
