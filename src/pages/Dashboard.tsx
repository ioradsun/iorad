import { useState, useMemo, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Search, ArrowUpDown, ChevronRight } from "lucide-react";
import { useCompanies, useCompaniesPage, useSignalCounts } from "@/hooks/useSupabase";
import { Input } from "@/components/ui/input";
import HubSpotPickerModal from "@/components/HubSpotPickerModal";

type SortKey = "name" | "scout_score";
type CategoryTab = "school" | "business" | "partner";

const CATEGORY_LABELS: Record<CategoryTab, string> = {
  school: "School",
  business: "Business",
  partner: "Partner",
};

const STAGE_LABELS: Record<string, string> = {
  prospect: "Prospect",
  active_opp: "Active Opp",
  customer: "Customer",
  expansion: "Expansion",
};

const STAGE_COLORS: Record<string, string> = {
  prospect: "bg-muted text-muted-foreground border-border",
  active_opp: "bg-info/10 text-info border-info/20",
  customer: "bg-success/10 text-success border-success/20",
  expansion: "bg-primary/10 text-primary border-primary/20",
};

export default function Dashboard() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [hubspotPickerOpen, setHubspotPickerOpen] = useState(false);

  const [sortKey, setSortKey] = useState<SortKey>("scout_score");
  const [sortAsc, setSortAsc] = useState(false);
  const [search, setSearch] = useState("");
  const categoryFromUrl = (searchParams.get("category") as CategoryTab) || "business";
  const activeTab = categoryFromUrl;
  const [visibleCount, setVisibleCount] = useState(50);

  const { data: firstPage = [], isLoading: firstPageLoading } = useCompaniesPage(activeTab);
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

    list.sort((a, b) => {
      let av: any;
      let bv: any;
      switch (sortKey) {
        case "name":
          av = a.name.toLowerCase();
          bv = b.name.toLowerCase();
          break;
        case "scout_score":
          av = (a as any).scout_score ?? -1;
          bv = (b as any).scout_score ?? -1;
          break;
        default:
          av = 0;
          bv = 0;
      }
      if (av < bv) return sortAsc ? -1 : 1;
      if (av > bv) return sortAsc ? 1 : -1;
      return 0;
    });

    return list;
  }, [search, sortKey, sortAsc, companiesWithSignals]);

  const byCategory = useMemo(() => ({
    school: sorted.filter(c => (c as any).category === "school"),
    business: sorted.filter(c => (c as any).category === "business" || !(c as any).category),
    partner: sorted.filter(c => (c as any).category === "partner"),
  }), [sorted]);

  const activeList = useMemo(() => {
    if (search) return sorted;
    return byCategory[activeTab] || [];
  }, [search, sorted, byCategory, activeTab]);

  useEffect(() => {
    setVisibleCount(50);
  }, [activeTab, search]);

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
      <div className="flex items-center gap-3 pt-1">
        <div className="flex items-center bg-secondary rounded-md p-0.5 gap-0.5">
          {(["school", "business", "partner"] as CategoryTab[]).map(tab => (
            <button
              key={tab}
              onClick={() => { setActiveTab(tab); setSearch(""); }}
              className={`px-3.5 py-1.5 rounded text-sm font-medium transition-all ${
                activeTab === tab
                  ? "bg-card text-foreground shadow-sm shadow-black/[0.06]"
                  : "text-foreground/45 hover:text-foreground"
              }`}
            >
              {CATEGORY_LABELS[tab]}
              <span className="ml-1.5 tabular-nums text-micro text-foreground/25">
                {byCategory[tab].length}
              </span>
            </button>
          ))}
        </div>

        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-foreground/25" />
          <Input
            placeholder="Search…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 h-9 text-body bg-secondary border-0 focus-visible:ring-1 focus-visible:ring-ring/30"
          />
        </div>
      </div>

      <div className="rounded-lg border border-border/30 bg-card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border/40">
              <th className="text-left px-5 py-3">
                <SortHeader label="Company" field="name" />
              </th>
              {search && (
                <th className="text-left px-5 py-3 hidden sm:table-cell">
                  <span className="text-micro font-medium uppercase tracking-wide text-foreground/45">Category</span>
                </th>
              )}
              <th className="text-left px-5 py-3 hidden sm:table-cell">
                <span className="text-micro font-medium uppercase tracking-wide text-foreground/45">Stage</span>
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
                  <div className="font-medium text-body text-foreground">{company.name}</div>
                  {company.domain && (
                    <div className="text-caption text-foreground/45 mt-0.5">{company.domain}</div>
                  )}
                </td>
                {search && (
                  <td className="px-5 py-3.5 hidden sm:table-cell">
                    <CategoryPill category={(company as any).category || "business"} />
                  </td>
                )}
                <td className="px-5 py-3.5 hidden sm:table-cell">
                  <StagePill stage={(company as any).stage || "prospect"} />
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
                No {CATEGORY_LABELS[activeTab].toLowerCase()} companies yet.
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

function CategoryPill({ category }: { category: string }) {
  const colorMap: Record<string, string> = {
    school: "bg-info/10 text-info border-info/20",
    business: "bg-muted text-muted-foreground border-border",
    partner: "bg-primary/10 text-primary border-primary/20",
  };
  const colors = colorMap[category] || colorMap.business;
  const labelMap: Record<string, string> = { school: "School", business: "Business", partner: "Partner" };
  return (
    <span className={`inline-flex items-center text-micro font-medium px-2 py-0.5 rounded border ${colors}`}>
      {labelMap[category] || category}
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
