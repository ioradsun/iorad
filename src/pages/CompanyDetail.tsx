import { useState, useCallback, useRef, useEffect } from "react";
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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
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
  const [deleteContactId, setDeleteContactId] = useState<string | null>(null);
  const [deletingContact, setDeletingContact] = useState(false);
  const [generatingCards, setGeneratingCards] = useState(false);
  const [generateStep, setGenerateStep] = useState<string | null>(null);
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
  const [syncingHubspot, setSyncingHubspot] = useState(false);
  const [generatingContactId, setGeneratingContactId] = useState<string | null>(null);
  // extractingProfiles state removed — extraction is now part of the generate pipeline

  // Auto-generate AI summary for creator contacts on load (every time contacts change)
  const autoGeneratedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!id || contacts.length === 0) return;
    const creatorsWithoutProfile = contacts.filter((c: any) => {
      const hp = (c.hubspot_properties as any) || {};
      const isCreator = !!hp.first_tutorial_create_date;
      const hasProfile = !!(c as any).contact_profile?.account_narrative;
      return isCreator && !hasProfile && !autoGeneratedRef.current.has(c.id);
    });
    if (creatorsWithoutProfile.length === 0) return;

    // Mark all as queued so we don't re-trigger
    creatorsWithoutProfile.forEach((c: any) => autoGeneratedRef.current.add(c.id));

    const runExtraction = async () => {
      try {
        await supabase.functions.invoke("extract-contact-profile", { body: { company_id: id } });
        queryClient.invalidateQueries({ queryKey: ["contacts", id] });
      } catch (e) {
        console.warn("Auto profile extraction failed:", e);
      }
    };
    runExtraction();
  }, [id, contacts, queryClient]);

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
    const missingContactInfo = !newContact.email.trim() || !newContact.linkedin.trim();
    try {
      // First insert the contact manually
      const { data: inserted, error } = await supabase.from("contacts").insert({
        company_id: id, name: newContact.name.trim(),
        title: newContact.title.trim() || null, email: newContact.email.trim() || null,
        linkedin: newContact.linkedin.trim() || null, source: "manual",
      }).select("id").single();
      if (error) throw error;

      // If email and linkedin are both blank, call Apollo to enrich
      if (missingContactInfo) {
        toast.info("Looking up contact details via Apollo…");
        try {
          const { data: apolloData, error: fnErr } = await supabase.functions.invoke("find-contacts", {
            body: { company_id: id, name_hint: newContact.name.trim() },
          });
          if (fnErr) throw fnErr;
          // Apollo may have saved a contact — check if it enriched the one we just inserted
          const { data: enriched } = await supabase
            .from("contacts")
            .select("email, linkedin")
            .eq("id", inserted.id)
            .maybeSingle();
          if (enriched?.email || enriched?.linkedin) {
            toast.success("Contact added and enriched via Apollo");
          } else {
            toast.success(`Contact added — Apollo found ${apolloData?.contacts_found ?? 0} related contacts`);
          }
        } catch {
          toast.success("Contact added (Apollo enrichment unavailable)");
        }
      } else {
        toast.success("Contact added");
      }

      setNewContact({ name: "", title: "", email: "", linkedin: "" });
      setAddContactOpen(false);
      queryClient.invalidateQueries({ queryKey: ["contacts", id] });
    } catch (e: any) { toast.error(e.message || "Failed to add contact"); }
    finally { setSavingContact(false); }
  };

  const handleDeleteContact = async (contactId: string) => {
    setDeletingContact(true);
    try {
      const { error } = await supabase.from("contacts").delete().eq("id", contactId);
      if (error) throw error;
      toast.success("Contact deleted");
      setDeleteContactId(null);
      queryClient.invalidateQueries({ queryKey: ["contacts", id] });
    } catch (e: any) { toast.error(e.message || "Failed to delete contact"); }
    finally { setDeletingContact(false); }
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

      // Step 2: Sync Fathom meetings (if company has a domain)
      if (companyAny?.domain) {
        toast.info("Syncing Fathom meetings…");
        try {
          const { data: fData, error: fErr } = await supabase.functions.invoke("sync-fathom", {
            body: { domain: companyAny.domain, company_id: id },
          });
          if (!fErr && !fData?.error) {
            toast.success(`Fathom synced — ${fData?.meetings_synced ?? 0} meetings`);
            queryClient.invalidateQueries({ queryKey: ["meetings", id] });
          }
        } catch (fe: any) {
          console.warn("Fathom sync non-fatal:", fe.message);
        }
      }

      // Step 3: Find contacts via Apollo (skip for partner companies — contacts come from HubSpot)
      if (companyAny?.category === "partner" || (!companyAny?.category && companyAny?.source_type !== "inbound")) {
        toast.info("Step 3/3 — Finding contacts via Apollo…");
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

      // Step 3: For non-partner companies, extract contact profiles and generate company cards
      if (companyAny?.category !== "partner") {
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

  // Unified generation for both outbound and inbound
  const generateCards = async () => {
    if (!id) return;
    setGeneratingCards(true);
    const firstContactId = contacts[0]?.id || null;
    try {
      // Non-partner: Step 0a — Run signals (Firecrawl)
      if (isPartnerCategory) {
        setGenerateStep("Signals");
        toast.info("Running signal search…");
        const { data: sigData, error: sigErr } = await supabase.functions.invoke("run-signals", { body: { company_id: id, mode: "full" } });
        if (sigErr) throw sigErr;
        if (sigData?.error) throw new Error(sigData.error);
        toast.success(`Signals complete — ${sigData?.signals_found ?? 0} found`);
        queryClient.invalidateQueries({ queryKey: ["signals", id] });
        queryClient.invalidateQueries({ queryKey: ["snapshots", id] });
      }

      // Step 1: Sync Fathom meetings (all categories)
      if (companyAny?.domain) {
        setGenerateStep("Fathom Sync");
        toast.info("Syncing Fathom meetings…");
        try {
          const { data: fData, error: fErr } = await supabase.functions.invoke("sync-fathom", {
            body: { domain: companyAny.domain, company_id: id },
          });
          if (!fErr && !fData?.error) {
            toast.success(`Fathom synced — ${fData?.meetings_synced ?? 0} meetings`);
            queryClient.invalidateQueries({ queryKey: ["meetings", id] });
          }
        } catch (fe: any) {
          console.warn("Fathom sync non-fatal:", fe.message);
        }
      }

      // Partner-only: Step 0b — Find contacts via Apollo
      if (isPartnerCategory) {
        setGenerateStep("Contacts");
        toast.info("Finding contacts via Apollo…");
        setFindingContacts(true);
        try {
          const { data: contactData, error: contactErr } = await supabase.functions.invoke("find-contacts", { body: { company_id: id } });
          if (contactErr) throw contactErr;
          if (contactData?.error) throw new Error(contactData.error);
          if (contactData?.contacts_found > 0) {
            toast.success(`Found ${contactData.contacts_found} contacts`);
          } else {
            toast.warning("No contacts found — check company domain");
          }
          queryClient.invalidateQueries({ queryKey: ["contacts", id] });
        } catch (ce: any) {
          toast.error("Contact enrichment failed: " + (ce.message || "Unknown error"));
        } finally {
          setFindingContacts(false);
        }
      }

      // Step 2: Company intel (AI cards)
      setGenerateStep("Company Intel");
      toast.info("Generating Company Intel…");
      {
        const { data, error } = await supabase.functions.invoke("generate-cards", {
          body: { company_id: id, tab: "company", ...(firstContactId ? { contact_id: firstContactId } : {}) },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
      }

      // Step 3: Analyze new Fathom transcripts (both source types)
      if (companyAny?.domain) {
        try {
          const { data: freshMeetings } = await supabase
            .from("meetings")
            .select("id, transcript, transcript_analysis")
            .eq("company_id", id!)
            .not("transcript", "is", null)
            .is("transcript_analysis", null);
          if (freshMeetings && freshMeetings.length > 0) {
            setGenerateStep("Analyzing Transcripts");
            for (const m of freshMeetings) {
              setAnalyzingMeeting(m.id);
              try {
                await supabase.functions.invoke("analyze-transcript", { body: { meeting_id: m.id } });
              } catch (ae: any) {
                console.warn("Transcript analysis failed:", ae.message);
              }
            }
            setAnalyzingMeeting(null);
            toast.success("Transcript analysis complete");
            queryClient.invalidateQueries({ queryKey: ["meetings", id] });
          }
        } catch (te: any) {
          console.warn("Transcript analysis non-fatal:", te.message);
        }
      }

      // Step 4: Extract contact profiles (for school/business categories with HubSpot data)
      if (!isPartnerCategory) {
        setGenerateStep("Contact Profiles");
        toast.info("Extracting contact profiles…");
        try {
          const { data: profileData } = await supabase.functions.invoke("extract-contact-profile", { body: { company_id: id } });
          if (profileData?.profiles_extracted > 0) toast.info(`Extracted ${profileData.profiles_extracted} AI profiles`);
          queryClient.invalidateQueries({ queryKey: ["contacts", id] });
        } catch (pe: any) {
          console.warn("Profile extraction non-fatal:", pe.message);
        }
      }

      // Step 5: Strategy → Outreach → Story
      const tabs = ["strategy", "outreach", "story"];
      const labels: Record<string, string> = { strategy: "Strategy", outreach: "Outreach", story: "Story" };
      for (const tab of tabs) {
        setGenerateStep(labels[tab]);
        toast.info(`Generating ${labels[tab]}…`);
        const body: Record<string, string> = { company_id: id, tab };
        if (firstContactId) body.contact_id = firstContactId;
        const { data, error } = await supabase.functions.invoke("generate-cards", { body });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
      }

      toast.success("All content generated successfully");
      queryClient.invalidateQueries({ queryKey: ["company_cards", id] });
      queryClient.invalidateQueries({ queryKey: ["snapshots", id] });
      queryClient.invalidateQueries({ queryKey: ["contacts", id] });
      queryClient.invalidateQueries({ queryKey: ["meetings", id] });
    } catch (e: any) { toast.error(e.message || "Failed to generate"); }
    finally { setGeneratingCards(false); setGenerateStep(null); setAnalyzingMeeting(null); }
  };

  // ---- Per-section regeneration ----
  const [regeneratingSection, setRegeneratingSection] = useState<string | null>(null);

  const regenerateSection = async (section: "signals" | "contacts" | "company" | "strategy" | "outreach" | "story" | "profiles") => {
    if (!id) return;
    setRegeneratingSection(section);
    const firstContactId = contacts[0]?.id || null;
    try {
      switch (section) {
        case "signals": {
          toast.info("Running signal search…");
          const { data, error } = await supabase.functions.invoke("run-signals", { body: { company_id: id, mode: "full" } });
          if (error) throw error;
          if (data?.error) throw new Error(data.error);
          toast.success(`Signals complete — ${data?.signals_found ?? 0} found`);
          queryClient.invalidateQueries({ queryKey: ["signals", id] });
          queryClient.invalidateQueries({ queryKey: ["snapshots", id] });
          break;
        }
        case "contacts": {
          toast.info("Finding contacts via Apollo…");
          const { data, error } = await supabase.functions.invoke("find-contacts", { body: { company_id: id } });
          if (error) throw error;
          if (data?.error) throw new Error(data.error);
          toast.success(data?.contacts_found > 0 ? `Found ${data.contacts_found} contacts` : "No new contacts found");
          queryClient.invalidateQueries({ queryKey: ["contacts", id] });
          break;
        }
        case "profiles": {
          toast.info("Extracting contact profiles…");
          const { data, error } = await supabase.functions.invoke("extract-contact-profile", { body: { company_id: id } });
          if (error) throw error;
          toast.success(`Extracted ${data?.profiles_extracted ?? 0} AI profiles`);
          queryClient.invalidateQueries({ queryKey: ["contacts", id] });
          break;
        }
        case "company":
        case "strategy":
        case "outreach":
        case "story": {
          const labels: Record<string, string> = { company: "Company Intel", strategy: "Strategy", outreach: "Outreach", story: "Story" };
          toast.info(`Regenerating ${labels[section]}…`);
          const body: Record<string, string> = { company_id: id, tab: section };
          if (firstContactId) body.contact_id = firstContactId;
          const { data, error } = await supabase.functions.invoke("generate-cards", { body });
          if (error) throw error;
          if (data?.error) throw new Error(data.error);
          toast.success(`${labels[section]} regenerated`);
          queryClient.invalidateQueries({ queryKey: ["company_cards", id] });
          break;
        }
      }
    } catch (e: any) { toast.error(e.message || "Regeneration failed"); }
    finally { setRegeneratingSection(null); }
  };

  const syncHubspot = async () => {
    if (!id) return;
    setSyncingHubspot(true);
    try {
      toast.info("Syncing HubSpot data…");
      const { data, error } = await supabase.functions.invoke("import-from-hubspot", {
        body: { action: "sync_company", domain: (company as any)?.domain, company_id: id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(
        data?.is_existing_customer
          ? "HubSpot synced — flagged as existing customer"
          : `HubSpot synced — ${data?.contacts_imported ?? 0} contact(s) updated`
      );
      queryClient.invalidateQueries({ queryKey: ["company", id] });
      queryClient.invalidateQueries({ queryKey: ["contacts", id] });
    } catch (e: any) { toast.error(e.message || "HubSpot sync failed"); }
    finally { setSyncingHubspot(false); }
  };

  const generateForContact = async (contactId: string) => {
    if (!id) return;
    setGeneratingContactId(contactId);
    try {
      // Step 1: Extract profile for this contact
      toast.info("Extracting contact profile…");
      try {
        await supabase.functions.invoke("extract-contact-profile", { body: { company_id: id, contact_id: contactId } });
        queryClient.invalidateQueries({ queryKey: ["contacts", id] });
      } catch (pe: any) { console.warn("Profile extraction non-fatal:", pe.message); }

      // Step 2: Generate all card tabs for this contact
      const tabs = ["company", "strategy", "outreach", "story"];
      const labels: Record<string, string> = { company: "Company Intel", strategy: "Strategy", outreach: "Outreach", story: "Story" };
      for (const tab of tabs) {
        toast.info(`Generating ${labels[tab]}…`);
        const { data, error } = await supabase.functions.invoke("generate-cards", {
          body: { company_id: id, tab, contact_id: contactId },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
      }
      toast.success("Content generated for contact");
      queryClient.invalidateQueries({ queryKey: ["company_cards", id] });
      queryClient.invalidateQueries({ queryKey: ["contacts", id] });
      // Switch to this contact
      setSelectedContactId(contactId);
    } catch (e: any) { toast.error(e.message || "Generation failed"); }
    finally { setGeneratingContactId(null); }
  };

  const contactSelector = contacts.length > 0 ? (
    <Select value={selectedContactId || contacts[0]?.id || ""} onValueChange={setSelectedContactId}>
      <SelectTrigger className="h-auto min-w-[200px] max-w-[320px] py-1.5 px-3 text-xs bg-background">
        <SelectValue placeholder="Select contact">
          {(() => {
            const c = contacts.find((c: any) => c.id === (selectedContactId || contacts[0]?.id));
            if (!c) return null;
            return (
              <div className="flex flex-col items-start text-left">
                <span className="font-medium text-[13px] leading-tight">{c.name}</span>
                {c.title && <span className="text-muted-foreground text-[11px] leading-tight">{c.title}</span>}
              </div>
            );
          })()}
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="bg-background z-50 min-w-[280px]">
        {contacts.map((c: any) => (
          <SelectItem key={c.id} value={c.id} className="py-2">
            <div className="flex flex-col items-start">
              <span className="font-medium text-[13px] leading-tight">{c.name}</span>
              {c.title && <span className="text-muted-foreground text-[11px] leading-tight">{c.title}</span>}
            </div>
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
  const rawAccountJson = parseJson<Record<string, unknown>>(companyCards?.account_json as Json) || {};
  // Strategy data: check dedicated _strategy namespace first, then fall back to root-level fields
  // (root-level exists when data was generated before the namespacing fix)
  const inboundStrategyData: Record<string, unknown> | null = (() => {
    const namespaced = rawAccountJson?._strategy as Record<string, unknown> | undefined;
    if (namespaced && (namespaced.momentum_observed || namespaced.initiative_translation || namespaced.opening_paragraph || namespaced.subject_line || namespaced.observed_behavior)) {
      return namespaced;
    }
    // Fallback: root-level fields (legacy data)
    if (rawAccountJson?.momentum_observed || rawAccountJson?.initiative_translation || rawAccountJson?.opening_paragraph || rawAccountJson?.subject_line) {
      return rawAccountJson;
    }
    return null;
  })();
  const isInboundStrategyResponse = !!(inboundStrategyData?.momentum_observed || inboundStrategyData?.initiative_translation || inboundStrategyData?.observed_behavior || inboundStrategyData?.subject_line || inboundStrategyData?.opening_paragraph);
  // Story data is stored at root with _type: inbound_story
  const isInboundStoryResponse = !!(rawAccountJson?._type === "inbound_story" || rawAccountJson?.behavior_acknowledged);
  const inboundStrategyFields: { label: string; key: string }[] = [
    { label: "Momentum Observed", key: "momentum_observed" },
    { label: "Initiative Translation", key: "initiative_translation" },
    { label: "Scale Risk", key: "scale_risk" },
    { label: "Institutionalization Gap", key: "institutionalization_gap" },
    { label: "Executive Translation", key: "executive_translation" },
    { label: "Real Cost If Stalled", key: "real_cost_if_stalled" },
    { label: "Upside If Executed", key: "upside_if_executed" },
    { label: "Why Now", key: "why_now" },
    // Legacy fields (old prompt format)
    { label: "Observed Behavior", key: "observed_behavior" },
    { label: "Inferred Initiative", key: "inferred_initiative" },
    { label: "Execution Gap", key: "execution_gap" },
    { label: "Institutionalization Play", key: "institutionalization_play" },
    { label: "ROI Expansion Path", key: "roi_expansion_path" },
  ];
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
  // category determines story URL type: non-partner (school/business) uses company_cards.id; partner uses slug
  const companyCategory = companyAny?.category || (companyAny?.source_type === "inbound" ? "business" : companyAny?.partner ? "partner" : "business");
  const companyStage = companyAny?.stage || "prospect";
  const isPartnerCategory = companyCategory === "partner";
  const storyBaseUrl = !isPartnerCategory && companyCards?.id
    ? `/stories/${companyCards.id}`
    : firstContact && company.partner
      ? `/${company.partner}/${company.name.toLowerCase().replace(/\s+/g, "-")}/stories/${firstContact.name.split(" ")[0].toLowerCase().replace(/[^a-z]/g, "")}`
      : null;

  // Small ghost regen button for individual sections
  const RegenerateBtn = ({ section, label }: { section: Parameters<typeof regenerateSection>[0]; label: string }) => (
    <Button
      size="sm"
      variant="ghost"
      className="h-6 gap-1 text-[11px] text-muted-foreground hover:text-foreground px-2"
      disabled={regeneratingSection === section || generatingCards}
      onClick={() => regenerateSection(section)}
    >
      {regeneratingSection === section
        ? <Loader2 className="w-3 h-3 animate-spin" />
        : <RefreshCw className="w-3 h-3" />}
      {label}
    </Button>
  );

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
        {/* Category + Stage inline selectors */}
        <div className="flex items-center gap-2 flex-wrap">
          <Select
            value={companyCategory}
            onValueChange={async (val) => {
              await updateCompany.mutateAsync({ id: id!, updates: { category: val } as any });
              queryClient.invalidateQueries({ queryKey: ["company", id] });
            }}
          >
            <SelectTrigger className="h-7 text-xs w-[130px] bg-secondary border-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="school">School (EDU)</SelectItem>
              <SelectItem value="business">Business (B2B)</SelectItem>
              <SelectItem value="partner">Partner</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={companyStage}
            onValueChange={async (val) => {
              await updateCompany.mutateAsync({ id: id!, updates: { stage: val } as any });
              queryClient.invalidateQueries({ queryKey: ["company", id] });
            }}
          >
            <SelectTrigger className="h-7 text-xs w-[130px] bg-secondary border-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="prospect">Prospect</SelectItem>
              <SelectItem value="active_opp">Active Opp</SelectItem>
              <SelectItem value="customer">Customer</SelectItem>
              <SelectItem value="expansion">Expansion</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs defaultValue="company" className="w-full" onValueChange={setActiveTab}>
        <div className="flex items-center justify-between gap-3 mb-1">
          <TabsList className="justify-start">
            <TabsTrigger value="company" className="text-sm">Company</TabsTrigger>
            <TabsTrigger value="strategy" className="text-sm">Strategy</TabsTrigger>
            <TabsTrigger value="outreach" className="text-sm">Outreach</TabsTrigger>
            <TabsTrigger value="story" className="text-sm">Story</TabsTrigger>
            <TabsTrigger value="onboarding" className="text-sm">Onboarding</TabsTrigger>
          </TabsList>

          {/* Unified generate + view story buttons — visible on all tabs for all companies */}
          {activeTab !== "onboarding" && (
            <div className="flex items-center gap-2">
              {storyBaseUrl && (
                <a href={storyBaseUrl} target="_blank" rel="noopener noreferrer">
                  <Button size="sm" variant="outline" className="gap-1.5 text-[13px]">
                    <Eye className="w-3.5 h-3.5" /> View Story
                  </Button>
                </a>
              )}
              <Button size="sm" className="gap-1.5 text-[13px]" onClick={generateCards} disabled={generatingCards}>
                {generatingCards ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                {generatingCards
                  ? generateStep ? `${generateStep}…` : "Generating…"
                  : (isInboundStoryResponse || isInboundStrategyResponse || cards.length > 0 || assets.email_sequence || signals.length > 0) ? "Regenerate All" : "Generate All"}
              </Button>
            </div>
          )}
        </div>

        {/* ============ TAB 1: COMPANY ============ */}
        <TabsContent value="company" className="space-y-6 mt-6">
          <div className="flex items-center justify-between">
            <h3 className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">Company Intel</h3>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2.5 text-xs gap-1.5"
                onClick={syncHubspot}
                disabled={syncingHubspot}
                title="Sync contacts and customer status from HubSpot"
              >
                {syncingHubspot ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                HubSpot Sync
              </Button>
              {companyAny?.source_type !== "inbound" && <RegenerateBtn section="signals" label="Signals" />}
              <RegenerateBtn section="company" label="Company Intel" />
            </div>
          </div>

          {/* Company Profile */}
          {accountData?.about?.text && (
            <p className="text-[14px] text-foreground/80 leading-relaxed line-clamp-2">
              {accountData.about.text}
            </p>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {(accountData?.industry?.value || company.industry) && (
              <Card className="bg-secondary/30"><CardContent className="p-3 flex flex-col items-start gap-1.5">
                <Building2 className="w-4 h-4 text-primary" />
                <span className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">Industry</span>
                <span className="text-[13px] font-medium text-foreground leading-tight">{accountData?.industry?.value || company.industry?.replace(/_/g, " ").toLowerCase()}</span>
              </CardContent></Card>
            )}
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
                <span>Contacts ({contacts.filter((c: any) => !c.email?.toLowerCase().includes("student")).length || (companyAny?.buyer_name ? 1 : 0)})</span>
                {findingContacts && (
                  <span className="text-[11px] text-muted-foreground font-normal flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Finding contacts via Apollo…
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
              {isPartnerCategory && (
                <RegenerateBtn section="contacts" label="Find Contacts" />
              )}
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
                      {savingContact ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Looking up…</> : (!newContact.email.trim() && !newContact.linkedin.trim()) ? "Add & Enrich via Apollo" : "Add Contact"}
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
            {contacts.filter((c: any) => !c.email?.toLowerCase().includes("student")).length > 0 && (
              <div className="px-4 pb-3">
                <Input
                  placeholder="Search contacts…"
                  value={contactSearch}
                  onChange={e => setContactSearch(e.target.value)}
                  className="h-7 text-xs"
                />
              </div>
            )}
            <div className="px-4 pb-4">
              {contacts.filter((c: any) => !c.email?.toLowerCase().includes("student")).length > 0 ? (() => {
                const filtered = contacts
                  .filter((c) => {
                    if (c.email?.toLowerCase().includes("student")) return false;
                    if (!contactSearch) return true;
                    const q = contactSearch.toLowerCase();
                    return (c.name?.toLowerCase().includes(q) || c.title?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q));
                  })
                  .sort((a: any, b: any) => {
                    const rankA = (a.hubspot_properties as any)?.rank ?? 0;
                    const rankB = (b.hubspot_properties as any)?.rank ?? 0;
                    return rankB - rankA;
                  });

                const getRankBadge = (contact: any) => {
                  const rank = (contact.hubspot_properties as any)?.rank ?? 0;
                  if (rank >= 50) return { label: "Top", cls: "bg-primary/15 text-primary border-primary/30" };
                  if (rank >= 25) return { label: "Mid", cls: "bg-warning/15 text-warning border-warning/30" };
                  if (rank > 0)  return { label: "Low", cls: "bg-muted text-muted-foreground border-border/40" };
                  return null;
                };

                const getIoradActivity = (contact: any) => {
                  const hp = (contact.hubspot_properties as any) || {};
                  return {
                    isCreator: !!hp.first_tutorial_create_date,
                    isViewer: !!(hp.first_tutorial_view_date || hp.first_tutorial_learn_date),
                    monthAnswers: parseInt(hp.answers_with_own_tutorial_month_count || "0", 10) || 0,
                    hasExtension: parseInt(hp.extension_connections || "0", 10) > 0,
                  };
                };

                return (
                  <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollSnapType: "x mandatory" }}>
                    {filtered.map((contact) => {
                      const firstName = contact.name.split(" ")[0].toLowerCase().replace(/[^a-z]/g, "");
                      const storyUrl = company.partner
                        ? `/${company.partner}/${company.name.toLowerCase().replace(/\s+/g, "-")}/stories/${firstName}`
                        : null;
                      
                      const profile = (contact as any).contact_profile as any;
                      const isGenerating = generatingContactId === contact.id;
                      const rankBadge = getRankBadge(contact);
                      const ioradActivity = getIoradActivity(contact);
                      const hasSnap = snapshots.length > 0;

                      return (
                        <div
                          key={contact.id}
                          className="border border-border/50 rounded-lg bg-secondary/20 hover:bg-secondary/30 transition-colors flex flex-col flex-shrink-0 w-72"
                          style={{ scrollSnapAlign: "start" }}
                        >
                          <div className="p-3 flex flex-col gap-2 flex-1">
                            {/* Top row: name/title + action icons + generate button */}
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                                {rankBadge && (
                                  <span className={`text-[10px] px-1.5 py-0.5 rounded border font-semibold w-fit mb-0.5 ${rankBadge.cls}`}>
                                    {rankBadge.label}
                                  </span>
                                )}
                                <div className="text-[14px] font-semibold leading-tight">{contact.name}</div>
                                {contact.title && (
                                  <div className="text-[12px] text-muted-foreground leading-snug">{contact.title}</div>
                                )}
                                {contact.email && (
                                  <a href={`mailto:${contact.email}`} className="text-[11px] text-muted-foreground hover:text-primary flex items-center gap-1 truncate" title={contact.email}>
                                    <Mail className="w-3 h-3 flex-shrink-0" /><span className="truncate">{contact.email}</span>
                                  </a>
                                )}
                              </div>
                              {/* Top-right actions */}
                              <div className="flex items-center gap-0.5 flex-shrink-0">
                                {contact.linkedin && (
                                  <a href={contact.linkedin} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary p-1" title="LinkedIn">
                                    <Linkedin className="w-3.5 h-3.5" />
                                  </a>
                                )}
                                {storyUrl && hasSnap && (
                                  <a href={storyUrl} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary p-1" title="View story">
                                    <ExternalLink className="w-3.5 h-3.5" />
                                  </a>
                                )}
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 w-7 p-0 text-muted-foreground hover:text-primary"
                                  title="Generate cards for this contact"
                                  onClick={() => generateForContact(contact.id)}
                                  disabled={isGenerating || !!generatingContactId}
                                >
                                  {isGenerating
                                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    : <Sparkles className="w-3.5 h-3.5" />}
                                </Button>
                              </div>
                            </div>

                            {/* iorad activity badges */}
                            {(ioradActivity.isCreator || ioradActivity.isViewer || ioradActivity.hasExtension || ioradActivity.monthAnswers > 0) && (
                              <div className="flex flex-wrap gap-1">
                                {ioradActivity.isCreator && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded border border-primary/30 bg-primary/10 text-primary font-medium flex items-center gap-0.5" title="Has created tutorials">
                                    <BookOpen className="w-2.5 h-2.5" /> Creator
                                  </span>
                                )}
                                {ioradActivity.isViewer && !ioradActivity.isCreator && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded border border-info/30 bg-info/10 text-info font-medium flex items-center gap-0.5" title="Has viewed tutorials">
                                    <Eye className="w-2.5 h-2.5" /> Viewer
                                  </span>
                                )}
                                {ioradActivity.monthAnswers > 0 && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded border border-warning/30 bg-warning/10 text-warning font-medium" title={`${ioradActivity.monthAnswers} answers this month`}>
                                    {ioradActivity.monthAnswers} ans/mo
                                  </span>
                                )}
                                {ioradActivity.hasExtension && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded border border-border/40 bg-secondary text-muted-foreground font-medium flex items-center gap-0.5" title="Extension connected">
                                    <Zap className="w-2.5 h-2.5" /> Ext
                                  </span>
                                )}
                              </div>
                            )}

                            {/* Key metrics row if profile exists */}
                            {profile?.key_metrics && (
                              <div className="flex gap-2 text-[10px] text-muted-foreground">
                                {profile.key_metrics.tutorials_created != null && (
                                  <span title="Tutorials created"><span className="font-semibold text-foreground">{profile.key_metrics.tutorials_created}</span> created</span>
                                )}
                                {profile.key_metrics.tutorials_viewed != null && (
                                  <span title="Tutorials viewed"><span className="font-semibold text-foreground">{profile.key_metrics.tutorials_viewed}</span> viewed</span>
                                )}
                                {profile.key_metrics.plan && (
                                  <span className="ml-auto text-[10px] px-1.5 py-0 rounded bg-secondary text-muted-foreground">{profile.key_metrics.plan}</span>
                                )}
                              </div>
                            )}

                            {/* AI summary */}
                            <div className="mt-1 pt-2 border-t border-border/40 flex-1">
                              {profile?.account_narrative ? (
                                <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-4">{profile.account_narrative}</p>
                              ) : isGenerating ? (
                                <p className="text-[11px] text-muted-foreground/50 italic flex items-center gap-1.5">
                                  <Loader2 className="w-3 h-3 animate-spin inline" /> Generating summary…
                                </p>
                              ) : (
                                <p className="text-[11px] text-muted-foreground/50 italic">No AI summary yet</p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );


              })() : companyAny?.buyer_name ? (
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
          </div>

          {/* Delete Contact Confirmation */}
          <AlertDialog open={!!deleteContactId} onOpenChange={(open) => !open && setDeleteContactId(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete contact?</AlertDialogTitle>
                <AlertDialogDescription>This will permanently remove the contact. This action cannot be undone.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={() => deleteContactId && handleDeleteContact(deleteContactId)}
                  disabled={deletingContact}
                >
                  {deletingContact ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

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
            <h3 className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">Strategy & Cards</h3>
            <RegenerateBtn section="strategy" label="Strategy" />
          </div>
          {cardsLoading ? (
            <div className="flex items-center gap-2 py-4">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              <span className="ml-2 text-sm text-muted-foreground">Loading cards…</span>
            </div>
          ) : isInboundStrategyResponse ? (
            <div className="space-y-3">
              {inboundStrategyFields.map(({ label, key }) =>
                inboundStrategyData?.[key] ? (
                  <div key={key} className="panel p-4 rounded-lg">
                    <div className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground mb-1">{label}</div>
                    <p className="text-[13px] leading-relaxed text-foreground/90">{String(inboundStrategyData[key])}</p>
                  </div>
                ) : null
              )}
              {Array.isArray(inboundStrategyData?.strategic_plays) && (inboundStrategyData.strategic_plays as any[]).length > 0 && (
                <div className="panel p-4 rounded-lg space-y-3">
                  <div className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground mb-2">Strategic Plays</div>
                  {(inboundStrategyData.strategic_plays as any[]).map((play: any, i: number) => (
                    <div key={i} className="border-l-2 border-primary/30 pl-3 space-y-1">
                      <div className="text-[13px] font-semibold text-foreground">{play.name}</div>
                      {play.objective && <div className="text-[12px] text-muted-foreground">{play.objective}</div>}
                      {play.why_now && <div className="text-[12px] text-foreground/80"><span className="font-medium">Why now: </span>{play.why_now}</div>}
                      {play.what_it_looks_like && <div className="text-[12px] text-foreground/80"><span className="font-medium">Looks like: </span>{play.what_it_looks_like}</div>}
                      {play.expected_impact && <div className="text-[12px] text-primary font-medium">{play.expected_impact}</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : cards.length > 0 ? (
            <div className="space-y-4">
              {cards.map((card) => <DashboardCardUI key={card.id} card={card} />)}
            </div>
          ) : (
            <div className="panel text-center py-8">
              <Sparkles className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground mb-3">No strategy generated yet.</p>
            </div>
          )}
        </TabsContent>

        {/* ============ TAB 3: OUTREACH ============ */}
        <TabsContent value="outreach" className="space-y-6 mt-6">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">Outreach Assets</h3>
            <RegenerateBtn section="outreach" label="Outreach" />
          </div>
          {cardsLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
              <span className="ml-2 text-sm text-muted-foreground">Loading…</span>
            </div>
          ) : (assets.email_sequence || assets.linkedin_sequence) ? (
            <div className="space-y-6">
              {rawAccountJson._outreach_meta && typeof rawAccountJson._outreach_meta === "object" && (() => {
                const meta = rawAccountJson._outreach_meta as Record<string, unknown>;
                const metaFields = [
                  { label: "Intent Tier", key: "intent_tier" },
                  { label: "Behavior Acknowledged", key: "behavior_acknowledged" },
                  { label: "Momentum Frame", key: "momentum_frame" },
                  { label: "Expansion Opportunity", key: "expansion_opportunity" },
                  { label: "Risk If Stalled", key: "risk_if_stalled" },
                  { label: "Upside If Executed", key: "upside_if_executed" },
                ];
                const hasAny = metaFields.some(({ key }) => meta[key]);
                if (!hasAny) return null;
                return (
                  <div className="space-y-3">
                    {metaFields.map(({ label, key }) =>
                      meta[key] ? (
                        <div key={key} className="panel p-4 rounded-lg">
                          <div className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground mb-1">{label}</div>
                          <p className="text-[13px] leading-relaxed text-foreground/90">{String(meta[key])}</p>
                        </div>
                      ) : null
                    )}
                  </div>
                );
              })()}
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
            </div>
          )}
        </TabsContent>

        {/* ============ TAB 4: STORY ============ */}
        <TabsContent value="story" className="space-y-6 mt-6">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">Story Configuration</h3>
            <div className="flex items-center gap-2">
              <RegenerateBtn section="story" label="Story" />
              {storyBaseUrl && (
                <a href={storyBaseUrl} target="_blank" rel="noopener noreferrer">
                  <Button size="sm" variant="outline" className="gap-1.5 text-[13px]">
                    <Eye className="w-3.5 h-3.5" /> View Story
                  </Button>
                </a>
              )}
            </div>
          </div>

          {/* Inbound Story — AI-Generated Institutional Brief */}
          {isInboundStoryResponse && (
            <div className="space-y-4">
              <div className="glow-line" />

              {/* Header meta */}
              <div className="flex flex-wrap items-center gap-2">
                {rawAccountJson.intent_tier && (
                  <Badge variant="outline" className="text-[11px]">Tier: {String(rawAccountJson.intent_tier)}</Badge>
                )}
                {rawAccountJson.momentum_score !== undefined && (
                  <Badge variant="outline" className="text-[11px]">Momentum Score: {String(rawAccountJson.momentum_score)}</Badge>
                )}
                {rawAccountJson.persona && (
                  <Badge variant="secondary" className="text-[11px]">{String(rawAccountJson.persona)}</Badge>
                )}
              </div>

              {/* Narrative sections */}
              {[
                { label: "Behavior Acknowledged", key: "behavior_acknowledged" },
                { label: "Momentum Observed", key: "momentum_observed" },
                { label: "Initiative Translation", key: "initiative_translation" },
                { label: "Scale Risk", key: "scale_risk" },
                { label: "Institutionalization Gap", key: "institutionalization_gap" },
                { label: "Executive Translation", key: "executive_translation" },
                { label: "Reinforcement Journey", key: "reinforcement_journey" },
                { label: "Real Cost If Stalled", key: "real_cost_if_stalled" },
                { label: "Upside If Executed", key: "upside_if_executed" },
                { label: "Why Now", key: "why_now" },
                { label: "CTA", key: "cta" },
              ].map(({ label, key }) =>
                rawAccountJson[key] ? (
                  <div key={key} className="panel p-4 rounded-lg space-y-1">
                    <div className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">{label}</div>
                    <p className="text-[13px] leading-relaxed text-foreground/90 whitespace-pre-line">{String(rawAccountJson[key])}</p>
                  </div>
                ) : null
              )}

              {/* Strategic Plays */}
              {Array.isArray(rawAccountJson.strategic_plays) && (rawAccountJson.strategic_plays as any[]).length > 0 && (
                <div className="space-y-3">
                  <div className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Strategic Expansion Plays</div>
                  <div className="grid grid-cols-1 gap-3">
                    {(rawAccountJson.strategic_plays as any[]).map((play: any, i: number) => (
                      <div key={i} className="panel p-4 rounded-lg border border-border/60 space-y-2">
                        <div className="font-semibold text-[13px] text-foreground">{play.name}</div>
                        {play.objective && <p className="text-[12px] text-muted-foreground"><span className="font-mono uppercase tracking-wider text-[10px]">Objective:</span> {play.objective}</p>}
                        {play.why_now && <p className="text-[12px] text-muted-foreground"><span className="font-mono uppercase tracking-wider text-[10px]">Why Now:</span> {play.why_now}</p>}
                        {play.what_it_looks_like && <p className="text-[12px] text-foreground/80 leading-relaxed"><span className="font-mono uppercase tracking-wider text-[10px]">What It Looks Like:</span> {play.what_it_looks_like}</p>}
                        {play.expected_impact && <p className="text-[12px] text-primary/90"><span className="font-mono uppercase tracking-wider text-[10px]">Expected Impact:</span> {play.expected_impact}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Reinforcement Preview */}
              {rawAccountJson.reinforcement_preview && typeof rawAccountJson.reinforcement_preview === "object" && (
                <div className="panel p-4 rounded-lg space-y-2">
                  <div className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Reinforcement Preview</div>
                  {(rawAccountJson.reinforcement_preview as any).detected_tool && (
                    <p className="text-[13px]"><span className="text-muted-foreground text-[11px]">Detected Tool:</span> {(rawAccountJson.reinforcement_preview as any).detected_tool}</p>
                  )}
                  {(rawAccountJson.reinforcement_preview as any).library_url && (
                    <a href={(rawAccountJson.reinforcement_preview as any).library_url} target="_blank" rel="noopener noreferrer" className="text-primary text-[13px] underline">
                      View Library →
                    </a>
                  )}
                  {(rawAccountJson.reinforcement_preview as any).description && (
                    <p className="text-[13px] text-foreground/80 leading-relaxed">{(rawAccountJson.reinforcement_preview as any).description}</p>
                  )}
                </div>
              )}
            </div>
          )}

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
