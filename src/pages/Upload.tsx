import { useState, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import Papa from "papaparse";
import { CSVRow, ValidationError } from "@/types";
import { useInsertCompanies } from "@/hooks/useSupabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload as UploadIcon, FileText, AlertTriangle, CheckCircle2, X, Building2, Globe, Users, Plus, ArrowLeft } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

const COLUMN_MAP: Record<string, keyof CSVRow> = {
  "account name": "company_name",
  "company_name": "company_name",
  "company name": "company_name",
  "name": "company_name",
  "domain": "domain",
  "website": "domain",
  "partner": "partner",
  "partner rep email": "partner_rep_email",
  "partner_rep_email": "partner_rep_email",
  "partner rep name": "partner_rep_name",
  "partner_rep_name": "partner_rep_name",
  "hq country": "hq_country",
  "hq_country": "hq_country",
  "country": "hq_country",
  "industry": "industry",
  "headcount": "headcount",
  "iorad existing customer": "is_existing_customer",
  "existing customer": "is_existing_customer",
  "is_existing_customer": "is_existing_customer",
  "persona": "persona",
  "account_type": "account_type",
  "category": "account_type",
  // backward compat: map source_type values via post-processing
  "source_type": "account_type",
};

function guessDomain(name: string): string | null {
  const clean = name.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim().split(/\s+/);
  if (clean.length === 0) return null;
  return clean[0] + ".com";
}

export default function UploadPage() {
  const navigate = useNavigate();
  const insertCompanies = useInsertCompanies();
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<CSVRow[]>([]);
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [validCount, setValidCount] = useState(0);
  const [duplicates, setDuplicates] = useState(0);
  const [parsed, setParsed] = useState(false);
  const [importing, setImporting] = useState(false);
  const [detectedColumns, setDetectedColumns] = useState<string[]>([]);
  const [unmappedColumns, setUnmappedColumns] = useState<string[]>([]);

  const handleFile = useCallback((f: File) => {
    setFile(f);
    setParsed(false);
    setErrors([]);
    setRows([]);

    Papa.parse<Record<string, string>>(f, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const errs: ValidationError[] = [];
        const seen = new Set<string>();
        const valid: CSVRow[] = [];
        let dupes = 0;

        const headers = results.meta.fields || [];
        setDetectedColumns(headers);
        const unmapped: string[] = [];
        headers.forEach(h => {
          const key = h.toLowerCase().trim();
          if (!COLUMN_MAP[key] && h.trim()) unmapped.push(h);
        });
        setUnmappedColumns(unmapped);

        const data = results.data.slice(0, 1000);
        if (results.data.length > 1000) {
          errs.push({ row: 0, field: "file", message: `File has ${results.data.length} rows. Only the first 1,000 will be processed.` });
        }

        data.forEach((row, i) => {
          const rowNum = i + 2;
          const mappedRow: Partial<CSVRow> = {};
          for (const [header, value] of Object.entries(row)) {
            const key = header.toLowerCase().trim();
            const field = COLUMN_MAP[key];
            if (field) (mappedRow as any)[field] = (value || "").trim();
          }

          const name = (mappedRow.company_name || "").trim();
          if (!name) { errs.push({ row: rowNum, field: "company_name", message: "Company name is required" }); return; }

          const domain = (mappedRow.domain || "").trim().toLowerCase() || guessDomain(name);
          const dedupeKey = domain || name.toLowerCase();
          if (seen.has(dedupeKey)) { dupes++; return; }
          seen.add(dedupeKey);

          const headcountRaw = mappedRow.headcount as any;
          const headcount = headcountRaw ? parseInt(String(headcountRaw), 10) || null : null;
          const existingRaw = (mappedRow.is_existing_customer as any || "").toString().toLowerCase();
          const isExisting = existingRaw === "true" || existingRaw === "yes" || existingRaw === "1";

          // Backward compat: map source_type → account_type
          let account_type = (mappedRow.account_type as any) || null;
          if (!account_type) account_type = "company";
          if (account_type === "inbound") account_type = "company";
          if (account_type === "outbound") account_type = (mappedRow.partner as any) ? "partner" : "company";
          if (account_type === "business") account_type = "company";

          // Map old stage values
          let lifecycle_stage = (mappedRow.lifecycle_stage as any) || "prospect";
          if (lifecycle_stage === "active_opp") lifecycle_stage = "opportunity";
          if (lifecycle_stage === "expansion") lifecycle_stage = "customer";

          const sales_motion = lifecycle_stage === "customer" ? "expansion" : lifecycle_stage === "opportunity" ? "active-deal" : "new-logo";
          const relationship_type = (mappedRow.partner as any) ? "partner-managed" : "direct";
          const brief_type = lifecycle_stage === "customer" ? "expansionBrief" : lifecycle_stage === "opportunity" ? "opportunityBrief" : "prospectBrief";

          valid.push({
            company_name: name, domain: domain || null, partner: (mappedRow.partner as any) || null,
            partner_rep_email: (mappedRow.partner_rep_email as any) || null, partner_rep_name: (mappedRow.partner_rep_name as any) || null,
            hq_country: (mappedRow.hq_country as any) || null, industry: (mappedRow.industry as any) || null,
            headcount, is_existing_customer: isExisting, persona: (mappedRow.persona as any) || null,
            account_type, lifecycle_stage, sales_motion, relationship_type, brief_type,
          });
        });

        setRows(valid);
        setErrors(errs);
        setValidCount(valid.length);
        setDuplicates(dupes);
        setParsed(true);
      },
      error: () => { toast.error("Failed to parse CSV file"); },
    });
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f && f.name.endsWith(".csv")) handleFile(f);
    else toast.error("Please drop a .csv file");
  }, [handleFile]);

  const handleImport = async () => {
    setImporting(true);
    try {
      const dbRows = rows.map(r => ({
        name: r.company_name,
        domain: r.domain,
        partner: r.partner,
        partner_rep_email: r.partner_rep_email,
        partner_rep_name: r.partner_rep_name,
        hq_country: r.hq_country,
        industry: r.industry,
        headcount: r.headcount,
        is_existing_customer: r.is_existing_customer,
        persona: r.persona,
        account_type: (r as any).account_type || "company",
        lifecycle_stage: (r as any).lifecycle_stage || "prospect",
        sales_motion: (r as any).sales_motion || "new-logo",
        relationship_type: (r as any).relationship_type || "direct",
        brief_type: (r as any).brief_type || "prospectBrief",
      }));
      await insertCompanies.mutateAsync(dbRows);
      toast.success(`Imported ${validCount} companies into the database`);
      navigate("/");
    } catch (err: any) {
      toast.error(`Import failed: ${err.message}`);
    } finally {
      setImporting(false);
    }
  };

  const countries = new Set(rows.map(r => r.hq_country).filter(Boolean));
  const partners = new Set(rows.map(r => r.partner).filter(Boolean));
  const industries = new Set(rows.map(r => r.industry).filter(Boolean));

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/" className="text-foreground/45 hover:text-foreground transition-colors"><ArrowLeft className="w-5 h-5" /></Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Add Companies</h1>
            <p className="text-sm text-foreground/45 mt-1">
              Add manually or upload a CSV.
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl">
        <Tabs defaultValue="manual" className="space-y-8">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="manual">Add Manually</TabsTrigger>
          <TabsTrigger value="upload">CSV Upload</TabsTrigger>
        </TabsList>

        <TabsContent value="manual">
          <ManualAddForm />
        </TabsContent>

        <TabsContent value="upload" className="space-y-8">

      <div
        onDrop={handleDrop}
        onDragOver={e => e.preventDefault()}
        className="border-2 border-dashed border-border rounded-lg p-12 text-center hover:border-primary/50 transition-colors cursor-pointer"
        onClick={() => {
          const input = document.createElement("input");
          input.type = "file"; input.accept = ".csv";
          input.onchange = (e) => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) handleFile(f); };
          input.click();
        }}
      >
        <UploadIcon className="w-10 h-10 text-foreground/45 mx-auto mb-3" />
        <p className="text-sm text-foreground/45">Drag & drop a CSV file here, or <span className="text-primary">click to browse</span></p>
      </div>

      <AnimatePresence>
        {file && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="panel">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-primary" />
                <div>
                  <div className="text-sm font-medium">{file.name}</div>
                  <div className="text-xs text-foreground/45">{(file.size / 1024).toFixed(1)} KB</div>
                </div>
              </div>
              <button onClick={() => { setFile(null); setParsed(false); setRows([]); setErrors([]); }} className="text-foreground/45 hover:text-foreground"><X className="w-4 h-4" /></button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {parsed && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          <div className="panel">
            <div className="panel-header">Column Mapping</div>
            <div className="flex flex-wrap gap-1.5">
              {detectedColumns.filter(h => h.trim()).map(h => {
                const key = h.toLowerCase().trim();
                const mapped = COLUMN_MAP[key];
                return (
                  <span key={h} className={`text-xs px-2 py-0.5 rounded border ${mapped ? "border-primary/30 bg-primary/10 text-primary" : "border-border text-foreground/45"}`}>
                    {h} {mapped ? `→ ${mapped}` : "(ignored)"}
                  </span>
                );
              })}
            </div>
            {unmappedColumns.length > 0 && <p className="text-xs text-foreground/45 mt-2">{unmappedColumns.length} column(s) not mapped.</p>}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="panel text-center"><div className="text-2xl font-display font-bold text-primary">{validCount}</div><div className="text-xs text-foreground/45 mt-1">Valid companies</div></div>
            <div className="panel text-center"><div className="text-2xl font-display font-bold text-warning">{duplicates}</div><div className="text-xs text-foreground/45 mt-1">Duplicates removed</div></div>
            <div className="panel text-center"><div className="text-2xl font-display font-bold text-destructive">{errors.length}</div><div className="text-xs text-foreground/45 mt-1">Validation errors</div></div>
            <div className="panel text-center"><div className="text-2xl font-display font-bold text-info">{partners.size}</div><div className="text-xs text-foreground/45 mt-1">Partners</div></div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="panel">
              <div className="flex items-center gap-2 mb-2"><Globe className="w-3.5 h-3.5 text-foreground/45" /><span className="section-label">Countries</span></div>
              <div className="flex flex-wrap gap-1">
                {Array.from(countries).slice(0, 8).map(c => <span key={c} className="text-xs bg-secondary px-1.5 py-0.5 rounded text-secondary-foreground">{c}</span>)}
                {countries.size > 8 && <span className="text-xs text-foreground/45">+{countries.size - 8} more</span>}
              </div>
            </div>
            <div className="panel">
              <div className="flex items-center gap-2 mb-2"><Building2 className="w-3.5 h-3.5 text-foreground/45" /><span className="section-label">Top Industries</span></div>
              <div className="flex flex-wrap gap-1">
                {Array.from(industries).slice(0, 5).map(ind => <span key={ind} className="text-xs bg-secondary px-1.5 py-0.5 rounded text-secondary-foreground">{(ind || "").replace(/_/g, " ").toLowerCase()}</span>)}
                {industries.size > 5 && <span className="text-xs text-foreground/45">+{industries.size - 5} more</span>}
              </div>
            </div>
            <div className="panel">
              <div className="flex items-center gap-2 mb-2"><Users className="w-3.5 h-3.5 text-foreground/45" /><span className="section-label">Personas</span></div>
              <div className="flex flex-wrap gap-1">
                {Array.from(new Set(rows.map(r => r.persona).filter(Boolean))).slice(0, 5).map(p => <span key={p} className="text-xs bg-secondary px-1.5 py-0.5 rounded text-secondary-foreground">{p}</span>)}
              </div>
            </div>
          </div>

          {errors.length > 0 && (
            <div className="panel max-h-48 overflow-y-auto space-y-1">
              <div className="panel-header flex items-center gap-2"><AlertTriangle className="w-3.5 h-3.5" /> Validation Errors</div>
              {errors.slice(0, 20).map((err, i) => <div key={i} className="text-xs text-destructive/80 font-mono">Row {err.row}: [{err.field}] {err.message}</div>)}
              {errors.length > 20 && <div className="text-xs text-foreground/45">...and {errors.length - 20} more</div>}
            </div>
          )}

          {validCount > 0 && (
            <div className="panel">
              <div className="panel-header flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-primary" /> Preview (first 10)</div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b">
                    <th className="text-left py-1.5 px-2 text-micro font-medium uppercase tracking-wide text-foreground/45">Company</th>
                    <th className="text-left py-1.5 px-2 text-micro font-medium uppercase tracking-wide text-foreground/45">Domain</th>
                    <th className="text-left py-1.5 px-2 text-micro font-medium uppercase tracking-wide text-foreground/45 hidden sm:table-cell">Partner</th>
                    <th className="text-left py-1.5 px-2 text-micro font-medium uppercase tracking-wide text-foreground/45 hidden md:table-cell">Country</th>
                    <th className="text-left py-1.5 px-2 text-micro font-medium uppercase tracking-wide text-foreground/45 hidden md:table-cell">Industry</th>
                  </tr></thead>
                  <tbody>
                    {rows.slice(0, 10).map((r, i) => (
                      <tr key={i} className="border-b border-border/30">
                        <td className="py-1.5 px-2 font-medium">{r.company_name}</td>
                        <td className="py-1.5 px-2 text-xs text-foreground/45 font-mono">{r.domain || "—"}</td>
                        <td className="py-1.5 px-2 text-xs text-foreground/45 hidden sm:table-cell">{r.partner || "—"}</td>
                        <td className="py-1.5 px-2 text-xs text-foreground/45 hidden md:table-cell">{r.hq_country || "—"}</td>
                        <td className="py-1.5 px-2 text-xs text-foreground/45 hidden md:table-cell">{r.industry?.replace(/_/g, " ").toLowerCase() || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <Button onClick={handleImport} disabled={validCount === 0 || importing} className="w-full gap-2">
            {importing ? <>Importing to database...</> : <><CheckCircle2 className="w-4 h-4" />Import {validCount} Companies</>}
          </Button>
        </motion.div>
      )}
        </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

const PARTNERS = ["seismic", "workramp", "360learning", "docebo", "gainsight"];

const CATEGORIES = [
  { value: "school", label: "School (EDU)" },
  { value: "company", label: "Company (B2B)" },
  { value: "partner", label: "Partner (LMS Reseller)" },
];

const STAGES = [
  { value: "prospect", label: "Prospect" },
  { value: "opportunity", label: "Opportunity" },
  { value: "customer", label: "Customer" },
];

function ManualAddForm() {
  const navigate = useNavigate();
  const insertCompanies = useInsertCompanies();
  const [form, setForm] = useState({
    name: "",
    domain: "",
    partner: "",
    account_type: "company",
    lifecycle_stage: "prospect",
  });
  const [saving, setSaving] = useState(false);

  const update = (key: string, value: string) => setForm(prev => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = form.name.trim();
    if (!name) { toast.error("Company name is required"); return; }
    if (name.length > 200) { toast.error("Company name is too long"); return; }

    const domain = form.domain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "") || null;

    setSaving(true);
    try {
      const lifecycle_stage = form.lifecycle_stage;
      const sales_motion = lifecycle_stage === "customer" ? "expansion" : lifecycle_stage === "opportunity" ? "active-deal" : "new-logo";
      const relationship_type = form.account_type === "partner" ? "partner-managed" : "direct";
      const brief_type = lifecycle_stage === "customer" ? "expansionBrief" : lifecycle_stage === "opportunity" ? "opportunityBrief" : "prospectBrief";

      await insertCompanies.mutateAsync([{
        name,
        domain,
        partner: form.account_type === "partner" ? (form.partner || null) : null,
        is_existing_customer: lifecycle_stage === "customer",
        account_type: form.account_type,
        lifecycle_stage,
        sales_motion,
        relationship_type,
        brief_type,
        source_type: form.account_type === "partner" ? "outbound" : "inbound",
      } as any]);
      toast.success(`Added ${name}`);
      navigate("/");
    } catch (err: any) {
      toast.error(`Failed: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="panel space-y-5">
      <div className="panel-header">Add a Company</div>

      {/* Category selector */}
      <div className="space-y-2">
        <Label className="text-xs">Account Type</Label>
        <div className="flex items-center bg-secondary rounded-md p-0.5 gap-0.5 w-fit">
          {CATEGORIES.map(cat => (
            <button
              key={cat.value}
              type="button"
              onClick={() => { update("account_type", cat.value); if (cat.value !== "partner") update("partner", ""); }}
              className={`px-4 py-1.5 rounded text-xs font-medium transition-all ${
                form.account_type === cat.value
                  ? "bg-card text-foreground shadow-sm shadow-black/[0.06]"
                  : "text-foreground/45 hover:text-foreground"
              }`}
            >
              {cat.value === "school" ? "School" : cat.value === "company" ? "Company" : "Partner"}
            </button>
          ))}
        </div>
        <p className="text-micro text-foreground/45">
          {form.account_type === "school" && "EDU institution or university"}
          {form.account_type === "company" && "Corporate / B2B prospect or customer"}
          {form.account_type === "partner" && "LMS reseller (Seismic, Docebo, etc.)"}
        </p>
      </div>

      {/* Stage selector */}
      <div className="space-y-2">
        <Label className="text-xs">Lifecycle Stage</Label>
        <div className="flex items-center bg-secondary rounded-md p-0.5 gap-0.5 w-fit">
          {STAGES.map(s => (
            <button
              key={s.value}
              type="button"
              onClick={() => update("lifecycle_stage", s.value)}
              className={`px-3.5 py-1.5 rounded text-xs font-medium transition-all ${
                form.lifecycle_stage === s.value
                  ? "bg-card text-foreground shadow-sm shadow-black/[0.06]"
                  : "text-foreground/45 hover:text-foreground"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2 col-span-2 sm:col-span-1">
          <Label className="text-xs">Company Name *</Label>
          <Input
            value={form.name}
            onChange={e => update("name", e.target.value)}
            placeholder="Acme Corp"
            className="bg-secondary"
            maxLength={200}
            required
          />
        </div>
        <div className="space-y-2 col-span-2 sm:col-span-1">
          <Label className="text-xs">Domain</Label>
          <Input
            value={form.domain}
            onChange={e => update("domain", e.target.value)}
            placeholder="acme.com"
            className="bg-secondary"
            maxLength={255}
          />
        </div>
        {form.account_type === "partner" && (
          <div className="space-y-2 col-span-2">
            <Label className="text-xs">Partner</Label>
            <Select value={form.partner} onValueChange={v => update("partner", v)}>
              <SelectTrigger className="bg-secondary"><SelectValue placeholder="Select partner" /></SelectTrigger>
              <SelectContent className="bg-background z-50">
                {PARTNERS.map(p => <SelectItem key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
      <Button type="submit" disabled={saving || !form.name.trim()} className="w-full gap-2">
        {saving ? <>Adding…</> : <><Plus className="w-4 h-4" />Add Company</>}
      </Button>
    </form>
  );
}

