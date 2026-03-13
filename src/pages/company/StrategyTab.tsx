import { Loader2, RefreshCw } from "lucide-react";
import { DashboardCardUI } from "./DashboardCardUI";
import type { DashboardCard } from "./types";

interface StrategyTabProps {
  contactName: string | null;
  cardsLoading: boolean;
  isInboundStrategyResponse: boolean;
  inboundStrategyData: Record<string, unknown> | null;
  inboundStrategyFields: { label: string; key: string }[];
  cards: DashboardCard[];
  regeneratingSection: string | null;
  ensureRunning: boolean;
  onRegenerate: () => void;
}

export default function StrategyTab({
  cardsLoading,
  isInboundStrategyResponse,
  inboundStrategyData,
  inboundStrategyFields,
  cards,
  regeneratingSection,
  ensureRunning,
  onRegenerate,
}: StrategyTabProps) {
  return (
    <div className="max-w-2xl">
      {cardsLoading ? (
        <div className="flex items-center gap-2 py-8">
          <Loader2 className="w-4 h-4 animate-spin text-primary" />
          <span className="text-caption text-foreground/40">Loading strategy…</span>
        </div>
      ) : isInboundStrategyResponse ? (
        <div className="space-y-6">
          {inboundStrategyFields.map(({ label, key }) =>
            inboundStrategyData?.[key] ? (
              <div key={key}>
                <div className="field-label mb-1.5">{label}</div>
                <p className="text-body text-foreground/65 leading-[1.7]">{String(inboundStrategyData[key])}</p>
              </div>
            ) : null,
          )}
          {Array.isArray(inboundStrategyData?.strategic_plays) && (inboundStrategyData.strategic_plays as any[]).length > 0 && (
            <div>
              <div className="field-label mb-3">Strategic Plays</div>
              <div className="space-y-4">
                {(inboundStrategyData.strategic_plays as any[]).map((play: any, i: number) => (
                  <div key={i} className="pl-4 border-l-2 border-primary/15 space-y-1.5">
                    <div className="text-body font-semibold text-foreground">{play.name}</div>
                    {play.objective && <p className="text-caption text-foreground/50">{play.objective}</p>}
                    {play.why_now && (
                      <p className="text-caption text-foreground/65">
                        <span className="field-label inline mr-1.5 normal-case tracking-normal">Why now:</span>{play.why_now}
                      </p>
                    )}
                    {play.what_it_looks_like && (
                      <p className="text-caption text-foreground/65">
                        <span className="field-label inline mr-1.5 normal-case tracking-normal">Looks like:</span>{play.what_it_looks_like}
                      </p>
                    )}
                    {play.expected_impact && (
                      <p className="text-caption text-primary/80 font-medium">{play.expected_impact}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : cards.length > 0 ? (
        <div className="space-y-5">
          {cards.map((card) => <DashboardCardUI key={card.id} card={card} />)}
        </div>
      ) : (
        <div className="py-12 text-center">
          <p className="text-body text-foreground/40 mb-1">No strategy yet</p>
          <p className="text-caption text-foreground/20">
            Click Generate to create a personalized strategy.
          </p>
        </div>
      )}

      {(isInboundStrategyResponse || cards.length > 0) && (
        <div className="flex justify-end mt-6">
          <button
            className="text-micro text-foreground/20 hover:text-foreground/50 transition-colors flex items-center gap-1"
            disabled={regeneratingSection === "strategy" || ensureRunning}
            onClick={onRegenerate}
          >
            {regeneratingSection === "strategy"
              ? <Loader2 className="w-3 h-3 animate-spin" />
              : <RefreshCw className="w-3 h-3" />}
            Regenerate
          </button>
        </div>
      )}
    </div>
  );
}
