import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Brain, ExternalLink } from "lucide-react";
import { TruthBadge } from "./TruthBadge";
import type { DashboardCard } from "./types";

export function DashboardCardUI({ card }: { card: DashboardCard }) {
  if (card.id === "ai_strategy" && card.strategies?.length) {
    return (
      <Card className="col-span-1 lg:col-span-2">
        <CardHeader className="pb-3">
          <CardTitle className="text-[14px] font-semibold flex items-center gap-2">
            <Brain className="w-4 h-4 text-primary" />
            {card.title}
            <Badge variant="outline" className="text-[11px] ml-auto">{card.priority}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {card.strategies.map((s, i) => (
            <div key={i} className="border rounded-lg p-4 space-y-2.5">
              <div className="font-semibold text-[14px]">{s.title}</div>
              <p className="text-[13px] text-muted-foreground leading-relaxed">{s.pitch}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[13px]">
                <div><span className="font-mono text-muted-foreground text-[11px] uppercase tracking-widest">Why now:</span> <span className="text-foreground/80">{s.why_now}</span></div>
                <div><span className="font-mono text-muted-foreground text-[11px] uppercase tracking-widest">Proof:</span> <span className="text-foreground/80">{s.proof}</span></div>
              </div>
              {s.what_to_validate?.length > 0 && (
                <div className="text-[13px]">
                  <span className="font-mono text-muted-foreground text-[11px] uppercase tracking-widest">Validate:</span>
                  <ul className="mt-1.5 space-y-1">{s.what_to_validate.map((q, j) => <li key={j} className="text-foreground/70 flex gap-1.5"><span className="text-primary">•</span>{q}</li>)}</ul>
                </div>
              )}
              {s.sources?.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {s.sources.map((url, j) => (
                    <a key={j} href={url} target="_blank" rel="noopener noreferrer" className="text-[11px] text-primary hover:underline flex items-center gap-0.5">
                      <ExternalLink className="w-3 h-3" /> Source
                    </a>
                  ))}
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-[14px] font-semibold flex items-center gap-2">
          {card.title}
          <Badge variant="outline" className="text-[11px] ml-auto">{card.priority}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {card.fields?.length ? (
          <div className="space-y-2.5">
            {card.fields.map((f, i) => (
              <div key={i} className="flex items-start justify-between gap-2 text-[13px]">
                <div className="flex-1">
                  <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">{f.label}:</span>{" "}
                  <span className="text-foreground/90">{f.value}</span>
                </div>
                <TruthBadge status={f.status} source={f.source} />
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[13px] text-muted-foreground">No data</p>
        )}
      </CardContent>
    </Card>
  );
}
