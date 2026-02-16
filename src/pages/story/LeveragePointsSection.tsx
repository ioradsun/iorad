import { Wrench } from "lucide-react";
import StorySection from "./StorySection";

interface Props {
  items: string[];
}

export default function LeveragePointsSection({ items }: Props) {
  return (
    <StorySection icon={Wrench} label="Leverage Points" title="Under-optimized leverage points">
      <div className="max-w-3xl">
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
