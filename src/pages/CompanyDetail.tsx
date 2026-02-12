import { useParams, Link } from "react-router-dom";
import { mockCompanies, mockSignals, mockSnapshots } from "@/data/mockData";
import ScoreCell from "@/components/ScoreCell";
import StatusBadge from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, RefreshCw, RotateCcw, ExternalLink, Briefcase, Newspaper, CheckCircle2, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";

export default function CompanyDetail() {
  const { id } = useParams<{ id: string }>();
  const company = mockCompanies.find(c => c.id === id);

  if (!company) {
    return (
      <div className="text-center py-20">
        <h2 className="text-xl font-bold">Company not found</h2>
        <Link to="/" className="text-primary text-sm mt-2 inline-block">← Back to Dashboard</Link>
      </div>
    );
  }

  const signals = mockSignals.filter(s => s.company_id === company.id);
  const snapshots = mockSnapshots.filter(s => s.company_id === company.id);
  const latestSnapshot = snapshots[0];
  const bd = company.score_breakdown;

  const ruleLabels: Record<string, string> = {
    onboarding_mention: "Onboarding keyword detected",
    enablement_mention: "Enablement keyword detected",
    customer_education_mention: "Customer education keyword detected",
    knowledge_base_mention: "Knowledge base keyword detected",
    self_serve_mention: "Self-serve keyword detected",
    recent_job: "Job posted within 30 days",
    multiple_roles: "2+ related roles found",
    news_signal: "Recent news signal found",
    senior_title: "Senior title (Manager+)",
    buyer_org: "Buyer org function match",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link to="/" className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{company.name}</h1>
            <p className="text-sm text-muted-foreground font-mono">{company.domain}</p>
          </div>
          <ScoreCell score={company.last_score_total} size="lg" />
          <StatusBadge status={company.snapshot_status} />
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5 text-xs">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh Signals
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs">
            <RotateCcw className="w-3.5 h-3.5" /> Recalculate Score
          </Button>
          <Button size="sm" className="gap-1.5 text-xs">
            <RotateCcw className="w-3.5 h-3.5" /> Regenerate Snapshot
          </Button>
        </div>
      </div>

      <div className="glow-line" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Score Breakdown */}
        <div className="panel lg:col-span-1">
          <div className="panel-header">Score Breakdown</div>
          {bd ? (
            <div className="space-y-4">
              {[
                { label: "Relevance", value: bd.relevance, max: 50 },
                { label: "Urgency", value: bd.urgency, max: 30 },
                { label: "Buyer Signal", value: bd.buyer_signal, max: 20 },
              ].map(({ label, value, max }) => (
                <div key={label}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="font-mono font-bold text-foreground">{value}/{max}</span>
                  </div>
                  <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(value / max) * 100}%` }}
                      transition={{ duration: 0.8, ease: "easeOut" }}
                      className="h-full bg-primary rounded-full"
                    />
                  </div>
                </div>
              ))}
              <div className="border-t pt-3 mt-3">
                <div className="panel-header">Rules Fired</div>
                <div className="space-y-1.5">
                  {bd.rules_fired.map(rule => (
                    <div key={rule} className="flex items-center gap-2 text-xs">
                      <CheckCircle2 className="w-3 h-3 text-primary flex-shrink-0" />
                      <span className="text-muted-foreground">{ruleLabels[rule] || rule}</span>
                    </div>
                  ))}
                </div>
              </div>
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
              {signals.map(signal => (
                <div key={signal.id} className="border rounded-md p-3 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      {signal.type === "job" ? (
                        <Briefcase className="w-4 h-4 text-info flex-shrink-0" />
                      ) : (
                        <Newspaper className="w-4 h-4 text-warning flex-shrink-0" />
                      )}
                      <div>
                        <div className="text-sm font-medium">{signal.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {signal.date || "No date"} · {signal.type}
                        </div>
                      </div>
                    </div>
                    <a href={signal.url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary flex-shrink-0">
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{signal.raw_excerpt}</p>
                  {signal.evidence_snippets.length > 0 && (
                    <div className="space-y-1 pt-1 border-t border-border/50">
                      <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Evidence Snippets</div>
                      {signal.evidence_snippets.map((snippet, i) => (
                        <div key={i} className="text-xs text-accent-foreground bg-accent/20 rounded px-2 py-1.5 border-l-2 border-primary/40">
                          "{snippet}"
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Snapshot */}
      {latestSnapshot?.snapshot_json && (
        <div className="panel">
          <div className="panel-header flex items-center justify-between">
            <span>Deal Signal Snapshot</span>
            <span className="text-[10px] text-muted-foreground normal-case tracking-normal">
              {latestSnapshot.model_version} · {latestSnapshot.prompt_version} · {new Date(latestSnapshot.created_at).toLocaleDateString()}
            </span>
          </div>
          <div className="space-y-5">
            {/* Trigger Summary */}
            <div>
              <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-1">Trigger Summary</div>
              <p className="text-sm text-foreground leading-relaxed">{latestSnapshot.snapshot_json.trigger_summary}</p>
            </div>

            {/* Why Now */}
            <div>
              <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-2">Why Now</div>
              <ul className="space-y-1.5">
                {latestSnapshot.snapshot_json.why_now.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className="text-primary mt-0.5">→</span>
                    <span className="text-foreground/90">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Initiative + Targets */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-1">Likely Initiative</div>
                <p className="text-sm text-foreground/90">{latestSnapshot.snapshot_json.likely_initiative}</p>
              </div>
              <div>
                <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-2">Target Personas</div>
                <div className="flex flex-wrap gap-1.5">
                  {latestSnapshot.snapshot_json.suggested_persona_targets.map((p, i) => (
                    <span key={i} className="text-xs bg-secondary px-2 py-0.5 rounded text-secondary-foreground">{p}</span>
                  ))}
                </div>
              </div>
            </div>

            {/* Confidence */}
            <div className="flex items-start gap-3 bg-secondary/50 rounded p-3">
              <AlertCircle className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
              <div>
                <div className="text-xs font-mono font-bold text-primary">{latestSnapshot.snapshot_json.confidence_level} Confidence</div>
                <p className="text-xs text-muted-foreground mt-0.5">{latestSnapshot.snapshot_json.confidence_reason}</p>
              </div>
            </div>

            {/* Evidence */}
            <div>
              <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-2">Cited Evidence</div>
              <div className="space-y-2">
                {latestSnapshot.snapshot_json.evidence.map((ev, i) => (
                  <div key={i} className="text-xs border-l-2 border-primary/40 pl-3 py-1">
                    <p className="text-foreground/80 italic">"{ev.snippet}"</p>
                    <a href={ev.source_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1 mt-0.5">
                      <ExternalLink className="w-3 h-3" /> {ev.source_type} · {ev.date || "no date"}
                    </a>
                  </div>
                ))}
              </div>
            </div>

            {/* Missing Data */}
            {latestSnapshot.snapshot_json.missing_data_questions.length > 0 && (
              <div>
                <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-2">Missing Data Questions</div>
                <ul className="space-y-1">
                  {latestSnapshot.snapshot_json.missing_data_questions.map((q, i) => (
                    <li key={i} className="text-xs text-muted-foreground">• {q}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Snapshot History */}
      <div className="panel">
        <div className="panel-header">Snapshot History</div>
        {snapshots.length === 0 ? (
          <p className="text-sm text-muted-foreground">No snapshots generated yet.</p>
        ) : (
          <div className="space-y-2">
            {snapshots.map(snap => (
              <div key={snap.id} className="flex items-center justify-between text-sm border rounded px-3 py-2">
                <div className="flex items-center gap-3">
                  <ScoreCell score={snap.score_total} />
                  <span className="font-mono text-xs text-muted-foreground">{snap.model_version}</span>
                </div>
                <span className="text-xs text-muted-foreground">{new Date(snap.created_at).toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
