import { useState, useCallback, useRef, useEffect } from "react";
import { useParams, Link, useSearchParams } from "react-router-dom";
import { useCompany, useSignals, useSnapshots, useContacts, useCompanyCards, useUpdateCompany, useMeetings, useCustomerActivity } from "@/hooks/useSupabase";
import { supabase } from "@/integrations/supabase/client";
import { useTrackRecent } from "@/hooks/useRecentCompanies";
import { useQueryClient } from "@tanstack/react-query";
import ScoreCell from "@/components/ScoreCell";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ExternalLink, Loader2, ChevronRight, Plus, X, CheckCircle2, AlertCircle, RefreshCw, Sparkles } from "lucide-react";
import { Json } from "@/integrations/supabase/types";
import { toast } from "sonner";
import { getContactActivity } from "@/lib/contactScore";

// Sub-components
import { parseJson, toArray } from "./company/types";
import type { ScoreBreakdown, SnapshotJSON } from "./company/types";
import OnboardingTab from "./company/OnboardingTab";
import ContactDetailView from "./company/ContactDetailView";

import { PlanBadge } from "@/components/PlanBadge";


function ContactMetaLine({ contact }: { contact: any }) {
  if (!contact) return null;

  const activity = getContactActivity((contact.hubspot_properties as any) || null);

  return (
    <div className="text-caption text-foreground/40 mt-1 flex items-center gap-2">
      {activity.score > 0 && (
        <span className={`text-micro tabular-nums font-medium ${
          activity.tier === "hot" ? "text-orange-400"
          : activity.tier === "warm" ? "text-amber-400"
          : activity.tier === "cool" ? "text-blue-400"
          : "text-foreground/20"
        }`}>
          {activity.score}
        </span>
      )}
      <span>{contact.email || contact.linkedin || contact.title || "No details available"}</span>
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
  const trackRecent = useTrackRecent();
  const queryClient = useQueryClient();
  const [regenerating, setRegenerating] = useState(false);
  const [deleteContactId, setDeleteContactId] = useState<string | null>(null);
  const [deletingContact, setDeletingContact] = useState(false);
  // Setup overlay
  type StepStatus = "pending" | "running" | "done" | "failed";
  interface SetupStep {
    label: string;
    status: StepStatus;
    detail: string;
    startedAt: number | null;
    duration: number | null;
    error: string | null;
  }
  const [showSetupOverlay, setShowSetupOverlay] = useState(false);
  const [setupSteps, setSetupSteps] = useState<SetupStep[]>([]);
  const [setupComplete, setSetupComplete] = useState(false);
  const setupRanRef = useRef(false);
  const hubspotSyncedRef = useRef(false);
  const signalSearchedRef = useRef(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedContactId = searchParams.get("contact") || "";
  const viewMode = selectedContactId ? "contact" : "company";
  const [addContactOpen, setAddContactOpen] = useState(false);
  const [newContact, setNewContact] = useState({ name: "", title: "", email: "", linkedin: "" });
  const [savingContact, setSavingContact] = useState(false);
  
  const [analyzingMeeting, setAnalyzingMeeting] = useState<string | null>(null);
  const [contactEnsureSteps, setContactEnsureSteps] = useState<
    { label: string; status: "pending" | "running" | "done" | "failed"; detail: string }[]
  >([]);
  const contactEnsuredRef = useRef<string | null>(null); // tracks which contact was ensured
  const [generatingStory, setGeneratingStory] = useState(false);
  const [regeneratingSection, setRegeneratingSection] = useState<string | null>(null);
  const [refreshingAnalysis, setRefreshingAnalysis] = useState(false);
  const [activeSection, setActiveSection] = useState("about");
  // extractingProfiles state removed — extraction is now part of the generate pipeline

  

  const effectiveContactId = selectedContactId || contacts[0]?.id || "";
  const { data: companyCards, isLoading: cardsLoading } = useCompanyCards(id, effectiveContactId || undefined);

  const companyAny = company as any;

  // Track recent visit
  const hasTrackedRecent = useRef(false);
  useEffect(() => {
    if (id && company && !hasTrackedRecent.current) {
      hasTrackedRecent.current = true;
      trackRecent.mutate(id);
    }
  }, [id, company]);

  useEffect(() => {
    if (searchParams.get("addContact") === "true") {
      setAddContactOpen(true);
      setSearchParams(selectedContactId ? { contact: selectedContactId } : {}, { replace: true });
    }
  }, [searchParams, selectedContactId, setSearchParams]);


  const regenerateSection = useCallback(async (section: "contacts" | "strategy" | "outreach" | "story" | "signals" | "company") => {
    if (!id) return;
    setRegeneratingSection(section);
    try {
      if (section === "contacts") {
        await supabase.functions.invoke("find-contacts", { body: { company_id: id } });
        queryClient.invalidateQueries({ queryKey: ["contacts", id] });
      } else if (section === "signals") {
        await supabase.functions.invoke("run-signals", { body: { company_id: id, mode: "signals_only" } });
        queryClient.invalidateQueries({ queryKey: ["signals", id] });
        queryClient.invalidateQueries({ queryKey: ["snapshots", id] });
      } else {
        await supabase.functions.invoke("generate-cards", {
          body: { company_id: id, tab: section, contact_id: section !== "company" ? (effectiveContactId || undefined) : undefined },
        });
        queryClient.invalidateQueries({ queryKey: ["company_cards", id], exact: false });
      }
      toast.success(`${section} regenerated`);
    } catch (e: any) {
      toast.error(e.message || `Failed to regenerate ${section}`);
    } finally {
      setRegeneratingSection(null);
    }
  }, [id, effectiveContactId, queryClient]);

  // companyAny declared above
  const companyAccountType = companyAny?.account_type || "company";
  const companyLifecycleStage = companyAny?.lifecycle_stage || "prospect";
  const companySalesMotion = companyAny?.sales_motion || "new-logo";
  const companyRelationshipType = companyAny?.relationship_type || "direct";
  const companyBriefType = companyAny?.brief_type || "prospectBrief";
  const isPartnerManaged = companyRelationshipType === "partner-managed";

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
      if (isPartnerManaged) {
        toast.info("Step 3/3 — Finding contacts via Apollo…");
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
        }
      }

      // Step 3: For non-partner companies, extract contact profiles and generate company cards
      if (!isPartnerManaged) {
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
      // REFACTOR: (b) contact-scoped — prefix invalidation intentionally matches all ["company_cards", id, contactId] variants.
      queryClient.invalidateQueries({ queryKey: ["company_cards", id], exact: false });
      queryClient.invalidateQueries({ queryKey: ["companies"] });
    } catch (e: any) { toast.error(e.message || "Operation failed"); }
    finally { setRegenerating(false); }
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

  useEffect(() => {
    if (!id || !company || isLoading || hubspotSyncedRef.current) return;
    hubspotSyncedRef.current = true;

    // Fire and forget — no await, no UI
    (async () => {
      try {
        if (companyAny?.domain || companyAny?.hubspot_object_id) {
          await supabase.functions.invoke("import-from-hubspot", {
            body: { action: "sync_company", domain: companyAny.domain, company_id: id },
          });
          queryClient.invalidateQueries({ queryKey: ["company", id] });
          queryClient.invalidateQueries({ queryKey: ["contacts", id] });
        }
      } catch (e: any) {
        console.warn("Silent HubSpot sync failed:", e.message);
      }
    })();
  }, [id, company, isLoading, companyAny?.domain, companyAny?.hubspot_object_id, queryClient]);

  useEffect(() => {
    if (!id || !company || isLoading || setupRanRef.current) return;

    const hasCompanyCards = !!companyCards?.account_json;
    const hasScore = company.scout_score != null;

    // Fast path: data exists → skip everything
    if (hasCompanyCards && hasScore) {
      setSetupComplete(true);
      return;
    }

    // Recent sync path: synced within 7 days → skip overlay, update silently in background
    const lastProcessed = companyAny?.last_processed_at;
    const daysSinceProcessed = lastProcessed
      ? (Date.now() - new Date(lastProcessed).getTime()) / (1000 * 60 * 60 * 24)
      : Infinity;

    if (daysSinceProcessed < 7) {
      setupRanRef.current = true;
      setSetupComplete(true);

      (async () => {
        try {
          if (!hasCompanyCards) {
            await supabase.functions.invoke("generate-cards", {
              body: { company_id: id, tab: "company" },
            });
            queryClient.invalidateQueries({ queryKey: ["company_cards", id], exact: false });
          }

          if (!hasScore) {
            await supabase.functions.invoke("score-companies", {
              body: { action: "score_one", company_id: id },
            });
            queryClient.invalidateQueries({ queryKey: ["company", id] });
          }
        } catch (e: any) {
          console.warn("Background setup failed:", e.message);
        }
      })();

      return;
    }

    // First visit path: never processed or >7 days old → show overlay
    setupRanRef.current = true;
    setShowSetupOverlay(true);

    type StepDef = {
      label: string;
      needed: boolean;
      fn: (updateDetail: (d: string) => void) => Promise<string>;
    };

    const stepDefs: StepDef[] = [
      {
        label: "Syncing from HubSpot",
        needed: !!(companyAny?.domain || companyAny?.hubspot_object_id),
        fn: async (updateDetail) => {
          updateDetail(`Searching HubSpot for ${companyAny?.domain || "company"}…`);
          const { data, error } = await supabase.functions.invoke("import-from-hubspot", {
            body: { action: "sync_company", domain: companyAny.domain, company_id: id },
          });
          if (error) throw new Error(error.message || "HubSpot sync failed");
          queryClient.invalidateQueries({ queryKey: ["company", id] });
          queryClient.invalidateQueries({ queryKey: ["contacts", id] });
          const imported = data?.contacts_imported || data?.contacts_found || 0;
          return imported > 0 ? `${imported} contacts synced` : "Company data updated";
        },
      },
      {
        label: "Syncing Fathom meetings",
        needed: !!(companyAny?.domain),
        fn: async (updateDetail) => {
          updateDetail(`Fetching meetings for ${companyAny?.domain}…`);
          const { data, error } = await supabase.functions.invoke("sync-fathom", {
            body: { domain: companyAny.domain, company_id: id },
          });
          if (error) throw new Error(error.message || "Fathom sync failed");
          if (data?.error) throw new Error(data.error);
          const synced = data?.meetings_synced || 0;
          queryClient.invalidateQueries({ queryKey: ["meetings", id] });

          // Auto-analyze new transcripts
          if (synced > 0) {
            updateDetail(`Analyzing ${synced} meeting transcripts…`);
            const { data: freshMeetings } = await supabase
              .from("meetings")
              .select("id, transcript, transcript_analysis")
              .eq("company_id", id!)
              .not("transcript", "is", null)
              .is("transcript_analysis", null);

            if (freshMeetings && freshMeetings.length > 0) {
              for (const m of freshMeetings) {
                await supabase.functions.invoke("analyze-transcript", {
                  body: { meeting_id: m.id },
                });
              }
              queryClient.invalidateQueries({ queryKey: ["meetings", id] });
            }
          }

          return synced > 0 ? `${synced} meetings synced` : "No new meetings";
        },
      },
      {
        label: "Computing score",
        needed: company.scout_score == null,
        fn: async (updateDetail) => {
          updateDetail("Reading contact activity data…");
          const { data, error } = await supabase.functions.invoke("score-companies", {
            body: { action: "score_one", company_id: id },
          });
          if (error) throw new Error(error.message || "Scoring failed");
          queryClient.invalidateQueries({ queryKey: ["company", id] });
          const score = data?.score ?? null;
          if (score !== null) return `Score: ${score}/100`;
          if (data?.scored === false) return "Skipped — no contacts with product data";
          return "Score computed";
        },
      },
      {
        label: "Analyzing company",
        needed: !hasCompanyCards,
        fn: async (updateDetail) => {
          updateDetail("Building company profile with AI…");
          const { error } = await supabase.functions.invoke("generate-cards", {
            body: { company_id: id, tab: "company" },
          });
          if (error) {
            const msg = error.message || "";
            if (msg.includes("not configured")) throw new Error("Company prompt not configured in Admin Settings");
            if (msg.includes("402")) throw new Error("AI credits exhausted — add credits to continue");
            if (msg.includes("429")) throw new Error("AI rate limited — try again in a minute");
            throw new Error(msg || "Company analysis failed");
          }
          queryClient.invalidateQueries({ queryKey: ["company_cards", id], exact: false });
          return "Company profile generated";
        },
      },
    ];

    const activeSteps = stepDefs.filter((s) => s.needed);
    if (activeSteps.length === 0) {
      setSetupComplete(true);
      setShowSetupOverlay(false);
      return;
    }

    setSetupSteps(activeSteps.map((s) => ({
      label: s.label,
      status: "pending",
      detail: "",
      startedAt: null,
      duration: null,
      error: null,
    })));

    const updateStep = (idx: number, patch: Partial<SetupStep>) => {
      setSetupSteps((prev) => prev.map((s, i) => (
        i === idx ? { ...s, ...patch } : s
      )));
    };

    (async () => {
      for (let i = 0; i < activeSteps.length; i++) {
        const startTime = Date.now();
        updateStep(i, { status: "running", startedAt: startTime, detail: "Starting…" });

        const updateDetail = (d: string) => updateStep(i, { detail: d });

        try {
          const result = await Promise.race([
            activeSteps[i].fn(updateDetail),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error("Timed out after 50 seconds")), 50_000)
            ),
          ]);
          updateStep(i, {
            status: "done",
            duration: Date.now() - startTime,
            detail: result,
          });
        } catch (e: any) {
          const errMsg = e.message || "Unknown error";
          console.warn(`Setup "${activeSteps[i].label}" failed:`, errMsg);
          updateStep(i, {
            status: "failed",
            duration: Date.now() - startTime,
            detail: "",
            error: errMsg,
          });
        }
      }

      setTimeout(() => {
        setShowSetupOverlay(false);
        setSetupComplete(true);
      }, 1000);

      try {
        await updateCompany.mutateAsync({
          id: id!,
          updates: { last_processed_at: new Date().toISOString() },
        });
      } catch {}
    })();
  }, [id, company, isLoading, companyCards, companyAny?.domain, companyAny?.hubspot_object_id, queryClient, updateCompany]);


  // Background signal search — runs after setup, no UI
  useEffect(() => {
    if (!id || !company || isLoading || !setupComplete || signalSearchedRef.current) return;
    if (signals.length > 0 || snapshots.length > 0) return;

    signalSearchedRef.current = true;

    (async () => {
      try {
        await supabase.functions.invoke("run-signals", {
          body: { company_id: id, mode: "full" },
        });
        queryClient.invalidateQueries({ queryKey: ["signals", id] });
        queryClient.invalidateQueries({ queryKey: ["snapshots", id] });
      } catch (e: any) {
        console.warn("Background signal search failed:", e.message);
      }
    })();
  }, [id, company, isLoading, setupComplete, signals.length, snapshots.length, queryClient]);

  // ── Auto-ensure contact data when a contact is selected ──
  useEffect(() => {
    if (!id || !effectiveContactId || !company || isLoading) return;
    if (viewMode !== "contact") return;
    // Don't re-run for the same contact
    if (contactEnsuredRef.current === effectiveContactId) return;
    contactEnsuredRef.current = effectiveContactId;

    const contact = contacts.find((c: any) => c.id === effectiveContactId);
    if (!contact) return;

    // Check what exists
    const hasProfile = !!(contact as any).contact_profile?.account_narrative;
    const hasStrategy = !!companyCards?.cards_json;
    const hasOutreach = !!companyCards?.assets_json;

    // Fast path: everything exists
    if (hasProfile && hasStrategy && hasOutreach) return;

    // 7-day skip: if contact cards were updated recently, refresh silently
    const cardCreatedAt = companyCards?.created_at;
    const daysSinceCardUpdate = cardCreatedAt
      ? (Date.now() - new Date(cardCreatedAt).getTime()) / (1000 * 60 * 60 * 24)
      : Infinity;

    if (daysSinceCardUpdate < 7 && (hasStrategy || hasOutreach)) {
      // Recent but possibly incomplete — fill in background
      (async () => {
        try {
          if (!hasProfile) {
            await supabase.functions.invoke("extract-contact-profile", {
              body: { contact_id: effectiveContactId, company_id: id },
            });
            queryClient.invalidateQueries({ queryKey: ["contacts", id] });
          }
          if (!hasStrategy) {
            await supabase.functions.invoke("generate-cards", {
              body: { company_id: id, tab: "strategy", contact_id: effectiveContactId },
            });
            queryClient.invalidateQueries({ queryKey: ["company_cards", id], exact: false });
          }
          if (!hasOutreach) {
            await supabase.functions.invoke("generate-cards", {
              body: { company_id: id, tab: "outreach", contact_id: effectiveContactId },
            });
            queryClient.invalidateQueries({ queryKey: ["company_cards", id], exact: false });
          }
        } catch (e: any) {
          console.warn("Background contact ensure failed:", e.message);
        }
      })();
      return;
    }

    // First visit for this contact — show inline progress
    const steps = [
      {
        label: "Building profile",
        needed: !hasProfile,
        fn: async () => {
          await supabase.functions.invoke("extract-contact-profile", {
            body: { contact_id: effectiveContactId, company_id: id },
          });
          queryClient.invalidateQueries({ queryKey: ["contacts", id] });
        },
      },
      {
        label: "Generating strategy",
        needed: !hasStrategy,
        fn: async () => {
          await supabase.functions.invoke("generate-cards", {
            body: { company_id: id, tab: "strategy", contact_id: effectiveContactId },
          });
          queryClient.invalidateQueries({ queryKey: ["company_cards", id], exact: false });
        },
      },
      {
        label: "Generating outreach",
        needed: !hasOutreach,
        fn: async () => {
          await supabase.functions.invoke("generate-cards", {
            body: { company_id: id, tab: "outreach", contact_id: effectiveContactId },
          });
          queryClient.invalidateQueries({ queryKey: ["company_cards", id], exact: false });
        },
      },
    ].filter((s) => s.needed);

    if (steps.length === 0) return;

    setContactEnsureSteps(steps.map((s) => ({ label: s.label, status: "pending", detail: "" })));

    (async () => {
      for (let i = 0; i < steps.length; i++) {
        setContactEnsureSteps((prev) => prev.map((s, idx) =>
          idx === i ? { ...s, status: "running" } : s
        ));

        try {
          await Promise.race([
            steps[i].fn(),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error("Timed out")), 50_000)
            ),
          ]);
          setContactEnsureSteps((prev) => prev.map((s, idx) =>
            idx === i ? { ...s, status: "done" } : s
          ));
        } catch (e: any) {
          console.warn(`Contact ensure "${steps[i].label}" failed:`, e.message);
          setContactEnsureSteps((prev) => prev.map((s, idx) =>
            idx === i ? { ...s, status: "failed", detail: e.message } : s
          ));
        }
      }

      // Clear steps after brief pause
      setTimeout(() => setContactEnsureSteps([]), 1000);
    })();
  }, [id, effectiveContactId, viewMode, company, isLoading, contacts, companyCards, queryClient]);


  const rawAccountJson = parseJson<Record<string, unknown>>(companyCards?.account_json as Json) || {};
  const hasContactStory = !!(rawAccountJson as any)?._type || !!(rawAccountJson as any)?.opening_hook || !!(rawAccountJson as any)?.behavior_acknowledged;


  useEffect(() => {
    const sections = viewMode === "contact"
      ? ["about", "strategy", "outreach", "story"]
      : ["about", "score", "signals", "analysis"];
    const observers: IntersectionObserver[] = [];

    for (const sectionId of sections) {
      const el = document.getElementById(`section-${sectionId}`);
      if (!el) continue;

      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) setActiveSection(sectionId);
        },
        { rootMargin: "-40% 0px -60% 0px" },
      );

      observer.observe(el);
      observers.push(observer);
    }

    return () => observers.forEach((observer) => observer.disconnect());
  }, [viewMode, effectiveContactId, id]);

  useEffect(() => {
    setActiveSection("about");
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [viewMode === "contact" ? effectiveContactId : id, viewMode]);

  // Reset ensure ref when contact changes
  useEffect(() => {
    if (effectiveContactId !== contactEnsuredRef.current) {
      contactEnsuredRef.current = null;
      setContactEnsureSteps([]);
    }
  }, [effectiveContactId]);

  const refreshAnalysis = async () => {
    if (!id || refreshingAnalysis) return;
    setRefreshingAnalysis(true);
    try {
      // Clear cached AI data so it regenerates
      await supabase.from("company_cards").delete().eq("company_id", id).is("contact_id", null);
      queryClient.removeQueries({ queryKey: ["company_cards", id] });

      // Re-run AI pipeline
      await supabase.functions.invoke("generate-cards", {
        body: { company_id: id, tab: "company" },
      });
      queryClient.invalidateQueries({ queryKey: ["company_cards", id], exact: false });

      await supabase.functions.invoke("score-companies", {
        body: { action: "score_one", company_id: id },
      });
      queryClient.invalidateQueries({ queryKey: ["company", id] });
      queryClient.invalidateQueries({ queryKey: ["snapshots", id] });

      await supabase.functions.invoke("run-signals", {
        body: { company_id: id, mode: "full" },
      });
      queryClient.invalidateQueries({ queryKey: ["signals", id] });

      toast.success("Analysis refreshed");
    } catch (e: any) {
      toast.error("Refresh failed: " + (e.message || "Unknown error"));
    } finally {
      setRefreshingAnalysis(false);
    }
  };

  const generateStory = async () => {
    if (!id || !effectiveContactId) return;
    setGeneratingStory(true);
    try {
      await supabase.functions.invoke("generate-cards", {
        body: { company_id: id, tab: "story", contact_id: effectiveContactId },
      });
      queryClient.invalidateQueries({ queryKey: ["company_cards", id], exact: false });

      const firstName = effectiveContact?.name?.split(" ")[0] || "Contact";
      toast.success(`Story generated for ${firstName}`, {
        action: storyBaseUrl ? {
          label: "View Story →",
          onClick: () => window.open(storyBaseUrl, "_blank"),
        } : undefined,
        duration: 8000,
      });
    } catch (e: any) {
      toast.error("Story generation failed: " + (e.message || "Unknown error"));
    } finally {
      setGeneratingStory(false);
    }
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
  const snap = latestSnapshot ? parseJson<SnapshotJSON>(latestSnapshot.snapshot_json) : null;
  const scoutBreakdown = parseJson<ScoreBreakdown>(companyAny?.scout_score_breakdown);

  const companyNameSlug = company.name.toLowerCase().replace(/\s+/g, "-");
  const effectiveContact = contacts.find((c: any) => c.id === effectiveContactId) || contacts[0] || null;
  const storyBaseUrl = effectiveContact
    ? (!isPartnerManaged
      ? `/stories/${companyNameSlug}/${(effectiveContact?.name || "contact").split(" ")[0].toLowerCase().replace(/[^a-z]/g, "")}`
      : company.partner
        ? `/${company.partner}/${companyNameSlug}/stories/${(effectiveContact?.name || "contact").split(" ")[0].toLowerCase().replace(/[^a-z]/g, "")}`
        : null)
    : null;

  const accountData = parseJson<{
    name?: string; about?: { text?: string; status?: string };
    industry?: { value?: string; status?: string };
    employees?: { value?: string; status?: string };
    hq?: { value?: string; status?: string };
    revenue_range?: { value?: string; status?: string };
    products_services?: { name: string; status?: string }[];
  }>(companyCards?.account_json as Json);

  return (
    <div>
      {showSetupOverlay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="relative bg-card border border-border/40 rounded-lg shadow-lg p-8 max-w-md w-full mx-4">
            <button
              onClick={() => setShowSetupOverlay(false)}
              className="absolute top-3 right-3 text-foreground/20 hover:text-foreground/50 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <h2 className="text-title font-semibold text-foreground mb-1">
              {company.name}
            </h2>
            <p className="text-caption text-foreground/30 mb-6">
              Preparing company data
            </p>

            <div className="space-y-4">
              {setupSteps.map((step, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex items-center gap-3">
                    {step.status === "pending" && (
                      <div className="w-4 h-4 rounded-full border border-border/40 shrink-0" />
                    )}
                    {step.status === "running" && (
                      <Loader2 className="w-4 h-4 animate-spin text-primary shrink-0" />
                    )}
                    {step.status === "done" && (
                      <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
                    )}
                    {step.status === "failed" && (
                      <AlertCircle className="w-4 h-4 text-destructive/60 shrink-0" />
                    )}
                    <span className={`text-caption font-medium ${
                      step.status === "running" ? "text-foreground"
                      : step.status === "done" ? "text-foreground/50"
                      : step.status === "failed" ? "text-destructive/60"
                      : "text-foreground/25"
                    }`}>
                      {step.label}
                    </span>
                    {step.duration != null && (
                      <span className="ml-auto text-micro text-foreground/15 tabular-nums">
                        {(step.duration / 1000).toFixed(1)}s
                      </span>
                    )}
                  </div>

                  {step.status === "running" && step.detail && (
                    <div className="pl-7 text-micro text-foreground/30">
                      {step.detail}
                    </div>
                  )}

                  {step.status === "done" && step.detail && (
                    <div className="pl-7 text-micro text-success/60">
                      {step.detail}
                    </div>
                  )}

                  {step.status === "failed" && step.error && (
                    <div className="pl-7 text-micro text-destructive/50 leading-relaxed">
                      {step.error}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {setupSteps.length > 0 && setupSteps.every((s) => s.status === "done" || s.status === "failed") && (
              <div className="mt-6 pt-4 border-t border-border/20">
                {setupSteps.every((s) => s.status === "done") ? (
                  <p className="text-caption text-success/60">All steps complete — loading page</p>
                ) : (
                  <p className="text-caption text-foreground/30">
                    {setupSteps.filter((s) => s.status === "done").length} of {setupSteps.length} steps succeeded ·{" "}
                    <button
                      onClick={() => setShowSetupOverlay(false)}
                      className="text-primary/60 hover:text-primary transition-colors"
                    >
                      View available data
                    </button>
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {viewMode === "company" ? (
        <div>
          {/* ── Sticky company header ── */}
          <div className="sticky top-0 z-30 bg-background pb-4 -mx-4 px-4 md:-mx-6 md:px-6 pt-2">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h1 className="text-display font-semibold tracking-tight">{company.name}</h1>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 text-caption text-foreground/40">
                  {company.domain && <span>{company.domain}</span>}
                  {company.domain && <span className="text-foreground/15">·</span>}
                  <Select
                    value={companyAccountType}
                    onValueChange={async (val) => {
                      const updates: Record<string, unknown> = {
                        account_type: val,
                        relationship_type: val === "partner" ? "partner-managed" : "direct",
                        brief_type: companyLifecycleStage === "customer" ? "expansionBrief" : companyLifecycleStage === "opportunity" ? "opportunityBrief" : "prospectBrief",
                      };
                      await updateCompany.mutateAsync({ id: id!, updates });
                      queryClient.invalidateQueries({ queryKey: ["company", id] });
                    }}
                  >
                    <SelectTrigger className="h-8 md:h-5 text-micro w-auto border-0 bg-transparent px-2 md:px-0 gap-1 text-foreground/40 hover:text-foreground [&>svg]:w-3 [&>svg]:h-3">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="company">Company</SelectItem>
                      <SelectItem value="school">School</SelectItem>
                      <SelectItem value="partner">Partner</SelectItem>
                    </SelectContent>
                  </Select>
                  <span className="text-foreground/15">·</span>
                  <Select
                    value={companyLifecycleStage}
                    onValueChange={async (val) => {
                      const updates: Record<string, unknown> = {
                        lifecycle_stage: val,
                        sales_motion: val === "customer" ? "expansion" : val === "opportunity" ? "active-deal" : "new-logo",
                        brief_type: val === "customer" ? "expansionBrief" : val === "opportunity" ? "opportunityBrief" : "prospectBrief",
                        is_existing_customer: val === "customer",
                      };
                      await updateCompany.mutateAsync({ id: id!, updates });
                      queryClient.invalidateQueries({ queryKey: ["company", id] });
                    }}
                  >
                    <SelectTrigger className="h-8 md:h-5 text-micro w-auto border-0 bg-transparent px-2 md:px-0 gap-1 text-foreground/40 hover:text-foreground [&>svg]:w-3 [&>svg]:h-3">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="prospect">Prospect</SelectItem>
                      <SelectItem value="opportunity">Opportunity</SelectItem>
                      <SelectItem value="customer">Customer</SelectItem>
                    </SelectContent>
                  </Select>
                  {companyAny?.iorad_plan && (
                    <>
                      <span className="text-foreground/15">·</span>
                      <PlanBadge plan={companyAny.iorad_plan} />
                    </>
                  )}
                  {company.scout_score != null && (
                    <>
                      <span className="text-foreground/15">·</span>
                      <ScoreCell score={company.scout_score} size="sm" />
                    </>
                  )}
                  <button
                    onClick={refreshAnalysis}
                    disabled={refreshingAnalysis}
                    className="inline-flex items-center gap-1.5 text-micro text-foreground/20 hover:text-foreground/40 disabled:opacity-50 transition-colors"
                  >
                    {refreshingAnalysis
                      ? <Loader2 className="w-3 h-3 animate-spin" />
                      : <RefreshCw className="w-3 h-3" />}
                    {refreshingAnalysis ? "Refreshing…" : "Refresh analysis"}
                  </button>
                </div>
              </div>
            </div>

            {/* Anchor nav */}
            <nav className="flex items-center gap-5 border-b border-border/15 pb-2 overflow-x-auto scrollbar-none">
              {["about", "score", "signals", "analysis"].map((section) => (
                <button
                  key={section}
                  onClick={() => {
                    document.getElementById(`section-${section}`)?.scrollIntoView({
                      behavior: "smooth",
                      block: "start",
                    });
                  }}
                  className={`text-caption font-medium transition-colors capitalize ${
                    activeSection === section
                      ? "text-foreground"
                      : "text-foreground/30 hover:text-foreground/60"
                  }`}
                >
                  {section}
                </button>
              ))}
            </nav>
          </div>

          {/* ═══ ABOUT ═══ */}
          <section id="section-about" className="scroll-mt-32">
              <div className="max-w-2xl space-y-8">
                {accountData?.about?.text && (
                  <p className="text-body text-foreground/65 leading-relaxed">
                    {accountData.about.text}
                  </p>
                )}
                {company.scout_summary && (
                  <p className="text-caption text-foreground/40 leading-relaxed">
                    {company.scout_summary}
                  </p>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-8 gap-y-5">
                  {(accountData?.industry?.value || company.industry) && (
                    <div>
                      <div className="field-label">Industry</div>
                      <div className="field-value">{accountData?.industry?.value || company.industry?.replace(/_/g, " ")}</div>
                    </div>
                  )}
                  {(accountData?.employees?.value || company.headcount) && (
                    <div>
                      <div className="field-label">Employees</div>
                      <div className="field-value">{accountData?.employees?.value || `${company.headcount?.toLocaleString()}+`}</div>
                    </div>
                  )}
                  {accountData?.revenue_range?.value && accountData.revenue_range.value !== "Unknown" && (
                    <div>
                      <div className="field-label">Revenue</div>
                      <div className="field-value">{accountData.revenue_range.value}</div>
                    </div>
                  )}
                  {company.partner && (
                    <div>
                      <div className="field-label">Partner</div>
                      <div className="field-value">{company.partner}</div>
                    </div>
                  )}
                  {company.hq_country && (
                    <div>
                      <div className="field-label">HQ</div>
                      <div className="field-value">{company.hq_country}</div>
                    </div>
                  )}
                </div>

                {companyAny?.hubspot_properties && Object.keys(companyAny.hubspot_properties).length > 0 && (
                  <details className="group">
                    <summary className="text-micro text-foreground/20 hover:text-foreground/40 cursor-pointer transition-colors list-none flex items-center gap-1.5">
                      <ChevronRight className="w-3 h-3 transition-transform group-open:rotate-90" />
                      HubSpot data ({Object.entries(companyAny.hubspot_properties).filter(([_, v]) => v != null && v !== "").length} fields)
                    </summary>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3 mt-4">
                      {Object.entries(companyAny.hubspot_properties as Record<string, any>)
                        .filter(([_, v]) => v !== null && v !== "" && v !== undefined)
                        .filter(([k]) => !["name", "domain", "industry", "country", "numberofemployees", "hs_object_id", "createdate", "hs_lastmodifieddate", "hs_pipeline"].includes(k))
                        .sort(([a], [b]) => a.localeCompare(b))
                        .map(([key, value]) => (
                          <div key={key}>
                            <div className="field-label">{key.replace(/_/g, " ").replace(/^hs /, "")}</div>
                            <div className="text-caption text-foreground/55 truncate" title={String(value)}>{String(value)}</div>
                          </div>
                        ))}
                    </div>
                  </details>
                )}

                <div className="py-3 border-t border-border/10">
                  <span className="text-caption text-foreground/40">
                    {meetings.length} meeting{meetings.length !== 1 ? "s" : ""} synced
                    {meetings.filter((m: any) => m.transcript_analysis).length > 0 && (
                      <span> · {meetings.filter((m: any) => m.transcript_analysis).length} analyzed</span>
                    )}
                  </span>
                </div>

                {meetings.length > 0 && (
                  <details className="group">
                    <summary className="text-micro text-foreground/20 hover:text-foreground/40 cursor-pointer transition-colors list-none flex items-center gap-1.5">
                      <ChevronRight className="w-3 h-3 transition-transform group-open:rotate-90" />
                      Onboarding ({meetings.length} meetings)
                    </summary>
                    <div className="mt-4">
                      <OnboardingTab meetings={meetings} analyzingMeeting={analyzingMeeting} onAnalyze={analyzeTranscript} />
                    </div>
                  </details>
                )}
              </div>
          </section>

          {/* ═══ SCORE ═══ */}
          <section id="section-score" className="scroll-mt-32 pt-10">
            <h2 className="text-title font-semibold text-foreground mb-4">Score</h2>
              <div className="max-w-lg space-y-6">
                {scoutBreakdown ? (
                  <>
                    <div className="flex items-center gap-3 mb-4">
                      <ScoreCell score={company.scout_score} size="lg" />
                      {snap?.confidence_level && (
                        <span className="text-caption text-foreground/40">
                          {snap.confidence_level} confidence
                          {snap.confidence_reason && ` — ${snap.confidence_reason}`}
                        </span>
                      )}
                    </div>

                    <div className="space-y-5">
                      {[
                        { label: "Tutorial Activity", value: scoutBreakdown.tutorial || 0, max: 60 },
                        { label: "Commercial Intent", value: scoutBreakdown.commercial || 0, max: 20 },
                        { label: "Recency", value: scoutBreakdown.recency || 0, max: 10 },
                        { label: "Intent Signals", value: scoutBreakdown.intent || 0, max: 10 },
                        ...((scoutBreakdown as any).expansion_bonus > 0 ? [
                          { label: "Expansion Signal", value: (scoutBreakdown as any).expansion_bonus, max: 20 }
                        ] : []),
                        ...((scoutBreakdown as any).pql_bonus > 0 ? [
                          { label: "PQL Signal", value: (scoutBreakdown as any).pql_bonus, max: 15 }
                        ] : []),
                      ].map(({ label, value, max }) => (
                        <div key={label}>
                          <div className="flex justify-between mb-1.5">
                            <span className="field-label">{label}</span>
                            <span className="text-caption font-medium tabular-nums text-foreground">{value}/{max}</span>
                          </div>
                          <div className="h-1.5 bg-foreground/[0.06] rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary rounded-full transition-all duration-700"
                              style={{ width: `${(value / max) * 100}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Signal flags */}
                    {((scoutBreakdown as any)?.expansion_signal || (scoutBreakdown as any)?.pql_signal) && (
                      <div className="space-y-2 pt-2">
                        {(scoutBreakdown as any)?.expansion_signal && (
                          <div className="flex items-center gap-2 text-caption px-3 py-2 rounded-lg bg-amber-500/[0.08] border border-amber-500/15">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                            <span className="text-amber-400 font-medium">Expansion signal</span>
                            <span className="text-foreground/40">— paid plan + free users actively creating tutorials</span>
                          </div>
                        )}
                        {(scoutBreakdown as any)?.pql_signal && (
                          <div className="flex items-center gap-2 text-caption px-3 py-2 rounded-lg bg-emerald-500/[0.08] border border-emerald-500/15">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                            <span className="text-emerald-400 font-medium">Product-qualified lead</span>
                            <span className="text-foreground/40">— free users creating tutorials, no paid plan yet</span>
                          </div>
                        )}
                      </div>
                    )}

                    {snapshots.length > 1 && (
                      <details className="group pt-4">
                        <summary className="text-micro text-foreground/20 hover:text-foreground/40 cursor-pointer transition-colors list-none flex items-center gap-1.5">
                          <ChevronRight className="w-3 h-3 transition-transform group-open:rotate-90" />
                          Score history ({snapshots.length} snapshots)
                        </summary>
                        <div className="space-y-2 mt-3">
                          {snapshots.map((s: any) => (
                            <div key={s.id} className="flex items-center justify-between text-caption py-1.5 border-b border-border/10 last:border-0">
                              <div className="flex items-center gap-3">
                                <ScoreCell score={s.score_total} size="sm" />
                                <span className="text-foreground/30 font-mono text-micro">{s.model_version}</span>
                              </div>
                              <span className="text-foreground/30">{new Date(s.created_at).toLocaleDateString()}</span>
                            </div>
                          ))}
                        </div>
                      </details>
                    )}
                  </>
                ) : (
                  <div>
                    <div className="field-label mb-2">Score</div>
                    <p className="field-value-empty">No score computed yet.</p>
                  </div>
                )}
              </div>
          </section>

          {/* ═══ SIGNALS ═══ */}
          <section id="section-signals" className="scroll-mt-32 pt-10">
            <h2 className="text-title font-semibold text-foreground mb-4">Signals</h2>
              <div className="max-w-2xl space-y-4">
                {signals.length === 0 ? (
                  <p className="field-value-empty">No signals discovered yet.</p>
                ) : (
                  signals.map((signal: any) => {
                    const snippets = (Array.isArray(signal.evidence_snippets) ? signal.evidence_snippets : []) as string[];
                    return (
                      <div key={signal.id} className="py-4 border-b border-border/10 last:border-0 space-y-2">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-body font-medium text-foreground">{signal.title}</div>
                            <div className="text-micro text-foreground/30 mt-0.5">
                              {signal.date || "No date"} · {signal.type}
                            </div>
                          </div>
                          {signal.url && (
                            <a href={signal.url} target="_blank" rel="noopener noreferrer" className="text-foreground/20 hover:text-primary transition-colors shrink-0">
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                        {signal.raw_excerpt && (
                          <p className="text-caption text-foreground/50 leading-relaxed">{signal.raw_excerpt}</p>
                        )}
                        {snippets.length > 0 && (
                          <div className="space-y-1.5 pt-2">
                            <div className="field-label">Evidence</div>
                            {snippets.map((snippet, i) => (
                              <p key={i} className="text-caption text-foreground/40 pl-3 border-l border-border/20">
                                {snippet}
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}

                {activityEvents.length > 0 && (
                  <details className="group pt-4">
                    <summary className="text-micro text-foreground/20 hover:text-foreground/40 cursor-pointer transition-colors list-none flex items-center gap-1.5">
                      <ChevronRight className="w-3 h-3 transition-transform group-open:rotate-90" />
                      HubSpot activity ({activityEvents.length} events)
                    </summary>
                    <div className="space-y-1.5 mt-3 max-h-[400px] overflow-y-auto">
                      {activityEvents.map((evt: any) => (
                        <div key={evt.id} className="flex items-center gap-3 py-2 border-b border-border/10 last:border-0">
                          <span className="text-caption font-medium text-foreground truncate flex-1">{evt.title}</span>
                          <span className="text-micro text-foreground/25 uppercase">{evt.activity_type?.replace(/_/g, " ")}</span>
                          <span className="text-micro text-foreground/20 tabular-nums whitespace-nowrap">
                            {new Date(evt.occurred_at).toLocaleDateString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
          </section>

          {/* ═══ ANALYSIS ═══ */}
          <section id="section-analysis" className="scroll-mt-32 pt-10">
            <h2 className="text-title font-semibold text-foreground mb-4">Analysis</h2>
              <div className="max-w-2xl">
                {snap && latestSnapshot ? (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-micro text-foreground/20">
                        {latestSnapshot.model_version} · {new Date(latestSnapshot.created_at).toLocaleDateString()}
                      </span>
                    </div>

                    {snap.why_now && toArray(snap.why_now).length > 0 && (
                      <div className="mb-6">
                        <div className="field-label mb-2">Why Now</div>
                        {toArray(snap.why_now).map((item, i) => (
                          <p key={i} className="text-body text-foreground/60 leading-[1.7]">{item}</p>
                        ))}
                      </div>
                    )}

                    <Accordion type="multiple" defaultValue={["executive-narrative"]} className="space-y-2">
                      {snap.signal_deconstruction && (
                        <AccordionItem value="signal-deconstruction" className="border-0 px-0">
                          <AccordionTrigger className="text-body font-medium text-foreground/75 hover:text-foreground">
                            Signal Deconstruction
                          </AccordionTrigger>
                          <AccordionContent>
                            <div className="space-y-4">
                              {snap.signal_deconstruction.company_stage && (
                                <div>
                                  <div className="field-label mb-1">Company Stage</div>
                                  <span className="text-sm bg-primary/10 text-primary px-2 py-0.5 rounded">{snap.signal_deconstruction.company_stage}</span>
                                </div>
                              )}
                              {snap.signal_deconstruction.observable_facts?.length ? (
                                <div>
                                  <div className="field-label mb-2">Observable Facts</div>
                                  <ul className="space-y-1">
                                    {snap.signal_deconstruction.observable_facts.map((f, i) => (
                                      <li key={i} className="text-body text-foreground/60 flex items-start gap-2"><span className="text-foreground/20 mt-0.5">·</span>{f}</li>
                                    ))}
                                  </ul>
                                </div>
                              ) : null}
                              {snap.signal_deconstruction.workflow_stress_indicators?.length ? (
                                <div>
                                  <div className="field-label mb-2">Workflow Stress Indicators</div>
                                  <ul className="space-y-1">
                                    {snap.signal_deconstruction.workflow_stress_indicators.map((w, i) => (
                                      <li key={i} className="text-body text-foreground/60 flex items-start gap-2"><span className="text-foreground/20 mt-0.5">·</span>{w}</li>
                                    ))}
                                  </ul>
                                </div>
                              ) : null}
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      )}

                      {snap.operational_friction?.length ? (
                        <AccordionItem value="operational-friction" className="border-0 px-0">
                          <AccordionTrigger className="text-body font-medium text-foreground/75 hover:text-foreground">
                            Operational Friction
                          </AccordionTrigger>
                          <AccordionContent>
                            <div className="space-y-1">
                              {snap.operational_friction.map((f, i) => (
                                <div key={i} className="space-y-1 py-3 border-b border-border/10 last:border-0">
                                  <div className="text-body text-foreground/60"><span className="field-label inline mr-2">Cause</span>{f.cause}</div>
                                  <div className="text-body text-foreground/60"><span className="field-label inline mr-2">Effect</span>{f.effect}</div>
                                  <div className="text-body text-foreground/60"><span className="field-label inline mr-2">Bottleneck</span>{f.bottleneck}</div>
                                </div>
                              ))}
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      ) : null}

                      {snap.partner_platform_ceiling && (
                        <AccordionItem value="partner-ceiling" className="border-0 px-0">
                          <AccordionTrigger className="text-body font-medium text-foreground/75 hover:text-foreground">
                            Partner Platform Ceiling
                          </AccordionTrigger>
                          <AccordionContent>
                            <div className="space-y-4">
                              {snap.partner_platform_ceiling.platform_strengths?.length ? (
                                <div>
                                  <div className="field-label mb-2">Platform Strengths</div>
                                  <div className="flex flex-wrap gap-1.5">{snap.partner_platform_ceiling.platform_strengths.map((s, i) => <span key={i} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">{s}</span>)}</div>
                                </div>
                              ) : null}
                              {snap.partner_platform_ceiling.execution_gaps?.length ? (
                                <div>
                                  <div className="field-label mb-2">Execution Gaps</div>
                                  <ul className="space-y-1">{snap.partner_platform_ceiling.execution_gaps.map((g, i) => <li key={i} className="text-body text-foreground/60 flex items-start gap-2"><span className="text-foreground/20 mt-0.5">·</span>{g}</li>)}</ul>
                                </div>
                              ) : null}
                              {snap.partner_platform_ceiling.key_insight && (
                                <p className="text-body text-foreground/60">{snap.partner_platform_ceiling.key_insight}</p>
                              )}
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      )}

                      {snap.embedded_leverage && (
                        <AccordionItem value="embedded-leverage" className="border-0 px-0">
                          <AccordionTrigger className="text-body font-medium text-foreground/75 hover:text-foreground">
                            Embedded iorad Leverage
                          </AccordionTrigger>
                          <AccordionContent>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              {(["situation", "constraint", "intervention", "transformation"] as const).map((key) => {
                                const val = snap.embedded_leverage?.[key];
                                if (!val) return null;
                                const labels: Record<string, string> = { situation: "Situation", constraint: "Constraint", intervention: "Intervention", transformation: "Transformation" };
                                return (
                                  <div key={key}>
                                    <div className="field-label">{labels[key]}</div>
                                    <p className="text-body text-foreground/60">{val}</p>
                                  </div>
                                );
                              })}
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      )}

                      {snap.quantified_impact?.length ? (
                        <AccordionItem value="quantified-impact" className="border-0 px-0">
                          <AccordionTrigger className="text-body font-medium text-foreground/75 hover:text-foreground">
                            Quantified Impact
                          </AccordionTrigger>
                          <AccordionContent>
                            <div className="space-y-1">
                              {snap.quantified_impact.map((q, i) => (
                                <div key={i} className="py-3 border-b border-border/10 last:border-0 space-y-1">
                                  <div className="text-body font-medium text-foreground">{q.metric}</div>
                                  <div className="text-caption text-foreground/40">{q.assumptions}</div>
                                  <div className="text-caption font-mono text-foreground/50">{q.calculation}</div>
                                  <div className="text-body font-semibold text-foreground">{q.result}</div>
                                </div>
                              ))}
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      ) : null}

                      {snap.executive_narrative && (
                        <AccordionItem value="executive-narrative" className="border-0 px-0">
                          <AccordionTrigger className="text-body font-medium text-foreground/75 hover:text-foreground">
                            Executive Narrative
                          </AccordionTrigger>
                          <AccordionContent>
                            <div className="prose prose-sm dark:prose-invert max-w-none">
                              {(Array.isArray(snap.executive_narrative)
                                ? snap.executive_narrative
                                : typeof snap.executive_narrative === "string"
                                  ? snap.executive_narrative.split("\n\n")
                                  : []
                              ).map((p: string, i: number) => (
                                <p key={i} className="text-body text-foreground/60 leading-relaxed mb-4">{p}</p>
                              ))}
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      )}

                      {snap.outbound_positioning && (
                        <AccordionItem value="outbound-positioning" className="border-0 px-0">
                          <AccordionTrigger className="text-body font-medium text-foreground/75 hover:text-foreground">
                            Outbound Positioning
                          </AccordionTrigger>
                          <AccordionContent>
                            <div className="space-y-3">
                              {snap.outbound_positioning.executive_framing && (
                                <div className="py-2">
                                  <div className="field-label">Executive Framing</div>
                                  <p className="text-body text-foreground/60">{snap.outbound_positioning.executive_framing}</p>
                                </div>
                              )}
                              {snap.outbound_positioning.efficiency_framing && (
                                <div className="py-2">
                                  <div className="field-label">Efficiency / Revenue</div>
                                  <p className="text-body text-foreground/60">{snap.outbound_positioning.efficiency_framing}</p>
                                </div>
                              )}
                              {snap.outbound_positioning.risk_framing && (
                                <div className="py-2">
                                  <div className="field-label">Risk Mitigation</div>
                                  <p className="text-body text-foreground/60">{snap.outbound_positioning.risk_framing}</p>
                                </div>
                              )}
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      )}

                      {snap.competitive_insulation?.length ? (
                        <AccordionItem value="competitive-insulation" className="border-0 px-0">
                          <AccordionTrigger className="text-body font-medium text-foreground/75 hover:text-foreground">
                            Competitive Insulation
                          </AccordionTrigger>
                          <AccordionContent>
                            <ul className="space-y-1.5">
                              {snap.competitive_insulation.map((r, i) => (
                                <li key={i} className="text-body text-foreground/60 flex items-start gap-2"><span className="text-foreground/20 mt-0.5">·</span>{r}</li>
                              ))}
                            </ul>
                          </AccordionContent>
                        </AccordionItem>
                      ) : null}

                      {snap.evidence?.length ? (
                        <AccordionItem value="evidence" className="border-0 px-0">
                          <AccordionTrigger className="text-body font-medium text-foreground/75 hover:text-foreground">
                            Cited Evidence ({snap.evidence.length})
                          </AccordionTrigger>
                          <AccordionContent>
                            <div className="space-y-2">
                              {snap.evidence.map((ev, i) => (
                                <div key={i} className="py-2 border-b border-border/10 last:border-0">
                                  <p className="text-caption text-foreground/40">{ev.snippet || ev.detail}</p>
                                  <a href={ev.source_url || ev.url || "#"} target="_blank" rel="noopener noreferrer" className="text-micro text-primary/60 hover:text-primary transition-colors mt-0.5 inline-flex items-center gap-1">
                                    <ExternalLink className="w-3 h-3" />
                                    {ev.source_type || ev.signal_type || "source"} · {ev.date || "no date"}
                                  </a>
                                </div>
                              ))}
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      ) : null}
                    </Accordion>
                  </div>
                ) : (
                  <p className="field-value-empty">
                    No analysis generated yet. Data will auto-populate in the background.
                  </p>
                )}
              </div>
          </section>

          {/* Add Contact dialog — company view */}
          <Dialog open={addContactOpen} onOpenChange={setAddContactOpen}>
            <DialogContent>
              <DialogHeader><DialogTitle>Add Contact</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Name *</Label><Input value={newContact.name} onChange={e => setNewContact(p => ({ ...p, name: e.target.value }))} placeholder="Jane Smith" /></div>
                <div><Label>Title</Label><Input value={newContact.title} onChange={e => setNewContact(p => ({ ...p, title: e.target.value }))} placeholder="VP of Learning" /></div>
                <div><Label>Email</Label><Input type="email" value={newContact.email} onChange={e => setNewContact(p => ({ ...p, email: e.target.value }))} placeholder="jane@company.com" /></div>
                <div><Label>LinkedIn</Label><Input value={newContact.linkedin} onChange={e => setNewContact(p => ({ ...p, linkedin: e.target.value }))} placeholder="https://linkedin.com/in/..." /></div>
                <div className="flex justify-end gap-2 pt-1">
                  <Button variant="ghost" onClick={() => setAddContactOpen(false)}>Cancel</Button>
                  <Button onClick={handleAddContact} disabled={savingContact || !newContact.name.trim()}>
                    {savingContact ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Add Contact
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      ) : (
        <div>
          {/* ── Sticky contact header ── */}
          <div className="sticky top-0 z-30 bg-background pb-4 -mx-4 px-4 md:-mx-6 md:px-6 pt-2">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h1 className="text-display font-semibold tracking-tight">{effectiveContact?.name}</h1>
                <ContactMetaLine contact={effectiveContact} />
              </div>
              <div className="flex items-center gap-2">
                {!hasContactStory && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    onClick={generateStory}
                    disabled={generatingStory || contactEnsureSteps.length > 0}
                  >
                    {generatingStory
                      ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Generating Story…</>
                      : <><Sparkles className="w-3.5 h-3.5" /> Generate Story</>}
                  </Button>
                )}
                {hasContactStory && storyBaseUrl && (
                  <a href={storyBaseUrl} target="_blank" rel="noopener noreferrer">
                    <Button size="sm" variant="outline" className="gap-1.5">
                      <ExternalLink className="w-3.5 h-3.5" /> View Story
                    </Button>
                  </a>
                )}
              </div>
            </div>

            {/* Anchor nav */}
            <nav className="flex items-center gap-5 border-b border-border/15 pb-2 overflow-x-auto scrollbar-none">
              {["about", "strategy", "outreach", "story"].map((section) => (
                <button
                  key={section}
                  onClick={() => {
                    document.getElementById(`section-${section}`)?.scrollIntoView({
                      behavior: "smooth",
                      block: "start",
                    });
                  }}
                  className={`text-caption font-medium transition-colors capitalize ${
                    activeSection === section
                      ? "text-foreground"
                      : "text-foreground/30 hover:text-foreground/60"
                  }`}
                >
                  {section}
                </button>
              ))}
            </nav>
          </div>

          <ContactDetailView
            companyId={id!}
            company={company}
            companyNameSlug={companyNameSlug}
            isPartnerCategory={isPartnerManaged}
            contacts={contacts}
            selectedContactId={selectedContactId || contacts[0]?.id || ""}
            addContactOpen={addContactOpen}
            onSetAddContactOpen={setAddContactOpen}
            newContact={newContact}
            onSetNewContact={setNewContact}
            onAddContact={handleAddContact}
            savingContact={savingContact}
            deleteContactId={deleteContactId}
            onSetDeleteContactId={setDeleteContactId}
            deletingContact={deletingContact}
            onConfirmDelete={() => deleteContactId && handleDeleteContact(deleteContactId)}
            ensureRunning={contactEnsureSteps.length > 0}
            companyCards={companyCards}
            cardsLoading={cardsLoading}
            regeneratingSection={regeneratingSection}
            onRegenerateSection={(section) => regenerateSection(section as any)}
            onGenerateStory={generateStory}
            generatingStory={generatingStory}
          />
        </div>
      )}
    </div>
  );
}
