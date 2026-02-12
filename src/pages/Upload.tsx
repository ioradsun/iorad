import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Papa from "papaparse";
import { CSVRow, ValidationError } from "@/types";
import { Button } from "@/components/ui/button";
import { Upload as UploadIcon, FileText, AlertTriangle, CheckCircle2, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

export default function UploadPage() {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<CSVRow[]>([]);
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [validCount, setValidCount] = useState(0);
  const [duplicates, setDuplicates] = useState(0);
  const [parsed, setParsed] = useState(false);
  const [importing, setImporting] = useState(false);

  const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]*\.[a-zA-Z]{2,}(\.[a-zA-Z]{2,})?$/;

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

        const data = results.data.slice(0, 1000);
        if (results.data.length > 1000) {
          errs.push({ row: 0, field: "file", message: `File has ${results.data.length} rows. Only the first 1,000 will be processed.` });
        }

        data.forEach((row, i) => {
          const name = (row.company_name || "").trim();
          const domain = (row.domain || "").trim().toLowerCase();
          const rowNum = i + 2; // header is row 1

          if (!name) errs.push({ row: rowNum, field: "company_name", message: "Company name is required" });
          if (!domain) {
            errs.push({ row: rowNum, field: "domain", message: "Domain is required" });
          } else if (!domainRegex.test(domain)) {
            errs.push({ row: rowNum, field: "domain", message: `Invalid domain format: "${domain}"` });
          }

          if (name && domain && domainRegex.test(domain)) {
            if (seen.has(domain)) {
              dupes++;
            } else {
              seen.add(domain);
              valid.push({ company_name: name, domain });
            }
          }
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
    // Mock import delay
    await new Promise(r => setTimeout(r, 1500));
    toast.success(`Imported ${validCount} companies`);
    setImporting(false);
    navigate("/");
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Upload Companies</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Upload a CSV file with <code className="font-mono text-xs bg-secondary px-1.5 py-0.5 rounded">company_name</code> and{" "}
          <code className="font-mono text-xs bg-secondary px-1.5 py-0.5 rounded">domain</code> columns. Max 1,000 rows.
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
          <div className="grid grid-cols-3 gap-3">
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
          </div>

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

          {validCount > 0 && (
            <div className="panel">
              <div className="panel-header flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-primary" /> Preview (first 5)
              </div>
              <div className="space-y-1">
                {rows.slice(0, 5).map((r, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span className="font-medium">{r.company_name}</span>
                    <span className="text-xs text-muted-foreground font-mono">{r.domain}</span>
                  </div>
                ))}
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
