import { Compass } from "lucide-react";
import StorySection from "./StorySection";

interface Props {
  items: string[];
}

export default function LeadershipPrioritiesSection({ items }: Props) {
  return (
    <StorySection icon={Compass} label="Leadership Focus" title="What this usually signals about priorities">
      <div className="max-w-3xl">
        <p className="text-sm mb-5 leading-relaxed" style={{ color: "var(--story-subtle)" }}>
          When companies hit this stage, leadership usually focuses on:
        </p>
        <ul className="space-y-3">
          {items.map((item, i) => (
            <li key={i} className="flex items-start gap-3 text-sm leading-relaxed" style={{ color: "var(--story-muted)" }}>
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "var(--story-accent)" }} />
              {item}
            </li>
          ))}
        </ul>
      </div>
    </StorySection>
  );
}
