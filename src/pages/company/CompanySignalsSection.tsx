import { useState } from "react";
import { AlertCircle, Briefcase, ChevronRight, ExternalLink, Newspaper, Zap } from "lucide-react";
import { motion } from "framer-motion";
import ScoreCell from "@/components/ScoreCell";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { parseJson } from "./types";
import type { ScoreBreakdown, SnapshotJSON } from "./types";

interface CompanySignalsSectionProps {
  signals: any[];
  snapshots: any[];
  activityEvents: any[];
  meetings: any[];
  company: any;
}

export default function CompanySignalsSection({ signals, snapshots, activityEvents, company }: CompanySignalsSectionProps) {
  const [extraOpen, setExtraOpen] = useState(true);
  const latestSnapshot = snapshots[0];
  const bd = latestSnapshot ? parseJson<ScoreBreakdown>(latestSnapshot.score_breakdown) : null;
  const snap = latestSnapshot ? parseJson<SnapshotJSON>(latestSnapshot.snapshot_json) : null;

  return (
    <>
      <Collapsible open={extraOpen} onOpenChange={setExtraOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full justify-between text-xs font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground">
            Score · Signals · Analysis
            <ChevronRight className={`w-4 h-4 transition-transform ${extraOpen ? "rotate-90" : ""}`} />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-6 pt-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="panel">
              <div className="panel-header flex items-center justify-between">
                <span>Score</span>
                <ScoreCell score={company.last_score_total} />
              </div>
              {bd ? (
                <div className="space-y-4">
                  {[
                    { label: "Hiring", value: bd.relevance || bd.hiring || 0, max: 30 },
                    { label: "News", value: bd.urgency || bd.news || 0, max: 40 },
                    { label: "Expansion", value: bd.buyer_signal || bd.expansion || 0, max: 30 },
                  ].map(({ label, value, max }) => (
                    <div key={label}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-muted-foreground">{label}</span>
                        <span className="font-mono font-bold text-foreground">{value}/{max}</span>
                      </div>
                      <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                        <motion.div initial={{ width: 0 }} animate={{ width: `${(value / max) * 100}%` }} transition={{ duration: 0.8, ease: "easeOut" }} className="h-full bg-primary rounded-full" />
                      </div>
                    </div>
                  ))}
                  {snap?.confidence_level && (
                    <div className="flex items-start gap-3 bg-secondary/50 rounded p-3 mt-2">
                      <AlertCircle className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                      <div>
                        <div className="text-xs font-mono font-bold text-primary">{snap.confidence_level} Confidence</div>
                        {snap.confidence_reason && <p className="text-xs text-muted-foreground mt-0.5">{snap.confidence_reason}</p>}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No score computed yet.</p>
              )}
            </div>

            <div className="panel lg:col-span-2">
              <div className="panel-header">Signals ({signals.length})</div>
              {signals.length === 0 ? (
                <p className="text-sm text-muted-foreground">No signals discovered yet.</p>
              ) : (
                <div className="space-y-4">
                  {signals.map(signal => {
                    const snippets = (Array.isArray(signal.evidence_snippets) ? signal.evidence_snippets : []) as string[];
                    return (
                      <div key={signal.id} className="border rounded-md p-3 space-y-2">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-2">
                            {signal.type === "job" ? <Briefcase className="w-4 h-4 text-info flex-shrink-0" /> : <Newspaper className="w-4 h-4 text-warning flex-shrink-0" />}
                            <div>
                              <div className="text-[14px] font-medium">{signal.title}</div>
                              <div className="text-[12px] text-muted-foreground">{signal.date || "No date"} · {signal.type}</div>
                            </div>
                          </div>
                          <a href={signal.url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary flex-shrink-0"><ExternalLink className="w-3.5 h-3.5" /></a>
                        </div>
                        {signal.raw_excerpt && <p className="text-[13px] text-muted-foreground leading-relaxed">{signal.raw_excerpt}</p>}
                        {snippets.length > 0 && (
                          <div className="space-y-1 pt-1 border-t border-border/50">
                            <div className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">Evidence Snippets</div>
                            {snippets.map((snippet, i) => (
                              <div key={i} className="text-[13px] text-accent-foreground bg-accent/20 rounded px-2 py-1.5 border-l-2 border-primary/40">"{snippet}"</div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="panel">
            <div className="panel-header">Snapshot History</div>
            {snapshots.length === 0 ? (
              <p className="text-sm text-muted-foreground">No snapshots generated yet.</p>
            ) : (
              <div className="space-y-2">
                {snapshots.map(s => (
                  <div key={s.id} className="flex items-center justify-between text-sm border rounded px-3 py-2">
                    <div className="flex items-center gap-3">
                      <ScoreCell score={s.score_total} />
                      <span className="font-mono text-xs text-muted-foreground">{s.model_version}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{new Date(s.created_at).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>

      {activityEvents.length > 0 && (
        <div className="panel space-y-3">
          <div className="panel-header flex items-center gap-2">
            <Zap className="w-4 h-4 text-primary" />
            <span>Intent Activity ({activityEvents.length})</span>
          </div>
          <p className="text-xs text-muted-foreground">Actions captured from HubSpot — page views, form submissions, emails, and meetings.</p>
          <div className="space-y-1 max-h-[400px] overflow-y-auto">
            {activityEvents.map((evt: any) => {
              const typeIcons: Record<string, string> = {
                FORM_SUBMISSION: "📝", EMAIL: "📧", EMAIL_RECEIVED: "📩",
                MEETING: "📅", CALL: "📞", PAGE_VIEW: "👁️",
                NOTE: "📒", TASK: "✅",
              };
              const icon = typeIcons[evt.activity_type] || "⚡";
              return (
                <div key={evt.id} className="flex items-start gap-3 px-3 py-2 rounded-lg border border-border/50 bg-secondary/20 hover:bg-secondary/40 transition-colors">
                  <span className="text-base mt-0.5">{icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[14px] font-medium text-foreground truncate">{evt.title}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-[11px] font-mono uppercase tracking-widest px-1.5 py-0.5 rounded border ${
                        evt.activity_type === "FORM_SUBMISSION"
                          ? "border-emerald-500/40 text-emerald-400 bg-emerald-500/10"
                          : evt.activity_type?.includes("EMAIL")
                            ? "border-blue-500/40 text-blue-400 bg-blue-500/10"
                            : "border-border text-muted-foreground bg-muted/50"
                      }`}>{evt.activity_type?.replace(/_/g, " ")}</span>
                      {evt.url && <a href={evt.url} target="_blank" rel="noopener noreferrer" className="text-[11px] text-primary hover:underline truncate max-w-[200px]">{evt.url}</a>}
                    </div>
                  </div>
                  <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                    {new Date(evt.occurred_at).toLocaleDateString()} {new Date(evt.occurred_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
