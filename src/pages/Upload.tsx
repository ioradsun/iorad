import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Papa from "papaparse";
import { CSVRow, ValidationError } from "@/types";
import { Button } from "@/components/ui/button";
import { Upload as UploadIcon, FileText, AlertTriangle, CheckCircle2, X, Building2, Globe, Users } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

// Column mapping: CSV header → our field
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
  // Very basic domain guess from company name
  const clean = name.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim().split(/\s+/);
  if (clean.length === 0) return null;
  return clean[0] + ".com";
}

export default function UploadPage() {
  const navigate = useNavigate();
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

        // Detect and map columns
        const headers = results.meta.fields || [];
        setDetectedColumns(headers);
        const mapped: string[] = [];
        const unmapped: string[] = [];
        headers.forEach(h => {
          const key = h.toLowerCase().trim();
          if (COLUMN_MAP[key]) mapped.push(h);
          else if (h.trim()) unmapped.push(h);
        });
        setUnmappedColumns(unmapped);

        const data = results.data.slice(0, 1000);
        if (results.data.length > 1000) {
          errs.push({ row: 0, field: "file", message: `File has ${results.data.length} rows. Only the first 1,000 will be processed.` });
        }

        data.forEach((row, i) => {
          const rowNum = i + 2;

          // Map columns dynamically
          const mappedRow: Partial<CSVRow> = {};
          for (const [header, value] of Object.entries(row)) {
            const key = header.toLowerCase().trim();
            const field = COLUMN_MAP[key];
            if (field) {
              (mappedRow as any)[field] = (value || "").trim();
            }
          }

          const name = (mappedRow.company_name || "").trim();
          if (!name) {
            errs.push({ row: rowNum, field: "company_name", message: "Company name is required" });
            return;
          }

          const domain = (mappedRow.domain || "").trim().toLowerCase() || guessDomain(name);
          const dedupeKey = domain || name.toLowerCase();

          if (seen.has(dedupeKey)) {
            dupes++;
            return;
          }
          seen.add(dedupeKey);

          const headcountRaw = mappedRow.headcount as any;
          const headcount = headcountRaw ? parseInt(String(headcountRaw), 10) || null : null;

          const existingRaw = (mappedRow.is_existing_customer as any || "").toString().toLowerCase();
          const isExisting = existingRaw === "true" || existingRaw === "yes" || existingRaw === "1";

          valid.push({
            company_name: name,
            domain: domain || null,
            partner: (mappedRow.partner as any) || null,
            partner_rep_email: (mappedRow.partner_rep_email as any) || null,
            partner_rep_name: (mappedRow.partner_rep_name as any) || null,
            hq_country: (mappedRow.hq_country as any) || null,
            industry: (mappedRow.industry as any) || null,
            headcount,
            is_existing_customer: isExisting,
            persona: (mappedRow.persona as any) || null,
          });
        });

        setRows(valid);
        setErrors(errs);
        setValidCount(valid.length);
        setDuplicates(dupes);
        setParsed(true);
      },
      error: () => {
        toast.error("Failed to parse CSV file");
      },
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
    await new Promise(r => setTimeout(r, 1500));
    toast.success(`Imported ${validCount} companies`);
    setImporting(false);
    navigate("/");
  };

  // Stats from parsed data
  const countries = new Set(rows.map(r => r.hq_country).filter(Boolean));
  const partners = new Set(rows.map(r => r.partner).filter(Boolean));
  const industries = new Set(rows.map(r => r.industry).filter(Boolean));

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Upload Companies</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Upload a CSV with an <code className="font-mono text-xs bg-secondary px-1.5 py-0.5 rounded">Account Name</code> or{" "}
          <code className="font-mono text-xs bg-secondary px-1.5 py-0.5 rounded">company_name</code> column.
          Extra fields like Partner, Industry, Country will be auto-detected. Max 1,000 rows.
        </p>
      </div>

      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={e => e.preventDefault()}
        className="border-2 border-dashed border-border rounded-lg p-12 text-center hover:border-primary/50 transition-colors cursor-pointer"
        onClick={() => {
          const input = document.createElement("input");
          input.type = "file";
          input.accept = ".csv";
          input.onchange = (e) => {
            const f = (e.target as HTMLInputElement).files?.[0];
            if (f) handleFile(f);
          };
          input.click();
        }}
      >
        <UploadIcon className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">
          Drag & drop a CSV file here, or <span className="text-primary">click to browse</span>
        </p>
      </div>

      {/* File info */}
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
              <button onClick={() => { setFile(null); setParsed(false); setRows([]); setErrors([]); }} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Validation results */}
      {parsed && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          {/* Column mapping info */}
          <div className="panel">
            <div className="panel-header">Column Mapping</div>
            <div className="flex flex-wrap gap-1.5">
              {detectedColumns.filter(h => h.trim()).map(h => {
                const key = h.toLowerCase().trim();
                const mapped = COLUMN_MAP[key];
                return (
                  <span
                    key={h}
                    className={`text-xs px-2 py-0.5 rounded border ${
                      mapped ? "border-primary/30 bg-primary/10 text-primary" : "border-border text-muted-foreground"
                    }`}
                  >
                    {h} {mapped ? `→ ${mapped}` : "(ignored)"}
                  </span>
                );
              })}
            </div>
            {unmappedColumns.length > 0 && (
              <p className="text-xs text-muted-foreground mt-2">
                {unmappedColumns.length} column(s) not mapped and will be ignored.
              </p>
            )}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="panel text-center">
              <div className="text-2xl font-display font-bold text-primary">{validCount}</div>
              <div className="text-xs text-muted-foreground mt-1">Valid companies</div>
            </div>
            <div className="panel text-center">
              <div className="text-2xl font-display font-bold text-warning">{duplicates}</div>
              <div className="text-xs text-muted-foreground mt-1">Duplicates removed</div>
            </div>
            <div className="panel text-center">
              <div className="text-2xl font-display font-bold text-destructive">{errors.length}</div>
              <div className="text-xs text-muted-foreground mt-1">Validation errors</div>
            </div>
            <div className="panel text-center">
              <div className="text-2xl font-display font-bold text-info">{partners.size}</div>
              <div className="text-xs text-muted-foreground mt-1">Partners</div>
            </div>
          </div>

          {/* Data summary */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="panel">
              <div className="flex items-center gap-2 mb-2">
                <Globe className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Countries</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {Array.from(countries).slice(0, 8).map(c => (
                  <span key={c} className="text-xs bg-secondary px-1.5 py-0.5 rounded text-secondary-foreground">{c}</span>
                ))}
                {countries.size > 8 && <span className="text-xs text-muted-foreground">+{countries.size - 8} more</span>}
              </div>
            </div>
            <div className="panel">
              <div className="flex items-center gap-2 mb-2">
                <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Top Industries</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {Array.from(industries).slice(0, 5).map(ind => (
                  <span key={ind} className="text-xs bg-secondary px-1.5 py-0.5 rounded text-secondary-foreground">
                    {(ind || "").replace(/_/g, " ").toLowerCase()}
                  </span>
                ))}
                {industries.size > 5 && <span className="text-xs text-muted-foreground">+{industries.size - 5} more</span>}
              </div>
            </div>
            <div className="panel">
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Personas</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {Array.from(new Set(rows.map(r => r.persona).filter(Boolean))).slice(0, 5).map(p => (
                  <span key={p} className="text-xs bg-secondary px-1.5 py-0.5 rounded text-secondary-foreground">{p}</span>
                ))}
              </div>
            </div>
          </div>

          {/* Errors */}
          {errors.length > 0 && (
            <div className="panel max-h-48 overflow-y-auto space-y-1">
              <div className="panel-header flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5" /> Validation Errors
              </div>
              {errors.slice(0, 20).map((err, i) => (
                <div key={i} className="text-xs text-destructive/80 font-mono">
                  Row {err.row}: [{err.field}] {err.message}
                </div>
              ))}
              {errors.length > 20 && (
                <div className="text-xs text-muted-foreground">...and {errors.length - 20} more</div>
              )}
            </div>
          )}

          {/* Preview */}
          {validCount > 0 && (
            <div className="panel">
              <div className="panel-header flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-primary" /> Preview (first 10)
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-1.5 px-2 text-xs font-mono uppercase tracking-wider text-muted-foreground">Company</th>
                      <th className="text-left py-1.5 px-2 text-xs font-mono uppercase tracking-wider text-muted-foreground">Domain</th>
                      <th className="text-left py-1.5 px-2 text-xs font-mono uppercase tracking-wider text-muted-foreground hidden sm:table-cell">Partner</th>
                      <th className="text-left py-1.5 px-2 text-xs font-mono uppercase tracking-wider text-muted-foreground hidden md:table-cell">Country</th>
                      <th className="text-left py-1.5 px-2 text-xs font-mono uppercase tracking-wider text-muted-foreground hidden md:table-cell">Industry</th>
                    </tr>
                  </thead>
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
            {importing ? (
              <>Processing...</>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Import {validCount} Companies
              </>
            )}
          </Button>
        </motion.div>
      )}
    </div>
  );
}
