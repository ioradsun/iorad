// Contact activity score — computed client-side from HubSpot properties.
// Focused on iorad product usage, not generic HubSpot engagement.
// Returns 0-100 score + tier label. No API calls.

export interface ContactScore {
  score: number;
  tier: "active" | "engaged" | "viewer" | "none";
  label: string;
}

export function scoreContact(hubspotProperties: Record<string, any> | null): ContactScore {
  if (!hubspotProperties) return { score: 0, tier: "none", label: "" };

  const hp = hubspotProperties;
  let score = 0;

  // ── Tutorial Creation (max 40) — the strongest signal ──────────
  const isCreator = !!hp.first_tutorial_create_date;
  if (isCreator) {
    score += 25;

    // Recency bonus
    const createDate = new Date(hp.first_tutorial_create_date).getTime();
    const daysSince = (Date.now() - createDate) / (1000 * 60 * 60 * 24);
    if (daysSince <= 14) score += 15;
    else if (daysSince <= 60) score += 10;
    else score += 5;
  }

  // ── Tutorial Viewing (max 15) ──────────────────────────────────
  const isViewer = !!(hp.first_tutorial_view_date || hp.first_tutorial_learn_date);
  if (isViewer) {
    score += 10;
    const viewDate = new Date(hp.first_tutorial_view_date || hp.first_tutorial_learn_date).getTime();
    const daysSince = (Date.now() - viewDate) / (1000 * 60 * 60 * 24);
    if (daysSince <= 30) score += 5;
  }

  // ── Extension Installed (max 10) ───────────────────────────────
  const hasExtension = parseInt(hp.extension_connections || "0", 10) > 0;
  if (hasExtension) score += 10;

  // ── Monthly Active Usage (max 15) ──────────────────────────────
  const monthlyAnswers = parseInt(hp.answers_with_own_tutorial_month_count || "0", 10) || 0;
  if (monthlyAnswers >= 10) score += 15;
  else if (monthlyAnswers >= 5) score += 10;
  else if (monthlyAnswers > 0) score += 5;

  // ── Previous Month Activity (max 10) — retention signal ────────
  const prevMonthAnswers = parseInt(hp.answers_with_own_tutorial_previous_month_count || "0", 10) || 0;
  if (prevMonthAnswers > 0) score += 10;

  // ── Plan / Account Type (max 10) ──────────────────────────────
  const plan = (hp.plan_name || "").toLowerCase();
  if (plan.includes("enterprise") || plan.includes("premium")) score += 10;
  else if (plan.includes("pro") || plan.includes("team")) score += 5;

  const finalScore = Math.min(100, score);

  // ── Tier assignment ────────────────────────────────────────────
  if (finalScore >= 50) return { score: finalScore, tier: "active", label: "Active" };
  if (finalScore >= 25) return { score: finalScore, tier: "engaged", label: "Engaged" };
  if (finalScore >= 10) return { score: finalScore, tier: "viewer", label: "Viewer" };
  return { score: finalScore, tier: "none", label: "" };
}

// Sort contacts by score descending (most active first)
export function sortContactsByActivity(contacts: any[]): any[] {
  return [...contacts].sort((a, b) => {
    const aScore = scoreContact((a.hubspot_properties as any) || null).score;
    const bScore = scoreContact((b.hubspot_properties as any) || null).score;
    return bScore - aScore;
  });
}
