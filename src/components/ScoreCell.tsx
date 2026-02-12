interface ScoreCellProps {
  score: number | null;
  size?: "sm" | "lg";
}

export default function ScoreCell({ score, size = "sm" }: ScoreCellProps) {
  if (score === null) return <span className="text-muted-foreground text-xs">—</span>;
  const cls = score >= 60 ? "score-badge-high" : score >= 40 ? "score-badge-medium" : "score-badge-low";
  return (
    <span className={`score-badge ${cls} ${size === "lg" ? "text-lg px-3 py-1" : ""}`}>
      {score}
    </span>
  );
}
