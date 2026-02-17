import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, XCircle, Search, ExternalLink, Plus } from "lucide-react";
import { toast } from "sonner";

interface LibraryPickerProps {
  detectedTool: string | null;
  currentLibraryUrl: string | null;
  snapshotId: string;
  onLibrarySelected?: (url: string, label: string) => void;
}

export default function LibraryPicker({
  detectedTool,
  currentLibraryUrl,
  snapshotId,
  onLibrarySelected,
}: LibraryPickerProps) {
  const [search, setSearch] = useState("");
  const [showPicker, setShowPicker] = useState(false);
  const [saving, setSaving] = useState(false);

  const { data: libraries = [] } = useQuery({
    queryKey: ["iorad-libraries"],
    queryFn: async () => {
      const { data } = await supabase
        .from("iorad_libraries")
        .select("id, label, help_center_url")
        .order("label");
      return data || [];
    },
  });

  const currentMatch = libraries.find((l) => l.help_center_url === currentLibraryUrl);
  const filtered = libraries.filter((l) =>
    l.label.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = async (library: { label: string; help_center_url: string }) => {
    setSaving(true);
    try {
      // Read current snapshot, update reinforcement_preview
      const { data: snap } = await supabase
        .from("snapshots")
        .select("snapshot_json")
        .eq("id", snapshotId)
        .single();

      if (!snap) throw new Error("Snapshot not found");

      const json = (snap.snapshot_json as Record<string, any>) || {};
      json.reinforcement_preview = {
        ...json.reinforcement_preview,
        library_url: library.help_center_url,
        detected_tool: detectedTool || json.reinforcement_preview?.detected_tool || "",
        description: json.reinforcement_preview?.description || "",
      };

      const { error } = await supabase
        .from("snapshots")
        .update({ snapshot_json: json as any })
        .eq("id", snapshotId);

      if (error) throw error;

      toast.success(`Library set to "${library.label}"`);
      onLibrarySelected?.(library.help_center_url, library.label);
      setShowPicker(false);
    } catch (err: any) {
      toast.error("Failed to update: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-2 pt-2" style={{ borderTop: "1px solid var(--story-border)" }}>
      <p className="font-mono uppercase text-[10px] tracking-wider" style={{ color: "var(--story-subtle)" }}>
        Library Match
      </p>

      {/* Auto-detection result */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          {detectedTool ? (
            <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
          ) : (
            <XCircle className="w-3 h-3 text-red-400 shrink-0" />
          )}
          <span style={{ color: "var(--story-muted)" }}>
            <strong>Detected tool:</strong> {detectedTool || "None detected"}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {currentLibraryUrl ? (
            <>
              <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
              <span style={{ color: "var(--story-muted)" }}>
                <strong>Matched library:</strong> {currentMatch?.label || "Custom URL"}
              </span>
              <a
                href={currentLibraryUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-1"
                style={{ color: "var(--story-accent)" }}
              >
                <ExternalLink className="w-3 h-3" />
              </a>
            </>
          ) : (
            <>
              <XCircle className="w-3 h-3 text-red-400 shrink-0" />
              <span style={{ color: "var(--story-muted)" }}>
                <strong>No library matched.</strong> The AI couldn't match a detected tool to an available iorad library.
              </span>
            </>
          )}
        </div>
      </div>

      {/* Manual override */}
      {!showPicker ? (
        <button
          onClick={() => setShowPicker(true)}
          className="flex items-center gap-1.5 px-2 py-1 rounded text-[11px] font-mono transition-all hover:opacity-80"
          style={{
            background: "var(--story-accent-dim)",
            color: "var(--story-accent)",
            border: "1px solid var(--story-accent-border)",
          }}
        >
          <Plus className="w-3 h-3" />
          {currentLibraryUrl ? "Change library" : "Manually assign library"}
        </button>
      ) : (
        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3" style={{ color: "var(--story-subtle)" }} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search libraries..."
              className="w-full pl-7 pr-2 py-1.5 rounded text-xs font-mono"
              style={{
                background: "var(--story-bg)",
                border: "1px solid var(--story-border)",
                color: "var(--story-fg)",
              }}
              autoFocus
            />
          </div>
          <div
            className="max-h-32 overflow-y-auto rounded space-y-0.5"
            style={{ background: "var(--story-bg)" }}
          >
            {filtered.length === 0 ? (
              <p className="text-[11px] p-2" style={{ color: "var(--story-subtle)" }}>
                No libraries found. Add them in Settings → Libraries.
              </p>
            ) : (
              filtered.map((lib) => (
                <button
                  key={lib.id}
                  onClick={() => handleSelect(lib)}
                  disabled={saving}
                  className="w-full text-left px-2 py-1.5 text-[11px] rounded transition-colors flex items-center justify-between gap-2 hover:opacity-80"
                  style={{
                    background: lib.help_center_url === currentLibraryUrl ? "var(--story-accent-dim)" : "transparent",
                    color: "var(--story-fg)",
                  }}
                >
                  <span className="truncate">{lib.label}</span>
                  {lib.help_center_url === currentLibraryUrl && (
                    <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                  )}
                </button>
              ))
            )}
          </div>
          <button
            onClick={() => setShowPicker(false)}
            className="text-[11px] font-mono underline"
            style={{ color: "var(--story-subtle)" }}
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
