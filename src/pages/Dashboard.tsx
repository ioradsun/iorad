import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useCompanies, useSignalCounts, useProcessingJobs, useRunSignals } from "@/hooks/useSupabase";
import { toast } from "sonner";
import StatusBadge from "@/components/StatusBadge";
import ScoreCell from "@/components/ScoreCell";
import { ArrowUpDown, Play, Search, SlidersHorizontal, Loader2, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { motion } from "framer-motion";
import { customers } from "@/data/customers";

const storyIds = new Set(customers.map(c => c.id));

type SortKey = "name" | "last_score_total" | "signals_count" | "snapshot_status" | "updated_at";

export default function Dashboard() {
  const { data: companies = [], isLoading } = useCompanies();
  const { data: signalCounts = {} } = useSignalCounts();
  const { data: jobs = [] } = useProcessingJobs();
  const runSignals = useRunSignals();
  const [runProgress, setRunProgress] = useState<string | null>(null);

  const [sortKey, setSortKey] = useState<SortKey>("last_score_total");
  const [sortAsc, setSortAsc] = useState(false);
  const [search, setSearch] = useState("");
  const [minScore, setMinScore] = useState(0);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [partnerFilter, setPartnerFilter] = useState<string>("all");

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

    list.sort((a, b) => {
      let av: any, bv: any;
      switch (sortKey) {
        case "name": av = a.name; bv = b.name; break;
        case "last_score_total": av = a.last_score_total ?? -1; bv = b.last_score_total ?? -1; break;
        case "signals_count": av = a.signals_count; bv = b.signals_count; break;
        case "snapshot_status": av = a.snapshot_status ?? ""; bv = b.snapshot_status ?? ""; break;
        case "updated_at": av = a.updated_at; bv = b.updated_at; break;
        default: av = 0; bv = 0;
      }
      if (av < bv) return sortAsc ? -1 : 1;
      if (av > bv) return sortAsc ? 1 : -1;
      return 0;
    });
    return list;
  }, [search, minScore, statusFilter, partnerFilter, sortKey, sortAsc, companiesWithSignals]);

  const partners = useMemo(() => {
    const set = new Set(companies.map(c => c.partner).filter(Boolean) as string[]);
    return Array.from(set).sort();
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

  const statuses = ["Generated", "Low Signal", "No Change", "Error"];
  const scored = companiesWithSignals.filter(c => c.last_score_total !== null);
  const avgScore = scored.length > 0 ? Math.round(scored.reduce((s, c) => s + (c.last_score_total ?? 0), 0) / scored.length) : 0;

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
          <h1 className="text-2xl font-bold tracking-tight">Signal Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {companies.length} companies tracked · Last run{" "}
            {lastJob ? new Date(lastJob.started_at).toLocaleDateString() : "never"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {runProgress && (
            <span className="text-xs text-muted-foreground font-mono">{runProgress}</span>
          )}
          <Button
            className="gap-2"
            disabled={runSignals.isPending}
            onClick={() => {
              setRunProgress("Starting…");
              const progressCb = (processed: number, total: number, name: string) => {
                setRunProgress(`${processed}/${total} — ${name}`);
              };
              runSignals.mutate(progressCb, {
                onSuccess: (data) => {
                  setRunProgress(null);
                  toast.success(`Job complete: ${data?.total_processed ?? 0} companies processed`);
                },
                onError: (err: any) => {
                  setRunProgress(null);
                  toast.error(`Run failed: ${err.message}`);
                },
              });
            }}
          >
            {runSignals.isPending ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Running…</>
            ) : (
              <><Play className="w-4 h-4" /> Run Now</>
            )}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { label: "Total Companies", value: companies.length },
          { label: "Snapshots Generated", value: companies.filter(c => c.snapshot_status === "Generated").length },
          { label: "Not Started", value: companies.filter(c => !c.snapshot_status || c.snapshot_status === "Low Signal").length },
        ].map(({ label, value }) => (
          <motion.div key={label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="panel">
            <div className="panel-header">{label}</div>
            <div className="text-2xl font-display font-bold text-foreground">{value}</div>
          </motion.div>
        ))}
      </div>

      <div className="glow-line" />

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search companies..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 bg-secondary border-border" />
        </div>
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
        <div className="flex items-center gap-2 text-xs">
          <SlidersHorizontal className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-muted-foreground">Min Score:</span>
          <Input type="number" min={0} max={100} value={minScore} onChange={e => setMinScore(Number(e.target.value))} className="w-16 h-8 bg-secondary border-border text-xs" />
        </div>
      </div>

      <div className="border rounded-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-secondary/50">
                <th className="text-left px-4 py-3"><SortHeader label="Company" field="name" /></th>
                <th className="text-left px-4 py-3"><SortHeader label="Score" field="last_score_total" /></th>
                <th className="text-left px-4 py-3 hidden md:table-cell"><span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Industry</span></th>
                <th className="text-left px-4 py-3 hidden md:table-cell"><span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Partner</span></th>
                <th className="text-left px-4 py-3 hidden lg:table-cell"><span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Partner Rep</span></th>
                <th className="text-left px-4 py-3"><SortHeader label="Status" field="snapshot_status" /></th>
                <th className="text-left px-4 py-3 hidden sm:table-cell"><SortHeader label="Signals" field="signals_count" /></th>
                <th className="text-left px-4 py-3 hidden lg:table-cell"><SortHeader label="Updated" field="updated_at" /></th>
                <th className="px-4 py-3 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((company, i) => (
                <motion.tr
                  key={company.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: Math.min(i * 0.02, 0.5) }}
                  className="border-b border-border/50 hover:bg-secondary/30 transition-colors"
                >
                  <td className="px-4 py-3">
                    <Link to={`/company/${company.id}`} className="group">
                      <div className="font-medium text-foreground group-hover:text-primary transition-colors">{company.name}</div>
                      <div className="text-xs text-muted-foreground">{company.domain || "—"}</div>
                    </Link>
                  </td>
                  <td className="px-4 py-3"><ScoreCell score={company.last_score_total} /></td>
                  <td className="px-4 py-3 hidden md:table-cell text-xs text-muted-foreground">{company.industry?.replace(/_/g, " ").toLowerCase() || "—"}</td>
                  <td className="px-4 py-3 hidden md:table-cell text-xs text-muted-foreground">{company.partner || "—"}</td>
                  <td className="px-4 py-3 hidden lg:table-cell text-xs text-muted-foreground">
                    {company.partner_rep_name || "—"}
                    {company.partner_rep_email && <div className="text-[10px] text-muted-foreground/60">{company.partner_rep_email}</div>}
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={company.snapshot_status} /></td>
                  <td className="px-4 py-3 hidden sm:table-cell data-cell text-muted-foreground">{company.signals_count}</td>
                  <td className="px-4 py-3 hidden lg:table-cell text-xs text-muted-foreground">
                    {company.last_processed_at ? new Date(company.last_processed_at).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {storyIds.has(company.name.toLowerCase()) && (() => {
                      const cust = customers.find(c => c.id === company.name.toLowerCase());
                      return cust ? (
                        <a href={`/${cust.partner}/${cust.id}/stories`} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors" title="Open Story">
                          <BookOpen className="w-4 h-4" />
                        </a>
                      ) : null;
                    })()}
                  </td>
                </motion.tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-muted-foreground">
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
