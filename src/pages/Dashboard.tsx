import { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Building2, ArrowDownRight, ArrowUpRight, Search, Loader2, Plus, ArrowUpDown, ExternalLink } from "lucide-react";
import { useCompanies, useSignalCounts, useProcessingJobs } from "@/hooks/useSupabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { motion } from "framer-motion";

type SortKey = "name" | "last_score_total" | "signals_count" | "updated_at" | "created_at";

export default function Dashboard() {
  const { data: companies = [], isLoading } = useCompanies();
  const { data: signalCounts = {} } = useSignalCounts();
  const { data: jobs = [] } = useProcessingJobs();
  const navigate = useNavigate();

  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortAsc, setSortAsc] = useState(false);
  const [search, setSearch] = useState("");
  const [partnerFilter, setPartnerFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");

  const lastJob = jobs[0];

  const companiesWithSignals = useMemo(() => {
    return companies.map(c => ({ ...c, signals_count: signalCounts[c.id] || 0 }));
  }, [companies, signalCounts]);

  const filtered = useMemo(() => {
    let list = [...companiesWithSignals];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(c => c.name.toLowerCase().includes(q) || (c.domain || "").toLowerCase().includes(q));
    }
    if (partnerFilter !== "all") list = list.filter(c => c.partner === partnerFilter);
    if (sourceFilter !== "all") list = list.filter(c => (c as any).source_type === sourceFilter);

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
  }, [search, partnerFilter, sourceFilter, sortKey, sortAsc, companiesWithSignals]);

  const partners = useMemo(() => {
    const set = new Set(companies.map(c => c.partner).filter(Boolean) as string[]);
    return Array.from(set).sort();
  }, [companies]);

  const stats = useMemo(() => {
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    let newInbound = 0;
    let newOutbound = 0;
    for (const c of companies) {
      if (new Date(c.created_at).getTime() >= oneDayAgo) {
        if ((c as any).source_type === "inbound") newInbound++;
        else newOutbound++;
      }
    }
    return { total: companies.length, newInbound, newOutbound };
  }, [companies]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  };

  const SortHeader = ({ label, field }: { label: string; field: SortKey }) => (
    <button
      onClick={() => toggleSort(field)}
      className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors"
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
          value={stats.newInbound}
          label="New inbound (24h)"
          icon={<ArrowDownRight className="w-4 h-4" style={{ color: "var(--stat-inbound-fg)" }} />}
          iconBg="var(--stat-inbound-bg)"
        />
        <KpiCard
          value={stats.newOutbound}
          label="New outbound (24h)"
          icon={<ArrowUpRight className="w-4 h-4" style={{ color: "var(--stat-outbound-fg)" }} />}
          iconBg="var(--stat-outbound-bg)"
        />
      </div>

      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Search…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm bg-secondary border-0 focus-visible:ring-1 focus-visible:ring-ring/30"
          />
        </div>
        <Select value={sourceFilter} onValueChange={setSourceFilter}>
          <SelectTrigger className="w-[140px] h-8 text-xs bg-secondary border-0 focus:ring-1 focus:ring-ring/30">
            <SelectValue placeholder="All sources" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sources</SelectItem>
            <SelectItem value="inbound">Inbound</SelectItem>
            <SelectItem value="outbound">Outbound</SelectItem>
          </SelectContent>
        </Select>
        {partners.length > 0 && (
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
          {filtered.length !== companies.length && (
            <span className="text-xs text-muted-foreground">
              {filtered.length} of {companies.length}
            </span>
          )}
          <Link to="/upload">
            <Button
              size="sm"
              className="gap-1.5 font-medium"
              style={{
                background: "var(--btn-primary-bg)",
                color: "var(--btn-primary-fg)",
                borderRadius: "var(--btn-radius)",
              }}
            >
              <Plus className="w-3.5 h-3.5" />
              Add Company
            </Button>
          </Link>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="rounded-lg bg-card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr style={{ borderBottom: "1px solid hsl(215 10% 88% / 0.7)" }}>
              <th className="text-left px-5 py-3">
                <SortHeader label="Company" field="name" />
              </th>
              <th className="text-left px-5 py-3 hidden sm:table-cell">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Source</span>
              </th>
              <th className="text-left px-5 py-3 hidden md:table-cell">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Partner</span>
              </th>
              <th className="text-left px-5 py-3 hidden lg:table-cell">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Rep</span>
              </th>
              <th className="text-left px-5 py-3 hidden lg:table-cell">
                <SortHeader label="Added" field="created_at" />
              </th>
              <th className="px-5 py-3 w-28" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((company, i) => (
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
                <td className="px-5 py-3.5">
                  <div className="font-medium text-sm text-foreground leading-snug">{company.name}</div>
                  {company.domain && (
                    <div className="text-xs text-muted-foreground mt-0.5">{company.domain}</div>
                  )}
                </td>
                <td className="px-5 py-3.5 hidden sm:table-cell">
                  <SourcePill type={(company as any).source_type || "outbound"} />
                </td>
                <td className="px-5 py-3.5 hidden md:table-cell">
                  <span className="text-sm text-muted-foreground">{company.partner || "—"}</span>
                </td>
                <td className="px-5 py-3.5 hidden lg:table-cell">
                  <span className="text-sm text-muted-foreground">{company.partner_rep_name || "—"}</span>
                  {company.partner_rep_email && (
                    <div className="text-xs text-muted-foreground/60 mt-0.5">{company.partner_rep_email}</div>
                  )}
                </td>
                <td className="px-5 py-3.5 hidden lg:table-cell">
                  <span className="text-sm text-muted-foreground">
                    {new Date(company.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </span>
                </td>
                <td className="px-5 py-3.5 text-right">
                  {company.snapshot_status === "Generated" && (
                    <Link
                      to={`/company/${company.id}`}
                      onClick={e => e.stopPropagation()}
                    >
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1.5 text-xs h-7 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <ExternalLink className="w-3 h-3" />
                        View story
                      </Button>
                    </Link>
                  )}
                </td>
              </motion.tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-16 text-center text-sm text-muted-foreground">
                  {companies.length === 0
                    ? "No companies yet — upload a CSV to get started."
                    : "No results match your filters."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────

function KpiCard({
  value,
  label,
  icon,
  iconBg,
}: {
  value: number;
  label: string;
  icon: React.ReactNode;
  iconBg: string;
}) {
  return (
    <div className="bg-card shadow-sm shadow-black/[0.04] rounded-lg px-5 py-4 flex items-center gap-4">
      <div
        className="rounded-md p-2 shrink-0"
        style={{ background: iconBg }}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-[2rem] font-semibold tracking-tight leading-none text-foreground tabular-nums">
          {value}
        </div>
        <div className="text-xs font-medium text-muted-foreground mt-1 leading-tight">{label}</div>
      </div>
    </div>
  );
}

function SourcePill({ type }: { type: string }) {
  const isInbound = type === "inbound";
  return (
    <span
      className="inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded border"
      style={isInbound ? {
        background: "var(--source-inbound-bg)",
        color: "var(--source-inbound-fg)",
        borderColor: "var(--source-inbound-border)",
      } : {
        background: "var(--source-outbound-bg)",
        color: "var(--source-outbound-fg)",
        borderColor: "var(--source-outbound-border)",
      }}
    >
      {type}
    </span>
  );
}
