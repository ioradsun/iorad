import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Papa from "papaparse";
import { CSVRow, ValidationError } from "@/types";
import { useInsertCompanies } from "@/hooks/useSupabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload as UploadIcon, FileText, AlertTriangle, CheckCircle2, X, Building2, Globe, Users, Plus, Copy, ExternalLink } from "lucide-react";
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

          valid.push({
            company_name: name, domain: domain || null, partner: (mappedRow.partner as any) || null,
            partner_rep_email: (mappedRow.partner_rep_email as any) || null, partner_rep_name: (mappedRow.partner_rep_name as any) || null,
            hq_country: (mappedRow.hq_country as any) || null, industry: (mappedRow.industry as any) || null,
            headcount, is_existing_customer: isExisting, persona: (mappedRow.persona as any) || null,
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
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Add Companies</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Upload a CSV, manually add, or import from Clay.
        </p>
      </div>

      <Tabs defaultValue="upload" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="upload">CSV Upload</TabsTrigger>
          <TabsTrigger value="manual">Add Manually</TabsTrigger>
          <TabsTrigger value="clay">Clay Import</TabsTrigger>
        </TabsList>

        <TabsContent value="manual">
          <ManualAddForm />
        </TabsContent>

        <TabsContent value="clay">
          <ClayImportInfo />
        </TabsContent>

        <TabsContent value="upload" className="space-y-6">

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
        <UploadIcon className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">Drag & drop a CSV file here, or <span className="text-primary">click to browse</span></p>
      </div>

      <AnimatePresence>
        {file && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="panel">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-primary" />
                <div>
                  <div className="text-sm font-medium">{file.name}</div>
                  <div className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</div>
                </div>
              </div>
              <button onClick={() => { setFile(null); setParsed(false); setRows([]); setErrors([]); }} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
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
                  <span key={h} className={`text-xs px-2 py-0.5 rounded border ${mapped ? "border-primary/30 bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}>
                    {h} {mapped ? `→ ${mapped}` : "(ignored)"}
                  </span>
                );
              })}
            </div>
            {unmappedColumns.length > 0 && <p className="text-xs text-muted-foreground mt-2">{unmappedColumns.length} column(s) not mapped.</p>}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="panel text-center"><div className="text-2xl font-display font-bold text-primary">{validCount}</div><div className="text-xs text-muted-foreground mt-1">Valid companies</div></div>
            <div className="panel text-center"><div className="text-2xl font-display font-bold text-warning">{duplicates}</div><div className="text-xs text-muted-foreground mt-1">Duplicates removed</div></div>
            <div className="panel text-center"><div className="text-2xl font-display font-bold text-destructive">{errors.length}</div><div className="text-xs text-muted-foreground mt-1">Validation errors</div></div>
            <div className="panel text-center"><div className="text-2xl font-display font-bold text-info">{partners.size}</div><div className="text-xs text-muted-foreground mt-1">Partners</div></div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="panel">
              <div className="flex items-center gap-2 mb-2"><Globe className="w-3.5 h-3.5 text-muted-foreground" /><span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Countries</span></div>
              <div className="flex flex-wrap gap-1">
                {Array.from(countries).slice(0, 8).map(c => <span key={c} className="text-xs bg-secondary px-1.5 py-0.5 rounded text-secondary-foreground">{c}</span>)}
                {countries.size > 8 && <span className="text-xs text-muted-foreground">+{countries.size - 8} more</span>}
              </div>
            </div>
            <div className="panel">
              <div className="flex items-center gap-2 mb-2"><Building2 className="w-3.5 h-3.5 text-muted-foreground" /><span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Top Industries</span></div>
              <div className="flex flex-wrap gap-1">
                {Array.from(industries).slice(0, 5).map(ind => <span key={ind} className="text-xs bg-secondary px-1.5 py-0.5 rounded text-secondary-foreground">{(ind || "").replace(/_/g, " ").toLowerCase()}</span>)}
                {industries.size > 5 && <span className="text-xs text-muted-foreground">+{industries.size - 5} more</span>}
              </div>
            </div>
            <div className="panel">
              <div className="flex items-center gap-2 mb-2"><Users className="w-3.5 h-3.5 text-muted-foreground" /><span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Personas</span></div>
              <div className="flex flex-wrap gap-1">
                {Array.from(new Set(rows.map(r => r.persona).filter(Boolean))).slice(0, 5).map(p => <span key={p} className="text-xs bg-secondary px-1.5 py-0.5 rounded text-secondary-foreground">{p}</span>)}
              </div>
            </div>
          </div>

          {errors.length > 0 && (
            <div className="panel max-h-48 overflow-y-auto space-y-1">
              <div className="panel-header flex items-center gap-2"><AlertTriangle className="w-3.5 h-3.5" /> Validation Errors</div>
              {errors.slice(0, 20).map((err, i) => <div key={i} className="text-xs text-destructive/80 font-mono">Row {err.row}: [{err.field}] {err.message}</div>)}
              {errors.length > 20 && <div className="text-xs text-muted-foreground">...and {errors.length - 20} more</div>}
            </div>
          )}

          {validCount > 0 && (
            <div className="panel">
              <div className="panel-header flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-primary" /> Preview (first 10)</div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b">
                    <th className="text-left py-1.5 px-2 text-xs font-mono uppercase tracking-wider text-muted-foreground">Company</th>
                    <th className="text-left py-1.5 px-2 text-xs font-mono uppercase tracking-wider text-muted-foreground">Domain</th>
                    <th className="text-left py-1.5 px-2 text-xs font-mono uppercase tracking-wider text-muted-foreground hidden sm:table-cell">Partner</th>
                    <th className="text-left py-1.5 px-2 text-xs font-mono uppercase tracking-wider text-muted-foreground hidden md:table-cell">Country</th>
                    <th className="text-left py-1.5 px-2 text-xs font-mono uppercase tracking-wider text-muted-foreground hidden md:table-cell">Industry</th>
                  </tr></thead>
                  <tbody>
                    {rows.slice(0, 10).map((r, i) => (
                      <tr key={i} className="border-b border-border/30">
                        <td className="py-1.5 px-2 font-medium">{r.company_name}</td>
                        <td className="py-1.5 px-2 text-xs text-muted-foreground font-mono">{r.domain || "—"}</td>
                        <td className="py-1.5 px-2 text-xs text-muted-foreground hidden sm:table-cell">{r.partner || "—"}</td>
                        <td className="py-1.5 px-2 text-xs text-muted-foreground hidden md:table-cell">{r.hq_country || "—"}</td>
                        <td className="py-1.5 px-2 text-xs text-muted-foreground hidden md:table-cell">{r.industry?.replace(/_/g, " ").toLowerCase() || "—"}</td>
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
  );
}

const PARTNERS = ["seismic", "workramp", "360learning", "docebo", "gainsight"];

const PERSONAS = [
  "Learning & Development",
  "Sales Enablement",
  "Revenue Enablement",
  "Customer Education",
  "Partner Enablement",
];

function ManualAddForm() {
  const navigate = useNavigate();
  const insertCompanies = useInsertCompanies();
  const [form, setForm] = useState({
    name: "",
    domain: "",
    partner: "",
    industry: "",
    hq_country: "",
    persona: "",
    headcount: "",
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
      await insertCompanies.mutateAsync([{
        name,
        domain,
        partner: form.partner || null,
        industry: form.industry.trim() || null,
        hq_country: form.hq_country.trim() || null,
        persona: form.persona.trim() || null,
        headcount: form.headcount ? parseInt(form.headcount, 10) || null : null,
        is_existing_customer: false,
        partner_rep_email: null,
        partner_rep_name: null,
      }]);
      toast.success(`Added ${name}`);
      navigate("/");
    } catch (err: any) {
      toast.error(`Failed: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="panel space-y-4">
      <div className="panel-header">Add a Company</div>
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
        <div className="space-y-2">
          <Label className="text-xs">Partner</Label>
          <Select value={form.partner} onValueChange={v => update("partner", v)}>
            <SelectTrigger className="bg-secondary"><SelectValue placeholder="Select partner" /></SelectTrigger>
            <SelectContent>
              {PARTNERS.map(p => <SelectItem key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-xs">Industry</Label>
          <Input
            value={form.industry}
            onChange={e => update("industry", e.target.value)}
            placeholder="SaaS, Healthcare…"
            className="bg-secondary"
            maxLength={100}
          />
        </div>
        <div className="space-y-2">
          <Label className="text-xs">HQ Country</Label>
          <Input
            value={form.hq_country}
            onChange={e => update("hq_country", e.target.value)}
            placeholder="US"
            className="bg-secondary"
            maxLength={100}
          />
        </div>
        <div className="space-y-2">
          <Label className="text-xs">Headcount</Label>
          <Input
            type="number"
            value={form.headcount}
            onChange={e => update("headcount", e.target.value)}
            placeholder="500"
            className="bg-secondary"
            min={1}
          />
        </div>
        <div className="space-y-2 col-span-2">
          <Label className="text-xs">Persona</Label>
          <Select value={form.persona} onValueChange={v => update("persona", v)}>
            <SelectTrigger className="bg-secondary"><SelectValue placeholder="Select persona" /></SelectTrigger>
            <SelectContent className="bg-background z-50">
              {PERSONAS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <Button type="submit" disabled={saving || !form.name.trim()} className="w-full gap-2">
        {saving ? <>Adding…</> : <><Plus className="w-4 h-4" />Add Company</>}
      </Button>
    </form>
  );
}

function ClayImportInfo() {
  const webhookUrl = `https://hpdfvqbrmyztmgensfdz.supabase.co/functions/v1/import-from-clay`;

  const copyUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    toast.success("Webhook URL copied to clipboard");
  };

  const fieldMapping = [
    { clay: "Company / Company Name / name", field: "name" },
    { clay: "Domain / Website", field: "domain" },
    { clay: "Industry", field: "industry" },
    { clay: "Country / HQ Country", field: "hq_country" },
    { clay: "Headcount / Employee Count", field: "headcount" },
    { clay: "Partner", field: "partner" },
    { clay: "Persona", field: "persona" },
  ];

  const contactFields = [
    { clay: "contacts[].name / Contact Name", field: "contacts[].name" },
    { clay: "contacts[].title / Job Title", field: "contacts[].title" },
    { clay: "contacts[].email / Contact Email", field: "contacts[].email" },
    { clay: "contacts[].linkedin / LinkedIn URL", field: "contacts[].linkedin" },
  ];

  return (
    <div className="space-y-4">
      <div className="panel space-y-4">
        <div className="panel-header">Clay Webhook Setup</div>
        <p className="text-sm text-muted-foreground">
          Use Clay's <strong>HTTP API</strong> action to push enriched rows to this webhook. Each row will be upserted into your companies table (matched by domain).
        </p>

        <div className="space-y-2">
          <Label className="text-xs">Webhook URL</Label>
          <div className="flex gap-2">
            <Input value={webhookUrl} readOnly className="bg-secondary font-mono text-xs" />
            <Button variant="outline" size="icon" onClick={copyUrl} title="Copy URL">
              <Copy className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-xs">HTTP Method</Label>
          <p className="text-sm font-mono bg-secondary rounded px-3 py-2">POST</p>
        </div>

        <div className="space-y-2">
          <Label className="text-xs">Content-Type Header</Label>
          <p className="text-sm font-mono bg-secondary rounded px-3 py-2">application/json</p>
        </div>
      </div>

      <div className="panel space-y-3">
        <div className="panel-header">Field Mapping</div>
        <p className="text-xs text-muted-foreground">
          Name your Clay columns using any of these labels — the webhook auto-maps them.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-1.5 px-2 text-xs font-mono uppercase tracking-wider text-muted-foreground">Clay Column</th>
                <th className="text-left py-1.5 px-2 text-xs font-mono uppercase tracking-wider text-muted-foreground">Maps To</th>
              </tr>
            </thead>
            <tbody>
              {fieldMapping.map((m, i) => (
                <tr key={i} className="border-b border-border/30">
                  <td className="py-1.5 px-2 text-xs text-muted-foreground">{m.clay}</td>
                  <td className="py-1.5 px-2 text-xs font-mono text-primary">{m.field}</td>
                </tr>
              ))}
              <tr className="border-b"><td colSpan={2} className="py-2 px-2 text-xs font-mono uppercase tracking-wider text-muted-foreground bg-secondary/50">Contacts (multiple per company)</td></tr>
              {contactFields.map((m, i) => (
                <tr key={`c-${i}`} className="border-b border-border/30">
                  <td className="py-1.5 px-2 text-xs text-muted-foreground">{m.clay}</td>
                  <td className="py-1.5 px-2 text-xs font-mono text-primary">{m.field}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel space-y-3">
        <div className="panel-header">How to Set Up in Clay</div>
        <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
          <li>Open your Clay table with enriched company data</li>
          <li>Add an <strong>HTTP API</strong> enrichment (or action)</li>
          <li>Set method to <strong>POST</strong> and paste the webhook URL above</li>
          <li>Set <strong>Content-Type: application/json</strong> in headers</li>
          <li>In the body, map your Clay columns to the field names shown above</li>
          <li>Run the column — companies will appear in your dashboard</li>
        </ol>
        <a
          href="https://university.clay.com/docs/http-api-integration-overview"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
        >
          <ExternalLink className="w-3 h-3" /> Clay HTTP API docs
        </a>
      </div>
    </div>
  );
}
