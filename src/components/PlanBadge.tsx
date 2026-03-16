export function PlanBadge({ plan }: { plan: string | null }) {
  if (!plan) return null;
  const styles: Record<string, string> = {
    Enterprise: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    Team:       "bg-blue-500/10 text-blue-400 border-blue-500/20",
    Free:       "bg-muted text-muted-foreground border-border",
  };
  return (
    <span className={`inline-flex items-center text-micro font-medium px-2 py-0.5 rounded border ${styles[plan] || styles.Free}`}>
      {plan}
    </span>
  );
}
