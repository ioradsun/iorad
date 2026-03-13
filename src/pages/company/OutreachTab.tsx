import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmailSequenceUI, LinkedInSequenceUI } from "./OutreachSequences";
import type { EmailTouch, LinkedInStep } from "./types";

interface OutreachTabProps {
  contactName: string | null;
  cardsLoading: boolean;
  rawAccountJson: Record<string, unknown>;
  emailSequence: Record<string, EmailTouch> | undefined;
  linkedinSequence: LinkedInStep[] | undefined;
  regeneratingSection: string | null;
  ensureRunning: boolean;
  onRegenerate: () => void;
}

export default function OutreachTab({
  cardsLoading,
  rawAccountJson,
  emailSequence,
  linkedinSequence,
  regeneratingSection,
  ensureRunning,
  onRegenerate,
}: OutreachTabProps) {
  return (
    <div className="max-w-2xl">
      {cardsLoading ? (
        <div className="flex items-center gap-2 py-8">
          <Loader2 className="w-4 h-4 animate-spin text-primary" />
          <span className="text-caption text-foreground/40">Loading outreach…</span>
        </div>
      ) : (emailSequence || linkedinSequence) ? (
        <div className="space-y-8">
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
              <div className="space-y-5">
                {metaFields.map(({ label, key }) =>
                  meta[key] ? (
                    <div key={key}>
                      <div className="field-label mb-1.5">{label}</div>
                      <p className="text-body text-foreground/65 leading-[1.7]">{String(meta[key])}</p>
                    </div>
                  ) : null,
                )}
              </div>
            );
          })()}

          {emailSequence && (
            <div>
              <div className="field-label mb-3">Email Sequence</div>
              <EmailSequenceUI emails={emailSequence} />
            </div>
          )}

          {linkedinSequence && (
            <div>
              <div className="field-label mb-3">LinkedIn Sequence</div>
              <LinkedInSequenceUI steps={linkedinSequence} />
            </div>
          )}

          <div className="flex justify-end">
            <Button
              size="sm"
              variant="ghost"
              className="gap-1.5 text-foreground/40 hover:text-foreground"
              disabled={regeneratingSection === "outreach" || ensureRunning}
              onClick={onRegenerate}
            >
              {regeneratingSection === "outreach"
                ? <Loader2 className="w-3 h-3 animate-spin" />
                : <RefreshCw className="w-3 h-3" />}
              Regenerate
            </Button>
          </div>
        </div>
      ) : (
        <div className="py-12 text-center">
          <p className="text-body text-foreground/40 mb-1">No outreach yet</p>
          <p className="text-caption text-foreground/20">
            Click Generate to create personalized email and LinkedIn sequences.
          </p>
        </div>
      )}
    </div>
  );
}
