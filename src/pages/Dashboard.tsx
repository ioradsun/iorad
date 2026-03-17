import { useState, useMemo, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Search, ArrowUpDown, ChevronRight } from "lucide-react";
import { useCompanies, useCompaniesPage, useSignalCounts } from "@/hooks/useSupabase";
import { ClearableInput } from "@/components/ui/clearable-input";
import HubSpotPickerModal from "@/components/HubSpotPickerModal";
import { PlanBadge } from "@/components/PlanBadge";
import { formatDistanceToNow } from "date-fns";

type SortKey = "name" | "scout_score";
type StageTab = "prospect" | "opportunity" | "customer";

const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

function getRowPriority(c: any, activeStage: string, now: number): number {
  const createdAt = c.created_at ? new Date(c.created_at).getTime() : 0;
  if (now - createdAt < TWENTY_FOUR_HOURS) return 100;
  if (activeStage === "customer" && c.expansion_signal) return 80;
  const trigger = c.last_sync_changes?.trigger;
  if (trigger === "product_activity" || trigger === "expansion_signal" || trigger === "pql_signal") return 60;
  return 0;
}

const STAGE_LABELS: Record<string, string> = {
  prospect: "Prospect",
  opportunity: "Opportunity",
  customer: "Customer",
};

const STAGE_COLORS: Record<string, string> = {
  prospect: "bg-muted text-muted-foreground border-border",
  opportunity: "bg-info/10 text-info border-info/20",
  customer: "bg-success/10 text-success border-success/20",
};

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  company: "Company",
  school: "School",
  partner: "Partner",
};

const EMPTY_STATE_LABELS: Record<string, string> = {
  prospect: "No prospects yet.",
  opportunity: "No active opportunities.",
  customer: "No expansion accounts yet.",
};

export default function Dashboard() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [hubspotPickerOpen, setHubspotPickerOpen] = useState(false);

  const [sortKey, setSortKey] = useState<SortKey>("scout_score");
  const [sortAsc, setSortAsc] = useState(false);
  const [search, setSearch] = useState("");
  const stageFromUrl = (searchParams.get("stage") as StageTab) || "prospect";
  const activeStage = stageFromUrl;
  const [visibleCount, setVisibleCount] = useState(50);
  const [accountTypeFilter, setAccountTypeFilter] = useState<string>("all");
  const [signalOnly, setSignalOnly] = useState(false);

  const { data: firstPage = [], isLoading: firstPageLoading } = useCompaniesPage(activeStage);
  const { data: fullList } = useCompanies();

  const companies = fullList ?? firstPage;
  const isLoading = firstPageLoading;

  const { data: signalCounts = {} } = useSignalCounts();

  const companiesWithSignals = useMemo(() => {
    return companies.map(c => ({ ...c, signals_count: signalCounts[c.id] || 0 }));
  }, [companies, signalCounts]);

  const sorted = useMemo(() => {
    let list = [...companiesWithSignals];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(c => c.name.toLowerCase().includes(q) || (c.domain || "").toLowerCase().includes(q));
    }

    const now = Date.now();
    list.sort((a, b) => {
      const aPriority = getRowPriority(a as any, activeStage, now);
      const bPriority = getRowPriority(b as any, activeStage, now);
      if (bPriority !== aPriority) return bPriority - aPriority;

      if (sortKey === "name") {
        const av = a.name.toLowerCase();
        const bv = b.name.toLowerCase();
        if (av < bv) return sortAsc ? -1 : 1;
        if (av > bv) return sortAsc ? 1 : -1;
        return 0;
      }

      const aScore = (a as any).scout_score ?? -1;
      const bScore = (b as any).scout_score ?? -1;
      return bScore - aScore;
    });

    return list;
  }, [search, sortKey, sortAsc, companiesWithSignals, activeStage]);

  const byStage = useMemo(() => ({
    prospect: sorted.filter(c => (c as any).lifecycle_stage === "prospect"),
    opportunity: sorted.filter(c => (c as any).lifecycle_stage === "opportunity"),
    customer: sorted.filter(c => (c as any).lifecycle_stage === "customer"),
  }), [sorted]);

  const activeList = useMemo(() => {
    let list = search ? sorted : (byStage[activeStage] || []);
    if (accountTypeFilter !== "all") {
      list = list.filter(c => (c as any).account_type === accountTypeFilter);
    }
    if (signalOnly) {
      list = list.filter(c => (c as any).expansion_signal === true);
    }
    return list;
  }, [search, sorted, byStage, activeStage, accountTypeFilter, signalOnly]);

  useEffect(() => {
    setVisibleCount(50);
  }, [activeStage, search, accountTypeFilter, signalOnly]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  const SortHeader = ({ label, field }: { label: string; field: SortKey }) => (
    <button
      onClick={() => toggleSort(field)}
      className="flex items-center gap-1.5 text-micro font-medium uppercase tracking-wide text-foreground/45 hover:text-foreground transition-colors"
    >
      {label}
      <ArrowUpDown className={`w-3 h-3 transition-colors ${sortKey === field ? "text-foreground" : "text-muted-foreground/40"}`} />
    </button>
  );

  if (isLoading) {
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-3 pt-1">
          <div className="h-9 w-72 rounded-md bg-foreground/[0.05] animate-pulse" />
          <div className="h-9 flex-1 max-w-sm rounded-md bg-foreground/[0.05] animate-pulse" />
        </div>
        <div className="rounded-lg border border-border/30 bg-card overflow-hidden">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-3.5 border-b border-border/30">
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-foreground/[0.06] rounded w-48" />
                <div className="h-3 bg-foreground/[0.04] rounded w-32" />
              </div>
              <div className="h-5 bg-foreground/[0.04] rounded w-20" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const visibleList = activeList.slice(0, visibleCount);
  const hasMore = activeList.length > visibleCount;

  return (
    <div className="space-y-5">
      <div className="relative max-w-xl mb-2 max-md:max-w-full">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/25 z-10" />
        <ClearableInput
          placeholder="Search companies…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          onClear={() => setSearch("")}
          className="pl-10 h-11 text-body bg-secondary border-0 rounded-xl focus-visible:ring-1 focus-visible:ring-ring/30"
        />
      </div>

      {/* Account type filter chips */}
      <div className="flex items-center gap-1.5">
        {[
          { key: "all", label: "All" },
          { key: "company", label: "Company" },
          { key: "school", label: "School" },
          { key: "partner", label: "Partner" },
        ].map(chip => (
          <button
            key={chip.key}
            onClick={() => setAccountTypeFilter(chip.key)}
            className={`px-3 py-1 rounded-full text-micro font-medium transition-colors border ${
              accountTypeFilter === chip.key
                ? "bg-foreground/10 text-foreground border-foreground/20"
                : "text-foreground/35 border-transparent hover:text-foreground/60"
            }`}
          >
            {chip.label}
          </button>
        ))}
        {activeStage === "customer" && (
          <button
            onClick={() => setSignalOnly(s => !s)}
            className={`px-3 py-1 rounded-full text-micro font-medium transition-colors border ${
              signalOnly
                ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
                : "text-foreground/35 border-transparent hover:text-foreground/60"
            }`}
          >
            Expansion signals only
          </button>
        )}
      </div>

      <div className="md:hidden space-y-2">
        {visibleList.map((company) => (
          <button
            key={company.id}
            onClick={() => navigate(`/company/${company.id}`)}
            className="w-full flex items-center gap-3 p-3 rounded-lg border border-border/20 bg-card text-left active:bg-secondary/50 transition-colors"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1">
                <span className="text-body font-medium text-foreground truncate">{company.name}</span>
                <NewSignupDot createdAt={(company as any).created_at ?? null} />
                <ExpansionSignalDot company={company} />
              </div>
              <div className="text-micro text-foreground/40 mt-0.5 flex items-center gap-2">
                {company.domain && <span className="truncate">{company.domain}</span>}
                <StagePill stage={(company as any).lifecycle_stage || "prospect"} />
              </div>
            </div>
            {(company as any).scout_score != null && (
              <ScoutBadge score={(company as any).scout_score} />
            )}
            <ChevronRight className="w-4 h-4 text-foreground/15 shrink-0" />
          </button>
        ))}

        {visibleList.length === 0 && !isLoading && (
          <div className="px-5 py-16 text-center rounded-lg border border-border/30 bg-card">
            {search ? (
              <>
                <p className="text-body text-foreground/45 mb-1">
                  No companies match "{search}"
                </p>
                <button
                  onClick={() => setHubspotPickerOpen(true)}
                  className="text-caption text-primary hover:text-primary/80 font-medium transition-colors"
                >
                  Import from HubSpot →
                </button>
              </>
            ) : (
              <p className="text-body text-foreground/45">
                {EMPTY_STATE_LABELS[activeStage] || "No companies yet."}
              </p>
            )}
          </div>
        )}
      </div>

      <div className="hidden md:block rounded-lg border border-border/30 bg-card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border/40">
              <th className="text-left px-5 py-3">
                <SortHeader label="Company" field="name" />
              </th>
              {search && (
                <th className="text-left px-5 py-3 hidden sm:table-cell">
                  <span className="text-micro font-medium uppercase tracking-wide text-foreground/45">Type</span>
                </th>
              )}
              <th className="text-left px-5 py-3 hidden sm:table-cell">
                <span className="text-micro font-medium uppercase tracking-wide text-foreground/45">Stage</span>
              </th>
              <th className="text-left px-5 py-3 hidden lg:table-cell">
                <span className="text-micro font-medium uppercase tracking-wide text-foreground/45">Plan</span>
              </th>
              <th className="text-left px-5 py-3 hidden md:table-cell">
                <SortHeader label="Score" field="scout_score" />
              </th>
              <th className="px-5 py-3 w-20" />
            </tr>
          </thead>
          <tbody>
            {visibleList.map((company) => (
              <tr
                key={company.id}
                className="group cursor-pointer transition-colors border-b border-border/30 hover:bg-secondary/40"
                onClick={() => navigate(`/company/${company.id}`)}
              >
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-1">
                    <span className="font-medium text-body text-foreground">{company.name}</span>
                    <NewSignupDot createdAt={(company as any).created_at ?? null} />
                    <ExpansionSignalDot company={company} />
                  </div>
                  {company.domain && (
                    <div className="text-caption text-foreground/45 mt-0.5">{company.domain}</div>
                  )}
                </td>
                {search && (
                  <td className="px-5 py-3.5 hidden sm:table-cell">
                    <AccountTypePill accountType={(company as any).account_type || "company"} />
                  </td>
                )}
                <td className="px-5 py-3.5 hidden sm:table-cell">
                  <StagePill stage={(company as any).lifecycle_stage || "prospect"} />
                </td>
                <td className="px-5 py-3.5 hidden lg:table-cell">
                  <PlanBadge plan={(company as any).iorad_plan ?? null} />
                </td>
                <td className="px-5 py-3.5 hidden md:table-cell">
                  <ScoutBadge score={(company as any).scout_score ?? null} />
                </td>
                <td className="px-5 py-3.5 text-right">
                  <ChevronRight className="w-4 h-4 text-foreground/15 group-hover:text-foreground/45 transition-colors inline" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {visibleList.length === 0 && !isLoading && (
          <div className="px-5 py-16 text-center">
            {search ? (
              <>
                <p className="text-body text-foreground/45 mb-1">
                  No companies match "{search}"
                </p>
                <button
                  onClick={() => setHubspotPickerOpen(true)}
                  className="text-caption text-primary hover:text-primary/80 font-medium transition-colors"
                >
                  Import from HubSpot →
                </button>
              </>
            ) : (
              <p className="text-body text-foreground/45">
                {EMPTY_STATE_LABELS[activeStage] || "No companies yet."}
              </p>
            )}
          </div>
        )}
      </div>

      {hasMore && (
        <div className="flex justify-center">
          <button
            onClick={() => setVisibleCount(prev => prev + 50)}
            className="text-caption text-primary hover:text-primary/80 font-medium transition-colors"
          >
            Show more ({activeList.length - visibleCount} remaining)
          </button>
        </div>
      )}

      <HubSpotPickerModal open={hubspotPickerOpen} onClose={() => setHubspotPickerOpen(false)} />
    </div>
  );
}

function StagePill({ stage }: { stage: string }) {
  const colors = STAGE_COLORS[stage] || STAGE_COLORS.prospect;
  const label = STAGE_LABELS[stage] || stage;
  return (
    <span className={`inline-flex items-center text-micro font-medium px-2 py-0.5 rounded border ${colors}`}>
      {label}
    </span>
  );
}

function AccountTypePill({ accountType }: { accountType: string }) {
  const colorMap: Record<string, string> = {
    school: "bg-info/10 text-info border-info/20",
    company: "bg-muted text-muted-foreground border-border",
    partner: "bg-primary/10 text-primary border-primary/20",
  };
  const colors = colorMap[accountType] || colorMap.company;
  return (
    <span className={`inline-flex items-center text-micro font-medium px-2 py-0.5 rounded border ${colors}`}>
      {ACCOUNT_TYPE_LABELS[accountType] || accountType}
    </span>
  );
}

function ScoutBadge({ score }: { score: number | null }) {
  if (score === null) return <span className="text-foreground/45 text-xs">—</span>;
  let cls = "";
  let tier = "";
  if (score >= 75) { cls = "bg-destructive/15 text-destructive border-destructive/30"; tier = "Hot"; }
  else if (score >= 50) { cls = "bg-warning/15 text-warning border-warning/30"; tier = "Warm"; }
  else if (score >= 25) { cls = "bg-muted text-muted-foreground border-border"; tier = "Lukewarm"; }
  else { cls = "bg-info/10 text-info border-info/20"; tier = "Cold"; }
  return (
    <span className={`inline-flex items-center gap-1 text-micro font-semibold px-2 py-0.5 rounded border ${cls}`}>
      {score} <span className="font-normal opacity-70">{tier}</span>
    </span>
  );
}


function ExpansionSignalDot({ company }: { company: any }) {
  if (!company.expansion_signal) return null;
  const since = company.expansion_signal_at
    ? formatDistanceToNow(new Date(company.expansion_signal_at), { addSuffix: true })
    : null;
  return (
    <span
      className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0 ml-1.5"
      title={since ? `Expansion signal detected ${since}` : "Expansion signal: paid plan + active free creators"}
    />
  );
}
