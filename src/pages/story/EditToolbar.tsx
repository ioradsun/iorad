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
    } finally {
      ctx.setIsSaving(false);
    }
  };

  if (!ctx.isEditing) {
    return (
      <button
        onClick={ctx.startEditing}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-5 py-3 rounded-full font-semibold text-sm shadow-xl transition-all hover:scale-105 active:scale-95"
        style={{ background: "var(--story-cta-bg)", color: "var(--story-cta-fg)" }}
      >
        <Pencil className="w-4 h-4" />
        Edit Story
      </button>
    );
  }

  return (
    <>
      {/* Top banner */}
      <div
        className="fixed top-0 left-0 right-0 z-[60] flex items-center justify-between px-6 py-2.5"
        style={{ background: "var(--story-accent)", color: "var(--story-bg)" }}
      >
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Pencil className="w-3.5 h-3.5" />
          Editing Mode — Click any text to edit, hover items to delete
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={ctx.cancelEditing}
            disabled={ctx.isSaving}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium transition-colors hover:opacity-80"
            style={{ background: "rgba(0,0,0,0.15)", color: "inherit" }}
          >
            <X className="w-3.5 h-3.5" />
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={ctx.isSaving}
            className="flex items-center gap-1.5 px-5 py-1.5 rounded-full text-sm font-bold transition-all hover:scale-105 active:scale-95"
            style={{ background: "var(--story-bg)", color: "var(--story-fg)" }}
          >
            {ctx.isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save Changes
          </button>
        </div>
      </div>

      {/* Spacer so content isn't hidden under banner */}
      <div className="h-11" />
    </>
  );
}
