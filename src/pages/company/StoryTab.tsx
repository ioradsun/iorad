import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BookOpen, Eye, Loader2, RefreshCw, Sparkles, Video } from "lucide-react";

interface StoryTabProps {
  contactName: string | null;
  // Story narrative data
  isInboundStoryResponse: boolean;
  rawAccountJson: Record<string, unknown>;
  // URL management
  storyBaseUrl: string | null;
  loomUrl: string;
  ioradUrl: string;
  loomEmbedUrl: string | null;
  ioradEmbedUrl: string | null;
  onLoomUrlChange: (url: string) => void;
  onIoradUrlChange: (url: string) => void;
  // Regeneration
  regeneratingSection: string | null;
  generatingCards: boolean;
  onRegenerate: () => void;
}

export default function StoryTab({
  contactName,
  isInboundStoryResponse,
  rawAccountJson,
  storyBaseUrl,
  loomUrl,
  ioradUrl,
  loomEmbedUrl,
  ioradEmbedUrl,
  onLoomUrlChange,
  onIoradUrlChange,
  regeneratingSection,
  generatingCards,
  onRegenerate,
}: StoryTabProps) {
  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
          <Sparkles className="w-3 h-3" />
          Story Configuration
          {contactName && <span className="normal-case tracking-normal text-primary/70 font-medium">for {contactName}</span>}
        </h3>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            className="h-6 gap-1 text-[11px] text-muted-foreground hover:text-foreground px-2"
            disabled={regeneratingSection === "story" || generatingCards}
            onClick={onRegenerate}
          >
            {regeneratingSection === "story"
              ? <Loader2 className="w-3 h-3 animate-spin" />
              : <RefreshCw className="w-3 h-3" />}
            Story
          </Button>
          {storyBaseUrl && (
            <a href={storyBaseUrl} target="_blank" rel="noopener noreferrer">
              <Button size="sm" variant="outline" className="gap-1.5 text-[13px]">
                <Eye className="w-3.5 h-3.5" /> View Story
              </Button>
            </a>
          )}
        </div>
      </div>

      {isInboundStoryResponse && (
        <div className="space-y-4">
          <div className="glow-line" />
          <div className="flex flex-wrap items-center gap-2">
            {rawAccountJson.intent_tier && (
              <Badge variant="outline" className="text-[11px]">Tier: {String(rawAccountJson.intent_tier)}</Badge>
            )}
            {rawAccountJson.momentum_score !== undefined && (
              <Badge variant="outline" className="text-[11px]">Momentum Score: {String(rawAccountJson.momentum_score)}</Badge>
            )}
            {rawAccountJson.persona && (
              <Badge variant="secondary" className="text-[11px]">{String(rawAccountJson.persona)}</Badge>
            )}
          </div>

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
              <div key={key} className="panel p-4 rounded-lg space-y-1">
                <div className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">{label}</div>
                <p className="text-[13px] leading-relaxed text-foreground/90 whitespace-pre-line">{String(rawAccountJson[key])}</p>
              </div>
            ) : null,
          )}

          {Array.isArray(rawAccountJson.strategic_plays) && (rawAccountJson.strategic_plays as any[]).length > 0 && (
            <div className="space-y-3">
              <div className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Strategic Expansion Plays</div>
              <div className="grid grid-cols-1 gap-3">
                {(rawAccountJson.strategic_plays as any[]).map((play: any, i: number) => (
                  <div key={i} className="panel p-4 rounded-lg border border-border/60 space-y-2">
                    <div className="font-semibold text-[13px] text-foreground">{play.name}</div>
                    {play.objective && <p className="text-[12px] text-muted-foreground"><span className="font-mono uppercase tracking-wider text-[10px]">Objective:</span> {play.objective}</p>}
                    {play.why_now && <p className="text-[12px] text-muted-foreground"><span className="font-mono uppercase tracking-wider text-[10px]">Why Now:</span> {play.why_now}</p>}
                    {play.what_it_looks_like && <p className="text-[12px] text-foreground/80 leading-relaxed"><span className="font-mono uppercase tracking-wider text-[10px]">What It Looks Like:</span> {play.what_it_looks_like}</p>}
                    {play.expected_impact && <p className="text-[12px] text-primary/90"><span className="font-mono uppercase tracking-wider text-[10px]">Expected Impact:</span> {play.expected_impact}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {rawAccountJson.reinforcement_preview && typeof rawAccountJson.reinforcement_preview === "object" && (
            <div className="panel p-4 rounded-lg space-y-2">
              <div className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Reinforcement Preview</div>
              {(rawAccountJson.reinforcement_preview as any).detected_tool && (
                <p className="text-[13px]"><span className="text-muted-foreground text-[11px]">Detected Tool:</span> {(rawAccountJson.reinforcement_preview as any).detected_tool}</p>
              )}
              {(rawAccountJson.reinforcement_preview as any).library_url && (
                <a href={(rawAccountJson.reinforcement_preview as any).library_url} target="_blank" rel="noopener noreferrer" className="text-primary text-[13px] underline">
                  View Library →
                </a>
              )}
              {(rawAccountJson.reinforcement_preview as any).description && (
                <p className="text-[13px] text-foreground/80 leading-relaxed">{(rawAccountJson.reinforcement_preview as any).description}</p>
              )}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Video className="w-4 h-4 text-primary" /> Loom Video
              <Badge variant="outline" className="text-[10px] ml-auto">{loomUrl ? "Ready" : "Not Set"}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-xs">Loom Share URL</Label>
              <Input
                placeholder="https://www.loom.com/share/abc123..."
                value={loomUrl}
                onChange={(e) => onLoomUrlChange(e.target.value)}
                className="mt-1"
              />
              <p className="text-[10px] text-muted-foreground mt-1">Paste your Loom share link. It will embed automatically at the top of the story page.</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-primary" /> iorad Tutorial
              <Badge variant="outline" className="text-[10px] ml-auto">{ioradUrl ? "Ready" : "Not Set"}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-xs">iorad Tutorial URL</Label>
              <Input
                placeholder="https://ior.ad/..."
                value={ioradUrl}
                onChange={(e) => onIoradUrlChange(e.target.value)}
                className="mt-1"
              />
              <p className="text-[10px] text-muted-foreground mt-1">Replaces the default tutorial in the customer story page.</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {(loomEmbedUrl || ioradEmbedUrl) && (
        <div className="space-y-4">
          <div className="glow-line" />
          <h3 className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Preview</h3>

          {loomEmbedUrl && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium flex items-center gap-2"><Video className="w-4 h-4 text-primary" /> Loom Video</h4>
              <div className="rounded-xl overflow-hidden border">
                <iframe src={loomEmbedUrl} width="100%" height="400" frameBorder="0" allowFullScreen allow="autoplay; fullscreen" title="Loom video preview" />
              </div>
            </div>
          )}

          {ioradEmbedUrl && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium flex items-center gap-2"><BookOpen className="w-4 h-4 text-primary" /> iorad Tutorial</h4>
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
    </>
  );
}
