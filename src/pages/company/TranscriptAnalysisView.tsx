import { Badge } from "@/components/ui/badge";

export function TranscriptAnalysisView({ analysis }: { analysis: any }) {
  if (!analysis) return null;
  if (analysis.raw_text) {
    return <pre className="text-xs whitespace-pre-wrap text-foreground/80 font-sans leading-relaxed">{analysis.raw_text}</pre>;
  }

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="mb-4">
      <div className="text-[11px] font-mono uppercase tracking-widest text-primary mb-2">{title}</div>
      {children}
    </div>
  );

  const BulletList = ({ items }: { items: any[] }) => (
    <ul className="space-y-1.5">
      {items.map((item: any, i: number) => (
        <li key={i} className="text-[13px] text-foreground/80 flex items-start gap-1.5 leading-relaxed">
          <span className="text-primary mt-0.5">•</span>
          <span>{typeof item === "string" ? item : JSON.stringify(item)}</span>
        </li>
      ))}
    </ul>
  );

  return (
    <div className="space-y-3 pr-2">
      {analysis.executive_snapshot && <Section title="Executive Snapshot"><BulletList items={analysis.executive_snapshot} /></Section>}
      {analysis.compelling_events?.length > 0 && (
        <Section title="Compelling Events">
          {analysis.compelling_events.map((ev: any, i: number) => (
            <div key={i} className="text-xs mb-2 border-l-2 border-primary/30 pl-2">
              <div className="font-medium text-foreground">{ev.event}</div>
              {ev.timeline && <div className="text-muted-foreground">Timeline: {ev.timeline}</div>}
              {ev.implication && <div className="text-foreground/70">→ {ev.implication}</div>}
            </div>
          ))}
        </Section>
      )}
      {analysis.stated_initiatives?.length > 0 && (
        <Section title="Stated Initiatives">
          {analysis.stated_initiatives.map((init: any, i: number) => (
            <div key={i} className="text-xs mb-2 border-l-2 border-primary/30 pl-2">
              <div className="font-medium text-foreground">{init.initiative}</div>
              {init.owner && <div className="text-muted-foreground">Owner: {init.owner}</div>}
              {init.urgency && <Badge variant="outline" className="text-[9px] h-4">{init.urgency}</Badge>}
              {init.iorad_fit && <div className="text-foreground/70 mt-0.5">iorad fit: {init.iorad_fit}</div>}
            </div>
          ))}
        </Section>
      )}
      {analysis.usage_analysis && (
        <Section title="iorad Usage Analysis">
          <div className="text-xs space-y-1 text-foreground/80">
            {analysis.usage_analysis.maturity && <div><span className="text-muted-foreground">Maturity:</span> {analysis.usage_analysis.maturity}</div>}
            {analysis.usage_analysis.use_cases && <div><span className="text-muted-foreground">Use cases:</span> {Array.isArray(analysis.usage_analysis.use_cases) ? analysis.usage_analysis.use_cases.join(", ") : analysis.usage_analysis.use_cases}</div>}
            {analysis.usage_analysis.double_usage_answer && <div className="mt-1 italic text-foreground/70">{analysis.usage_analysis.double_usage_answer}</div>}
          </div>
        </Section>
      )}
      {analysis.power_map?.length > 0 && (
        <Section title="Power Map">
          {analysis.power_map.map((p: any, i: number) => (
            <div key={i} className="text-xs mb-1.5 flex items-start gap-2">
              <span className="font-medium text-foreground min-w-[80px]">{p.name || p.role}</span>
              <span className="text-muted-foreground">{p.role}{p.influence ? ` · ${p.influence}` : ""}{p.sentiment ? ` · ${p.sentiment}` : ""}</span>
            </div>
          ))}
        </Section>
      )}
      {analysis.risk_assessment && (
        <Section title="Risk Assessment">
          <div className="text-xs text-foreground/80">
            <div className="font-medium">Churn Risk: <span className={analysis.risk_assessment.churn_risk === "High" ? "text-destructive" : analysis.risk_assessment.churn_risk === "Medium" ? "text-warning" : "text-primary"}>{analysis.risk_assessment.churn_risk}</span></div>
            {analysis.risk_assessment.churn_reason && <div className="mt-0.5 text-muted-foreground">{analysis.risk_assessment.churn_reason}</div>}
            {analysis.risk_assessment.signals && <BulletList items={analysis.risk_assessment.signals} />}
          </div>
        </Section>
      )}
      {analysis.expansion_angles?.length > 0 && (
        <Section title="Expansion Angles">
          {analysis.expansion_angles.map((a: any, i: number) => (
            <div key={i} className="text-xs mb-1.5 border-l-2 border-primary/30 pl-2">
              <div className="font-medium text-foreground">{a.angle}</div>
              {a.details && <div className="text-foreground/70">{a.details}</div>}
            </div>
          ))}
        </Section>
      )}
      {analysis.messaging_strategy && (
        <Section title="Messaging Strategy">
          <div className="text-xs space-y-2 text-foreground/80">
            {analysis.messaging_strategy.positioning_angles && <div><span className="text-muted-foreground font-medium">Positioning:</span><BulletList items={analysis.messaging_strategy.positioning_angles} /></div>}
            {analysis.messaging_strategy.questions && <div><span className="text-muted-foreground font-medium">Questions:</span><BulletList items={analysis.messaging_strategy.questions} /></div>}
            {analysis.messaging_strategy.renewal_storyline && <div><span className="text-muted-foreground font-medium">Renewal:</span> {analysis.messaging_strategy.renewal_storyline}</div>}
          </div>
        </Section>
      )}
      {analysis.action_plan && (
        <Section title="30-60-90 Day Plan">
          <div className="text-xs space-y-2">
            {analysis.action_plan.day_30 && <div><span className="text-muted-foreground font-medium">30 Days:</span><BulletList items={analysis.action_plan.day_30} /></div>}
            {analysis.action_plan.day_60 && <div><span className="text-muted-foreground font-medium">60 Days:</span><BulletList items={analysis.action_plan.day_60} /></div>}
            {analysis.action_plan.day_90 && <div><span className="text-muted-foreground font-medium">90 Days:</span><BulletList items={analysis.action_plan.day_90} /></div>}
          </div>
        </Section>
      )}
      {analysis.account_thesis && (
        <Section title="Account Thesis">
          <p className="text-xs font-medium text-foreground italic">"{analysis.account_thesis}"</p>
        </Section>
      )}
    </div>
  );
}
