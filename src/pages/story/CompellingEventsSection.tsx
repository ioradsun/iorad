import { motion } from "framer-motion";
import { Zap, MessageCircle } from "lucide-react";
import { fade } from "./StorySection";
import StorySection from "./StorySection";
import type { CustomerSignal, CompellingEvents } from "@/data/customers";

interface Props {
  signals: CustomerSignal[];
  compellingEvents: CompellingEvents;
}

export default function CompellingEventsSection({ signals, compellingEvents }: Props) {
  return (
    <StorySection icon={Zap} label="What We're Seeing" title="Signals that reveal the opportunity">
      {/* Signals */}
      <div className="grid md:grid-cols-2 gap-4 mb-10">
        {signals.map((s, i) => (
          <motion.div
            key={i}
            {...fade}
            transition={{ ...fade.transition, delay: i * 0.1 }}
            className="rounded-xl p-5"
            style={{ border: "1px solid var(--story-border)", background: "var(--story-surface)" }}
          >
            <h4 className="font-semibold text-sm mb-2" style={{ color: "var(--story-accent)" }}>{s.title}</h4>
            <p className="text-sm leading-relaxed" style={{ color: "var(--story-muted)" }}>{s.detail}</p>
          </motion.div>
        ))}
      </div>

      {/* Compelling Events */}
      <div className="mb-8">
        <p className="text-xs font-mono uppercase tracking-widest mb-3" style={{ color: "var(--story-subtle)" }}>Compelling Events Detected</p>
        <div className="flex flex-wrap gap-2">
          {compellingEvents.matched.map((event, i) => (
            <span
              key={i}
              className="text-xs font-mono px-3 py-1.5 rounded-full"
              style={{ border: "1px solid var(--story-accent-border)", background: "var(--story-accent-dim)", color: "var(--story-accent)" }}
            >
              {event}
            </span>
          ))}
        </div>
      </div>

      {/* Buyer Language */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <MessageCircle className="w-3.5 h-3.5" style={{ color: "var(--story-subtle)" }} />
          <p className="text-xs font-mono uppercase tracking-widest" style={{ color: "var(--story-subtle)" }}>What buyers say on calls</p>
        </div>
        <div className="space-y-3">
          {compellingEvents.buyerLanguage.map((line, i) => (
            <motion.p
              key={i}
              {...fade}
              transition={{ ...fade.transition, delay: i * 0.1 }}
              className="text-sm italic pl-4 leading-relaxed"
              style={{ color: "var(--story-muted)", borderLeft: "2px solid var(--story-border)" }}
            >
              "{line}"
            </motion.p>
          ))}
        </div>
      </div>
    </StorySection>
  );
}
