import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useCompany, useSignals, useSnapshots } from "@/hooks/useSupabase";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import ScoreCell from "@/components/ScoreCell";
import StatusBadge from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ArrowLeft, RefreshCw, RotateCcw, ExternalLink, Briefcase, Newspaper, CheckCircle2, AlertCircle, Loader2, Target, TrendingUp, Shield, Zap, BarChart3, FileText, MessageSquareQuote } from "lucide-react";
import { motion } from "framer-motion";
import { Json } from "@/integrations/supabase/types";
import { toast } from "sonner";

interface ScoreBreakdown {
  relevance?: number;
  urgency?: number;
  buyer_signal?: number;
  hiring?: number;
  news?: number;
  expansion?: number;
  rules_fired?: string[];
  evidence_urls?: string[];
}

interface SnapshotJSON {
  // Legacy fields
  trigger_summary?: string;
  why_now?: string | string[];
  likely_initiative?: string;
  suggested_persona_targets?: string[];
  confidence_level?: string;
  confidence_reason?: string;
  missing_data_questions?: string[];
  evidence?: { snippet?: string; detail?: string; signal_type?: string; source_url?: string; url?: string; source_type?: string; date?: string | null }[];
  // Enterprise sections
  signal_deconstruction?: {
    observable_facts?: string[];
    company_stage?: string;
    workflow_stress_indicators?: string[];
  };
  operational_friction?: { cause?: string; effect?: string; bottleneck?: string }[];
  partner_platform_ceiling?: {
    platform_strengths?: string[];
    execution_gaps?: string[];
    key_insight?: string;
  };
  embedded_leverage?: {
    situation?: string;
    constraint?: string;
    intervention?: string;
    transformation?: string;
  };
  quantified_impact?: { metric?: string; assumptions?: string; calculation?: string; result?: string }[];
  executive_narrative?: string;
  outbound_positioning?: {
    executive_framing?: string;
    efficiency_framing?: string;
    risk_framing?: string;
  };
  competitive_insulation?: string[];
}

function toArray(val: unknown): string[] {
  if (Array.isArray(val)) return val.map(String);
  if (typeof val === "string" && val) return [val];
  return [];
}

function parseJson<T>(val: Json | null | undefined): T | null {
  if (!val) return null;
  if (typeof val === "object") return val as unknown as T;
  try { return JSON.parse(String(val)); } catch { return null; }
}

function SectionHeader({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-muted-foreground mb-3">
      <Icon className="w-4 h-4 text-primary" />
      <span>{title}</span>
    </div>
  );
}

export default function CompanyDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: company, isLoading } = useCompany(id);
  const { data: signals = [] } = useSignals(id);
  const { data: snapshots = [] } = useSnapshots(id);
  const queryClient = useQueryClient();
  const [activeAction, setActiveAction] = useState<string | null>(null);

  const runAction = async (mode: "signals_only" | "score_only" | "snapshot_only" | "full") => {
    if (!id) return;
    setActiveAction(mode);
    try {
      const { data, error } = await supabase.functions.invoke("run-signals", {
        body: { company_id: id, mode },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`Done — ${data?.company || "company"}`);
      queryClient.invalidateQueries({ queryKey: ["company", id] });
      queryClient.invalidateQueries({ queryKey: ["signals", id] });
      queryClient.invalidateQueries({ queryKey: ["snapshots", id] });
      queryClient.invalidateQueries({ queryKey: ["companies"] });
    } catch (e: any) {
      toast.error(e.message || "Action failed");
    } finally {
      setActiveAction(null);
    }
  };
  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }

  if (!company) {
    return (
      <div className="text-center py-20">
        <h2 className="text-xl font-bold">Company not found</h2>
        <Link to="/" className="text-primary text-sm mt-2 inline-block">← Back to Dashboard</Link>
      </div>
    );
  }

  const latestSnapshot = snapshots[0];
  const bd = latestSnapshot ? parseJson<ScoreBreakdown>(latestSnapshot.score_breakdown) : null;
  const snap = latestSnapshot ? parseJson<SnapshotJSON>(latestSnapshot.snapshot_json) : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link to="/" className="text-muted-foreground hover:text-foreground transition-colors"><ArrowLeft className="w-5 h-5" /></Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{company.name}</h1>
            <p className="text-sm text-muted-foreground font-mono">{company.domain || "no domain"}</p>
          </div>
          <ScoreCell score={company.last_score_total} size="lg" />
          <StatusBadge status={company.snapshot_status} />
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" disabled={!!activeAction} onClick={() => runAction("signals_only")}>
            {activeAction === "signals_only" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Refresh Signals
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" disabled={!!activeAction} onClick={() => runAction("score_only")}>
            {activeAction === "score_only" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />} Recalculate Score
          </Button>
          <Button size="sm" className="gap-1.5 text-xs" disabled={!!activeAction} onClick={() => runAction("full")}>
            {activeAction === "full" || activeAction === "snapshot_only" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />} Regenerate Snapshot
          </Button>
        </div>
      </div>

      {/* Company metadata */}
      {(company.partner || company.industry || company.hq_country || company.persona) && (
        <div className="flex flex-wrap gap-2">
          {company.partner && <span className="text-xs bg-secondary px-2 py-0.5 rounded">Partner: {company.partner}</span>}
          {company.partner_rep_name && <span className="text-xs bg-secondary px-2 py-0.5 rounded">Rep: {company.partner_rep_name}</span>}
          {company.industry && <span className="text-xs bg-secondary px-2 py-0.5 rounded">{company.industry.replace(/_/g, " ").toLowerCase()}</span>}
          {company.hq_country && <span className="text-xs bg-secondary px-2 py-0.5 rounded">{company.hq_country}</span>}
          {company.persona && <span className="text-xs bg-secondary px-2 py-0.5 rounded">{company.persona}</span>}
          {company.headcount && <span className="text-xs bg-secondary px-2 py-0.5 rounded">{company.headcount}+ employees</span>}
        </div>
      )}

      <div className="glow-line" />

      {/* Score + Signals row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Score Breakdown */}
        <div className="panel lg:col-span-1">
          <div className="panel-header">Score Breakdown</div>
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

        {/* Signals */}
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
                          <div className="text-sm font-medium">{signal.title}</div>
                          <div className="text-xs text-muted-foreground">{signal.date || "No date"} · {signal.type}</div>
                        </div>
                      </div>
                      <a href={signal.url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary flex-shrink-0"><ExternalLink className="w-3.5 h-3.5" /></a>
                    </div>
                    {signal.raw_excerpt && <p className="text-xs text-muted-foreground leading-relaxed">{signal.raw_excerpt}</p>}
                    {snippets.length > 0 && (
                      <div className="space-y-1 pt-1 border-t border-border/50">
                        <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Evidence Snippets</div>
                        {snippets.map((snippet, i) => (
                          <div key={i} className="text-xs text-accent-foreground bg-accent/20 rounded px-2 py-1.5 border-l-2 border-primary/40">"{snippet}"</div>
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

      {/* Enterprise Analysis Accordion */}
      {snap && latestSnapshot && (
        <div className="panel">
          <div className="panel-header flex items-center justify-between">
            <span>iorad Expansion Analysis</span>
            <span className="text-[10px] text-muted-foreground normal-case tracking-normal">
              {latestSnapshot.model_version} · {latestSnapshot.prompt_version} · {new Date(latestSnapshot.created_at).toLocaleDateString()}
            </span>
          </div>

          {/* Why Now (always visible) */}
          {snap.why_now && toArray(snap.why_now).length > 0 && (
            <div className="mb-4 bg-primary/5 border border-primary/20 rounded-lg p-4">
              <div className="text-xs font-mono uppercase tracking-wider text-primary mb-2">Why Now</div>
              {toArray(snap.why_now).map((item, i) => <p key={i} className="text-sm text-foreground/90 leading-relaxed">{item}</p>)}
            </div>
          )}

          <Accordion type="multiple" defaultValue={["executive-narrative"]} className="space-y-2">
            {/* 1. Signal Deconstruction */}
            {snap.signal_deconstruction && (
              <AccordionItem value="signal-deconstruction" className="border rounded-lg px-4">
                <AccordionTrigger className="text-sm font-medium">
                  <div className="flex items-center gap-2"><Target className="w-4 h-4 text-primary" /> Signal Deconstruction</div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-4">
                    {snap.signal_deconstruction.company_stage && (
                      <div>
                        <div className="text-xs font-mono text-muted-foreground mb-1">Company Stage</div>
                        <span className="text-sm bg-primary/10 text-primary px-2 py-0.5 rounded">{snap.signal_deconstruction.company_stage}</span>
                      </div>
                    )}
                    {snap.signal_deconstruction.observable_facts?.length ? (
                      <div>
                        <div className="text-xs font-mono text-muted-foreground mb-2">Observable Facts</div>
                        <ul className="space-y-1">{snap.signal_deconstruction.observable_facts.map((f, i) => <li key={i} className="text-sm flex items-start gap-2"><span className="text-primary">•</span>{f}</li>)}</ul>
                      </div>
                    ) : null}
                    {snap.signal_deconstruction.workflow_stress_indicators?.length ? (
                      <div>
                        <div className="text-xs font-mono text-muted-foreground mb-2">Workflow Stress Indicators</div>
                        <ul className="space-y-1">{snap.signal_deconstruction.workflow_stress_indicators.map((w, i) => <li key={i} className="text-sm flex items-start gap-2"><AlertCircle className="w-3.5 h-3.5 text-destructive mt-0.5 flex-shrink-0" />{w}</li>)}</ul>
                      </div>
                    ) : null}
                  </div>
                </AccordionContent>
              </AccordionItem>
            )}

            {/* 2. Operational Friction */}
            {snap.operational_friction?.length ? (
              <AccordionItem value="operational-friction" className="border rounded-lg px-4">
                <AccordionTrigger className="text-sm font-medium">
                  <div className="flex items-center gap-2"><Zap className="w-4 h-4 text-primary" /> Operational Friction</div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-3">
                    {snap.operational_friction.map((f, i) => (
                      <div key={i} className="bg-secondary/50 rounded-lg p-3 space-y-1">
                        <div className="text-sm"><span className="font-medium text-foreground">Cause:</span> <span className="text-foreground/80">{f.cause}</span></div>
                        <div className="text-sm"><span className="font-medium text-foreground">→ Effect:</span> <span className="text-foreground/80">{f.effect}</span></div>
                        <div className="text-sm"><span className="font-medium text-foreground">→ Bottleneck:</span> <span className="text-foreground/80">{f.bottleneck}</span></div>
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ) : null}

            {/* 3. Partner Platform Ceiling */}
            {snap.partner_platform_ceiling && (
              <AccordionItem value="partner-ceiling" className="border rounded-lg px-4">
                <AccordionTrigger className="text-sm font-medium">
                  <div className="flex items-center gap-2"><TrendingUp className="w-4 h-4 text-primary" /> Partner Platform Ceiling</div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-4">
                    {snap.partner_platform_ceiling.platform_strengths?.length ? (
                      <div>
                        <div className="text-xs font-mono text-muted-foreground mb-2">Platform Strengths</div>
                        <div className="flex flex-wrap gap-1.5">{snap.partner_platform_ceiling.platform_strengths.map((s, i) => <span key={i} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">{s}</span>)}</div>
                      </div>
                    ) : null}
                    {snap.partner_platform_ceiling.execution_gaps?.length ? (
                      <div>
                        <div className="text-xs font-mono text-muted-foreground mb-2">Execution Gaps</div>
                        <ul className="space-y-1">{snap.partner_platform_ceiling.execution_gaps.map((g, i) => <li key={i} className="text-sm flex items-start gap-2"><span className="text-destructive">✕</span>{g}</li>)}</ul>
                      </div>
                    ) : null}
                    {snap.partner_platform_ceiling.key_insight && (
                      <div className="bg-primary/5 border border-primary/20 rounded p-3 text-sm italic text-foreground/90">{snap.partner_platform_ceiling.key_insight}</div>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            )}

            {/* 4. Embedded iorad Leverage */}
            {snap.embedded_leverage && (
              <AccordionItem value="embedded-leverage" className="border rounded-lg px-4">
                <AccordionTrigger className="text-sm font-medium">
                  <div className="flex items-center gap-2"><Zap className="w-4 h-4 text-primary" /> Embedded iorad Leverage</div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {(["situation", "constraint", "intervention", "transformation"] as const).map(key => {
                      const val = snap.embedded_leverage?.[key];
                      if (!val) return null;
                      const labels: Record<string, string> = { situation: "Situation", constraint: "Constraint", intervention: "Intervention", transformation: "Transformation" };
                      return (
                        <div key={key} className="bg-secondary/50 rounded-lg p-3">
                          <div className="text-xs font-mono text-muted-foreground mb-1">{labels[key]}</div>
                          <p className="text-sm text-foreground/90">{val}</p>
                        </div>
                      );
                    })}
                  </div>
                </AccordionContent>
              </AccordionItem>
            )}

            {/* 5. Quantified Impact */}
            {snap.quantified_impact?.length ? (
              <AccordionItem value="quantified-impact" className="border rounded-lg px-4">
                <AccordionTrigger className="text-sm font-medium">
                  <div className="flex items-center gap-2"><BarChart3 className="w-4 h-4 text-primary" /> Quantified Impact</div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-3">
                    {snap.quantified_impact.map((q, i) => (
                      <div key={i} className="border rounded-lg p-3 space-y-2">
                        <div className="font-medium text-sm text-foreground">{q.metric}</div>
                        <div className="text-xs text-muted-foreground"><span className="font-mono">Assumptions:</span> {q.assumptions}</div>
                        <div className="text-xs font-mono bg-secondary/50 rounded p-2 text-foreground/80">{q.calculation}</div>
                        <div className="text-sm font-bold text-primary">{q.result}</div>
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ) : null}

            {/* 6. Executive Narrative */}
            {snap.executive_narrative && (
              <AccordionItem value="executive-narrative" className="border rounded-lg px-4">
                <AccordionTrigger className="text-sm font-medium">
                  <div className="flex items-center gap-2"><FileText className="w-4 h-4 text-primary" /> Executive Narrative</div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    {snap.executive_narrative.split("\n\n").map((p, i) => (
                      <p key={i} className="text-sm text-foreground/90 leading-relaxed mb-3">{p}</p>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            )}

            {/* 7. Outbound Positioning */}
            {snap.outbound_positioning && (
              <AccordionItem value="outbound-positioning" className="border rounded-lg px-4">
                <AccordionTrigger className="text-sm font-medium">
                  <div className="flex items-center gap-2"><MessageSquareQuote className="w-4 h-4 text-primary" /> Outbound Positioning</div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-3">
                    {snap.outbound_positioning.executive_framing && (
                      <div className="border-l-2 border-primary/40 pl-3">
                        <div className="text-xs font-mono text-muted-foreground mb-1">Executive Framing</div>
                        <p className="text-sm text-foreground/90 italic">"{snap.outbound_positioning.executive_framing}"</p>
                      </div>
                    )}
                    {snap.outbound_positioning.efficiency_framing && (
                      <div className="border-l-2 border-primary/40 pl-3">
                        <div className="text-xs font-mono text-muted-foreground mb-1">Efficiency / Revenue</div>
                        <p className="text-sm text-foreground/90 italic">"{snap.outbound_positioning.efficiency_framing}"</p>
                      </div>
                    )}
                    {snap.outbound_positioning.risk_framing && (
                      <div className="border-l-2 border-primary/40 pl-3">
                        <div className="text-xs font-mono text-muted-foreground mb-1">Risk Mitigation</div>
                        <p className="text-sm text-foreground/90 italic">"{snap.outbound_positioning.risk_framing}"</p>
                      </div>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            )}

            {/* 8. Competitive Insulation */}
            {snap.competitive_insulation?.length ? (
              <AccordionItem value="competitive-insulation" className="border rounded-lg px-4">
                <AccordionTrigger className="text-sm font-medium">
                  <div className="flex items-center gap-2"><Shield className="w-4 h-4 text-primary" /> Competitive Insulation</div>
                </AccordionTrigger>
                <AccordionContent>
                  <ul className="space-y-1.5">{snap.competitive_insulation.map((r, i) => <li key={i} className="text-sm flex items-start gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-primary mt-0.5 flex-shrink-0" />{r}</li>)}</ul>
                </AccordionContent>
              </AccordionItem>
            ) : null}

            {/* Evidence */}
            {snap.evidence?.length ? (
              <AccordionItem value="evidence" className="border rounded-lg px-4">
                <AccordionTrigger className="text-sm font-medium">
                  <div className="flex items-center gap-2"><ExternalLink className="w-4 h-4 text-primary" /> Cited Evidence ({snap.evidence.length})</div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-2">
                    {snap.evidence.map((ev, i) => (
                      <div key={i} className="text-xs border-l-2 border-primary/40 pl-3 py-1">
                        <p className="text-foreground/80 italic">"{ev.snippet || ev.detail || ""}"</p>
                        <a href={ev.source_url || ev.url || "#"} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1 mt-0.5">
                          <ExternalLink className="w-3 h-3" /> {ev.source_type || ev.signal_type || "source"} · {ev.date || "no date"}
                        </a>
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ) : null}
          </Accordion>
        </div>
      )}

      {/* Snapshot History */}
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
    </div>
  );
}
