import { ExternalLink } from "lucide-react";
import { TruthBadge } from "./TruthBadge";
import type { DashboardCard } from "./types";

export function DashboardCardUI({ card }: { card: DashboardCard }) {
  if (card.id === "ai_strategy" && card.strategies?.length) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-body font-semibold text-foreground">{card.title}</h4>
          {card.priority && (
            <span className="text-micro text-foreground/25">{card.priority}</span>
          )}
        </div>
        <div className="space-y-4">
          {card.strategies.map((s, i) => (
            <div key={i} className="pl-4 border-l-2 border-primary/15 space-y-2">
              <div className="text-body font-semibold">{s.title}</div>
              <p className="text-body text-foreground/65 leading-[1.7]">{s.pitch}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {s.why_now && (
                  <div>
                    <div className="field-label">Why Now</div>
                    <p className="text-caption text-foreground/65 leading-relaxed">{s.why_now}</p>
                  </div>
                )}
                {s.proof && (
                  <div>
                    <div className="field-label">Proof</div>
                    <p className="text-caption text-foreground/65 leading-relaxed">{s.proof}</p>
                  </div>
                )}
              </div>
              {s.what_to_validate?.length > 0 && (
                <div>
                  <div className="field-label mb-1">Validate</div>
                  <ul className="space-y-1">
                    {s.what_to_validate.map((q, j) => (
                      <li key={j} className="text-caption text-foreground/65 flex gap-2">
                        <span className="text-foreground/20 shrink-0">•</span>{q}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {s.sources?.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {s.sources.map((url, j) => (
                    <a key={j} href={url} target="_blank" rel="noopener noreferrer" className="text-micro text-primary hover:underline flex items-center gap-0.5">
                      <ExternalLink className="w-3 h-3" /> Source
                    </a>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-body font-semibold text-foreground">{card.title}</h4>
        {card.priority && (
          <span className="text-micro text-foreground/25">{card.priority}</span>
        )}
      </div>
      {card.fields?.length ? (
        <div className="space-y-2.5">
          {card.fields.map((f, i) => (
            <div key={i} className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <span className="field-label inline mr-2 normal-case tracking-normal">{f.label}</span>
                <span className="text-body text-foreground/65">{f.value}</span>
              </div>
              <TruthBadge status={f.status} source={f.source} />
            </div>
          ))}
        </div>
      ) : (
        <p className="field-value-empty">No data</p>
      )}
    </div>
  );
}
