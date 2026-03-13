

interface StoryTabProps {
  contactName: string | null;
  isInboundStoryResponse: boolean;
  rawAccountJson: Record<string, unknown>;
  storyBaseUrl: string | null;
  loomUrl: string;
  ioradUrl: string;
  loomEmbedUrl: string | null;
  ioradEmbedUrl: string | null;
  onLoomUrlChange: (url: string) => void;
  onIoradUrlChange: (url: string) => void;
  regeneratingSection: string | null;
  ensureRunning: boolean;
  onRegenerate: () => void;
}

export default function StoryTab({
  isInboundStoryResponse,
  rawAccountJson,
}: StoryTabProps) {
  return (
    <div className="max-w-2xl space-y-6">
      {isInboundStoryResponse && (
        <div className="space-y-6">
          {[
            { label: "Behavior Acknowledged", key: "behavior_acknowledged" },
            { label: "Momentum Observed", key: "momentum_observed" },
            { label: "Initiative Translation", key: "initiative_translation" },
            { label: "Scale Risk", key: "scale_risk" },
            { label: "Institutionalization Gap", key: "institutionalization_gap" },
            { label: "Executive Translation", key: "executive_translation" },
            { label: "Reinforcement Journey", key: "reinforcement_journey" },
            { label: "Real Cost If Stalled", key: "real_cost_if_stalled" },
            { label: "Upside If Executed", key: "upside_if_executed" },
            { label: "Why Now", key: "why_now" },
            { label: "CTA", key: "cta" },
          ].map(({ label, key }) =>
            rawAccountJson[key] ? (
              <div key={key}>
                <div className="field-label mb-1.5">{label}</div>
                <p className="text-body text-foreground/65 leading-[1.7] whitespace-pre-line">{String(rawAccountJson[key])}</p>
              </div>
            ) : null,
          )}

          {Array.isArray(rawAccountJson.strategic_plays) && (rawAccountJson.strategic_plays as any[]).length > 0 && (
            <div>
              <div className="field-label mb-3">Strategic Expansion Plays</div>
              <div className="space-y-4">
                {(rawAccountJson.strategic_plays as any[]).map((play: any, i: number) => (
                  <div key={i} className="pl-4 border-l-2 border-primary/15 space-y-1.5">
                    <div className="text-body font-semibold text-foreground">{play.name}</div>
                    {play.objective && (
                      <p className="text-caption text-foreground/65">
                        <span className="field-label inline mr-1.5 normal-case tracking-normal">Objective:</span>{play.objective}
                      </p>
                    )}
                    {play.why_now && (
                      <p className="text-caption text-foreground/65">
                        <span className="field-label inline mr-1.5 normal-case tracking-normal">Why Now:</span>{play.why_now}
                      </p>
                    )}
                    {play.what_it_looks_like && (
                      <p className="text-caption text-foreground/65 leading-[1.7]">
                        <span className="field-label inline mr-1.5 normal-case tracking-normal">What It Looks Like:</span>{play.what_it_looks_like}
                      </p>
                    )}
                    {play.expected_impact && (
                      <p className="text-caption text-primary/90">
                        <span className="field-label inline mr-1.5 normal-case tracking-normal">Expected Impact:</span>{play.expected_impact}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {rawAccountJson.reinforcement_preview && typeof rawAccountJson.reinforcement_preview === "object" && (
            <div className="space-y-2">
              <div className="field-label mb-1.5">Reinforcement Preview</div>
              {(rawAccountJson.reinforcement_preview as any).detected_tool && (
                <p className="text-body text-foreground/65 leading-[1.7]"><span className="field-label inline mr-1.5 normal-case tracking-normal">Detected Tool:</span>{(rawAccountJson.reinforcement_preview as any).detected_tool}</p>
              )}
              {(rawAccountJson.reinforcement_preview as any).library_url && (
                <a href={(rawAccountJson.reinforcement_preview as any).library_url} target="_blank" rel="noopener noreferrer" className="text-primary text-body underline">
                  View Library →
                </a>
              )}
              {(rawAccountJson.reinforcement_preview as any).description && (
                <p className="text-body text-foreground/65 leading-[1.7]">{(rawAccountJson.reinforcement_preview as any).description}</p>
              )}
            </div>
          )}
        </div>
      )}


    </div>
  );
}
