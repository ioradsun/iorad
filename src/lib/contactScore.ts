export interface ContactActivity {
  score: number;
  tier: "hot" | "warm" | "cool" | "cold" | "none";

  // Recency
  lastActiveDate: Date | null;
  daysSinceActive: number | null;
  recencyLabel: string;

  // iorad usage (real counts from HubSpot)
  isCreator: boolean;
  creatorSince: string | null;
  tutorialsCreated: number;
  tutorialsViewed: number;
  isViewer: boolean;
  viewerSince: string | null;
  hasExtension: boolean;
  monthlyAnswers: number;
  prevMonthAnswers: number;
  totalAnswers: number;

  // Account
  plan: string | null;
  accountType: string | null;
  engagementSegment: string | null;
  documentingProduct: string | null;
  embeddedIn: string | null;
}

function daysSince(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const t = new Date(dateStr).getTime();
  if (isNaN(t)) return null;
  return Math.floor((Date.now() - t) / (1000 * 60 * 60 * 24));
}

function formatDate(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

export function getContactActivity(hp: Record<string, any> | null): ContactActivity {
  const empty: ContactActivity = {
    score: 0,
    tier: "none",
    lastActiveDate: null,
    daysSinceActive: null,
    recencyLabel: "No data",
    isCreator: false,
    creatorSince: null,
    tutorialsCreated: 0,
    tutorialsViewed: 0,
    isViewer: false,
    viewerSince: null,
    hasExtension: false,
    monthlyAnswers: 0,
    prevMonthAnswers: 0,
    totalAnswers: 0,
    plan: null,
    accountType: null,
    engagementSegment: null,
    documentingProduct: null,
    embeddedIn: null,
  };
  if (!hp) return empty;

  const score = Math.min(100, parseInt(String(hp.rank || "0"), 10) || 0);

  let tier: ContactActivity["tier"] = "none";
  if (score >= 60) tier = "hot";
  else if (score >= 35) tier = "warm";
  else if (score >= 15) tier = "cool";
  else if (score > 0) tier = "cold";

  // Recency — use last_active_date first (most accurate), then fallbacks
  const candidates = [
    hp.last_active_date,
    hp.first_tutorial_create_date,
    hp.first_tutorial_view_date,
    hp.first_tutorial_learn_date,
    hp.hs_last_contacted,
    hp.hs_analytics_last_visit_timestamp,
  ]
    .filter(Boolean)
    .map((d) => new Date(d).getTime())
    .filter((t) => !isNaN(t));

  const lastMs = candidates.length > 0 ? Math.max(...candidates) : null;
  const lastActiveDate = lastMs ? new Date(lastMs) : null;
  const dsa = lastMs ? daysSince(new Date(lastMs).toISOString()) : null;

  let recencyLabel = "No data";
  if (dsa !== null) {
    if (dsa === 0) recencyLabel = "Today";
    else if (dsa <= 7) recencyLabel = `${dsa}d ago`;
    else if (dsa <= 30) recencyLabel = `${Math.floor(dsa / 7)}w ago`;
    else if (dsa <= 365) recencyLabel = `${Math.floor(dsa / 30)}mo ago`;
    else recencyLabel = `${Math.floor(dsa / 365)}y ago`;
  }

  return {
    score,
    tier,
    lastActiveDate,
    daysSinceActive: dsa,
    recencyLabel,
    isCreator: !!hp.first_tutorial_create_date,
    creatorSince: formatDate(hp.first_tutorial_create_date),
    tutorialsCreated: parseInt(String(hp.tutorials_created || "0"), 10) || 0,
    tutorialsViewed: parseInt(String(hp.tutorials_views || "0"), 10) || 0,
    isViewer: !!(hp.first_tutorial_view_date || hp.first_tutorial_learn_date),
    viewerSince: formatDate(hp.first_tutorial_view_date || hp.first_tutorial_learn_date),
    hasExtension: parseInt(String(hp.extension_connections || "0"), 10) > 0,
    monthlyAnswers: parseInt(String(hp.answers_with_own_tutorial_month_count || "0"), 10) || 0,
    prevMonthAnswers: parseInt(String(hp.answers_with_own_tutorial_previous_month_count || "0"), 10) || 0,
    totalAnswers: parseInt(String(hp.answers || "0"), 10) || 0,
    plan: hp.plan_name || null,
    accountType: hp.account_type || null,
    engagementSegment: hp.engagement_segment || null,
    documentingProduct: hp.first_embed_tutorial_base_domain_name || null,
    embeddedIn: hp.first_embed_base_domain_name || null,
  };
}

export function sortContactsByActivity(contacts: any[]): any[] {
  return [...contacts].sort((a, b) => {
    const aS = getContactActivity((a.hubspot_properties as any) || null).score;
    const bS = getContactActivity((b.hubspot_properties as any) || null).score;
    return bS - aS;
  });
}
