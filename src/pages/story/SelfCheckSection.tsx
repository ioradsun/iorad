import { CheckSquare } from "lucide-react";
import StorySection from "./StorySection";

interface Props {
  items: string[];
}

export default function SelfCheckSection({ items }: Props) {
  return (
    <StorySection icon={CheckSquare} label="Quick Self-Check" title="A few questions worth asking">
      <div className="max-w-3xl">
        <ul className="space-y-3">
          {items.map((item, i) => (
            <li key={i} className="flex items-start gap-3 text-sm leading-relaxed" style={{ color: "var(--story-muted)" }}>
              <span
                className="mt-0.5 w-5 h-5 rounded flex items-center justify-center shrink-0 text-xs font-mono"
                style={{ border: "1px solid var(--story-border)", color: "var(--story-subtle)" }}
              >
                ?
              </span>
              {item}
            </li>
          ))}
        </ul>
        <p className="text-sm mt-5 italic" style={{ color: "var(--story-subtle)" }}>
          If more than one answer feels uncertain, reinforcement gaps may exist.
        </p>
      </div>
    </StorySection>
  );
}
