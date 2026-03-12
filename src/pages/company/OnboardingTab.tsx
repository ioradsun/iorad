import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertTriangle,
  ArrowRight,
  Brain,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  Flag,
  Loader2,
  Rocket,
  Shield,
  Sparkles,
  Target,
  TrendingUp,
  User,
  Users,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

interface OnboardingTabProps {
  meetings: any[];
  analyzingMeeting: string | null;
  onAnalyze: (meetingId: string) => void;
}

/* ---------- health helpers ---------- */
const healthColor = (health?: string) => {
  if (!health) return "bg-muted text-foreground/45";
  const h = health.toLowerCase();
  if (h.includes("green")) return "bg-emerald-500/10 text-emerald-600 border-emerald-500/20";
  if (h.includes("yellow")) return "bg-amber-500/10 text-amber-600 border-amber-500/20";
  if (h.includes("red")) return "bg-destructive/10 text-destructive border-destructive/20";
  return "bg-muted text-foreground/45";
};

const urgencyColor = (u?: string) => {
  if (!u) return "outline";
  const l = u.toLowerCase();
  if (l === "high") return "destructive" as const;
  if (l === "medium") return "secondary" as const;
  return "outline" as const;
};

const riskColor = (r?: string) => {
  if (!r) return "text-foreground/45";
  const l = r.toLowerCase();
  if (l === "high") return "text-destructive";
  if (l === "medium") return "text-amber-600";
  return "text-emerald-600";
};

/* ---------- small reusable pieces ---------- */
function SectionHeader({ icon: Icon, title, subtitle }: { icon: any; title: string; subtitle?: string }) {
  return (
    <div className="flex items-start gap-3 mb-4">
      <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <h3 className="text-body font-semibold text-foreground leading-tight">{title}</h3>
        {subtitle && <p className="text-caption text-foreground/45 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="p-4 rounded-full bg-muted mb-4">
        <Brain className="w-8 h-8 text-foreground/45" />
      </div>
      <h3 className="text-title font-semibold text-foreground mb-1">No analysis yet</h3>
      <p className="text-body text-foreground/45 max-w-sm leading-relaxed">
        Run a transcript analysis on one of the meetings from the Company tab first. The strategic intelligence will appear here.
      </p>
    </div>
  );
}

/* ========== MAIN COMPONENT ========== */
export default function OnboardingTab({ meetings, analyzingMeeting, onAnalyze }: OnboardingTabProps) {
  // Find the most recent meeting with transcript_analysis
  const analyzed = meetings.filter((m: any) => m.transcript_analysis);
  const latest = analyzed[0]; // already sorted desc
  const analysis = latest?.transcript_analysis as any;

  if (!analysis) return <EmptyState />;

  // Extract health from executive_snapshot bullets
  const healthBullet = (analysis.executive_snapshot || []).find((b: string) =>
    typeof b === "string" && /green|yellow|red/i.test(b)
  );
  const healthSignal = healthBullet
    ? healthBullet.match(/(green|yellow|red)/i)?.[1] || ""
    : "";

  const fadeUp = {
    hidden: { opacity: 0, y: 12 },
    visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.04, duration: 0.3 } }),
  };

  return (
    <div className="space-y-8 mt-6">
      {/* Meeting source badge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-caption gap-1">
            <Clock className="w-3 h-3" />
            {latest.title}
          </Badge>
          {latest.meeting_date && (
            <span className="text-caption text-foreground/45">
              {new Date(latest.meeting_date).toLocaleDateString()}
            </span>
          )}
        </div>
        <Button
          size="sm" variant="outline" className="gap-1.5 text-caption"
          onClick={() => onAnalyze(latest.id)}
          disabled={!!analyzingMeeting}
        >
          {analyzingMeeting === latest.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
          Re-analyze
        </Button>
      </div>

      {/* ===== 1. EXECUTIVE SNAPSHOT ===== */}
      {analysis.executive_snapshot?.length > 0 && (
        <motion.section initial="hidden" animate="visible" variants={fadeUp} custom={0}>
          <SectionHeader icon={Target} title="Executive Snapshot" subtitle="High-level account overview" />
          <Card>
            <CardContent className="p-5">
              {healthSignal && (
                <div className="mb-4">
                  <Badge className={`${healthColor(healthSignal)} text-xs px-3 py-1 border`}>
                    Account Health: {healthSignal.charAt(0).toUpperCase() + healthSignal.slice(1)}
                  </Badge>
                </div>
              )}
              <ul className="space-y-2.5">
                {analysis.executive_snapshot.map((bullet: string, i: number) => (
                  <li key={i} className="flex items-start gap-2.5 text-body text-foreground/65 leading-relaxed">
                    <ChevronRight className="w-3.5 h-3.5 text-primary mt-1 shrink-0" />
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </motion.section>
      )}

      {/* ===== 2. COMPELLING EVENTS ===== */}
      {analysis.compelling_events?.length > 0 && (
        <motion.section initial="hidden" animate="visible" variants={fadeUp} custom={1}>
          <SectionHeader icon={Calendar} title="Compelling Events" subtitle="Time-sensitive triggers to act on" />
          <div className="grid gap-4 sm:grid-cols-2">
            {analysis.compelling_events.map((ev: any, i: number) => (
                <Card key={i} className="border-l border-l-primary/20">
                <CardContent className="p-4 space-y-1.5">
                  <p className="text-body font-medium text-foreground">{ev.event}</p>
                  {ev.timeline && (
                    <div className="flex items-center gap-1.5 text-caption text-foreground/45">
                      <Clock className="w-3 h-3" /> {ev.timeline}
                    </div>
                  )}
                  {ev.implication && (
                    <p className="text-caption text-foreground/65 flex items-start gap-1.5">
                      <ArrowRight className="w-3 h-3 mt-0.5 text-primary shrink-0" />
                      {ev.implication}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </motion.section>
      )}

      {/* ===== 3. STATED INITIATIVES ===== */}
      {analysis.stated_initiatives?.length > 0 && (
        <motion.section initial="hidden" animate="visible" variants={fadeUp} custom={2}>
          <SectionHeader icon={Flag} title="Company Initiatives" subtitle="Where iorad fits in their priorities" />
          <div className="space-y-4">
            {analysis.stated_initiatives.map((init: any, i: number) => (
              <Card key={i}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 flex-1">
                      <p className="text-body font-medium text-foreground">{init.initiative}</p>
                      {init.owner && (
                        <p className="text-caption text-foreground/45 flex items-center gap-1">
                          <User className="w-3 h-3" /> {init.owner}
                        </p>
                      )}
                      {init.iorad_fit && (
                        <p className="text-caption text-foreground/65 mt-1.5 bg-primary/5 rounded px-2 py-1.5 border border-primary/10">
                          <span className="font-medium text-primary">iorad fit:</span> {init.iorad_fit}
                        </p>
                      )}
                    </div>
                    {init.urgency && (
                      <Badge variant={urgencyColor(init.urgency)} className="text-micro shrink-0">
                        {init.urgency}
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </motion.section>
      )}

      {/* ===== 4. USAGE ANALYSIS ===== */}
      {analysis.usage_analysis && (
        <motion.section initial="hidden" animate="visible" variants={fadeUp} custom={3}>
          <SectionHeader icon={Zap} title="iorad Usage Analysis" subtitle="Current adoption and growth potential" />
          <Card>
            <CardContent className="p-5 space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {analysis.usage_analysis.maturity && (
                  <div className="bg-secondary/40 rounded-lg p-4 text-center">
                    <p className="section-label mb-1">Maturity</p>
                    <p className="text-body font-semibold text-foreground">{analysis.usage_analysis.maturity}</p>
                  </div>
                )}
                {analysis.usage_analysis.who_uses && (
                  <div className="bg-secondary/40 rounded-lg p-4 text-center">
                    <p className="section-label mb-1">Users</p>
                    <p className="text-body font-semibold text-foreground">{typeof analysis.usage_analysis.who_uses === "string" ? analysis.usage_analysis.who_uses : Array.isArray(analysis.usage_analysis.who_uses) ? analysis.usage_analysis.who_uses.join(", ") : "—"}</p>
                  </div>
                )}
              </div>

              {analysis.usage_analysis.use_cases && (
                <div>
                  <p className="text-caption font-medium text-foreground/45 mb-1.5">Current Use Cases</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(Array.isArray(analysis.usage_analysis.use_cases) ? analysis.usage_analysis.use_cases : [analysis.usage_analysis.use_cases]).map((uc: string, i: number) => (
                      <Badge key={i} variant="outline" className="text-caption">{uc}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {analysis.usage_analysis.adoption_blockers && (
                <div>
                  <p className="text-caption font-medium text-destructive/80 mb-1.5">Adoption Blockers</p>
                  <ul className="space-y-1.5">
                    {(Array.isArray(analysis.usage_analysis.adoption_blockers) ? analysis.usage_analysis.adoption_blockers : [analysis.usage_analysis.adoption_blockers]).map((b: string, i: number) => (
                      <li key={i} className="text-caption text-foreground/65 flex items-start gap-1.5">
                        <AlertTriangle className="w-3 h-3 text-destructive mt-0.5 shrink-0" /> {b}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {analysis.usage_analysis.excitement_signals && (
                <div>
                  <p className="text-caption font-medium text-success mb-1.5">Excitement Signals</p>
                  <ul className="space-y-1.5">
                    {(Array.isArray(analysis.usage_analysis.excitement_signals) ? analysis.usage_analysis.excitement_signals : [analysis.usage_analysis.excitement_signals]).map((s: string, i: number) => (
                      <li key={i} className="text-caption text-foreground/65 flex items-start gap-1.5">
                        <CheckCircle2 className="w-3 h-3 text-success mt-0.5 shrink-0" /> {s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {analysis.usage_analysis.double_usage_answer && (
                <div className="bg-primary/5 border border-primary/15 rounded-lg p-4">
                  <p className="section-label text-primary mb-1">If usage doubled in 6 months…</p>
                  <p className="text-body text-foreground/65 italic leading-relaxed">{analysis.usage_analysis.double_usage_answer}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.section>
      )}

      {/* ===== 5. POWER MAP ===== */}
      {analysis.power_map?.length > 0 && (
        <motion.section initial="hidden" animate="visible" variants={fadeUp} custom={4}>
          <SectionHeader icon={Users} title="Power Map" subtitle="Key stakeholders and their stance" />
          <div className="grid gap-4 sm:grid-cols-2">
            {analysis.power_map.map((p: any, i: number) => {
              const sentiment = (p.sentiment || "").toLowerCase();
              const sentimentColor = sentiment.includes("support")
                ? "text-emerald-600"
                : sentiment.includes("risk") || sentiment.includes("block")
                  ? "text-destructive"
                  : "text-foreground/45";
              return (
                <Card key={i}>
                  <CardContent className="p-5 flex items-start gap-3">
                    <div className="p-1.5 rounded-full bg-secondary shrink-0">
                      <User className="w-3.5 h-3.5 text-foreground/60" />
                    </div>
                    <div className="space-y-0.5 flex-1 min-w-0">
                      <p className="text-body font-medium text-foreground truncate">{p.name || p.role}</p>
                      <p className="text-caption text-foreground/45">{p.role}{p.influence ? ` · ${p.influence} influence` : ""}</p>
                      {p.sentiment && <p className={`text-caption font-medium ${sentimentColor}`}>{p.sentiment}</p>}
                      {p.cares_about && <p className="text-caption text-foreground/65 mt-1">Cares about: {p.cares_about}</p>}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </motion.section>
      )}

      {/* ===== 6. RISK ASSESSMENT ===== */}
      {analysis.risk_assessment && (
        <motion.section initial="hidden" animate="visible" variants={fadeUp} custom={5}>
          <SectionHeader icon={Shield} title="Risk Assessment" subtitle="Churn signals and mitigation" />
          <Card>
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center gap-3">
                <span className="text-body font-medium text-foreground">Churn Risk:</span>
                <span className={`text-body font-bold ${riskColor(analysis.risk_assessment.churn_risk)}`}>
                  {analysis.risk_assessment.churn_risk}
                </span>
              </div>
              {analysis.risk_assessment.churn_reason && (
                <p className="text-body text-foreground/65 leading-relaxed">{analysis.risk_assessment.churn_reason}</p>
              )}
              {analysis.risk_assessment.signals?.length > 0 && (
                <ul className="space-y-1.5 mt-2">
                  {analysis.risk_assessment.signals.map((s: string, i: number) => (
                    <li key={i} className="text-caption text-foreground/65 flex items-start gap-2">
                      <AlertTriangle className="w-3 h-3 text-warning mt-0.5 shrink-0" /> {s}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </motion.section>
      )}

      {/* ===== 7. EXPANSION ANGLES ===== */}
      {analysis.expansion_angles?.length > 0 && (
        <motion.section initial="hidden" animate="visible" variants={fadeUp} custom={6}>
          <SectionHeader icon={TrendingUp} title="Expansion & Revenue Angles" subtitle="Concrete upsell paths" />
          <div className="space-y-4">
            {analysis.expansion_angles.map((a: any, i: number) => (
              <Card key={i} className="border-l border-l-success/30">
                <CardContent className="p-5">
                  <p className="text-body font-medium text-foreground">{a.angle || a}</p>
                  {a.details && <p className="text-caption text-foreground/65 mt-1">{a.details}</p>}
                </CardContent>
              </Card>
            ))}
          </div>
        </motion.section>
      )}

      {/* ===== 8. MESSAGING STRATEGY ===== */}
      {analysis.messaging_strategy && (
        <motion.section initial="hidden" animate="visible" variants={fadeUp} custom={7}>
          <SectionHeader icon={Sparkles} title="CS Messaging Strategy" subtitle="Positioning, questions, and renewal story" />
          <Card>
            <CardContent className="p-5 space-y-5">
              {analysis.messaging_strategy.positioning_angles?.length > 0 && (
                <div>
                  <p className="section-label mb-2">Positioning Angles</p>
                  <div className="space-y-2">
                    {analysis.messaging_strategy.positioning_angles.map((a: string, i: number) => (
                      <div key={i} className="flex items-start gap-2 text-body text-foreground/65">
                        <span className="text-primary font-bold text-caption mt-0.5">{i + 1}.</span>
                        <span>{a}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {analysis.messaging_strategy.questions?.length > 0 && (
                <div>
                  <p className="section-label mb-2">Questions for Next Call</p>
                  <div className="space-y-2">
                    {analysis.messaging_strategy.questions.map((q: string, i: number) => (
                      <div key={i} className="bg-secondary/40 rounded-lg px-3 py-2.5 text-body text-foreground/65">
                        "{q}"
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {analysis.messaging_strategy.metrics?.length > 0 && (
                <div>
                  <p className="section-label mb-2">Anchor Metrics</p>
                  <div className="flex flex-wrap gap-2">
                    {analysis.messaging_strategy.metrics.map((m: string, i: number) => (
                      <Badge key={i} variant="secondary" className="text-caption">{m}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {analysis.messaging_strategy.renewal_storyline && (
                <div className="bg-primary/5 border border-primary/15 rounded-lg p-4">
                  <p className="section-label text-primary mb-1">Renewal Storyline</p>
                  <p className="text-body text-foreground/65 italic leading-relaxed">"{analysis.messaging_strategy.renewal_storyline}"</p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.section>
      )}

      {/* ===== 9. 30-60-90 DAY PLAN ===== */}
      {analysis.action_plan && (
        <motion.section initial="hidden" animate="visible" variants={fadeUp} custom={8}>
          <SectionHeader icon={Rocket} title="30-60-90 Day Action Plan" subtitle="Structured CS onboarding roadmap" />
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { key: "day_30", label: "First 30 Days", sublabel: "Tactical moves & relationship building", color: "border-t-primary" },
              { key: "day_60", label: "60 Days", sublabel: "Strategic alignment & enablement", color: "border-t-amber-500" },
              { key: "day_90", label: "90 Days", sublabel: "Executive alignment & expansion", color: "border-t-emerald-500" },
            ].map(({ key, label, sublabel, color }) => {
              const items = analysis.action_plan[key];
              if (!items?.length) return null;
              return (
                <Card key={key} className={`border-t-4 ${color}`}>
                  <CardContent className="p-5 space-y-3">
                    <div>
                      <p className="text-body font-semibold text-foreground">{label}</p>
                      <p className="text-caption text-foreground/45">{sublabel}</p>
                    </div>
                    <Separator />
                    <ul className="space-y-2">
                      {items.map((item: string, i: number) => (
                        <li key={i} className="text-caption text-foreground/65 flex items-start gap-2 leading-relaxed">
                          <CheckCircle2 className="w-3 h-3 text-primary mt-0.5 shrink-0" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </motion.section>
      )}

      {/* ===== 10. ACCOUNT THESIS ===== */}
      {analysis.account_thesis && (
        <motion.section initial="hidden" animate="visible" variants={fadeUp} custom={9}>
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-6 text-center">
              <p className="section-label text-primary mb-4">Account Thesis</p>
              <p className="text-title font-semibold text-foreground leading-relaxed italic max-w-2xl mx-auto">
                "{analysis.account_thesis}"
              </p>
            </CardContent>
          </Card>
        </motion.section>
      )}
    </div>
  );
}
