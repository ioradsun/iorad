import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, RefreshCw, Sparkles } from "lucide-react";
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
  generatingCards: boolean;
  onRegenerate: () => void;
}

export default function StrategyTab({
  contactName,
  cardsLoading,
  isInboundStrategyResponse,
  inboundStrategyData,
  inboundStrategyFields,
  cards,
  regeneratingSection,
  generatingCards,
  onRegenerate,
}: StrategyTabProps) {
  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">
          Strategy & Cards
          {contactName && <span className="ml-2 normal-case tracking-normal text-primary/70 font-medium">for {contactName}</span>}
        </h3>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 gap-1 text-[11px] text-muted-foreground hover:text-foreground px-2"
          disabled={regeneratingSection === "strategy" || generatingCards}
          onClick={onRegenerate}
        >
          {regeneratingSection === "strategy"
            ? <Loader2 className="w-3 h-3 animate-spin" />
            : <RefreshCw className="w-3 h-3" />}
          Strategy
        </Button>
      </div>
      {cardsLoading ? (
        <div className="flex items-center gap-2 py-4">
          <Loader2 className="w-4 h-4 animate-spin text-primary" />
          <span className="ml-2 text-sm text-muted-foreground">Loading cards…</span>
        </div>
      ) : isInboundStrategyResponse ? (
        <div className="space-y-3">
          {inboundStrategyFields.map(({ label, key }) =>
            inboundStrategyData?.[key] ? (
              <Card key={key} className="panel p-4 rounded-lg">
                <div className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground mb-1">{label}</div>
                <p className="text-[13px] leading-relaxed text-foreground/90">{String(inboundStrategyData[key])}</p>
              </Card>
            ) : null,
          )}
          {Array.isArray(inboundStrategyData?.strategic_plays) && (inboundStrategyData.strategic_plays as any[]).length > 0 && (
            <Card className="panel p-4 rounded-lg space-y-3">
              <div className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground mb-2">Strategic Plays</div>
              {(inboundStrategyData.strategic_plays as any[]).map((play: any, i: number) => (
                <div key={i} className="border-l-2 border-primary/30 pl-3 space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5">Play {i + 1}</Badge>
                    <div className="text-[13px] font-semibold text-foreground">{play.name}</div>
                  </div>
                  {play.objective && <div className="text-[12px] text-muted-foreground">{play.objective}</div>}
                  {play.why_now && <div className="text-[12px] text-foreground/80"><span className="font-medium">Why now: </span>{play.why_now}</div>}
                  {play.what_it_looks_like && <div className="text-[12px] text-foreground/80"><span className="font-medium">Looks like: </span>{play.what_it_looks_like}</div>}
                  {play.expected_impact && <div className="text-[12px] text-primary font-medium">{play.expected_impact}</div>}
                </div>
              ))}
            </Card>
          )}
        </div>
      ) : cards.length > 0 ? (
        <div className="space-y-4">
          {cards.map((card) => <DashboardCardUI key={card.id} card={card} />)}
        </div>
      ) : (
        <Card className="panel text-center py-8">
          <Sparkles className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground mb-3">
            {contactName
              ? `No strategy generated for ${contactName} yet.`
              : "No strategy generated yet."}
          </p>
        </Card>
      )}
    </>
  );
}
