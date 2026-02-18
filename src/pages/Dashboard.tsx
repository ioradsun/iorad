import { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Building2, Search, Loader2, ArrowUpDown, ExternalLink, RefreshCw } from "lucide-react";
import { useCompanies, useSignalCounts, useProcessingJobs } from "@/hooks/useSupabase";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { motion } from "framer-motion";
import { toast } from "sonner";
import HubSpotPickerModal from "@/components/HubSpotPickerModal";

type SortKey = "name" | "last_score_total" | "signals_count" | "updated_at" | "created_at";
type CategoryTab = "school" | "business" | "partner";
type StageFilter = "all" | "prospect" | "active_opp" | "customer" | "expansion";

const CATEGORY_LABELS: Record<CategoryTab, string> = {
  school: "School",
  business: "Business",
  partner: "Partner",
};

const STAGE_LABELS: Record<StageFilter, string> = {
  all: "All",
  prospect: "Prospect",
  active_opp: "Active Opp",
  customer: "Customer",
  expansion: "Expansion",
};

const STAGE_COLORS: Record<string, string> = {
  prospect:   "bg-muted text-muted-foreground border-border",
  active_opp: "bg-info/10 text-info border-info/20",
  customer:   "bg-success/10 text-success border-success/20",
  expansion:  "bg-primary/10 text-primary border-primary/20",
};

export default function Dashboard() {
  const { data: companies = [], isLoading } = useCompanies();
  const { data: signalCounts = {} } = useSignalCounts();
  const { data: jobs = [] } = useProcessingJobs();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [syncingHubspot, setSyncingHubspot] = useState(false);
  const [hubspotPickerOpen, setHubspotPickerOpen] = useState(false);

  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortAsc, setSortAsc] = useState(false);
  const [search, setSearch] = useState("");
  const [partnerFilter, setPartnerFilter] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<CategoryTab>("business");
  const [stageFilter, setStageFilter] = useState<StageFilter>("all");

  const handleHubspotSync = async () => {
    setSyncingHubspot(true);
    try {
      const { error } = await supabase.functions.invoke("import-from-hubspot", {
        body: { action: "sync" },
      });
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["companies"] });
      toast.success("HubSpot sync complete — business companies updated.");
    } catch (err: any) {
      toast.error(`HubSpot sync failed: ${err?.message || "Unknown error"}`);
    } finally {
      setSyncingHubspot(false);
    }
  };

  const companiesWithSignals = useMemo(() => {
    return companies.map(c => ({ ...c, signals_count: signalCounts[c.id] || 0 }));
  }, [companies, signalCounts]);

  const sorted = useMemo(() => {
    let list = [...companiesWithSignals];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(c => c.name.toLowerCase().includes(q) || (c.domain || "").toLowerCase().includes(q));
    }
    if (partnerFilter !== "all") list = list.filter(c => c.partner === partnerFilter);
    list.sort((a, b) => {
      let av: any, bv: any;
      switch (sortKey) {
        case "name": av = a.name; bv = b.name; break;
        case "last_score_total": av = a.last_score_total ?? -1; bv = b.last_score_total ?? -1; break;
        case "signals_count": av = a.signals_count; bv = b.signals_count; break;
        case "updated_at": av = a.updated_at; bv = b.updated_at; break;
        case "created_at": av = a.created_at; bv = b.created_at; break;
        default: av = 0; bv = 0;
      }
      if (av < bv) return sortAsc ? -1 : 1;
      if (av > bv) return sortAsc ? 1 : -1;
      return 0;
    });
    return list;
  }, [search, partnerFilter, sortKey, sortAsc, companiesWithSignals]);

  // Category buckets
  const byCategory = useMemo(() => ({
    school:   sorted.filter(c => (c as any).category === "school"),
    business: sorted.filter(c => (c as any).category === "business" || !(c as any).category),
    partner:  sorted.filter(c => (c as any).category === "partner"),
  }), [sorted]);

  // Active list: search shows all, otherwise filter by category + stage
  const activeList = useMemo(() => {
    if (search) return sorted;
    let list = byCategory[activeTab] || [];
    if (stageFilter !== "all") {
      list = list.filter(c => (c as any).stage === stageFilter);
    }
    return list;
  }, [search, sorted, byCategory, activeTab, stageFilter]);

  const partners = useMemo(() => {
    const set = new Set(companies.map(c => c.partner).filter(Boolean) as string[]);
    return Array.from(set).sort();
  }, [companies]);

  const stats = useMemo(() => {
    const now = Date.now();
    const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;
    let newThisWeek = 0;
    for (const c of companies) {
      const createdAt = new Date(c.created_at);
      if (createdAt.getTime() >= oneWeekAgo) newThisWeek++;
    }

    // Stage breakdown across all companies
    const stageCounts = { prospect: 0, active_opp: 0, customer: 0, expansion: 0 };
    for (const c of companies) {
      const stage = (c as any).stage || "prospect";
      if (stage in stageCounts) stageCounts[stage as keyof typeof stageCounts]++;
    }
    return { total: companies.length, newThisWeek, stageCounts };
  }, [companies]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  };

  const SortHeader = ({ label, field }: { label: string; field: SortKey }) => (
    <button
      onClick={() => toggleSort(field)}
      className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
    >
      {label}
      <ArrowUpDown className={`w-3 h-3 transition-colors ${sortKey === field ? "text-foreground" : "text-muted-foreground/40"}`} />
    </button>
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        <span className="ml-2.5 text-sm text-muted-foreground">Loading…</span>
      </div>
    );
  }

  const stageFilters: StageFilter[] = ["all", "prospect", "active_opp", "customer", "expansion"];

  return (
    <div className="max-w-6xl mx-auto px-1 space-y-6">

      {/* ── KPI strip ── */}
      <div className="grid grid-cols-3 gap-3 pt-1">
        <KpiCard
          value={stats.total}
          label="Total tracked"
          icon={<Building2 className="w-4 h-4" style={{ color: "var(--stat-total-fg)" }} />}
          iconBg="var(--stat-total-bg)"
        />
        <KpiCard
          value={stats.newThisWeek}
          label="New this week"
          icon={<Building2 className="w-4 h-4" style={{ color: "var(--stat-inbound-fg)" }} />}
          iconBg="var(--stat-inbound-bg)"
          onRefresh={handleHubspotSync}
          refreshing={syncingHubspot}
        />
        {/* Stage breakdown mini-card */}
        <div className="bg-card shadow-sm shadow-black/[0.04] rounded-lg px-5 py-4">
          <div className="text-[13px] font-medium text-muted-foreground mb-2.5 leading-tight">Pipeline stages</div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            {(Object.entries(stats.stageCounts) as [string, number][]).map(([stage, count]) => (
              <div key={stage} className="flex items-center justify-between gap-2">
                <span className="text-[11px] text-muted-foreground capitalize">{stage.replace("_", " ")}</span>
                <span className="text-[13px] font-semibold tabular-nums text-foreground">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Category Tabs ── */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="flex items-center bg-secondary rounded-md p-0.5 gap-0.5">
          {(["school", "business", "partner"] as CategoryTab[]).map(tab => (
            <button
              key={tab}
              onClick={() => { setActiveTab(tab); setStageFilter("all"); }}
              className={`px-3.5 py-1.5 rounded text-sm font-medium transition-all ${
                activeTab === tab
                  ? "bg-card text-foreground shadow-sm shadow-black/[0.06]"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {CATEGORY_LABELS[tab]}
              <span className="ml-1.5 tabular-nums text-xs text-muted-foreground">
                {byCategory[tab].length}
              </span>
            </button>
          ))}
        </div>

        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Search…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm bg-secondary border-0 focus-visible:ring-1 focus-visible:ring-ring/30"
          />
        </div>

        {activeTab === "partner" && partners.length > 0 && (
          <Select value={partnerFilter} onValueChange={setPartnerFilter}>
            <SelectTrigger className="w-[160px] h-8 text-xs bg-secondary border-0 focus:ring-1 focus:ring-ring/30">
              <SelectValue placeholder="All partners" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All partners</SelectItem>
              {partners.map(p => (
                <SelectItem key={p} value={p}>{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <div className="ml-auto flex items-center gap-3">
          <Button
            size="sm"
            className="gap-1.5 font-medium"
            style={{
              background: "var(--btn-primary-bg)",
              color: "var(--btn-primary-fg)",
              borderRadius: "var(--btn-radius)",
            }}
            onClick={() => setHubspotPickerOpen(true)}
          >
            Import from HubSpot
          </Button>
        </div>
      </div>

      {/* ── Stage pill filter ── */}
      {!search && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {stageFilters.map(stage => (
            <button
              key={stage}
              onClick={() => setStageFilter(stage)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                stageFilter === stage
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground/40"
              }`}
            >
              {STAGE_LABELS[stage]}
              {stage !== "all" && (
                <span className="ml-1.5 tabular-nums opacity-70">
                  {byCategory[activeTab].filter(c => (c as any).stage === stage).length}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* ── Table ── */}
      <div className="rounded-lg bg-card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr style={{ borderBottom: "1px solid hsl(215 10% 88% / 0.7)" }}>
              <th className="text-left px-5 py-3.5">
                <SortHeader label="Company" field="name" />
              </th>
              {search && (
                <th className="text-left px-5 py-3.5 hidden sm:table-cell">
                  <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Category</span>
                </th>
              )}
              <th className="text-left px-5 py-3.5 hidden sm:table-cell">
                <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Stage</span>
              </th>
              {activeTab === "partner" && (
                <th className="text-left px-5 py-3.5 hidden md:table-cell">
                  <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Partner</span>
                </th>
              )}
              {activeTab === "partner" && (
                <th className="text-left px-5 py-3.5 hidden lg:table-cell">
                  <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Rep</span>
                </th>
              )}
              <th className="text-left px-5 py-3.5 hidden lg:table-cell">
                <SortHeader label="Added" field="created_at" />
              </th>
              <th className="px-5 py-3.5 w-28" />
            </tr>
          </thead>
          <tbody>
            {activeList.map((company, i) => (
              <motion.tr
                key={company.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: Math.min(i * 0.015, 0.4) }}
                className="group relative cursor-pointer transition-colors hover:bg-secondary/50"
                style={{ borderBottom: "1px solid hsl(215 10% 92% / 0.6)" }}
                onMouseEnter={e => (e.currentTarget.style.borderBottomColor = "hsl(215 10% 70% / 0.5)")}
                onMouseLeave={e => (e.currentTarget.style.borderBottomColor = "hsl(215 10% 92% / 0.6)")}
                onClick={() => navigate(`/company/${company.id}`)}
              >
                <td className="px-5 py-4">
                  <div className="font-semibold text-[15px] text-foreground leading-snug">{company.name}</div>
                  {company.domain && (
                    <div className="text-[13px] text-muted-foreground mt-0.5">{company.domain}</div>
                  )}
                </td>
                {search && (
                  <td className="px-5 py-4 hidden sm:table-cell">
                    <CategoryPill category={(company as any).category || "business"} />
                  </td>
                )}
                <td className="px-5 py-4 hidden sm:table-cell">
                  <StagePill stage={(company as any).stage || "prospect"} />
                </td>
                {activeTab === "partner" && (
                  <td className="px-5 py-4 hidden md:table-cell">
                    <span className="text-[14px] text-muted-foreground">{company.partner || "—"}</span>
                  </td>
                )}
                {activeTab === "partner" && (
                  <td className="px-5 py-4 hidden lg:table-cell">
                    <span className="text-[14px] text-muted-foreground">{company.partner_rep_name || "—"}</span>
                    {company.partner_rep_email && (
                      <div className="text-[13px] text-muted-foreground/60 mt-0.5">{company.partner_rep_email}</div>
                    )}
                  </td>
                )}
                <td className="px-5 py-4 hidden lg:table-cell">
                  <span className="text-[14px] text-muted-foreground">
                    {new Date(company.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </span>
                </td>
                <td className="px-5 py-4 text-right">
                  {company.snapshot_status === "Generated" && (
                    <Link
                      to={`/company/${company.id}`}
                      onClick={e => e.stopPropagation()}
                    >
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1.5 text-[13px] h-8 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        View story
                      </Button>
                    </Link>
                  )}
                </td>
              </motion.tr>
            ))}
            {activeList.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-16 text-center text-sm text-muted-foreground">
                  {companies.length === 0
                    ? "No companies yet — upload a CSV to get started."
                    : `No ${CATEGORY_LABELS[activeTab]} companies match your filters.`}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <HubSpotPickerModal open={hubspotPickerOpen} onClose={() => setHubspotPickerOpen(false)} />
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────

function KpiCard({
  value,
  label,
  icon,
  iconBg,
  subtitle,
  onRefresh,
  refreshing,
}: {
  value: number;
  label: string;
  icon: React.ReactNode;
  iconBg: string;
  subtitle?: string;
  onRefresh?: () => void;
  refreshing?: boolean;
}) {
  return (
    <div className="bg-card shadow-sm shadow-black/[0.04] rounded-lg px-5 py-4 flex items-center gap-4">
      <div className="rounded-md p-2 shrink-0" style={{ background: iconBg }}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[2rem] font-semibold tracking-tight leading-none text-foreground tabular-nums">
          {value}
        </div>
        <div className="text-[13px] font-medium text-muted-foreground mt-1.5 leading-tight">{label}</div>
        {subtitle && (
          <div className="text-[11px] text-muted-foreground/60 mt-1 leading-tight">{subtitle}</div>
        )}
      </div>
      {onRefresh && (
        <button
          onClick={onRefresh}
          disabled={refreshing}
          title="Sync from HubSpot"
          className="shrink-0 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-40"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
        </button>
      )}
    </div>
  );
}

function StagePill({ stage }: { stage: string }) {
  const colors = STAGE_COLORS[stage] || STAGE_COLORS.prospect;
  const label = STAGE_LABELS[stage as StageFilter] || stage;
  return (
    <span className={`inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded border ${colors}`}>
      {label}
    </span>
  );
}

function CategoryPill({ category }: { category: string }) {
  const colorMap: Record<string, string> = {
    school:   "bg-info/10 text-info border-info/20",
    business: "bg-muted text-muted-foreground border-border",
    partner:  "bg-primary/10 text-primary border-primary/20",
  };
  const colors = colorMap[category] || colorMap.business;
  const labelMap: Record<string, string> = { school: "School", business: "Business", partner: "Partner" };
  return (
    <span className={`inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded border ${colors}`}>
      {labelMap[category] || category}
    </span>
  );
}
