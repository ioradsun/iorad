import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Video, BookOpen, Sparkles, Copy } from "lucide-react";
import { copyToClipboard } from "./types";
import { toast } from "sonner";
import type { StoryAssets } from "./types";

function copy(text: string) {
  copyToClipboard(text);
  toast.success("Copied to clipboard");
}

export function StoryAssetsUI({ storyAssets }: { storyAssets: StoryAssets }) {
  const loom = storyAssets.primary_asset;
  const iorad = storyAssets.supporting_asset;
  const loomReady = !!(loom?.title && loom?.loom_script);
  const ioradReady = !!(iorad?.title && iorad?.what_it_guides?.length);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" /> AI-Generated Story Config
        </h3>
        {storyAssets.active_strategy && (
          <Badge variant="outline" className="text-[12px]">Strategy: {storyAssets.active_strategy}</Badge>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Loom — Narrative Layer */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-[14px] font-semibold flex items-center gap-2">
              <Video className="w-4 h-4 text-primary" />
              Loom Script
              <span className="text-[11px] text-muted-foreground">(Narrative Layer)</span>
              <Badge variant={loomReady ? "default" : "secondary"} className="text-[11px] ml-auto">
                {loomReady ? "Ready" : "Not Ready"}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {loom?.title && <div className="text-[13px]"><span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Title:</span> <span className="text-foreground/90">{loom.title}</span></div>}
            {loom?.purpose && <div className="text-[13px]"><span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Purpose:</span> <span className="text-foreground/90">{loom.purpose}</span></div>}
            {loom?.covers?.length > 0 && (
              <div className="text-[13px]">
                <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Covers:</span>
                <ul className="mt-1 space-y-0.5">{loom.covers.map((c, i) => <li key={i} className="text-foreground/80 flex gap-1.5"><span className="text-primary">•</span>{c}</li>)}</ul>
              </div>
            )}
            {loom?.when_to_send && <div className="text-[13px]"><span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">When to send:</span> <span className="text-foreground/90">{loom.when_to_send}</span></div>}
            {loom?.intro_message && (
              <div className="space-y-1.5">
                <div className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">Intro Message</div>
                <div className="text-[13px] text-foreground/80 bg-secondary/30 rounded p-2.5">{loom.intro_message}</div>
                <Button size="sm" variant="ghost" className="gap-1 text-[13px] h-8" onClick={() => copy(loom.intro_message)}>
                  <Copy className="w-3 h-3" /> Copy Intro
                </Button>
              </div>
            )}
            {loom?.loom_script && (
              <div className="space-y-1.5 border-t border-border/50 pt-3">
                <div className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">Loom Script</div>
                <div className="text-[13px] text-foreground/80 whitespace-pre-wrap leading-relaxed bg-secondary/30 rounded p-3 max-h-64 overflow-y-auto">{loom.loom_script}</div>
                <Button size="sm" variant="ghost" className="gap-1 text-[13px] h-8" onClick={() => copy(loom.loom_script)}>
                  <Copy className="w-3 h-3" /> Copy Script
                </Button>
              </div>
            )}
            {!loom?.title && <p className="text-[13px] text-muted-foreground">No Loom data generated yet.</p>}
          </CardContent>
        </Card>

        {/* iorad Tutorial — Mechanism Layer */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-[14px] font-semibold flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-primary" />
              iorad Tutorial
              <span className="text-[11px] text-muted-foreground">(Mechanism Layer)</span>
              <Badge variant={ioradReady ? "default" : "secondary"} className="text-[11px] ml-auto">
                {ioradReady ? "Ready" : "Not Ready"}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {iorad?.title && <div className="text-[13px]"><span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Title:</span> <span className="text-foreground/90">{iorad.title}</span></div>}
            {iorad?.environment && <div className="text-[13px]"><span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Environment:</span> <span className="text-foreground/90">{iorad.environment}</span></div>}
            {iorad?.what_it_guides?.length > 0 && (
              <div className="text-[13px]">
                <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">What it guides:</span>
                <ul className="mt-1 space-y-0.5">{iorad.what_it_guides.map((g, i) => <li key={i} className="text-foreground/80 flex gap-1.5"><span className="text-primary">•</span>{g}</li>)}</ul>
              </div>
            )}
            {iorad?.business_outcome && <div className="text-[13px]"><span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Business outcome:</span> <span className="text-foreground/90">{iorad.business_outcome}</span></div>}
            {iorad?.when_to_send && <div className="text-[13px]"><span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">When to send:</span> <span className="text-foreground/90">{iorad.when_to_send}</span></div>}
            {iorad?.intro_message && (
              <div className="space-y-1.5">
                <div className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">Intro Message</div>
                <div className="text-[13px] text-foreground/80 bg-secondary/30 rounded p-2.5">{iorad.intro_message}</div>
                <Button size="sm" variant="ghost" className="gap-1 text-[13px] h-8" onClick={() => copy(iorad.intro_message)}>
                  <Copy className="w-3 h-3" /> Copy Intro
                </Button>
              </div>
            )}
            {iorad?.embed_context && <div className="text-[13px]"><span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Embed context:</span> <span className="text-foreground/90">{iorad.embed_context}</span></div>}
            {!iorad?.title && <p className="text-[13px] text-muted-foreground">No tutorial data generated yet.</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
