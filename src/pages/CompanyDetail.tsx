import { useState, useCallback, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { useCompany, useSignals, useSnapshots, useContacts, useCompanyCards, useUpdateCompany, useMeetings, useCustomerActivity } from "@/hooks/useSupabase";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import ScoreCell from "@/components/ScoreCell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, RefreshCw, ExternalLink, Briefcase, Newspaper, CheckCircle2, AlertCircle, Loader2, Target, TrendingUp, Shield, Zap, BarChart3, FileText, MessageSquareQuote, UserSearch, Linkedin, Mail, Plus, Sparkles, Eye, Building2, MapPin, Users, DollarSign, Globe, Video, BookOpen, ChevronRight, Search, PhoneCall, Clock, Brain } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { motion } from "framer-motion";
import { Json } from "@/integrations/supabase/types";
import { toast } from "sonner";

// Sub-components
import { parseJson, toArray, toLoomEmbedUrl, toIoradEmbedUrl } from "./company/types";
import type { ScoreBreakdown, SnapshotJSON, DashboardCard, EmailTouch, LinkedInStep, StoryAssets } from "./company/types";
import { DashboardCardUI } from "./company/DashboardCardUI";
import { EmailSequenceUI, LinkedInSequenceUI } from "./company/OutreachSequences";
import { StoryAssetsUI } from "./company/StoryAssetsUI";
import OnboardingTab from "./company/OnboardingTab";

function TranscriptAnalysisView({ analysis }: { analysis: any }) {
  if (!analysis) return null;
  if (analysis.raw_text) {
    return <pre className="text-xs whitespace-pre-wrap text-foreground/80 font-sans leading-relaxed">{analysis.raw_text}</pre>;
  }
  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="mb-4">
      <div className="text-[11px] font-mono uppercase tracking-widest text-primary mb-2">{title}</div>
      {children}
    </div>
  );
  const BulletList = ({ items }: { items: any[] }) => (
    <ul className="space-y-1.5">
      {items.map((item: any, i: number) => (
        <li key={i} className="text-[13px] text-foreground/80 flex items-start gap-1.5 leading-relaxed">
          <span className="text-primary mt-0.5">•</span>
          <span>{typeof item === "string" ? item : JSON.stringify(item)}</span>
        </li>
      ))}
    </ul>
  );
  return (
    <div className="space-y-3 pr-2">
      {analysis.executive_snapshot && <Section title="Executive Snapshot"><BulletList items={analysis.executive_snapshot} /></Section>}
      {analysis.compelling_events?.length > 0 && (
        <Section title="Compelling Events">
          {analysis.compelling_events.map((ev: any, i: number) => (
            <div key={i} className="text-xs mb-2 border-l-2 border-primary/30 pl-2">
              <div className="font-medium text-foreground">{ev.event}</div>
              {ev.timeline && <div className="text-muted-foreground">Timeline: {ev.timeline}</div>}
              {ev.implication && <div className="text-foreground/70">→ {ev.implication}</div>}
            </div>
          ))}
        </Section>
      )}
      {analysis.stated_initiatives?.length > 0 && (
        <Section title="Stated Initiatives">
          {analysis.stated_initiatives.map((init: any, i: number) => (
            <div key={i} className="text-xs mb-2 border-l-2 border-primary/30 pl-2">
              <div className="font-medium text-foreground">{init.initiative}</div>
              {init.owner && <div className="text-muted-foreground">Owner: {init.owner}</div>}
              {init.urgency && <Badge variant="outline" className="text-[9px] h-4">{init.urgency}</Badge>}
              {init.iorad_fit && <div className="text-foreground/70 mt-0.5">iorad fit: {init.iorad_fit}</div>}
            </div>
          ))}
        </Section>
      )}
      {analysis.usage_analysis && (
        <Section title="iorad Usage Analysis">
          <div className="text-xs space-y-1 text-foreground/80">
            {analysis.usage_analysis.maturity && <div><span className="text-muted-foreground">Maturity:</span> {analysis.usage_analysis.maturity}</div>}
            {analysis.usage_analysis.use_cases && <div><span className="text-muted-foreground">Use cases:</span> {Array.isArray(analysis.usage_analysis.use_cases) ? analysis.usage_analysis.use_cases.join(", ") : analysis.usage_analysis.use_cases}</div>}
            {analysis.usage_analysis.double_usage_answer && <div className="mt-1 italic text-foreground/70">{analysis.usage_analysis.double_usage_answer}</div>}
          </div>
        </Section>
      )}
      {analysis.power_map?.length > 0 && (
        <Section title="Power Map">
          {analysis.power_map.map((p: any, i: number) => (
            <div key={i} className="text-xs mb-1.5 flex items-start gap-2">
              <span className="font-medium text-foreground min-w-[80px]">{p.name || p.role}</span>
              <span className="text-muted-foreground">{p.role}{p.influence ? ` · ${p.influence}` : ""}{p.sentiment ? ` · ${p.sentiment}` : ""}</span>
            </div>
          ))}
        </Section>
      )}
      {analysis.risk_assessment && (
        <Section title="Risk Assessment">
          <div className="text-xs text-foreground/80">
            <div className="font-medium">Churn Risk: <span className={analysis.risk_assessment.churn_risk === "High" ? "text-destructive" : analysis.risk_assessment.churn_risk === "Medium" ? "text-warning" : "text-primary"}>{analysis.risk_assessment.churn_risk}</span></div>
            {analysis.risk_assessment.churn_reason && <div className="mt-0.5 text-muted-foreground">{analysis.risk_assessment.churn_reason}</div>}
            {analysis.risk_assessment.signals && <BulletList items={analysis.risk_assessment.signals} />}
          </div>
        </Section>
      )}
      {analysis.expansion_angles?.length > 0 && (
        <Section title="Expansion Angles">
          {analysis.expansion_angles.map((a: any, i: number) => (
            <div key={i} className="text-xs mb-1.5 border-l-2 border-primary/30 pl-2">
              <div className="font-medium text-foreground">{a.angle}</div>
              {a.details && <div className="text-foreground/70">{a.details}</div>}
            </div>
          ))}
        </Section>
      )}
      {analysis.messaging_strategy && (
        <Section title="Messaging Strategy">
          <div className="text-xs space-y-2 text-foreground/80">
            {analysis.messaging_strategy.positioning_angles && <div><span className="text-muted-foreground font-medium">Positioning:</span><BulletList items={analysis.messaging_strategy.positioning_angles} /></div>}
            {analysis.messaging_strategy.questions && <div><span className="text-muted-foreground font-medium">Questions:</span><BulletList items={analysis.messaging_strategy.questions} /></div>}
            {analysis.messaging_strategy.renewal_storyline && <div><span className="text-muted-foreground font-medium">Renewal:</span> {analysis.messaging_strategy.renewal_storyline}</div>}
          </div>
        </Section>
      )}
      {analysis.action_plan && (
        <Section title="30-60-90 Day Plan">
          <div className="text-xs space-y-2">
            {analysis.action_plan.day_30 && <div><span className="text-muted-foreground font-medium">30 Days:</span><BulletList items={analysis.action_plan.day_30} /></div>}
            {analysis.action_plan.day_60 && <div><span className="text-muted-foreground font-medium">60 Days:</span><BulletList items={analysis.action_plan.day_60} /></div>}
            {analysis.action_plan.day_90 && <div><span className="text-muted-foreground font-medium">90 Days:</span><BulletList items={analysis.action_plan.day_90} /></div>}
          </div>
        </Section>
      )}
      {analysis.account_thesis && (
        <Section title="Account Thesis">
          <p className="text-xs font-medium text-foreground italic">"{analysis.account_thesis}"</p>
        </Section>
      )}
    </div>
  );
}

export default function CompanyDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: company, isLoading } = useCompany(id);
  const { data: signals = [] } = useSignals(id);
  const { data: snapshots = [] } = useSnapshots(id);
  const { data: contacts = [] } = useContacts(id);
  const { data: meetings = [] } = useMeetings(id);
  const { data: activityEvents = [] } = useCustomerActivity(id);
  const updateCompany = useUpdateCompany();
  const queryClient = useQueryClient();
  const [regenerating, setRegenerating] = useState(false);
  const [generatingCards, setGeneratingCards] = useState(false);
  const [selectedContactId, setSelectedContactId] = useState<string>("");
  const [activeTab, setActiveTab] = useState("company");
  const [addContactOpen, setAddContactOpen] = useState(false);
  const [newContact, setNewContact] = useState({ name: "", title: "", email: "", linkedin: "" });
  const [savingContact, setSavingContact] = useState(false);
  const [extraOpen, setExtraOpen] = useState(true);
  const [loomUrl, setLoomUrl] = useState<string | null>(null);
  const [ioradUrl, setIoradUrl] = useState<string | null>(null);
  const [findingContacts, setFindingContacts] = useState(false);
  const [searchingPersona, setSearchingPersona] = useState<string | null>(null);
  const [syncingFathom, setSyncingFathom] = useState(false);
  const [fixingDomain, setFixingDomain] = useState(false);
  const [analyzingMeeting, setAnalyzingMeeting] = useState<string | null>(null);
  const [contactSearch, setContactSearch] = useState("");
  // extractingProfiles state removed — extraction is now part of the generate pipeline

  const effectiveContactId = selectedContactId || contacts[0]?.id || "";
  const { data: companyCards, isLoading: cardsLoading } = useCompanyCards(id, effectiveContactId || undefined);

  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autosaveUrls = useCallback((loom: string, iorad: string) => {
    if (!id) return;
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => {
      updateCompany.mutate({ id, updates: { loom_url: loom || null, iorad_url: iorad || null } });
    }, 800);
  }, [id, updateCompany]);

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
    try {
      // Step 1: Run signals
      toast.info("Step 1/2 — Running signal search…");
      const { data, error } = await supabase.functions.invoke("run-signals", { body: { company_id: id, mode } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`Signals complete — ${data?.signals_found ?? 0} found for ${data?.company || "company"}`);

      // Step 2: Find contacts via Apollo (skip for inbound companies — contacts come from HubSpot)
      if (companyAny?.source_type !== "inbound") {
        toast.info("Step 2/2 — Finding contacts via Apollo…");
        setFindingContacts(true);
        try {
          const { data: contactData, error: contactErr } = await supabase.functions.invoke("find-contacts", { body: { company_id: id } });
          if (contactErr) throw contactErr;
          if (contactData?.error) throw new Error(contactData.error);
          if (contactData?.contacts_found > 0) {
            toast.success(`Found ${contactData.contacts_found} contacts via Apollo`);
          } else {
            toast.warning("No contacts found — check company domain is correct");
          }
        } catch (ce: any) {
          console.error("Contact enrichment failed:", ce);
          toast.error("Contact enrichment failed: " + (ce.message || "Unknown error"));
        } finally {
          setFindingContacts(false);
        }
      }

      // Step 3: For inbound companies, extract contact profiles and generate company cards
      if (companyAny?.source_type === "inbound") {
        // Extract AI profiles from HubSpot data
        toast.info("Extracting contact profiles…");
        try {
          const { data: profileData, error: profileErr } = await supabase.functions.invoke("extract-contact-profile", { body: { company_id: id } });
          if (profileErr) console.warn("Profile extraction failed:", profileErr);
          else if (profileData?.profiles_extracted > 0) toast.success(`Extracted ${profileData.profiles_extracted} AI profiles`);
        } catch (pe: any) { console.warn("Profile extraction error:", pe.message); }

        // Generate company intel cards
        toast.info("Generating company intel…");
        try {
          const { data: cardData, error: cardErr } = await supabase.functions.invoke("generate-cards", { body: { company_id: id, tab: "company" } });
          if (cardErr) throw cardErr;
          if (cardData?.error) throw new Error(cardData.error);
          toast.success("Company intel generated");
        } catch (ce: any) {
          console.error("Card generation failed:", ce);
          toast.error("Card generation failed: " + (ce.message || "Unknown error"));
        }
      }

      queryClient.invalidateQueries({ queryKey: ["company", id] });
      queryClient.invalidateQueries({ queryKey: ["signals", id] });
      queryClient.invalidateQueries({ queryKey: ["snapshots", id] });
      queryClient.invalidateQueries({ queryKey: ["contacts", id] });
      queryClient.invalidateQueries({ queryKey: ["company_cards", id] });
      queryClient.invalidateQueries({ queryKey: ["companies"] });
    } catch (e: any) { toast.error(e.message || "Operation failed"); }
    finally { setRegenerating(false); }
  };

  const PERSONAS = ["Learning & Development", "Enablement", "Customer Ed"];

  const syncFathom = async () => {
    if (!company?.domain) { toast.error("Company needs a domain to sync Fathom meetings"); return; }
    setSyncingFathom(true);
    toast.info(`Syncing Fathom meetings for ${company.domain}…`);
    try {
      const { data, error } = await supabase.functions.invoke("sync-fathom", {
        body: { domain: company.domain, company_id: id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const synced = data.meetings_synced || 0;
      toast.success(`Synced ${synced} meetings`);
      await queryClient.invalidateQueries({ queryKey: ["meetings", id] });

      // Auto-analyze: get meetings with transcripts but no analysis yet
      if (synced > 0) {
        toast.info("Auto-analyzing transcripts…");
        const { data: freshMeetings } = await supabase
          .from("meetings")
          .select("id, transcript, transcript_analysis")
          .eq("company_id", id!)
          .not("transcript", "is", null)
          .is("transcript_analysis", null);

        if (freshMeetings && freshMeetings.length > 0) {
          for (const m of freshMeetings) {
            setAnalyzingMeeting(m.id);
            try {
              const { data: aData, error: aErr } = await supabase.functions.invoke("analyze-transcript", {
                body: { meeting_id: m.id },
              });
              if (aErr) throw aErr;
              if (aData?.error) throw new Error(aData.error);
            } catch (ae: any) {
              console.error(`Analysis failed for meeting ${m.id}:`, ae);
              toast.error(`Analysis failed for a meeting: ${ae.message}`);
            }
          }
          setAnalyzingMeeting(null);
          toast.success("Transcript analysis complete — check the Onboarding tab");
          queryClient.invalidateQueries({ queryKey: ["meetings", id] });
          setActiveTab("onboarding");
        }
      }
    } catch (e: any) { toast.error(e.message || "Fathom sync failed"); }
    finally { setSyncingFathom(false); setAnalyzingMeeting(null); }
  };

  const analyzeTranscript = async (meetingId: string) => {
    setAnalyzingMeeting(meetingId);
    toast.info("Analyzing transcript…");
    try {
      const { data, error } = await supabase.functions.invoke("analyze-transcript", {
        body: { meeting_id: meetingId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Transcript analysis complete");
      queryClient.invalidateQueries({ queryKey: ["meetings", id] });
    } catch (e: any) { toast.error(e.message || "Analysis failed"); }
    finally { setAnalyzingMeeting(null); }
  };

  const fixDomain = async () => {
    if (!id) return;
    setFixingDomain(true);
    toast.info("AI is checking the domain…");
    try {
      const { data, error } = await supabase.functions.invoke("fix-domain", {
        body: { company_id: id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const result = data.results?.[0];
      if (result && result.old_domain !== result.new_domain) {
        toast.success(`Domain fixed: ${result.old_domain} → ${result.new_domain}`);
        queryClient.invalidateQueries({ queryKey: ["company", id] });
      } else {
        toast.info("Domain looks correct — no changes needed");
      }
    } catch (e: any) { toast.error(e.message || "Domain fix failed"); }
    finally { setFixingDomain(false); }
  };

  const searchByPersona = async (persona: string) => {
    if (!id) return;
    setSearchingPersona(persona);
    toast.info(`Searching Apollo for "${persona}" contacts…`);
    try {
      const { data, error } = await supabase.functions.invoke("find-contacts", { body: { company_id: id, persona } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data?.contacts_found > 0) {
        toast.success(`Found ${data.contacts_found} "${persona}" contacts`);
      } else {
        toast.warning(`No "${persona}" contacts found at this company`);
      }
      queryClient.invalidateQueries({ queryKey: ["contacts", id] });
    } catch (e: any) {
      toast.error(e.message || "Persona search failed");
    } finally {
      setSearchingPersona(null);
    }
  };

  // Profile extraction is now handled automatically inside generate-cards pipeline
  const generateCards = async () => {
    if (!id) return;
    setGeneratingCards(true);
    try {
      const body: Record<string, string> = { company_id: id, tab: activeTab };
      const cId = effectiveContactId;
      if (cId) body.contact_id = cId;
      const { data, error } = await supabase.functions.invoke("generate-cards", { body });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`Cards generated — ${data?.cards_count || 0} cards`);
      queryClient.invalidateQueries({ queryKey: ["company_cards", id, cId || "default"] });
    } catch (e: any) { toast.error(e.message || "Failed to generate cards"); }
    finally { setGeneratingCards(false); }
  };

  const selectedContact = contacts.find((c: any) => c.id === selectedContactId) || contacts[0] || null;

  const contactSelector = contacts.length > 0 ? (
    <Select value={selectedContactId || contacts[0]?.id || ""} onValueChange={setSelectedContactId}>
      <SelectTrigger className="w-[220px] h-8 text-xs bg-background">
        <SelectValue placeholder="Select contact" />
      </SelectTrigger>
      <SelectContent className="bg-background z-50">
        {contacts.map((c: any) => (
          <SelectItem key={c.id} value={c.id} className="text-xs">
            <span className="font-medium">{c.name}</span>
            {c.title && <span className="text-muted-foreground ml-1">· {c.title}</span>}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  ) : (
    <span className="text-xs text-muted-foreground italic">No contacts</span>
  );

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
            <h1 className="text-[1.75rem] font-bold tracking-tight leading-tight">{company.name}</h1>
            <p className="text-[13px] text-muted-foreground font-mono mt-0.5">{company.domain || "no domain"}</p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="company" className="w-full" onValueChange={setActiveTab}>
        <TabsList className="w-full justify-start">
          <TabsTrigger value="company" className="text-sm">Company</TabsTrigger>
          <TabsTrigger value="strategy" className="text-sm">Strategy</TabsTrigger>
          <TabsTrigger value="outreach" className="text-sm">Outreach</TabsTrigger>
          <TabsTrigger value="story" className="text-sm">Story</TabsTrigger>
          <TabsTrigger value="onboarding" className="text-sm">Onboarding</TabsTrigger>
        </TabsList>

        {/* ============ TAB 1: COMPANY ============ */}
        <TabsContent value="company" className="space-y-6 mt-6">
          <div className="flex items-center justify-between">
          <h3 className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">Company Intel</h3>
            <Button size="sm" variant="outline" className="gap-1.5 text-[13px]" onClick={() => regenerate("full")} disabled={regenerating}>
              {regenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              {regenerating ? "Generating…" : signals.length > 0 ? "Regenerate" : "Generate"}
            </Button>
          </div>

          {/* Company Profile */}
          {accountData?.about?.text && (
            <p className="text-[14px] text-foreground/80 leading-relaxed line-clamp-2">
              {accountData.about.text}
            </p>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {(accountData?.employees?.value || company.headcount) && (
              <Card className="bg-secondary/30"><CardContent className="p-3 flex flex-col items-start gap-1.5">
                <Users className="w-4 h-4 text-primary" />
                <span className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">Employees</span>
                <span className="text-[13px] font-medium text-foreground">{accountData?.employees?.value || `${company.headcount}+`}</span>
              </CardContent></Card>
            )}
            {accountData?.revenue_range?.value && accountData.revenue_range.value !== "Unknown" && (
              <Card className="bg-secondary/30"><CardContent className="p-3 flex flex-col items-start gap-1.5">
                <DollarSign className="w-4 h-4 text-primary" />
                <span className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">Revenue</span>
                <span className="text-[13px] font-medium text-foreground">{accountData.revenue_range.value}</span>
              </CardContent></Card>
            )}
            {company.partner && (
              <Card className="bg-secondary/30"><CardContent className="p-3 flex flex-col items-start gap-1.5">
                <Briefcase className="w-4 h-4 text-primary" />
                <span className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">Partner</span>
                <span className="text-[13px] font-medium text-foreground">{company.partner}</span>
              </CardContent></Card>
            )}
          </div>

          {/* HubSpot Product Properties */}
          {companyAny?.hubspot_properties && Object.keys(companyAny.hubspot_properties).length > 0 && (
            <Collapsible>
              <CollapsibleTrigger className="flex items-center gap-2 w-full text-left">
                <ChevronRight className="w-4 h-4 text-muted-foreground transition-transform data-[state=open]:rotate-90" />
                <span className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">iorad Product Data (HubSpot)</span>
                <Badge variant="outline" className="text-[9px] h-4 ml-auto">
                  {Object.entries(companyAny.hubspot_properties).filter(([_, v]) => v !== null && v !== "" && v !== undefined).length} properties
                </Badge>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {Object.entries(companyAny.hubspot_properties as Record<string, any>)
                    .filter(([_, v]) => v !== null && v !== "" && v !== undefined)
                    .filter(([k]) => !["name", "domain", "industry", "country", "numberofemployees", "hs_object_id", "createdate", "hs_lastmodifieddate", "hs_pipeline"].includes(k))
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([key, value]) => (
                       <div key={key} className="px-3 py-2 rounded-lg border border-border/50 bg-secondary/20">
                        <div className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground truncate" title={key}>
                          {key.replace(/_/g, " ").replace(/^hs /, "")}
                        </div>
                        <div className="text-[13px] font-medium text-foreground mt-0.5 truncate" title={String(value)}>
                          {String(value).length > 80 ? String(value).slice(0, 80) + "…" : String(value)}
                        </div>
                      </div>
                    ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Contacts */}
          <div className="panel">
            <div className="panel-header flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span>Contacts ({contacts.length || (companyAny?.buyer_name ? 1 : 0)})</span>
                {findingContacts && (
                  <span className="text-[11px] text-muted-foreground font-normal flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Finding contacts via Apollo…
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
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
            </div>
            {/* Persona Search — only for outbound companies */}
            {companyAny?.source_type !== "inbound" && (
            <div className="flex items-center gap-2 flex-wrap px-4 pb-3">
              <span className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">Search by persona:</span>
              {PERSONAS.map((p) => (
                <Button
                  key={p}
                  size="sm"
                  variant="outline"
                  className="text-[12px] h-7 px-2.5 gap-1"
                  disabled={!!searchingPersona || findingContacts}
                  onClick={() => searchByPersona(p)}
                >
                  {searchingPersona === p ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
                  {p}
                </Button>
              ))}
            </div>
            )}
            {contacts.length > 3 && (
              <div className="px-4 pb-3">
                <Input
                  placeholder="Search contacts…"
                  value={contactSearch}
                  onChange={e => setContactSearch(e.target.value)}
                  className="h-7 text-xs"
                />
              </div>
            )}
            <ScrollArea className="h-[180px]">
              <div className="space-y-3 pr-3">
              {contacts.length > 0 ? contacts.filter((c) => {
                if (!contactSearch) return true;
                const q = contactSearch.toLowerCase();
                return (c.name?.toLowerCase().includes(q) || c.title?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q));
              }).map((contact) => {
                const firstName = contact.name.split(" ")[0].toLowerCase().replace(/[^a-z]/g, "");
                const storyUrl = company.partner
                  ? `/${company.partner}/${company.name.toLowerCase().replace(/\s+/g, "-")}/stories/${firstName}`
                  : null;
                return (
                  <div key={contact.id} className="p-2 rounded-md hover:bg-secondary/30 transition-colors space-y-1.5">
                    <div className="flex items-center gap-4">
                      <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <UserSearch className="w-4 h-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0 space-y-0.5">
                        <div className="text-[14px] font-medium truncate">{contact.name}</div>
                        {contact.title && <div className="text-[13px] text-muted-foreground truncate">{contact.title}</div>}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {storyUrl && snap && (
                          <a href={storyUrl} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary" title="View personalized story"><ExternalLink className="w-4 h-4" /></a>
                        )}
                        {contact.email && <a href={`mailto:${contact.email}`} className="text-muted-foreground hover:text-primary" title={contact.email}><Mail className="w-4 h-4" /></a>}
                        {contact.linkedin && <a href={contact.linkedin} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary"><Linkedin className="w-4 h-4" /></a>}
                      </div>
                    </div>
                    {/* AI Profile — directly under name */}
                    {(() => {
                      const profile = (contact as any).contact_profile;
                      if (!profile) return null;
                      return (
                        <div className="ml-[52px] space-y-1.5">
                          {/* Tier badges */}
                          <div className="flex flex-wrap items-center gap-1.5">
                            {profile.engagement_tier && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded border border-primary/20 bg-primary/10 text-primary font-medium">
                                {profile.engagement_tier.replace(/_/g, " ")}
                              </span>
                            )}
                            {profile.adoption_stage && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded border border-border/50 bg-secondary/30 text-foreground font-medium">
                                {profile.adoption_stage.replace(/_/g, " ")}
                              </span>
                            )}
                            {profile.key_metrics?.plan && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded border border-accent bg-accent/50 text-accent-foreground font-medium">
                                {profile.key_metrics.plan}
                              </span>
                            )}
                            {profile.key_metrics?.days_since_last_active != null && (
                              <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${profile.key_metrics.days_since_last_active > 30 ? "border-destructive/30 bg-destructive/10 text-destructive" : "border-border/50 bg-secondary/30 text-muted-foreground"}`}>
                                {profile.key_metrics.days_since_last_active}d ago
                              </span>
                            )}
                          </div>
                          {/* Use case + narrative */}
                          {profile.primary_use_case && (
                            <div className="text-xs text-foreground/80">{profile.primary_use_case}</div>
                          )}
                          {profile.account_narrative && (
                            <div className="text-xs text-foreground/60 italic leading-relaxed">{profile.account_narrative}</div>
                          )}
                          {/* Expansion & risk signals inline */}
                          {(profile.expansion_signals?.length > 0 || profile.risk_signals?.length > 0) && (
                            <div className="space-y-0.5">
                              {profile.expansion_signals?.map((s: string, i: number) => (
                                <div key={`exp-${i}`} className="text-[11px] text-foreground/70 flex items-start gap-1.5">
                                  <TrendingUp className="w-3 h-3 text-primary mt-0.5 flex-shrink-0" />
                                  <span>{s}</span>
                                </div>
                              ))}
                              {profile.risk_signals?.map((s: string, i: number) => (
                                <div key={`risk-${i}`} className="text-[11px] text-foreground/70 flex items-start gap-1.5">
                                  <AlertCircle className="w-3 h-3 text-destructive mt-0.5 flex-shrink-0" />
                                  <span>{s}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                    {/* Bottom row: source tag + key metric tags */}
                    {(() => {
                      const profile = (contact as any).contact_profile;
                      const tags: { label: string; value: string }[] = [];
                      if (profile?.key_metrics) {
                        const km = profile.key_metrics;
                        if (km.tutorials_created > 0) tags.push({ label: "Created", value: String(km.tutorials_created) });
                        if (km.tutorials_viewed > 0) tags.push({ label: "Views", value: String(km.tutorials_viewed) });
                        if (km.libraries_owned > 0) tags.push({ label: "Libraries", value: String(km.libraries_owned) });
                        if (km.sessions > 0) tags.push({ label: "Sessions", value: String(km.sessions) });
                      }
                      if (profile?.tools_documented?.length > 0) tags.push({ label: "Docs", value: profile.tools_documented.join(", ") });
                      if (profile?.deployment_channels?.length > 0) tags.push({ label: "Deploy", value: profile.deployment_channels.join(", ") });

                      return (
                        <div className="ml-[52px] flex flex-wrap gap-1.5">
                          {contact.source && <span className="text-[10px] bg-secondary px-1.5 py-0.5 rounded text-muted-foreground">{contact.source}</span>}
                          {tags.map(t => (
                            <span key={t.label} className="text-[10px] px-1.5 py-0.5 rounded border border-border/30 bg-muted/30 text-muted-foreground">
                              <span className="font-mono uppercase tracking-wider">{t.label}:</span>{" "}
                              <span className="text-foreground">{t.value}</span>
                            </span>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                );
              }) : companyAny?.buyer_name ? (
                <div className="flex items-center gap-4 p-2 rounded-md hover:bg-secondary/30 transition-colors">
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center"><UserSearch className="w-4 h-4 text-primary" /></div>
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <div className="text-[14px] font-medium">{companyAny.buyer_name}</div>
                    {companyAny.buyer_title && <div className="text-[13px] text-muted-foreground">{companyAny.buyer_title}</div>}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {companyAny.buyer_email && <a href={`mailto:${companyAny.buyer_email}`} className="text-muted-foreground hover:text-primary"><Mail className="w-4 h-4" /></a>}
                    {companyAny.buyer_linkedin && <a href={companyAny.buyer_linkedin} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary"><Linkedin className="w-4 h-4" /></a>}
                  </div>
                </div>
              ) : (
                <p className="text-[14px] text-muted-foreground">No contacts yet. Add one manually or run enrichment.</p>
              )}
              </div>
            </ScrollArea>
          </div>

          {/* Meetings (Fathom) */}
          <Card className="bg-secondary/30">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <PhoneCall className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <div className="text-[14px] font-medium text-foreground">
                    {meetings.length} Meeting{meetings.length !== 1 ? "s" : ""} Synced
                  </div>
                  <div className="text-[13px] text-muted-foreground">
                    {meetings.filter((m: any) => m.transcript_analysis).length} analyzed
                    {(syncingFathom || analyzingMeeting) && (
                      <span className="ml-2 inline-flex items-center gap-1">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        {syncingFathom ? "Syncing…" : "Analyzing…"}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <Button size="sm" variant="outline" className="gap-1.5 text-[13px]" onClick={syncFathom} disabled={syncingFathom || !!analyzingMeeting}>
                {syncingFathom ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                Sync Fathom
              </Button>
            </CardContent>
          </Card>

          {snap && latestSnapshot && (
            <div className="panel">
              <div className="panel-header flex items-center justify-between">
                <span>iorad Expansion Analysis</span>
                <span className="text-[11px] text-muted-foreground normal-case tracking-normal">
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

          <div className="glow-line" />

          {/* Score + Signals + Analysis (collapsible) */}
          <Collapsible open={extraOpen} onOpenChange={setExtraOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between text-xs font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground">
                Score · Signals · Analysis
                <ChevronRight className={`w-4 h-4 transition-transform ${extraOpen ? "rotate-90" : ""}`} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-6 pt-4">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Score */}
                <div className="panel">
                  <div className="panel-header flex items-center justify-between">
                    <span>Score</span>
                    <ScoreCell score={company.last_score_total} />
                  </div>
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

                {/* Signals */}
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
                                  <div className="text-[14px] font-medium">{signal.title}</div>
                                  <div className="text-[12px] text-muted-foreground">{signal.date || "No date"} · {signal.type}</div>
                                </div>
                              </div>
                              <a href={signal.url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary flex-shrink-0"><ExternalLink className="w-3.5 h-3.5" /></a>
                            </div>
                            {signal.raw_excerpt && <p className="text-[13px] text-muted-foreground leading-relaxed">{signal.raw_excerpt}</p>}
                            {snippets.length > 0 && (
                              <div className="space-y-1 pt-1 border-t border-border/50">
                                <div className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">Evidence Snippets</div>
                                {snippets.map((snippet, i) => (
                                  <div key={i} className="text-[13px] text-accent-foreground bg-accent/20 rounded px-2 py-1.5 border-l-2 border-primary/40">"{snippet}"</div>
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

          {/* Intent Activity Timeline */}
          {activityEvents.length > 0 && (
            <div className="panel space-y-3">
              <div className="panel-header flex items-center gap-2">
                <Zap className="w-4 h-4 text-primary" />
                <span>Intent Activity ({activityEvents.length})</span>
              </div>
              <p className="text-xs text-muted-foreground">Actions captured from HubSpot — page views, form submissions, emails, and meetings.</p>
              <div className="space-y-1 max-h-[400px] overflow-y-auto">
                {activityEvents.map((evt: any) => {
                  const typeIcons: Record<string, string> = {
                    FORM_SUBMISSION: "📝", EMAIL: "📧", EMAIL_RECEIVED: "📩",
                    MEETING: "📅", CALL: "📞", PAGE_VIEW: "👁️",
                    NOTE: "📒", TASK: "✅",
                  };
                  const icon = typeIcons[evt.activity_type] || "⚡";
                  return (
                    <div key={evt.id} className="flex items-start gap-3 px-3 py-2 rounded-lg border border-border/50 bg-secondary/20 hover:bg-secondary/40 transition-colors">
                      <span className="text-base mt-0.5">{icon}</span>
                        <div className="flex-1 min-w-0">
                        <div className="text-[14px] font-medium text-foreground truncate">{evt.title}</div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={`text-[11px] font-mono uppercase tracking-widest px-1.5 py-0.5 rounded border ${
                            evt.activity_type === "FORM_SUBMISSION"
                              ? "border-emerald-500/40 text-emerald-400 bg-emerald-500/10"
                              : evt.activity_type?.includes("EMAIL")
                              ? "border-blue-500/40 text-blue-400 bg-blue-500/10"
                              : "border-border text-muted-foreground bg-muted/50"
                          }`}>{evt.activity_type?.replace(/_/g, " ")}</span>
                          {evt.url && (
                            <a href={evt.url} target="_blank" rel="noopener noreferrer" className="text-[11px] text-primary hover:underline truncate max-w-[200px]">
                              {evt.url}
                            </a>
                          )}
                        </div>
                      </div>
                      <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                        {new Date(evt.occurred_at).toLocaleDateString()}{" "}
                        {new Date(evt.occurred_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </TabsContent>

        {/* ============ TAB 2: STRATEGY ============ */}
        <TabsContent value="strategy" className="space-y-6 mt-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
            <h3 className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">Strategy & Cards</h3>
              {contactSelector}
            </div>
            <Button size="sm" variant="outline" className="gap-1.5 text-[13px]" onClick={generateCards} disabled={generatingCards}>
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
                {cards.map((card, i) => <DashboardCardUI key={card.id || i} card={card} />)}
              </div>
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
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <h3 className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">Outreach Assets</h3>
              {contactSelector}
            </div>
            <Button size="sm" variant="outline" className="gap-1.5 text-[13px]" onClick={generateCards} disabled={generatingCards}>
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
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <h3 className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">Story Configuration</h3>
              {contactSelector}
            </div>
            <div className="flex items-center gap-2">
              {storyBaseUrl && (
                <a href={storyBaseUrl} target="_blank" rel="noopener noreferrer">
                  <Button size="sm" className="gap-1.5 text-[13px]">
                    <Eye className="w-3.5 h-3.5" /> View Story
                  </Button>
                </a>
              )}
              <Button size="sm" variant="outline" className="gap-1.5 text-[13px]" onClick={generateCards} disabled={generatingCards}>
                {generatingCards ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                {generatingCards ? "Generating…" : (assets.story_assets ? "Regenerate" : "Generate")}
              </Button>
            </div>
          </div>

          {/* URL Inputs */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Video className="w-4 h-4 text-primary" /> Loom Video
                  <Badge variant="outline" className="text-[10px] ml-auto">{effectiveLoomUrl ? "Ready" : "Not Set"}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label className="text-xs">Loom Share URL</Label>
                  <Input
                    placeholder="https://www.loom.com/share/abc123..."
                    value={effectiveLoomUrl}
                    onChange={(e) => { const v = e.target.value; setLoomUrl(v); autosaveUrls(v, effectiveIoradUrl); }}
                    className="mt-1"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">Paste your Loom share link. It will embed automatically at the top of the story page.</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-primary" /> iorad Tutorial
                  <Badge variant="outline" className="text-[10px] ml-auto">{effectiveIoradUrl ? "Ready" : "Not Set"}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label className="text-xs">iorad Tutorial URL</Label>
                  <Input
                    placeholder="https://ior.ad/..."
                    value={effectiveIoradUrl}
                    onChange={(e) => { const v = e.target.value; setIoradUrl(v); autosaveUrls(effectiveLoomUrl, v); }}
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
                    <iframe src={loomEmbedUrl} width="100%" height="400" frameBorder="0" allowFullScreen allow="autoplay; fullscreen" title="Loom video preview" />
                  </div>
                </div>
              )}

              {ioradEmbedUrl && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium flex items-center gap-2"><BookOpen className="w-4 h-4 text-primary" /> iorad Tutorial</h4>
                  <div className="rounded-xl overflow-hidden border">
                    <iframe
                      src={ioradEmbedUrl} width="100%" height="500" frameBorder="0" allowFullScreen
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

        {/* ============ TAB 5: ONBOARDING ============ */}
        <TabsContent value="onboarding">
          <OnboardingTab
            meetings={meetings}
            analyzingMeeting={analyzingMeeting}
            onAnalyze={analyzeTranscript}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
