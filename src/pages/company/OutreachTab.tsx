import { Button } from "@/components/ui/button";
import { Loader2, Linkedin, Mail, RefreshCw } from "lucide-react";
import { EmailSequenceUI, LinkedInSequenceUI } from "./OutreachSequences";
import type { EmailTouch, LinkedInStep } from "./types";

interface OutreachTabProps {
  cardsLoading: boolean;
  rawAccountJson: Record<string, unknown>;
  emailSequence: Record<string, EmailTouch> | undefined;
  linkedinSequence: LinkedInStep[] | undefined;
  regeneratingSection: string | null;
  generatingCards: boolean;
  onRegenerate: () => void;
}

export default function OutreachTab({
  cardsLoading,
  rawAccountJson,
  emailSequence,
  linkedinSequence,
  regeneratingSection,
  generatingCards,
  onRegenerate,
}: OutreachTabProps) {
  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">Outreach Assets</h3>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 gap-1 text-[11px] text-muted-foreground hover:text-foreground px-2"
          disabled={regeneratingSection === "outreach" || generatingCards}
          onClick={onRegenerate}
        >
          {regeneratingSection === "outreach"
            ? <Loader2 className="w-3 h-3 animate-spin" />
            : <RefreshCw className="w-3 h-3" />}
          Outreach
        </Button>
      </div>
      {cardsLoading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
          <span className="ml-2 text-sm text-muted-foreground">Loading…</span>
        </div>
      ) : (emailSequence || linkedinSequence) ? (
        <div className="space-y-6">
          {rawAccountJson._outreach_meta && typeof rawAccountJson._outreach_meta === "object" && (() => {
            const meta = rawAccountJson._outreach_meta as Record<string, unknown>;
            const metaFields = [
              { label: "Intent Tier", key: "intent_tier" },
              { label: "Behavior Acknowledged", key: "behavior_acknowledged" },
              { label: "Momentum Frame", key: "momentum_frame" },
              { label: "Expansion Opportunity", key: "expansion_opportunity" },
              { label: "Risk If Stalled", key: "risk_if_stalled" },
              { label: "Upside If Executed", key: "upside_if_executed" },
            ];
            const hasAny = metaFields.some(({ key }) => meta[key]);
            if (!hasAny) return null;
            return (
              <div className="space-y-3">
                {metaFields.map(({ label, key }) =>
                  meta[key] ? (
                    <div key={key} className="panel p-4 rounded-lg">
                      <div className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground mb-1">{label}</div>
                      <p className="text-[13px] leading-relaxed text-foreground/90">{String(meta[key])}</p>
                    </div>
                  ) : null,
                )}
              </div>
            );
          })()}
          {emailSequence && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium flex items-center gap-2"><Mail className="w-4 h-4 text-primary" /> Email Sequence</h4>
              <EmailSequenceUI emails={emailSequence} />
            </div>
          )}
          {linkedinSequence && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium flex items-center gap-2"><Linkedin className="w-4 h-4 text-primary" /> LinkedIn Sequence</h4>
              <LinkedInSequenceUI steps={linkedinSequence} />
            </div>
          )}
        </div>
      ) : (
        <div className="panel text-center py-8">
          <Mail className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground mb-3">No outreach assets generated yet.</p>
        </div>
      )}
    </>
  );
}
