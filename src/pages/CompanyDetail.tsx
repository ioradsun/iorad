import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useCompany, useSignals, useSnapshots, useContacts, useCompanyCards, useUpdateCompany } from "@/hooks/useSupabase";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import ScoreCell from "@/components/ScoreCell";
import StatusBadge from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ArrowLeft, RefreshCw, ExternalLink, Briefcase, Newspaper, CheckCircle2, AlertCircle, Loader2, Target, TrendingUp, Shield, Zap, BarChart3, FileText, MessageSquareQuote, UserSearch, Linkedin, Mail, Plus, Brain, Sparkles, Copy, ChevronRight, Video, BookOpen, Save, Eye, Building2, MapPin, Users, DollarSign, Globe } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { motion } from "framer-motion";
import { Json } from "@/integrations/supabase/types";
import { toast } from "sonner";

// --- Types ---

interface ScoreBreakdown {
  relevance?: number; urgency?: number; buyer_signal?: number;
  hiring?: number; news?: number; expansion?: number;
  rules_fired?: string[]; evidence_urls?: string[];
}

interface SnapshotJSON {
  trigger_summary?: string; why_now?: string | string[];
  likely_initiative?: string; suggested_persona_targets?: string[];
  confidence_level?: string; confidence_reason?: string;
  missing_data_questions?: string[];
  evidence?: { snippet?: string; detail?: string; signal_type?: string; source_url?: string; url?: string; source_type?: string; date?: string | null }[];
  signal_deconstruction?: { observable_facts?: string[]; company_stage?: string; workflow_stress_indicators?: string[] };
  operational_friction?: { cause?: string; effect?: string; bottleneck?: string }[];
  partner_platform_ceiling?: { platform_strengths?: string[]; execution_gaps?: string[]; key_insight?: string };
  embedded_leverage?: { situation?: string; constraint?: string; intervention?: string; transformation?: string };
  quantified_impact?: { metric?: string; assumptions?: string; calculation?: string; result?: string }[];
  executive_narrative?: string;
  outbound_positioning?: { executive_framing?: string; efficiency_framing?: string; risk_framing?: string };
  competitive_insulation?: string[];
}

interface CardField { label: string; value: string; status?: string }
interface CardAction { label: string; value: string }
interface Strategy { title: string; pitch: string; why_now: string; proof: string; what_to_validate: string[]; sources: string[] }
interface DashboardCard { id: string; title: string; priority: string; fields?: CardField[]; actions?: CardAction[]; strategies?: Strategy[] }
interface EmailTouch { subject_lines: string[]; body: string }
interface LinkedInStep { step: number; timing: string; message: string }
interface StoryAssets {
  active_strategy?: string;
  primary_asset?: {
    type: string; title: string; purpose: string; covers: string[];
    when_to_send: string; intro_message: string; loom_script: string;
  };
  supporting_asset?: {
    type: string; title: string; environment: string; what_it_guides: string[];
    business_outcome: string; when_to_send: string; intro_message: string; embed_context: string;
  };
}

function toArray(val: unknown): string[] {
  if (Array.isArray(val)) return val.map(String);
  if (typeof val === "string" && val) return [val];
  return [];
}

function parseJson<T>(val: Json | null | undefined): T | null {
  if (!val) return null;
  if (typeof val === "object") return val as unknown as T;
  try { return JSON.parse(String(val)); } catch { return null; }
}

// --- Truth Status Badge ---
const statusColors: Record<string, string> = {
  Provided: "bg-primary/10 text-primary border-primary/20",
  "Source-backed": "bg-info/10 text-info border-info/20",
  Inference: "bg-warning/10 text-warning border-warning/20",
  Hypothesis: "bg-accent/50 text-accent-foreground border-accent",
  Unknown: "bg-muted text-muted-foreground border-border",
};

function TruthBadge({ status }: { status?: string }) {
  if (!status) return null;
  const cls = statusColors[status] || statusColors.Unknown;
  return <span className={`text-[10px] px-1.5 py-0.5 rounded border ${cls}`}>{status}</span>;
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text);
  toast.success("Copied to clipboard");
}

// --- Loom embed helper ---
function toLoomEmbedUrl(url: string): string | null {
  if (!url) return null;
  const match = url.match(/loom\.com\/(?:share|embed)\/([a-zA-Z0-9]+)/);
  if (match) return `https://www.loom.com/embed/${match[1]}`;
  return null;
}

// --- iorad embed helper ---
function toIoradEmbedUrl(url: string): string | null {
  if (!url) return null;
  const base = url.split("?")[0];
  return `${base}${url.includes("?") ? "&" : "?"}oembed=1`;
}

// --- Dashboard Card Component ---
function DashboardCardUI({ card }: { card: DashboardCard }) {
  if (card.id === "ai_strategy" && card.strategies?.length) {
    return (
      <Card className="col-span-1 lg:col-span-2">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Brain className="w-4 h-4 text-primary" />
            {card.title}
            <Badge variant="outline" className="text-[10px] ml-auto">{card.priority}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {card.strategies.map((s, i) => (
            <div key={i} className="border rounded-lg p-3 space-y-2">
              <div className="font-medium text-sm">{s.title}</div>
              <p className="text-xs text-muted-foreground leading-relaxed">{s.pitch}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div><span className="font-mono text-muted-foreground">Why now:</span> <span className="text-foreground/80">{s.why_now}</span></div>
                <div><span className="font-mono text-muted-foreground">Proof:</span> <span className="text-foreground/80">{s.proof}</span></div>
              </div>
              {s.what_to_validate?.length > 0 && (
                <div className="text-xs">
                  <span className="font-mono text-muted-foreground">Validate:</span>
                  <ul className="mt-1 space-y-0.5">{s.what_to_validate.map((q, j) => <li key={j} className="text-foreground/70 flex gap-1"><span className="text-primary">•</span>{q}</li>)}</ul>
                </div>
              )}
              {s.sources?.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {s.sources.map((url, j) => (
                    <a key={j} href={url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary hover:underline flex items-center gap-0.5">
                      <ExternalLink className="w-3 h-3" /> Source
                    </a>
                  ))}
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          {card.title}
          <Badge variant="outline" className="text-[10px] ml-auto">{card.priority}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {card.fields?.length ? (
          <div className="space-y-2">
            {card.fields.map((f, i) => (
              <div key={i} className="flex items-start justify-between gap-2 text-xs">
                <div className="flex-1">
                  <span className="font-mono text-muted-foreground">{f.label}:</span>{" "}
                  <span className="text-foreground/90">{f.value}</span>
                </div>
                <TruthBadge status={f.status} />
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No data</p>
        )}
      </CardContent>
    </Card>
  );
}

// --- Email Sequence ---
function EmailSequenceUI({ emails }: { emails: Record<string, EmailTouch> }) {
  const entries = Object.entries(emails).sort();
  if (entries.length === 0) return null;
  return (
    <Accordion type="multiple" className="space-y-1">
      {entries.map(([key, email]) => (
        <AccordionItem key={key} value={key} className="border rounded-lg px-4">
          <AccordionTrigger className="text-sm font-medium">
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-primary" />
              {key.replace("_", " ").replace(/\b\w/g, c => c.toUpperCase())}
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-3">
              {email.subject_lines?.length > 0 && (
                <div>
                  <div className="text-[10px] font-mono text-muted-foreground mb-1">Subject Lines</div>
                  {email.subject_lines.map((s, i) => (
                    <div key={i} className="text-xs text-foreground/90 flex items-center gap-2">
                      <span>• {s}</span>
                      <button onClick={() => copyToClipboard(s)} className="text-muted-foreground hover:text-primary"><Copy className="w-3 h-3" /></button>
                    </div>
                  ))}
                </div>
              )}
              <div>
                <div className="text-[10px] font-mono text-muted-foreground mb-1">Body</div>
                <div className="text-xs text-foreground/80 whitespace-pre-wrap leading-relaxed bg-secondary/30 rounded p-3">{email.body}</div>
              </div>
              <Button size="sm" variant="ghost" className="gap-1 text-xs h-7" onClick={() => copyToClipboard(`Subject: ${email.subject_lines?.[0] || ""}\n\n${email.body}`)}>
                <Copy className="w-3 h-3" /> Copy Full Email
              </Button>
            </div>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}

// --- LinkedIn Sequence ---
function LinkedInSequenceUI({ steps }: { steps: LinkedInStep[] }) {
  if (!steps?.length) return null;
  return (
    <Accordion type="multiple" className="space-y-1">
      {steps.map((step) => (
        <AccordionItem key={step.step} value={`li-${step.step}`} className="border rounded-lg px-4">
          <AccordionTrigger className="text-sm font-medium">
            <div className="flex items-center gap-2">
              <Linkedin className="w-4 h-4 text-primary" />
              Step {step.step} — {step.timing}
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="text-xs text-foreground/80 whitespace-pre-wrap leading-relaxed bg-secondary/30 rounded p-3">{step.message}</div>
            <Button size="sm" variant="ghost" className="gap-1 text-xs h-7 mt-2" onClick={() => copyToClipboard(step.message)}>
              <Copy className="w-3 h-3" /> Copy
            </Button>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}

// --- Story Assets (AI-generated config) ---
function StoryAssetsUI({ storyAssets }: { storyAssets: StoryAssets }) {
  const loom = storyAssets.primary_asset;
  const iorad = storyAssets.supporting_asset;
  const loomReady = !!(loom?.title && loom?.loom_script);
  const ioradReady = !!(iorad?.title && iorad?.what_it_guides?.length);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" /> AI-Generated Story Config
        </h3>
        {storyAssets.active_strategy && (
          <Badge variant="outline" className="text-xs">Strategy: {storyAssets.active_strategy}</Badge>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Loom — Narrative Layer */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Video className="w-4 h-4 text-primary" />
              Loom Script
              <span className="text-[10px] text-muted-foreground">(Narrative Layer)</span>
              <Badge variant={loomReady ? "default" : "secondary"} className="text-[10px] ml-auto">
                {loomReady ? "Ready" : "Not Ready"}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {loom?.title && (
              <div className="text-xs"><span className="font-mono text-muted-foreground">Title:</span> <span className="text-foreground/90">{loom.title}</span></div>
            )}
            {loom?.purpose && (
              <div className="text-xs"><span className="font-mono text-muted-foreground">Purpose:</span> <span className="text-foreground/90">{loom.purpose}</span></div>
            )}
            {loom?.covers?.length > 0 && (
              <div className="text-xs">
                <span className="font-mono text-muted-foreground">Covers:</span>
                <ul className="mt-1 space-y-0.5">{loom.covers.map((c, i) => <li key={i} className="text-foreground/80 flex gap-1"><span className="text-primary">•</span>{c}</li>)}</ul>
              </div>
            )}
            {loom?.when_to_send && (
              <div className="text-xs"><span className="font-mono text-muted-foreground">When to send:</span> <span className="text-foreground/90">{loom.when_to_send}</span></div>
            )}
            {loom?.intro_message && (
              <div className="space-y-1">
                <div className="text-[10px] font-mono text-muted-foreground">Intro Message</div>
                <div className="text-xs text-foreground/80 bg-secondary/30 rounded p-2">{loom.intro_message}</div>
                <Button size="sm" variant="ghost" className="gap-1 text-xs h-7" onClick={() => copyToClipboard(loom.intro_message)}>
                  <Copy className="w-3 h-3" /> Copy Intro
                </Button>
              </div>
            )}
            {loom?.loom_script && (
              <div className="space-y-1 border-t border-border/50 pt-3">
                <div className="text-[10px] font-mono text-muted-foreground">Loom Script</div>
                <div className="text-xs text-foreground/80 whitespace-pre-wrap leading-relaxed bg-secondary/30 rounded p-3 max-h-64 overflow-y-auto">{loom.loom_script}</div>
                <Button size="sm" variant="ghost" className="gap-1 text-xs h-7" onClick={() => copyToClipboard(loom.loom_script)}>
                  <Copy className="w-3 h-3" /> Copy Script
                </Button>
              </div>
            )}
            {!loom?.title && <p className="text-xs text-muted-foreground">No Loom data generated yet.</p>}
          </CardContent>
        </Card>

        {/* iorad Tutorial — Mechanism Layer */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-primary" />
              iorad Tutorial
              <span className="text-[10px] text-muted-foreground">(Mechanism Layer)</span>
              <Badge variant={ioradReady ? "default" : "secondary"} className="text-[10px] ml-auto">
                {ioradReady ? "Ready" : "Not Ready"}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {iorad?.title && (
              <div className="text-xs"><span className="font-mono text-muted-foreground">Title:</span> <span className="text-foreground/90">{iorad.title}</span></div>
            )}
            {iorad?.environment && (
              <div className="text-xs"><span className="font-mono text-muted-foreground">Environment:</span> <span className="text-foreground/90">{iorad.environment}</span></div>
            )}
            {iorad?.what_it_guides?.length > 0 && (
              <div className="text-xs">
                <span className="font-mono text-muted-foreground">What it guides:</span>
                <ul className="mt-1 space-y-0.5">{iorad.what_it_guides.map((g, i) => <li key={i} className="text-foreground/80 flex gap-1"><span className="text-primary">•</span>{g}</li>)}</ul>
              </div>
            )}
            {iorad?.business_outcome && (
              <div className="text-xs"><span className="font-mono text-muted-foreground">Business outcome:</span> <span className="text-foreground/90">{iorad.business_outcome}</span></div>
            )}
            {iorad?.when_to_send && (
              <div className="text-xs"><span className="font-mono text-muted-foreground">When to send:</span> <span className="text-foreground/90">{iorad.when_to_send}</span></div>
            )}
            {iorad?.intro_message && (
              <div className="space-y-1">
                <div className="text-[10px] font-mono text-muted-foreground">Intro Message</div>
                <div className="text-xs text-foreground/80 bg-secondary/30 rounded p-2">{iorad.intro_message}</div>
                <Button size="sm" variant="ghost" className="gap-1 text-xs h-7" onClick={() => copyToClipboard(iorad.intro_message)}>
                  <Copy className="w-3 h-3" /> Copy Intro
                </Button>
              </div>
            )}
            {iorad?.embed_context && (
              <div className="text-xs"><span className="font-mono text-muted-foreground">Embed context:</span> <span className="text-foreground/90">{iorad.embed_context}</span></div>
            )}
            {!iorad?.title && <p className="text-xs text-muted-foreground">No tutorial data generated yet.</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// === MAIN COMPONENT ===

export default function CompanyDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: company, isLoading } = useCompany(id);
  const { data: signals = [] } = useSignals(id);
  const { data: snapshots = [] } = useSnapshots(id);
  const { data: contacts = [] } = useContacts(id);
  const { data: companyCards, isLoading: cardsLoading } = useCompanyCards(id);
  const updateCompany = useUpdateCompany();
  const queryClient = useQueryClient();
  const [regenerating, setRegenerating] = useState(false);
  
  const [generatingCards, setGeneratingCards] = useState(false);
  const [addContactOpen, setAddContactOpen] = useState(false);
  const [newContact, setNewContact] = useState({ name: "", title: "", email: "", linkedin: "" });
  const [savingContact, setSavingContact] = useState(false);
  const [extraOpen, setExtraOpen] = useState(true);
  const [loomUrl, setLoomUrl] = useState<string | null>(null);
  const [ioradUrl, setIoradUrl] = useState<string | null>(null);
  const [storyUrlsDirty, setStoryUrlsDirty] = useState(false);

  // Sync local state with company data
  const companyAny = company as any;
  const effectiveLoomUrl = loomUrl ?? companyAny?.loom_url ?? "";
  const effectiveIoradUrl = ioradUrl ?? companyAny?.iorad_url ?? "";

  const handleAddContact = async () => {
    if (!id || !newContact.name.trim()) return;
    setSavingContact(true);
    try {
      const { error } = await supabase.from("contacts").insert({
        company_id: id, name: newContact.name.trim(),
        title: newContact.title.trim() || null, email: newContact.email.trim() || null,
        linkedin: newContact.linkedin.trim() || null, source: "manual",
      });
      if (error) throw error;
      toast.success("Contact added");
      setNewContact({ name: "", title: "", email: "", linkedin: "" });
      setAddContactOpen(false);
      queryClient.invalidateQueries({ queryKey: ["contacts", id] });
    } catch (e: any) { toast.error(e.message || "Failed to add contact"); }
    finally { setSavingContact(false); }
  };

  const regenerate = async (mode: string = "full") => {
    if (!id) return;
    setRegenerating(true);
    const modeLabels: Record<string, string> = { full: "Full refresh", signals_only: "Signal search", score_only: "Story regeneration" };
    try {
      const { data, error } = await supabase.functions.invoke("run-signals", { body: { company_id: id, mode } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`${modeLabels[mode] || mode} complete — ${data?.company || "company"}`);
      queryClient.invalidateQueries({ queryKey: ["company", id] });
      queryClient.invalidateQueries({ queryKey: ["signals", id] });
      queryClient.invalidateQueries({ queryKey: ["snapshots", id] });
      queryClient.invalidateQueries({ queryKey: ["contacts", id] });
      queryClient.invalidateQueries({ queryKey: ["companies"] });
    } catch (e: any) { toast.error(e.message || "Operation failed"); }
    finally { setRegenerating(false); }
  };

  const generateCards = async () => {
    if (!id) return;
    setGeneratingCards(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-cards", { body: { company_id: id } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`Cards generated — ${data?.cards_count || 0} cards`);
      queryClient.invalidateQueries({ queryKey: ["company_cards", id] });
    } catch (e: any) { toast.error(e.message || "Failed to generate cards"); }
    finally { setGeneratingCards(false); }
  };

  const saveStoryUrls = async () => {
    if (!id) return;
    try {
      await updateCompany.mutateAsync({
        id,
        updates: { loom_url: effectiveLoomUrl || null, iorad_url: effectiveIoradUrl || null },
      });
      toast.success("Story URLs saved");
      setStoryUrlsDirty(false);
    } catch (e: any) { toast.error(e.message || "Failed to save"); }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }

  if (!company) {
    return (
      <div className="text-center py-20">
        <h2 className="text-xl font-bold">Company not found</h2>
        <Link to="/" className="text-primary text-sm mt-2 inline-block">← Back to Dashboard</Link>
      </div>
    );
  }

  const latestSnapshot = snapshots[0];
  const bd = latestSnapshot ? parseJson<ScoreBreakdown>(latestSnapshot.score_breakdown) : null;
  const snap = latestSnapshot ? parseJson<SnapshotJSON>(latestSnapshot.snapshot_json) : null;

  const cards = (companyCards?.cards_json as unknown as DashboardCard[] | null) || [];
  const assets = parseJson<{ email_sequence?: Record<string, EmailTouch>; linkedin_sequence?: LinkedInStep[]; story_assets?: StoryAssets }>(companyCards?.assets_json as Json) || {};
  const accountData = parseJson<{
    name?: string; about?: { text?: string; status?: string };
    industry?: { value?: string; status?: string };
    employees?: { value?: string; status?: string };
    hq?: { value?: string; status?: string };
    revenue_range?: { value?: string; status?: string };
    products_services?: { name: string; status?: string }[];
  }>(companyCards?.account_json as Json);

  const loomEmbedUrl = toLoomEmbedUrl(effectiveLoomUrl);
  const ioradEmbedUrl = toIoradEmbedUrl(effectiveIoradUrl);

  // Build story URL for link
  const firstContact = contacts[0] || (companyAny?.buyer_name ? { name: companyAny.buyer_name } : null);
  const storyBaseUrl = firstContact && company.partner
    ? `/${company.partner}/${company.name.toLowerCase().replace(/\s+/g, "-")}/stories/${firstContact.name.split(" ")[0].toLowerCase().replace(/[^a-z]/g, "")}`
    : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link to="/" className="text-muted-foreground hover:text-foreground transition-colors"><ArrowLeft className="w-5 h-5" /></Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{company.name}</h1>
            <p className="text-sm text-muted-foreground font-mono">{company.domain || "no domain"}</p>
          </div>
          <ScoreCell score={company.last_score_total} size="lg" />
          <StatusBadge status={company.snapshot_status} />
        </div>
      </div>

      {/* ============ TABS ============ */}
      <Tabs defaultValue="company" className="w-full">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="company">Company</TabsTrigger>
          <TabsTrigger value="strategy">Strategy</TabsTrigger>
          <TabsTrigger value="outreach">Outreach</TabsTrigger>
          <TabsTrigger value="story">Story</TabsTrigger>
        </TabsList>

        {/* ============ TAB 1: COMPANY ============ */}
        <TabsContent value="company" className="space-y-6 mt-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Company Intel</h3>
            <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => regenerate("full")} disabled={regenerating}>
              {regenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              {regenerating ? "Generating…" : signals.length > 0 ? "Regenerate" : "Generate"}
            </Button>
          </div>
          {/* Company Profile — scannable card grid */}
          {(accountData?.about?.text || company.domain) && (
            <p className="text-sm text-foreground/80 leading-relaxed line-clamp-2">
              {accountData?.about?.text || `${company.name} — ${company.domain}`}
            </p>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {(accountData?.industry?.value || company.industry) && (
              <Card className="bg-secondary/30">
                <CardContent className="p-3 flex flex-col items-start gap-1.5">
                  <Building2 className="w-4 h-4 text-primary" />
                  <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Industry</span>
                  <span className="text-sm font-medium text-foreground leading-tight">{accountData?.industry?.value || company.industry?.replace(/_/g, " ").toLowerCase()}</span>
                </CardContent>
              </Card>
            )}
            {(accountData?.employees?.value || company.headcount) && (
              <Card className="bg-secondary/30">
                <CardContent className="p-3 flex flex-col items-start gap-1.5">
                  <Users className="w-4 h-4 text-primary" />
                  <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Employees</span>
                  <span className="text-sm font-medium text-foreground">{accountData?.employees?.value || `${company.headcount}+`}</span>
                </CardContent>
              </Card>
            )}
            {(accountData?.hq?.value || company.hq_country) && (
              <Card className="bg-secondary/30">
                <CardContent className="p-3 flex flex-col items-start gap-1.5">
                  <MapPin className="w-4 h-4 text-primary" />
                  <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Headquarters</span>
                  <span className="text-sm font-medium text-foreground leading-tight">{accountData?.hq?.value || company.hq_country}</span>
                </CardContent>
              </Card>
            )}
            {accountData?.revenue_range?.value && accountData.revenue_range.value !== "Unknown" && (
              <Card className="bg-secondary/30">
                <CardContent className="p-3 flex flex-col items-start gap-1.5">
                  <DollarSign className="w-4 h-4 text-primary" />
                  <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Revenue</span>
                  <span className="text-sm font-medium text-foreground">{accountData.revenue_range.value}</span>
                </CardContent>
              </Card>
            )}
            {company.domain && (
              <Card className="bg-secondary/30">
                <CardContent className="p-3 flex flex-col items-start gap-1.5">
                  <Globe className="w-4 h-4 text-primary" />
                  <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Website</span>
                  <a href={`https://${company.domain}`} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-primary hover:underline">{company.domain}</a>
                </CardContent>
              </Card>
            )}
            {company.partner && (
              <Card className="bg-secondary/30">
                <CardContent className="p-3 flex flex-col items-start gap-1.5">
                  <Briefcase className="w-4 h-4 text-primary" />
                  <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Partner</span>
                  <span className="text-sm font-medium text-foreground">{company.partner}</span>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Contacts */}
          <div className="panel">
            <div className="panel-header flex items-center justify-between">
              <span>Contacts ({contacts.length || ((companyAny)?.buyer_name ? 1 : 0)})</span>
              <Dialog open={addContactOpen} onOpenChange={setAddContactOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="ghost" className="gap-1 text-xs h-7"><Plus className="w-3.5 h-3.5" /> Add</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Add Contact</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <div><Label>Name *</Label><Input value={newContact.name} onChange={e => setNewContact(p => ({ ...p, name: e.target.value }))} placeholder="Jane Smith" /></div>
                    <div><Label>Title</Label><Input value={newContact.title} onChange={e => setNewContact(p => ({ ...p, title: e.target.value }))} placeholder="VP of Learning" /></div>
                    <div><Label>Email</Label><Input type="email" value={newContact.email} onChange={e => setNewContact(p => ({ ...p, email: e.target.value }))} placeholder="jane@company.com" /></div>
                    <div><Label>LinkedIn</Label><Input value={newContact.linkedin} onChange={e => setNewContact(p => ({ ...p, linkedin: e.target.value }))} placeholder="https://linkedin.com/in/..." /></div>
                    <Button onClick={handleAddContact} disabled={!newContact.name.trim() || savingContact} className="w-full">
                      {savingContact ? <Loader2 className="w-4 h-4 animate-spin" /> : "Add Contact"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            <div className="space-y-3">
              {contacts.length > 0 ? contacts.map((contact) => {
                const firstName = contact.name.split(" ")[0].toLowerCase().replace(/[^a-z]/g, "");
                const storyUrl = company.partner
                  ? `/${company.partner}/${company.name.toLowerCase().replace(/\s+/g, "-")}/stories/${firstName}`
                  : null;
                return (
                  <div key={contact.id} className="flex items-center gap-4 p-2 rounded-md hover:bg-secondary/30 transition-colors">
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <UserSearch className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0 space-y-0.5">
                      <div className="text-sm font-medium truncate">{contact.name}</div>
                      {contact.title && <div className="text-xs text-muted-foreground truncate">{contact.title}</div>}
                      {contact.source && <span className="text-[10px] bg-secondary px-1.5 py-0.5 rounded text-muted-foreground">{contact.source}</span>}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {storyUrl && snap && (
                        <a href={storyUrl} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary" title="View personalized story"><ExternalLink className="w-4 h-4" /></a>
                      )}
                      {contact.email && <a href={`mailto:${contact.email}`} className="text-muted-foreground hover:text-primary" title={contact.email}><Mail className="w-4 h-4" /></a>}
                      {contact.linkedin && <a href={contact.linkedin} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary"><Linkedin className="w-4 h-4" /></a>}
                    </div>
                  </div>
                );
              }) : (companyAny)?.buyer_name ? (
                <div className="flex items-center gap-4 p-2 rounded-md hover:bg-secondary/30 transition-colors">
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center"><UserSearch className="w-4 h-4 text-primary" /></div>
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <div className="text-sm font-medium">{companyAny.buyer_name}</div>
                    {companyAny.buyer_title && <div className="text-xs text-muted-foreground">{companyAny.buyer_title}</div>}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {companyAny.buyer_email && <a href={`mailto:${companyAny.buyer_email}`} className="text-muted-foreground hover:text-primary"><Mail className="w-4 h-4" /></a>}
                    {companyAny.buyer_linkedin && <a href={companyAny.buyer_linkedin} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary"><Linkedin className="w-4 h-4" /></a>}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No contacts yet. Add one manually or run enrichment.</p>
              )}
            </div>
          </div>

          <div className="glow-line" />

          {/* Extra — Score, Signals, Analysis, History (open by default in Company tab) */}
          <Collapsible open={extraOpen} onOpenChange={setExtraOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between text-sm font-medium h-10">
                <span className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-primary" />
                  Score, Signals, Analysis & History
                </span>
                <ChevronRight className={`w-4 h-4 transition-transform ${extraOpen ? "rotate-90" : ""}`} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-6 pt-4">
              {/* Score + Signals row */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="panel lg:col-span-1">
                  <div className="panel-header">Score Breakdown</div>
                  {bd ? (
                    <div className="space-y-4">
                      {[
                        { label: "Hiring", value: bd.relevance || bd.hiring || 0, max: 30 },
                        { label: "News", value: bd.urgency || bd.news || 0, max: 40 },
                        { label: "Expansion", value: bd.buyer_signal || bd.expansion || 0, max: 30 },
                      ].map(({ label, value, max }) => (
                        <div key={label}>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-muted-foreground">{label}</span>
                            <span className="font-mono font-bold text-foreground">{value}/{max}</span>
                          </div>
                          <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                            <motion.div initial={{ width: 0 }} animate={{ width: `${(value / max) * 100}%` }} transition={{ duration: 0.8, ease: "easeOut" }} className="h-full bg-primary rounded-full" />
                          </div>
                        </div>
                      ))}
                      {snap?.confidence_level && (
                        <div className="flex items-start gap-3 bg-secondary/50 rounded p-3 mt-2">
                          <AlertCircle className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                          <div>
                            <div className="text-xs font-mono font-bold text-primary">{snap.confidence_level} Confidence</div>
                            {snap.confidence_reason && <p className="text-xs text-muted-foreground mt-0.5">{snap.confidence_reason}</p>}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No score computed yet.</p>
                  )}
                </div>

                <div className="panel lg:col-span-2">
                  <div className="panel-header">Signals ({signals.length})</div>
                  {signals.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No signals discovered yet.</p>
                  ) : (
                    <div className="space-y-4">
                      {signals.map(signal => {
                        const snippets = (Array.isArray(signal.evidence_snippets) ? signal.evidence_snippets : []) as string[];
                        return (
                          <div key={signal.id} className="border rounded-md p-3 space-y-2">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-center gap-2">
                                {signal.type === "job" ? <Briefcase className="w-4 h-4 text-info flex-shrink-0" /> : <Newspaper className="w-4 h-4 text-warning flex-shrink-0" />}
                                <div>
                                  <div className="text-sm font-medium">{signal.title}</div>
                                  <div className="text-xs text-muted-foreground">{signal.date || "No date"} · {signal.type}</div>
                                </div>
                              </div>
                              <a href={signal.url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary flex-shrink-0"><ExternalLink className="w-3.5 h-3.5" /></a>
                            </div>
                            {signal.raw_excerpt && <p className="text-xs text-muted-foreground leading-relaxed">{signal.raw_excerpt}</p>}
                            {snippets.length > 0 && (
                              <div className="space-y-1 pt-1 border-t border-border/50">
                                <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Evidence Snippets</div>
                                {snippets.map((snippet, i) => (
                                  <div key={i} className="text-xs text-accent-foreground bg-accent/20 rounded px-2 py-1.5 border-l-2 border-primary/40">"{snippet}"</div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Enterprise Analysis Accordion */}
              {snap && latestSnapshot && (
                <div className="panel">
                  <div className="panel-header flex items-center justify-between">
                    <span>iorad Expansion Analysis</span>
                    <span className="text-[10px] text-muted-foreground normal-case tracking-normal">
                      {latestSnapshot.model_version} · {latestSnapshot.prompt_version} · {new Date(latestSnapshot.created_at).toLocaleDateString()}
                    </span>
                  </div>

                  {snap.why_now && toArray(snap.why_now).length > 0 && (
                    <div className="mb-4 bg-primary/5 border border-primary/20 rounded-lg p-4">
                      <div className="text-xs font-mono uppercase tracking-wider text-primary mb-2">Why Now</div>
                      {toArray(snap.why_now).map((item, i) => <p key={i} className="text-sm text-foreground/90 leading-relaxed">{item}</p>)}
                    </div>
                  )}

                  <Accordion type="multiple" defaultValue={["executive-narrative"]} className="space-y-2">
                    {snap.signal_deconstruction && (
                      <AccordionItem value="signal-deconstruction" className="border rounded-lg px-4">
                        <AccordionTrigger className="text-sm font-medium">
                          <div className="flex items-center gap-2"><Target className="w-4 h-4 text-primary" /> Signal Deconstruction</div>
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="space-y-4">
                            {snap.signal_deconstruction.company_stage && (
                              <div>
                                <div className="text-xs font-mono text-muted-foreground mb-1">Company Stage</div>
                                <span className="text-sm bg-primary/10 text-primary px-2 py-0.5 rounded">{snap.signal_deconstruction.company_stage}</span>
                              </div>
                            )}
                            {snap.signal_deconstruction.observable_facts?.length ? (
                              <div>
                                <div className="text-xs font-mono text-muted-foreground mb-2">Observable Facts</div>
                                <ul className="space-y-1">{snap.signal_deconstruction.observable_facts.map((f, i) => <li key={i} className="text-sm flex items-start gap-2"><span className="text-primary">•</span>{f}</li>)}</ul>
                              </div>
                            ) : null}
                            {snap.signal_deconstruction.workflow_stress_indicators?.length ? (
                              <div>
                                <div className="text-xs font-mono text-muted-foreground mb-2">Workflow Stress Indicators</div>
                                <ul className="space-y-1">{snap.signal_deconstruction.workflow_stress_indicators.map((w, i) => <li key={i} className="text-sm flex items-start gap-2"><AlertCircle className="w-3.5 h-3.5 text-destructive mt-0.5 flex-shrink-0" />{w}</li>)}</ul>
                              </div>
                            ) : null}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    )}

                    {snap.operational_friction?.length ? (
                      <AccordionItem value="operational-friction" className="border rounded-lg px-4">
                        <AccordionTrigger className="text-sm font-medium">
                          <div className="flex items-center gap-2"><Zap className="w-4 h-4 text-primary" /> Operational Friction</div>
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="space-y-3">
                            {snap.operational_friction.map((f, i) => (
                              <div key={i} className="bg-secondary/50 rounded-lg p-3 space-y-1">
                                <div className="text-sm"><span className="font-medium text-foreground">Cause:</span> <span className="text-foreground/80">{f.cause}</span></div>
                                <div className="text-sm"><span className="font-medium text-foreground">→ Effect:</span> <span className="text-foreground/80">{f.effect}</span></div>
                                <div className="text-sm"><span className="font-medium text-foreground">→ Bottleneck:</span> <span className="text-foreground/80">{f.bottleneck}</span></div>
                              </div>
                            ))}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    ) : null}

                    {snap.partner_platform_ceiling && (
                      <AccordionItem value="partner-ceiling" className="border rounded-lg px-4">
                        <AccordionTrigger className="text-sm font-medium">
                          <div className="flex items-center gap-2"><TrendingUp className="w-4 h-4 text-primary" /> Partner Platform Ceiling</div>
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="space-y-4">
                            {snap.partner_platform_ceiling.platform_strengths?.length ? (
                              <div>
                                <div className="text-xs font-mono text-muted-foreground mb-2">Platform Strengths</div>
                                <div className="flex flex-wrap gap-1.5">{snap.partner_platform_ceiling.platform_strengths.map((s, i) => <span key={i} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">{s}</span>)}</div>
                              </div>
                            ) : null}
                            {snap.partner_platform_ceiling.execution_gaps?.length ? (
                              <div>
                                <div className="text-xs font-mono text-muted-foreground mb-2">Execution Gaps</div>
                                <ul className="space-y-1">{snap.partner_platform_ceiling.execution_gaps.map((g, i) => <li key={i} className="text-sm flex items-start gap-2"><span className="text-destructive">✕</span>{g}</li>)}</ul>
                              </div>
                            ) : null}
                            {snap.partner_platform_ceiling.key_insight && (
                              <div className="bg-primary/5 border border-primary/20 rounded p-3 text-sm italic text-foreground/90">{snap.partner_platform_ceiling.key_insight}</div>
                            )}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    )}

                    {snap.embedded_leverage && (
                      <AccordionItem value="embedded-leverage" className="border rounded-lg px-4">
                        <AccordionTrigger className="text-sm font-medium">
                          <div className="flex items-center gap-2"><Zap className="w-4 h-4 text-primary" /> Embedded iorad Leverage</div>
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {(["situation", "constraint", "intervention", "transformation"] as const).map(key => {
                              const val = snap.embedded_leverage?.[key];
                              if (!val) return null;
                              const labels: Record<string, string> = { situation: "Situation", constraint: "Constraint", intervention: "Intervention", transformation: "Transformation" };
                              return (
                                <div key={key} className="bg-secondary/50 rounded-lg p-3">
                                  <div className="text-xs font-mono text-muted-foreground mb-1">{labels[key]}</div>
                                  <p className="text-sm text-foreground/90">{val}</p>
                                </div>
                              );
                            })}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    )}

                    {snap.quantified_impact?.length ? (
                      <AccordionItem value="quantified-impact" className="border rounded-lg px-4">
                        <AccordionTrigger className="text-sm font-medium">
                          <div className="flex items-center gap-2"><BarChart3 className="w-4 h-4 text-primary" /> Quantified Impact</div>
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="space-y-3">
                            {snap.quantified_impact.map((q, i) => (
                              <div key={i} className="border rounded-lg p-3 space-y-2">
                                <div className="font-medium text-sm text-foreground">{q.metric}</div>
                                <div className="text-xs text-muted-foreground"><span className="font-mono">Assumptions:</span> {q.assumptions}</div>
                                <div className="text-xs font-mono bg-secondary/50 rounded p-2 text-foreground/80">{q.calculation}</div>
                                <div className="text-sm font-bold text-primary">{q.result}</div>
                              </div>
                            ))}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    ) : null}

                    {snap.executive_narrative && (
                      <AccordionItem value="executive-narrative" className="border rounded-lg px-4">
                        <AccordionTrigger className="text-sm font-medium">
                          <div className="flex items-center gap-2"><FileText className="w-4 h-4 text-primary" /> Executive Narrative</div>
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="prose prose-sm dark:prose-invert max-w-none">
                            {(Array.isArray(snap.executive_narrative)
                              ? snap.executive_narrative
                              : typeof snap.executive_narrative === 'string' ? snap.executive_narrative.split("\n\n") : []
                            ).map((p: string, i: number) => (
                              <p key={i} className="text-sm text-foreground/90 leading-relaxed mb-3">{p}</p>
                            ))}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    )}

                    {snap.outbound_positioning && (
                      <AccordionItem value="outbound-positioning" className="border rounded-lg px-4">
                        <AccordionTrigger className="text-sm font-medium">
                          <div className="flex items-center gap-2"><MessageSquareQuote className="w-4 h-4 text-primary" /> Outbound Positioning</div>
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="space-y-3">
                            {snap.outbound_positioning.executive_framing && (
                              <div className="border-l-2 border-primary/40 pl-3">
                                <div className="text-xs font-mono text-muted-foreground mb-1">Executive Framing</div>
                                <p className="text-sm text-foreground/90 italic">"{snap.outbound_positioning.executive_framing}"</p>
                              </div>
                            )}
                            {snap.outbound_positioning.efficiency_framing && (
                              <div className="border-l-2 border-primary/40 pl-3">
                                <div className="text-xs font-mono text-muted-foreground mb-1">Efficiency / Revenue</div>
                                <p className="text-sm text-foreground/90 italic">"{snap.outbound_positioning.efficiency_framing}"</p>
                              </div>
                            )}
                            {snap.outbound_positioning.risk_framing && (
                              <div className="border-l-2 border-primary/40 pl-3">
                                <div className="text-xs font-mono text-muted-foreground mb-1">Risk Mitigation</div>
                                <p className="text-sm text-foreground/90 italic">"{snap.outbound_positioning.risk_framing}"</p>
                              </div>
                            )}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    )}

                    {snap.competitive_insulation?.length ? (
                      <AccordionItem value="competitive-insulation" className="border rounded-lg px-4">
                        <AccordionTrigger className="text-sm font-medium">
                          <div className="flex items-center gap-2"><Shield className="w-4 h-4 text-primary" /> Competitive Insulation</div>
                        </AccordionTrigger>
                        <AccordionContent>
                          <ul className="space-y-1.5">{snap.competitive_insulation.map((r, i) => <li key={i} className="text-sm flex items-start gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-primary mt-0.5 flex-shrink-0" />{r}</li>)}</ul>
                        </AccordionContent>
                      </AccordionItem>
                    ) : null}

                    {snap.evidence?.length ? (
                      <AccordionItem value="evidence" className="border rounded-lg px-4">
                        <AccordionTrigger className="text-sm font-medium">
                          <div className="flex items-center gap-2"><ExternalLink className="w-4 h-4 text-primary" /> Cited Evidence ({snap.evidence.length})</div>
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="space-y-2">
                            {snap.evidence.map((ev, i) => (
                              <div key={i} className="text-xs border-l-2 border-primary/40 pl-3 py-1">
                                <p className="text-foreground/80 italic">"{ev.snippet || ev.detail || ""}"</p>
                                <a href={ev.source_url || ev.url || "#"} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1 mt-0.5">
                                  <ExternalLink className="w-3 h-3" /> {ev.source_type || ev.signal_type || "source"} · {ev.date || "no date"}
                                </a>
                              </div>
                            ))}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    ) : null}
                  </Accordion>
                </div>
              )}

              {/* Snapshot History */}
              <div className="panel">
                <div className="panel-header">Snapshot History</div>
                {snapshots.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No snapshots generated yet.</p>
                ) : (
                  <div className="space-y-2">
                    {snapshots.map(s => (
                      <div key={s.id} className="flex items-center justify-between text-sm border rounded px-3 py-2">
                        <div className="flex items-center gap-3">
                          <ScoreCell score={s.score_total} />
                          <span className="font-mono text-xs text-muted-foreground">{s.model_version}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">{new Date(s.created_at).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </TabsContent>

        {/* ============ TAB 2: STRATEGY ============ */}
        <TabsContent value="strategy" className="space-y-6 mt-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Strategy & Cards</h3>
            <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={generateCards} disabled={generatingCards}>
              {generatingCards ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              {generatingCards ? "Generating…" : cards.length > 0 ? "Regenerate" : "Generate"}
            </Button>
          </div>

          {cardsLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
              <span className="ml-2 text-sm text-muted-foreground">Loading cards…</span>
            </div>
          ) : cards.length > 0 ? (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {cards.map((card, i) => (
                  <DashboardCardUI key={card.id || i} card={card} />
                ))}
              </div>

              {/* AI-Generated Story Config */}
              {assets.story_assets && (assets.story_assets.primary_asset || assets.story_assets.supporting_asset) && (
                <>
                  <div className="glow-line" />
                  <StoryAssetsUI storyAssets={assets.story_assets} />
                </>
              )}
            </>
          ) : (
            <div className="panel text-center py-8">
              <Sparkles className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground mb-3">No dashboard cards generated yet.</p>
              <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={generateCards} disabled={generatingCards}>
                {generatingCards ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                Generate Cards
              </Button>
            </div>
          )}
        </TabsContent>

        {/* ============ TAB 3: OUTREACH ============ */}
        <TabsContent value="outreach" className="space-y-6 mt-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Outreach Assets</h3>
            <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={generateCards} disabled={generatingCards}>
              {generatingCards ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              {generatingCards ? "Generating…" : (assets.email_sequence || assets.linkedin_sequence) ? "Regenerate" : "Generate"}
            </Button>
          </div>

          {cardsLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
              <span className="ml-2 text-sm text-muted-foreground">Loading…</span>
            </div>
          ) : (assets.email_sequence || assets.linkedin_sequence) ? (
            <div className="space-y-6">
              {assets.email_sequence && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium flex items-center gap-2"><Mail className="w-4 h-4 text-primary" /> Email Sequence</h4>
                  <EmailSequenceUI emails={assets.email_sequence} />
                </div>
              )}
              {assets.linkedin_sequence && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium flex items-center gap-2"><Linkedin className="w-4 h-4 text-primary" /> LinkedIn Sequence</h4>
                  <LinkedInSequenceUI steps={assets.linkedin_sequence} />
                </div>
              )}
            </div>
          ) : (
            <div className="panel text-center py-8">
              <Mail className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground mb-3">No outreach assets generated yet.</p>
              <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={generateCards} disabled={generatingCards}>
                {generatingCards ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                Generate Cards
              </Button>
            </div>
          )}
        </TabsContent>

        {/* ============ TAB 4: STORY ============ */}
        <TabsContent value="story" className="space-y-6 mt-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Story Configuration</h3>
            <div className="flex items-center gap-2">
              {storyBaseUrl && (
                <a href={storyBaseUrl} target="_blank" rel="noopener noreferrer">
                  <Button size="sm" variant="ghost" className="gap-1.5 text-xs">
                    <Eye className="w-3.5 h-3.5" /> View Story
                  </Button>
                </a>
              )}
              <Button
                size="sm"
                className="gap-1.5 text-xs"
                onClick={saveStoryUrls}
                disabled={!storyUrlsDirty || updateCompany.isPending}
              >
                {updateCompany.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Save
              </Button>
            </div>
          </div>

          {/* URL Inputs */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Video className="w-4 h-4 text-primary" />
                  Loom Video
                  <Badge variant={effectiveLoomUrl ? "default" : "secondary"} className="text-[10px] ml-auto">
                    {effectiveLoomUrl ? "Ready" : "Not Set"}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label className="text-xs">Loom Share URL</Label>
                  <Input
                    placeholder="https://www.loom.com/share/abc123..."
                    value={effectiveLoomUrl}
                    onChange={(e) => { setLoomUrl(e.target.value); setStoryUrlsDirty(true); }}
                    className="mt-1"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">Paste your Loom share link. It will embed automatically at the top of the story page.</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-primary" />
                  iorad Tutorial
                  <Badge variant={effectiveIoradUrl ? "default" : "secondary"} className="text-[10px] ml-auto">
                    {effectiveIoradUrl ? "Ready" : "Not Set"}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label className="text-xs">iorad Tutorial URL</Label>
                  <Input
                    placeholder="https://ior.ad/..."
                    value={effectiveIoradUrl}
                    onChange={(e) => { setIoradUrl(e.target.value); setStoryUrlsDirty(true); }}
                    className="mt-1"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">Replaces the default tutorial in the customer story page.</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Embedded Previews */}
          {(loomEmbedUrl || ioradEmbedUrl) && (
            <div className="space-y-4">
              <div className="glow-line" />
              <h3 className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Preview</h3>

              {loomEmbedUrl && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium flex items-center gap-2"><Video className="w-4 h-4 text-primary" /> Loom Video</h4>
                  <div className="rounded-xl overflow-hidden border">
                    <iframe
                      src={loomEmbedUrl}
                      width="100%"
                      height="400"
                      frameBorder="0"
                      allowFullScreen
                      allow="autoplay; fullscreen"
                      title="Loom video preview"
                    />
                  </div>
                </div>
              )}

              {ioradEmbedUrl && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium flex items-center gap-2"><BookOpen className="w-4 h-4 text-primary" /> iorad Tutorial</h4>
                  <div className="rounded-xl overflow-hidden border">
                    <iframe
                      src={ioradEmbedUrl}
                      width="100%"
                      height="500"
                      frameBorder="0"
                      allowFullScreen
                      allow="camera; microphone; clipboard-write"
                      sandbox="allow-scripts allow-forms allow-same-origin allow-presentation allow-downloads allow-modals allow-popups allow-popups-to-escape-sandbox allow-top-navigation allow-top-navigation-by-user-activation"
                      title="iorad tutorial preview"
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
