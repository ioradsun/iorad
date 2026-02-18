import { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Building2, ArrowDownRight, ArrowUpRight } from "lucide-react";
import { useCompanies, useSignalCounts, useProcessingJobs } from "@/hooks/useSupabase";
import ScoreCell from "@/components/ScoreCell";
import { ArrowUpDown, Search, Loader2, Plus, ExternalLink } from "lucide-react";
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
  const [minScore, setMinScore] = useState(0);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
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
    if (minScore > 0) list = list.filter(c => (c.last_score_total ?? 0) >= minScore);
    if (statusFilter.length > 0) list = list.filter(c => c.snapshot_status && statusFilter.includes(c.snapshot_status));
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
  }, [search, minScore, statusFilter, partnerFilter, sourceFilter, sortKey, sortAsc, companiesWithSignals]);

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
      className="flex items-center gap-1 text-xs font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
    >
      {label}
      <ArrowUpDown className={`w-3 h-3 ${sortKey === field ? "text-primary" : ""}`} />
    </button>
  );




  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Loading companies…</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">iorad Scout Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {companies.length} companies tracked · Last run{" "}
            {lastJob ? new Date(lastJob.started_at).toLocaleDateString() : "never"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/upload">
            <Button className="gap-2 bg-pink text-pink-foreground hover:bg-pink/90">
              <Plus className="w-4 h-4" /> Add Company
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="panel flex items-center gap-3 px-4 py-3">
          <div className="rounded-lg p-2" style={{ background: "var(--stat-total-bg)" }}>
            <Building2 className="w-5 h-5" style={{ color: "var(--stat-total-fg)" }} />
          </div>
          <div>
            <div className="text-2xl font-bold tracking-tight">{stats.total}</div>
            <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">Total Records</div>
          </div>
        </div>
        <div className="panel flex items-center gap-3 px-4 py-3">
          <div className="rounded-lg p-2" style={{ background: "var(--stat-inbound-bg)" }}>
            <ArrowDownRight className="w-5 h-5" style={{ color: "var(--stat-inbound-fg)" }} />
          </div>
          <div>
            <div className="text-2xl font-bold tracking-tight">{stats.newInbound}</div>
            <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">New Inbound <span className="normal-case text-muted-foreground/60">(24h)</span></div>
          </div>
        </div>
        <div className="panel flex items-center gap-3 px-4 py-3">
          <div className="rounded-lg p-2" style={{ background: "var(--stat-outbound-bg)" }}>
            <ArrowUpRight className="w-5 h-5" style={{ color: "var(--stat-outbound-fg)" }} />
          </div>
          <div>
            <div className="text-2xl font-bold tracking-tight">{stats.newOutbound}</div>
            <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">New Outbound <span className="normal-case text-muted-foreground/60">(24h)</span></div>
          </div>
        </div>
      </div>

      <div className="glow-line" />

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search companies..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 bg-secondary border-border" />
        </div>
        <Select value={sourceFilter} onValueChange={setSourceFilter}>
          <SelectTrigger className="w-[160px] h-8 text-xs bg-secondary border-border">
            <SelectValue placeholder="All Sources" />
          </SelectTrigger>
          <SelectContent className="bg-popover border-border z-50">
            <SelectItem value="all">All Sources</SelectItem>
            <SelectItem value="inbound">Inbound</SelectItem>
            <SelectItem value="outbound">Outbound</SelectItem>
          </SelectContent>
        </Select>
        <Select value={partnerFilter} onValueChange={setPartnerFilter}>
          <SelectTrigger className="w-[180px] h-8 text-xs bg-secondary border-border">
            <SelectValue placeholder="All Partners" />
          </SelectTrigger>
          <SelectContent className="bg-popover border-border z-50">
            <SelectItem value="all">All Partners</SelectItem>
            {partners.map(p => (
              <SelectItem key={p} value={p}>{p}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="border rounded-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-secondary/50">
                <th className="text-left px-4 py-3"><SortHeader label="Company" field="name" /></th>
                <th className="text-left px-4 py-3 hidden md:table-cell"><span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Source</span></th>
                <th className="text-left px-4 py-3 hidden md:table-cell"><span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Partner</span></th>
                <th className="text-left px-4 py-3 hidden lg:table-cell"><span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Partner Rep</span></th>
                <th className="text-left px-4 py-3 hidden lg:table-cell"><SortHeader label="Date Added" field="created_at" /></th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((company, i) => (
                <motion.tr
                  key={company.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: Math.min(i * 0.02, 0.5) }}
                  className="border-b border-border/50 hover:bg-secondary/30 transition-colors cursor-pointer"
                  onClick={() => navigate(`/company/${company.id}`)}
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-foreground">{company.name}</div>
                    <div className="text-xs text-muted-foreground">{company.domain || "—"}</div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span
                      className="text-[11px] font-mono font-medium uppercase tracking-wider px-2 py-0.5 rounded-full border"
                      style={(company as any).source_type === "inbound" ? {
                        background: "var(--source-inbound-bg)",
                        color: "var(--source-inbound-fg)",
                        borderColor: "var(--source-inbound-border)",
                      } : {
                        background: "var(--source-outbound-bg)",
                        color: "var(--source-outbound-fg)",
                        borderColor: "var(--source-outbound-border)",
                      }}
                    >
                      {(company as any).source_type || "outbound"}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-xs text-muted-foreground">{company.partner || "—"}</td>
                  <td className="px-4 py-3 hidden lg:table-cell text-xs text-muted-foreground">
                    {company.partner_rep_name || "—"}
                    {company.partner_rep_email && <div className="text-[10px] text-muted-foreground/60">{company.partner_rep_email}</div>}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-xs text-muted-foreground">
                    {new Date(company.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    {company.snapshot_status === "Generated" && (
                      <Link to={`/company/${company.id}`}>
                        <Button variant="outline" size="sm" className="gap-1.5 text-xs h-7 border-pink text-pink hover:bg-pink/10">
                          <ExternalLink className="w-3 h-3" />
                          View Story
                        </Button>
                      </Link>
                    )}
                  </td>
                </motion.tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                    {companies.length === 0 ? "No companies yet. Upload a CSV to get started." : "No companies match your filters."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
