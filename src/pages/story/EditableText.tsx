import { useRef, useEffect } from "react";
import { useStoryEdit } from "./EditContext";
import { X } from "lucide-react";

interface EditableTextProps {
  value: string;
  field: string;
  as?: "p" | "span" | "h1" | "h2" | "h3" | "h4" | "li";
  className?: string;
  style?: React.CSSProperties;
}

export function EditableText({ value, field, as: Tag = "span", className, style }: EditableTextProps) {
  const ctx = useStoryEdit();
  const ref = useRef<HTMLElement>(null);

  // For override fields, check if there's an edited value
  const isOverride = field.startsWith("overrides.");
  const displayValue = ctx?.isEditing && isOverride
    ? (ctx.editedCustomer.overrides?.[field.replace("overrides.", "")] ?? value)
    : value;

  useEffect(() => {
    if (ref.current && ref.current.innerText !== displayValue) {
      ref.current.innerText = displayValue;
    }
  }, [displayValue]);

  if (!ctx?.isEditing) {
    return <Tag className={className} style={{ ...style, whiteSpace: "pre-wrap" }}>{displayValue}</Tag>;
  }

  return (
    <Tag
      ref={ref as any}
      contentEditable
      suppressContentEditableWarning
      className={`${className || ""} editable-field`}
      style={{ ...style, minHeight: "1em", whiteSpace: "pre-wrap" }}
      onBlur={(e) => {
        const newVal = e.currentTarget.innerText || "";
        if (isOverride) {
          const key = field.replace("overrides.", "");
          const overrides = { ...(ctx.editedCustomer.overrides || {}), [key]: newVal };
          ctx.setField("overrides", overrides);
        } else {
          ctx.setField(field, newVal);
        }
      }}
    >
      {displayValue}
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
        className="absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow-md"
        style={{ background: "#ef4444", color: "#fff" }}
        title="Remove item"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
