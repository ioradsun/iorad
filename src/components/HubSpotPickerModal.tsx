import { useState, useEffect, useCallback } from "react";
import { Search, Loader2, Check, Building2, RefreshCw } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ClearableInput } from "@/components/ui/clearable-input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface HubSpotCompany {
  hubspot_id: string;
  name: string;
  domain: string;
  industry: string;
  country: string;
  lifecycle: string;
  employees: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

const LIFECYCLE_LABELS: Record<string, string> = {
  lead: "Lead",
  marketingqualifiedlead: "MQL",
  salesqualifiedlead: "SQL",
  opportunity: "Opportunity",
  customer: "Customer",
  evangelist: "Evangelist",
  other: "Other",
};

export default function HubSpotPickerModal({ open, onClose }: Props) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [companies, setCompanies] = useState<HubSpotCompany[]>([]);
  const [paging, setPaging] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState<Record<string, boolean>>({});
  const [synced, setSynced] = useState<Record<string, boolean>>({});

  const fetchCompanies = useCallback(async (q: string, after?: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("import-from-hubspot", {
        body: { action: "list_companies", search: q, after: after || null },
      });
      if (error) throw error;
      if (after) {
        setCompanies(prev => [...prev, ...(data.companies || [])]);
      } else {
        setCompanies(data.companies || []);
      }
      setPaging(data.paging || null);
    } catch (err: any) {
      toast.error(`Failed to load HubSpot companies: ${err?.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounced search
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => fetchCompanies(search), 400);
    return () => clearTimeout(t);
  }, [search, open, fetchCompanies]);

  // Reset when closed
  useEffect(() => {
    if (!open) {
      setSearch("");
      setCompanies([]);
      setSynced({});
      setPaging(null);
    }
  }, [open]);

  const handleSync = async (company: HubSpotCompany) => {
    setSyncing(prev => ({ ...prev, [company.hubspot_id]: true }));
    try {
      const { data, error } = await supabase.functions.invoke("import-from-hubspot", {
        body: { action: "sync_hubspot_id", hubspot_id: company.hubspot_id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setSynced(prev => ({ ...prev, [company.hubspot_id]: true }));
      await qc.invalidateQueries({ queryKey: ["companies"] });
      toast.success(`${company.name} ${data.is_new ? "added to" : "updated in"} Scout`);
    } catch (err: any) {
      const msg = err?.message || "Unknown error";
      if (msg.includes("non-2xx") || msg.includes("timeout")) {
        toast.error(`${company.name} has too many records to sync instantly. It will be picked up by the next automatic sync.`);
      } else {
        toast.error(`Failed to sync ${company.name}: ${msg}`);
      }
    } finally {
      setSyncing(prev => ({ ...prev, [company.hubspot_id]: false }));
    }
  };

  const loadMore = () => {
    if (paging?.next?.after) {
      fetchCompanies(search, paging.next.after);
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col gap-0 p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border shrink-0">
          <DialogTitle className="text-[17px] font-semibold">Import from HubSpot</DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Search your HubSpot companies and send them to Scout.
          </p>
        </DialogHeader>

        {/* Search */}
        <div className="px-6 py-3 border-b border-border shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <ClearableInput
              autoFocus
              placeholder="Search HubSpot companies…"
              value={search}
              onChange={e => {
                setSearch(e.target.value);
              }}
              onClear={() => {
                setSearch("");
                fetchCompanies("");
              }}
              className="pl-9 bg-secondary/50 border-border/50 h-10"
            />
          </div>
        </div>

        {/* List */}
        <div className="overflow-y-auto flex-1 divide-y divide-border">
          {loading && companies.length === 0 ? (
            <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Loading HubSpot companies…</span>
            </div>
          ) : companies.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2 text-muted-foreground">
              <Building2 className="w-6 h-6 opacity-40" />
              <span className="text-sm">{search ? "No companies match your search." : "No companies found."}</span>
            </div>
          ) : (
            <>
              {companies.map(company => {
                const isSyncing = syncing[company.hubspot_id];
                const isSynced = synced[company.hubspot_id];
                const lifecycleLabel = LIFECYCLE_LABELS[company.lifecycle?.toLowerCase()] || company.lifecycle || "";

                return (
                  <div
                    key={company.hubspot_id}
                    className="flex items-center gap-4 px-6 py-3.5 hover:bg-secondary/50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-[14px] text-foreground leading-snug truncate">
                        {company.name}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {company.domain && (
                          <span className="text-[12px] text-muted-foreground">{company.domain}</span>
                        )}
                        {lifecycleLabel && (
                          <span className="text-[11px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground border border-border/60">
                            {lifecycleLabel}
                          </span>
                        )}
                        {company.industry && (
                          <span className="text-[11px] text-muted-foreground/60 truncate max-w-[140px]">
                            {company.industry.replace(/_/g, " ")}
                          </span>
                        )}
                      </div>
                    </div>

                    <Button
                      size="sm"
                      variant={isSynced ? "secondary" : "outline"}
                      disabled={isSyncing}
                      onClick={() => handleSync(company)}
                      className="shrink-0 h-8 text-xs gap-1.5"
                    >
                      {isSyncing ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : isSynced ? (
                        <Check className="w-3.5 h-3.5 text-success" />
                      ) : null}
                      {isSyncing ? "Syncing…" : isSynced ? "Added" : "Send to Scout"}
                    </Button>
                  </div>
                );
              })}

              {/* Load more */}
              {paging?.next?.after && (
                <div className="px-6 py-4 flex justify-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={loadMore}
                    disabled={loading}
                    className="gap-1.5 text-xs text-muted-foreground"
                  >
                    {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                    Load more
                  </Button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-border flex items-center justify-between shrink-0">
          <span className="text-xs text-muted-foreground">
            {companies.length > 0 && `${companies.length} companies loaded`}
          </span>
          <Button variant="ghost" size="sm" onClick={onClose} className="text-xs">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
