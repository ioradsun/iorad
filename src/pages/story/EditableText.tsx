import { useRef, useEffect } from "react";
import { useStoryEdit } from "./EditContext";
import { X } from "lucide-react";

interface EditableTextProps {
  value: string;
  field: string;
  as?: "p" | "span" | "h4" | "h1" | "h2" | "li";
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

export function EditableText({ value, field, as: Tag = "span", className, style }: EditableTextProps) {
  const ctx = useStoryEdit();
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    if (ref.current && ref.current.textContent !== value) {
      ref.current.textContent = value;
    }
  }, [value]);

  if (!ctx?.isEditing) {
    return <Tag className={className} style={style}>{value}</Tag>;
  }

  return (
    <Tag
      ref={ref as any}
      contentEditable
      suppressContentEditableWarning
      className={`${className || ""} outline-none ring-1 ring-transparent focus:ring-[var(--story-accent-border)] rounded px-1 -mx-1`}
      style={{ ...style, minHeight: "1em" }}
      onBlur={(e) => {
        ctx.setField(field, e.currentTarget.textContent || "");
      }}
    >
      {value}
    </Tag>
  );
}

interface EditableListItemProps {
  arrayPath: string;
  index: number;
  children: React.ReactNode;
}

export function EditableListItemWrapper({ arrayPath, index, children }: EditableListItemProps) {
  const ctx = useStoryEdit();

  if (!ctx?.isEditing) return <>{children}</>;

  return (
    <div className="relative group">
      {children}
      <button
        onClick={() => ctx.removeFromArray(arrayPath, index)}
        className="absolute -top-2 -right-2 w-5 h-5 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ background: "var(--story-accent)", color: "var(--story-bg)" }}
        title="Remove item"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}
