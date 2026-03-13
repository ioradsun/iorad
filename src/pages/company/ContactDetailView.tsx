import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronRight, ExternalLink, Linkedin, Loader2, Plus, Sparkles, CheckCircle2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Json } from "@/integrations/supabase/types";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import OutreachTab from "./OutreachTab";
import StoryTab from "./StoryTab";
import StrategyTab from "./StrategyTab";
import { parseJson, toIoradEmbedUrl, toLoomEmbedUrl } from "./types";
import type { DashboardCard, EmailTouch, LinkedInStep, StoryAssets } from "./types";
import { getContactActivity } from "@/lib/contactScore";

interface ContactDetailViewProps {
  companyId: string;
  company: any;
  companyNameSlug: string;
  isPartnerCategory: boolean;
  contacts: any[];
  selectedContactId: string;
  addContactOpen: boolean;
  onSetAddContactOpen: (open: boolean) => void;
  newContact: { name: string; title: string; email: string; linkedin: string };
  onSetNewContact: (updater: (prev: any) => any) => void;
  onAddContact: () => void;
  savingContact: boolean;
  deleteContactId: string | null;
  onSetDeleteContactId: (id: string | null) => void;
  deletingContact: boolean;
  onConfirmDelete: () => void;
  ensureRunning: boolean;
  companyCards: any;
  cardsLoading: boolean;
  regeneratingSection: string | null;
  onRegenerateSection: (section: string) => void;
  onGenerateStory: () => void;
  generatingStory: boolean;
}

export default function ContactDetailView({
  companyId,
  company,
  companyNameSlug,
  isPartnerCategory,
  contacts,
  selectedContactId,
  addContactOpen,
  onSetAddContactOpen,
  newContact,
  onSetNewContact,
  onAddContact,
  savingContact,
  deleteContactId,
  onSetDeleteContactId,
  deletingContact,
  onConfirmDelete,
  ensureRunning,
  companyCards,
  cardsLoading,
  regeneratingSection,
  onRegenerateSection,
  onGenerateStory,
  generatingStory,
}: ContactDetailViewProps) {
  const queryClient = useQueryClient();
  const companyAny = company as any;

  const effectiveContact = contacts.find((c: any) => c.id === selectedContactId) || contacts[0] || null;
  const firstName = effectiveContact?.name?.split(" ")[0] || "Contact";
  const contactSlug = effectiveContact?.name?.split(" ")[0]?.toLowerCase().replace(/[^a-z]/g, "") || "";
  const storyUrl = !isPartnerCategory
    ? contactSlug ? `/stories/${companyNameSlug}/${contactSlug}` : `/stories/${companyNameSlug}`
    : effectiveContact && company.partner
      ? `/${company.partner}/${companyNameSlug}/stories/${contactSlug}`
      : null;

  const cards = (companyCards?.cards_json as unknown as DashboardCard[] | null) || [];
  const assets = parseJson<{ email_sequence?: Record<string, EmailTouch>; linkedin_sequence?: LinkedInStep[]; story_assets?: StoryAssets }>(companyCards?.assets_json as Json) || {};
  const rawAccountJson = parseJson<Record<string, unknown>>(companyCards?.account_json as Json) || {};
  const inboundStrategyData: Record<string, unknown> | null = (() => {
    const namespaced = rawAccountJson?._strategy as Record<string, unknown> | undefined;
    if (namespaced && (namespaced.momentum_observed || namespaced.initiative_translation || namespaced.opening_paragraph || namespaced.subject_line || namespaced.observed_behavior)) {
      return namespaced;
    }
    if (rawAccountJson?.momentum_observed || rawAccountJson?.initiative_translation || rawAccountJson?.opening_paragraph || rawAccountJson?.subject_line) {
      return rawAccountJson;
    }
    return null;
  })();
  const isInboundStrategyResponse = !!(inboundStrategyData?.momentum_observed || inboundStrategyData?.initiative_translation || inboundStrategyData?.observed_behavior || inboundStrategyData?.subject_line || inboundStrategyData?.opening_paragraph);
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
    { label: "Observed Behavior", key: "observed_behavior" },
    { label: "Inferred Initiative", key: "inferred_initiative" },
    { label: "Execution Gap", key: "execution_gap" },
    { label: "Institutionalization Play", key: "institutionalization_play" },
    { label: "ROI Expansion Path", key: "roi_expansion_path" },
  ];

  const effectiveLoomUrl = companyCards?.loom_url || companyAny?.loom_url || "";
  const effectiveIoradUrl = companyCards?.iorad_url || companyAny?.iorad_url || "";
  const loomEmbedUrl = toLoomEmbedUrl(effectiveLoomUrl);
  const ioradEmbedUrl = toIoradEmbedUrl(effectiveIoradUrl);
  const activity = useMemo(() => {
    return getContactActivity((effectiveContact as any)?.hubspot_properties || null);
  }, [effectiveContact?.id]);

  // ── Autosave for name, role_focus and user_notes ──
  const nameParts = (effectiveContact?.name || "").split(" ");
  const [localFirstName, setLocalFirstName] = useState(nameParts[0] || "");
  const [localLastName, setLocalLastName] = useState(nameParts.slice(1).join(" ") || "");
  const [localRoleFocus, setLocalRoleFocus] = useState((effectiveContact as any)?.role_focus || "");
  const [localUserNotes, setLocalUserNotes] = useState((effectiveContact as any)?.user_notes || "");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset local state when contact changes
  useEffect(() => {
    const parts = (effectiveContact?.name || "").split(" ");
    setLocalFirstName(parts[0] || "");
    setLocalLastName(parts.slice(1).join(" ") || "");
    setLocalRoleFocus((effectiveContact as any)?.role_focus || "");
    setLocalUserNotes((effectiveContact as any)?.user_notes || "");
    setSaveStatus("idle");
  }, [effectiveContact?.id]);

  const autosave = useCallback(async (fields: { firstName?: string; lastName?: string; roleFocus?: string; userNotes?: string }) => {
    if (!effectiveContact) return;
    setSaveStatus("saving");
    try {
      const updates: Record<string, any> = {};
      if (fields.firstName !== undefined || fields.lastName !== undefined) {
        const first = fields.firstName ?? localFirstName;
        const last = fields.lastName ?? localLastName;
        updates.name = [first, last].filter(Boolean).join(" ") || effectiveContact.name;
      }
      if (fields.roleFocus !== undefined) updates.role_focus = fields.roleFocus || null;
      if (fields.userNotes !== undefined) updates.user_notes = fields.userNotes || null;

      const { error } = await supabase
        .from("contacts")
        .update(updates)
        .eq("id", effectiveContact.id);
      if (error) {
        console.error("Autosave failed:", error.message);
        setSaveStatus("idle");
        return;
      }
      setSaveStatus("saved");
      queryClient.invalidateQueries({ queryKey: ["contacts", companyId] });
      setTimeout(() => setSaveStatus("idle"), 2000);
    } catch {
      setSaveStatus("idle");
    }
  }, [effectiveContact?.id, companyId, queryClient, localFirstName, localLastName]);

  const debouncedSave = useCallback((fields: { firstName?: string; lastName?: string; roleFocus?: string; userNotes?: string }) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => autosave(fields), 1500);
  }, [autosave]);

  const handleFirstNameChange = (val: string) => {
    setLocalFirstName(val);
    debouncedSave({ firstName: val });
  };
  const handleLastNameChange = (val: string) => {
    setLocalLastName(val);
    debouncedSave({ lastName: val });
  };
  const handleRoleFocusChange = (val: string) => {
    setLocalRoleFocus(val);
    debouncedSave({ roleFocus: val });
  };
  const handleUserNotesChange = (val: string) => {
    setLocalUserNotes(val);
    debouncedSave({ userNotes: val });
  };

  const handleFieldBlur = () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    autosave({ firstName: localFirstName, lastName: localLastName, roleFocus: localRoleFocus, userNotes: localUserNotes });
  };

  const hasStrategy = cards.length > 0 || !!(rawAccountJson as any)?._strategy;
  const hasStory = !!(rawAccountJson as any)?._type || !!(rawAccountJson as any)?.opening_hook || !!(rawAccountJson as any)?.behavior_acknowledged;
  const hasOutreach = !!(assets.email_sequence || assets.linkedin_sequence);
  const [generatingBriefing, setGeneratingBriefing] = useState(false);
  const [briefingSteps, setBriefingSteps] = useState<
    { label: string; status: "pending" | "running" | "done" | "failed" }[]
  >([]);

  const generateBriefing = async () => {
    if (!companyId || !effectiveContact?.id) return;
    setGeneratingBriefing(true);
    const tabs = ["strategy", "outreach"];
    setBriefingSteps(tabs.map((t) => ({ label: `Generating ${t}`, status: "pending" })));

    for (let i = 0; i < tabs.length; i++) {
      setBriefingSteps((prev) => prev.map((s, idx) =>
        idx === i ? { ...s, status: "running" } : s
      ));
      try {
        await Promise.race([
          supabase.functions.invoke("generate-cards", {
            body: { company_id: companyId, tab: tabs[i], contact_id: effectiveContact.id },
          }),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("Timed out")), 55_000)
          ),
        ]);
        setBriefingSteps((prev) => prev.map((s, idx) =>
          idx === i ? { ...s, status: "done" } : s
        ));
      } catch {
        setBriefingSteps((prev) => prev.map((s, idx) =>
          idx === i ? { ...s, status: "failed" } : s
        ));
      }
    }
    queryClient.invalidateQueries({ queryKey: ["company_cards", companyId], exact: false });
    setGeneratingBriefing(false);
    setTimeout(() => setBriefingSteps([]), 1500);
  };
  const handleLoomUrlChange = async (url: string) => {
    if (!companyId || !effectiveContact?.id) return;
    try {
      const { error } = await supabase
        .from("companies")
        .update({ loom_url: url })
        .eq("id", companyId);
      if (error) console.warn("Loom URL save failed:", error.message);
      queryClient.invalidateQueries({ queryKey: ["company_cards", companyId], exact: false });
    } catch {}
  };

  const handleIoradUrlChange = async (url: string) => {
    if (!companyId || !effectiveContact?.id) return;
    try {
      const { error } = await supabase
        .from("companies")
        .update({ iorad_url: url })
        .eq("id", companyId);
      if (error) console.warn("iorad URL save failed:", error.message);
      queryClient.invalidateQueries({ queryKey: ["company_cards", companyId], exact: false });
    } catch {}
  };

  if (!contacts.length) {
    return (
      <>
        <div className="text-center py-16">
          <p className="text-body text-foreground/40 mb-1">No contacts yet</p>
          <p className="text-caption text-foreground/20 mb-4">
            Add a contact manually or sync from HubSpot.
          </p>
          <Button variant="outline" onClick={() => onSetAddContactOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" /> Add Contact
          </Button>
        </div>
        <Dialog open={addContactOpen} onOpenChange={onSetAddContactOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Contact</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Name *</Label><Input value={newContact.name} onChange={e => onSetNewContact((p: any) => ({ ...p, name: e.target.value }))} placeholder="Jane Smith" /></div>
              <div><Label>Title</Label><Input value={newContact.title} onChange={e => onSetNewContact((p: any) => ({ ...p, title: e.target.value }))} placeholder="VP Customer Success" /></div>
              <div><Label>Email</Label><Input value={newContact.email} onChange={e => onSetNewContact((p: any) => ({ ...p, email: e.target.value }))} placeholder="jane@company.com" /></div>
              <div><Label>LinkedIn URL</Label><Input value={newContact.linkedin} onChange={e => onSetNewContact((p: any) => ({ ...p, linkedin: e.target.value }))} placeholder="https://linkedin.com/in/..." /></div>
              <div className="flex justify-end gap-2 pt-1">
                <Button variant="ghost" onClick={() => onSetAddContactOpen(false)}>Cancel</Button>
                <Button onClick={onAddContact} disabled={savingContact || !newContact.name.trim()}>
                  {savingContact ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Add Contact
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <>
      <div className="space-y-12">

        {/* ═══ SECTION 1: ABOUT ═══ */}
        <section id="section-about" className="scroll-mt-32">
          <div className="max-w-2xl space-y-8">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-8 gap-y-5">
            <div>
              <label className="field-label block mb-1">First Name</label>
              <input type="text" value={localFirstName} onChange={(e) => handleFirstNameChange(e.target.value)} onBlur={handleFieldBlur} placeholder="First" className="field-editable" />
            </div>
            <div>
              <label className="field-label block mb-1">Last Name</label>
              <input type="text" value={localLastName} onChange={(e) => handleLastNameChange(e.target.value)} onBlur={handleFieldBlur} placeholder="Last" className="field-editable" />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-8 gap-y-5">
            <div>
              <div className="field-label">Email</div>
              {effectiveContact?.email ? (
                <a href={`mailto:${effectiveContact.email}`} className="text-body text-foreground/80 hover:text-primary transition-colors">{effectiveContact.email}</a>
              ) : <div className="field-value-empty">No email</div>}
            </div>
            <div>
              <div className="field-label">Title</div>
              {effectiveContact?.title ? <div className="field-value">{effectiveContact.title}</div> : <div className="field-value-empty">No title</div>}
            </div>
            <div>
              <div className="field-label">LinkedIn</div>
              {effectiveContact?.linkedin ? (
                <a href={effectiveContact.linkedin} target="_blank" rel="noopener noreferrer" className="text-body text-foreground/80 hover:text-primary transition-colors inline-flex items-center gap-1.5">
                  <Linkedin className="w-3.5 h-3.5" /> Profile
                </a>
              ) : <div className="field-value-empty">Not linked</div>}
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-4">
              {activity.score > 0 ? (
                <div className="flex items-baseline gap-1.5">
                  <span className={`text-display font-semibold tabular-nums ${
                    activity.tier === "hot" ? "text-orange-400"
                    : activity.tier === "warm" ? "text-amber-400"
                    : activity.tier === "cool" ? "text-blue-400"
                    : "text-foreground/30"
                  }`}>{activity.score}</span>
                  <span className="text-micro text-foreground/15">/100</span>
                </div>
              ) : (
                <span className="text-caption text-foreground/20 italic">No iorad activity</span>
              )}
              {activity.daysSinceActive !== null && (
                <span className={`text-micro font-medium px-2 py-0.5 rounded ${
                  activity.daysSinceActive <= 7 ? "bg-success/10 text-success"
                  : activity.daysSinceActive <= 30 ? "bg-primary/10 text-primary/70"
                  : activity.daysSinceActive <= 90 ? "bg-foreground/[0.05] text-foreground/35"
                  : "bg-destructive/8 text-destructive/60"
                }`}>
                  {activity.daysSinceActive <= 7 ? "Active now"
                    : activity.daysSinceActive <= 30 ? activity.recencyLabel
                    : activity.daysSinceActive <= 90 ? `Cooling · ${activity.recencyLabel}`
                    : `At risk · ${activity.recencyLabel}`}
                </span>
              )}
            </div>
            {activity.score > 0 && (
              <div className="flex flex-wrap gap-x-8 gap-y-3">
                {activity.lastActiveDate && (
                  <div>
                    <div className="field-label">Last Active</div>
                    <div className="text-body font-semibold text-foreground">{activity.lastActiveDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</div>
                    <div className={`text-micro font-medium mt-0.5 ${
                      activity.daysSinceActive !== null && activity.daysSinceActive <= 7 ? "text-orange-400"
                      : activity.daysSinceActive !== null && activity.daysSinceActive <= 30 ? "text-amber-400"
                      : activity.daysSinceActive !== null && activity.daysSinceActive <= 90 ? "text-blue-400"
                      : "text-destructive/60"
                    }`}>{activity.recencyLabel}</div>
                  </div>
                )}
                {activity.tutorialsCreated > 0 && (
                  <div>
                    <div className="field-label">Created</div>
                    <div className="text-body font-semibold tabular-nums text-foreground">{activity.tutorialsCreated}</div>
                    {activity.creatorSince && <div className="text-micro text-foreground/20">since {activity.creatorSince}</div>}
                  </div>
                )}
                {activity.tutorialsViewed > 0 && (
                  <div>
                    <div className="field-label">Viewed</div>
                    <div className="text-body font-semibold tabular-nums text-foreground">{activity.tutorialsViewed}</div>
                  </div>
                )}
                {activity.monthlyAnswers > 0 && (
                  <div>
                    <div className="field-label">This month</div>
                    <div className="text-body font-semibold tabular-nums text-foreground">{activity.monthlyAnswers}</div>
                  </div>
                )}
                {activity.hasExtension && (
                  <div>
                    <div className="field-label">Extension</div>
                    <div className="text-caption text-foreground/50">Installed</div>
                  </div>
                )}
                {activity.plan && (
                  <div>
                    <div className="field-label">Plan</div>
                    <div className="text-caption text-foreground/50">{activity.plan}</div>
                  </div>
                )}
              </div>
            )}
          </div>

          {(effectiveContact as any)?.contact_profile?.account_narrative && (
            <div>
              <div className="field-label mb-2">AI Profile</div>
              <p className="text-body text-foreground/60 leading-[1.7]">{(effectiveContact as any).contact_profile.account_narrative}</p>
            </div>
          )}

          {effectiveContact?.hubspot_properties && Object.keys(effectiveContact.hubspot_properties as Record<string, any>).length > 0 && (
            <details className="group">
              <summary className="text-micro text-foreground/20 hover:text-foreground/40 cursor-pointer transition-colors list-none flex items-center gap-1.5">
                <ChevronRight className="w-3 h-3 transition-transform group-open:rotate-90" />
                HubSpot data ({Object.entries(effectiveContact.hubspot_properties as Record<string, any>).filter(([_, v]) => v != null && v !== "").length} fields)
              </summary>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3 mt-4">
                {Object.entries(effectiveContact.hubspot_properties as Record<string, any>)
                  .filter(([_, v]) => v != null && v !== "" && v !== 0)
                  .filter(([k]) => !["rank"].includes(k))
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
          </div>
        </section>

        {/* ═══ SECTION 2: AI CONTEXT + GENERATE BRIEFING ═══ */}
        <section className="space-y-4">
          <div className="relative pl-4 border-l-[3px] border-primary/40 bg-primary/[0.03] rounded-r-lg py-4 pr-4 -ml-1">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-caption font-semibold text-foreground/70">AI Context</div>
                <p className="text-micro text-foreground/25 mt-0.5">
                  Fill in before generating — powers strategy, outreach &amp; story
                </p>
              </div>
              <span className={`text-micro transition-opacity duration-300 ${
                saveStatus === "saving" ? "text-foreground/40 opacity-100"
                : saveStatus === "saved" ? "text-success opacity-100"
                : "opacity-0"
              }`}>
                {saveStatus === "saving" ? "Saving…" : "✓ Saved"}
              </span>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-micro font-medium text-foreground/35 block mb-1">Role / Focus</label>
                <input
                  type="text"
                  value={localRoleFocus}
                  onChange={(e) => handleRoleFocusChange(e.target.value)}
                  onBlur={handleFieldBlur}
                  placeholder="e.g. Instructional Design, Training Ops"
                  className="w-full bg-transparent border border-border/30 rounded px-3 py-2 text-body text-foreground placeholder:text-foreground/15 placeholder:italic outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/10 transition-colors"
                />
              </div>
              <div>
                <label className="text-micro font-medium text-foreground/35 block mb-1">Notes</label>
                <textarea
                  value={localUserNotes}
                  onChange={(e) => handleUserNotesChange(e.target.value)}
                  onBlur={handleFieldBlur}
                  placeholder="Context that improves AI output — role details, priorities, recent conversations"
                  rows={3}
                  className="w-full bg-transparent border border-border/30 rounded px-3 py-2 text-body text-foreground placeholder:text-foreground/15 placeholder:italic outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/10 transition-colors resize-none leading-relaxed"
                />
              </div>
            </div>
          </div>

          {!hasStrategy && !generatingBriefing && briefingSteps.length === 0 && (
            <div className="pt-2">
              <Button variant="outline" onClick={generateBriefing} className="w-full gap-2">
                <Sparkles className="w-4 h-4" /> Generate Briefing
              </Button>
              <p className="text-micro text-foreground/15 text-center mt-2">Creates strategy & outreach based on the context above</p>
            </div>
          )}

          {briefingSteps.length > 0 && (
            <div className="space-y-2.5 pt-2">
              {briefingSteps.map((step, i) => (
                <div key={i} className="flex items-center gap-2.5">
                  {step.status === "pending" && <div className="w-3.5 h-3.5 rounded-full border border-border/40 shrink-0" />}
                  {step.status === "running" && <Loader2 className="w-3.5 h-3.5 animate-spin text-primary shrink-0" />}
                  {step.status === "done" && <CheckCircle2 className="w-3.5 h-3.5 text-success shrink-0" />}
                  {step.status === "failed" && <AlertCircle className="w-3.5 h-3.5 text-destructive/50 shrink-0" />}
                  <span className={`text-caption ${
                    step.status === "running" ? "text-foreground/60"
                    : step.status === "done" ? "text-foreground/30"
                    : step.status === "failed" ? "text-destructive/40"
                    : "text-foreground/20"
                  }`}>{step.label}</span>
                </div>
              ))}
            </div>
          )}

          {hasStrategy && !generatingBriefing && (
            <button onClick={generateBriefing} className="text-micro text-foreground/15 hover:text-foreground/40 transition-colors">
              Regenerate briefing
            </button>
          )}
        </section>

        {/* ═══ SECTION 3: STRATEGY ═══ */}
        {hasStrategy && (
          <section id="section-strategy" className="scroll-mt-32">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-title font-semibold text-foreground">Strategy</h2>
            </div>
            <StrategyTab contactName={firstName} cardsLoading={cardsLoading} isInboundStrategyResponse={isInboundStrategyResponse} inboundStrategyData={inboundStrategyData} inboundStrategyFields={inboundStrategyFields} cards={cards} regeneratingSection={regeneratingSection} ensureRunning={ensureRunning} onRegenerate={() => onRegenerateSection("strategy")} />
          </section>
        )}

        {/* ═══ SECTION 4: OUTREACH ═══ */}
        {hasOutreach && (
          <section id="section-outreach" className="scroll-mt-32">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-title font-semibold text-foreground">Outreach</h2>
            </div>
            <OutreachTab contactName={firstName} cardsLoading={cardsLoading} rawAccountJson={rawAccountJson} emailSequence={assets.email_sequence} linkedinSequence={assets.linkedin_sequence} regeneratingSection={regeneratingSection} ensureRunning={ensureRunning} onRegenerate={() => onRegenerateSection("outreach")} />
          </section>
        )}

        {/* ═══ SECTION 5: STORY TIME ═══ */}
        {hasStrategy && (
          <section id="section-story" className="scroll-mt-32">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-title font-semibold text-foreground">Story</h2>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className="field-label block mb-1.5">Loom Video</label>
                  <input type="text" value={effectiveLoomUrl} onChange={(e) => handleLoomUrlChange(e.target.value)} placeholder="https://www.loom.com/share/..." className="field-editable" />
                  <p className="text-micro text-foreground/15 mt-1">Embeds at top of story page</p>
                </div>
                <div>
                  <label className="field-label block mb-1.5">iorad Tutorial</label>
                  <input type="text" value={effectiveIoradUrl} onChange={(e) => handleIoradUrlChange(e.target.value)} placeholder="https://ior.ad/..." className="field-editable" />
                  <p className="text-micro text-foreground/15 mt-1">Replaces default tutorial embed</p>
                </div>
              </div>

              {(loomEmbedUrl || ioradEmbedUrl) && (
                <div className="space-y-4">
                  {loomEmbedUrl && (
                    <div className="rounded-lg overflow-hidden border border-border/20">
                      <iframe src={loomEmbedUrl} width="100%" height="360" frameBorder="0" allowFullScreen allow="autoplay; fullscreen" title="Loom preview" />
                    </div>
                  )}
                  {ioradEmbedUrl && (
                    <div className="rounded-lg overflow-hidden border border-border/20">
                      <iframe src={ioradEmbedUrl} width="100%" height="400" frameBorder="0" allowFullScreen allow="camera; microphone; clipboard-write" sandbox="allow-scripts allow-forms allow-same-origin allow-presentation allow-downloads allow-modals allow-popups allow-popups-to-escape-sandbox allow-top-navigation allow-top-navigation-by-user-activation" title="iorad preview" />
                    </div>
                  )}
                </div>
              )}

              {!hasStory ? (
                <div className="py-6 text-center">
                  <p className="text-caption text-foreground/25 mb-4">Strategy & outreach are ready. Generate a story built on the strategic angle.</p>
                  <Button onClick={onGenerateStory} disabled={generatingStory} variant="outline" className="gap-2">
                    {generatingStory
                      ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating Story…</>
                      : <><Sparkles className="w-4 h-4" /> Generate Story</>}
                  </Button>
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="field-label">Story</div>
                    <div className="flex items-center gap-3">
                      {storyUrl && (
                        <a href={storyUrl} target="_blank" rel="noopener noreferrer">
                          <Button size="sm" variant="outline" className="gap-1.5 text-micro">
                            <ExternalLink className="w-3 h-3" /> View Story
                          </Button>
                        </a>
                      )}
                      <button onClick={onGenerateStory} disabled={generatingStory} className="text-micro text-foreground/15 hover:text-foreground/40 transition-colors">
                        {generatingStory ? "Regenerating…" : "Regenerate"}
                      </button>
                    </div>
                  </div>
                  <StoryTab contactName={firstName} isInboundStoryResponse={isInboundStoryResponse} rawAccountJson={rawAccountJson} storyBaseUrl={storyUrl} loomUrl={effectiveLoomUrl} ioradUrl={effectiveIoradUrl} loomEmbedUrl={loomEmbedUrl} ioradEmbedUrl={ioradEmbedUrl} onLoomUrlChange={() => {}} onIoradUrlChange={() => {}} regeneratingSection={regeneratingSection} ensureRunning={ensureRunning} onRegenerate={() => onRegenerateSection("story")} />
                </div>
              )}
            </div>
          </section>
        )}
      </div>

      <Dialog open={addContactOpen} onOpenChange={onSetAddContactOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Contact</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Name *</Label><Input value={newContact.name} onChange={e => onSetNewContact((p: any) => ({ ...p, name: e.target.value }))} placeholder="Jane Smith" /></div>
            <div><Label>Title</Label><Input value={newContact.title} onChange={e => onSetNewContact((p: any) => ({ ...p, title: e.target.value }))} placeholder="VP Customer Success" /></div>
            <div><Label>Email</Label><Input value={newContact.email} onChange={e => onSetNewContact((p: any) => ({ ...p, email: e.target.value }))} placeholder="jane@company.com" /></div>
            <div><Label>LinkedIn URL</Label><Input value={newContact.linkedin} onChange={e => onSetNewContact((p: any) => ({ ...p, linkedin: e.target.value }))} placeholder="https://linkedin.com/in/..." /></div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="ghost" onClick={() => onSetAddContactOpen(false)}>Cancel</Button>
              <Button onClick={onAddContact} disabled={savingContact || !newContact.name.trim()}>
                {savingContact ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Add Contact
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteContactId} onOpenChange={(open) => !open && onSetDeleteContactId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete contact?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently remove the contact.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={onConfirmDelete} disabled={deletingContact}>
              {deletingContact ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
