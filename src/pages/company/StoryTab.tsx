import { Input } from "@/components/ui/input";
import { Loader2, RefreshCw } from "lucide-react";

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
  setupRunning: boolean;
  onRegenerate: () => void;
}

export default function StoryTab({
  isInboundStoryResponse,
  rawAccountJson,
  loomUrl,
  ioradUrl,
  loomEmbedUrl,
  ioradEmbedUrl,
  onLoomUrlChange,
  onIoradUrlChange,
  regeneratingSection,
  setupRunning,
  onRegenerate,
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

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-6 pt-6 border-t border-border/15">
        <div>
          <div className="field-label mb-1.5">Loom Video URL</div>
          <Input
            placeholder="https://www.loom.com/share/..."
            value={loomUrl}
            onChange={(e) => onLoomUrlChange(e.target.value)}
            className="h-9 text-body"
          />
          <p className="text-micro text-foreground/20 mt-1.5">
            Embeds at the top of the story page
          </p>
        </div>
        <div>
          <div className="field-label mb-1.5">iorad Tutorial URL</div>
          <Input
            placeholder="https://ior.ad/..."
            value={ioradUrl}
            onChange={(e) => onIoradUrlChange(e.target.value)}
            className="h-9 text-body"
          />
          <p className="text-micro text-foreground/20 mt-1.5">
            Replaces the default tutorial on the story page
          </p>
        </div>
      </div>

      {(loomEmbedUrl || ioradEmbedUrl) && (
        <div className="space-y-5">
          <h3 className="field-label">Preview</h3>

          {loomEmbedUrl && (
            <div className="space-y-2">
              <h4 className="text-title font-semibold text-foreground">Loom Video</h4>
              <div className="rounded-xl overflow-hidden border">
                <iframe src={loomEmbedUrl} width="100%" height="400" frameBorder="0" allowFullScreen allow="autoplay; fullscreen" title="Loom video preview" />
              </div>
            </div>
          )}

          {ioradEmbedUrl && (
            <div className="space-y-2">
              <h4 className="text-title font-semibold text-foreground">iorad Tutorial</h4>
              <div className="rounded-xl overflow-hidden border">
                <iframe
                  src={ioradEmbedUrl} width="100%" height="500" frameBorder="0" allowFullScreen
                  allow="camera; microphone; clipboard-write"
                  sandbox="allow-scripts allow-forms allow-same-origin allow-presentation allow-downloads allow-modals allow-popups allow-popups-to-escape-sandbox allow-top-navigation allow-top-navigation-by-user-activation"
                  title="iorad tutorial preview"
                />
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex justify-end mt-6">
        <button
          className="text-micro text-foreground/20 hover:text-foreground/50 transition-colors flex items-center gap-1"
          disabled={regeneratingSection === "story" || setupRunning}
          onClick={onRegenerate}
        >
          {regeneratingSection === "story"
            ? <Loader2 className="w-3 h-3 animate-spin" />
            : <RefreshCw className="w-3 h-3" />}
          Regenerate
        </button>
      </div>
    </div>
  );
}
