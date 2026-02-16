import { Layout } from "lucide-react";
import { motion } from "framer-motion";
import { fade } from "./StorySection";
import StorySection from "./StorySection";
import type { StrategicPlay } from "@/data/customers";

interface Props {
  plays: StrategicPlay[];
}

export default function StrategicPlaysSection({ plays }: Props) {
  return (
    <StorySection icon={Layout} label="Strategic Plays" title="Plays to consider">
      <div className="space-y-6">
        {plays.map((play, i) => (
          <motion.div
            key={i}
            {...fade}
            transition={{ ...fade.transition, delay: i * 0.15 }}
            className="rounded-xl p-6"
            style={{ border: "1px solid var(--story-border)", background: "var(--story-surface)" }}
          >
            <h4 className="font-semibold text-lg mb-4">{play.name}</h4>
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs font-mono uppercase tracking-wider mb-1" style={{ color: "var(--story-accent)" }}>Objective</p>
                <p className="leading-relaxed" style={{ color: "var(--story-muted)" }}>{play.objective}</p>
              </div>
              <div>
                <p className="text-xs font-mono uppercase tracking-wider mb-1" style={{ color: "var(--story-accent)" }}>Why Now</p>
                <p className="leading-relaxed" style={{ color: "var(--story-muted)" }}>{play.whyNow}</p>
              </div>
              <div>
                <p className="text-xs font-mono uppercase tracking-wider mb-1" style={{ color: "var(--story-accent)" }}>In Practice</p>
                <p className="leading-relaxed" style={{ color: "var(--story-muted)" }}>{play.inPractice}</p>
              </div>
              <div>
                <p className="text-xs font-mono uppercase tracking-wider mb-1" style={{ color: "var(--story-accent)" }}>Expected Impact</p>
                <p className="leading-relaxed" style={{ color: "var(--story-muted)" }}>{play.expectedImpact}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </StorySection>
  );
}
