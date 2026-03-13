import { Button } from "@/components/ui/button";
import { Loader2, Linkedin, Mail, RefreshCw } from "lucide-react";
import { EmailSequenceUI, LinkedInSequenceUI } from "./OutreachSequences";
import type { EmailTouch, LinkedInStep } from "./types";

interface OutreachTabProps {
  contactName: string | null;
  cardsLoading: boolean;
  rawAccountJson: Record<string, unknown>;
  emailSequence: Record<string, EmailTouch> | undefined;
  linkedinSequence: LinkedInStep[] | undefined;
  regeneratingSection: string | null;
  setupRunning: boolean;
  onRegenerate: () => void;
}

export default function OutreachTab({
  contactName,
  cardsLoading,
  rawAccountJson,
  emailSequence,
  linkedinSequence,
  regeneratingSection,
  setupRunning,
  onRegenerate,
}: OutreachTabProps) {
  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <h3 className="section-label">
          Outreach Assets
          {contactName && <span className="ml-2 normal-case tracking-normal text-primary/70 font-medium">for {contactName}</span>}
        </h3>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 gap-1 text-micro text-foreground/45 hover:text-foreground px-2"
          disabled={regeneratingSection === "outreach" || setupRunning}
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
          <span className="ml-2 text-body text-foreground/45">Loading…</span>
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
              <div className="space-y-4">
                {metaFields.map(({ label, key }) =>
                  meta[key] ? (
                    <div key={key} className="panel p-5 rounded-lg">
                      <div className="section-label mb-1">{label}</div>
                      <p className="text-body leading-relaxed text-foreground/65">{String(meta[key])}</p>
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
          <Mail className="w-8 h-8 text-foreground/25 mx-auto mb-3" />
          <p className="text-body text-foreground/45 mb-1">No outreach yet</p>
          <p className="text-caption text-foreground/25">
            Generate content for a contact to get personalized email and LinkedIn sequences.
          </p>
        </div>
      )}
    </>
  );
}
