import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronRight, Linkedin, Loader2, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Json } from "@/integrations/supabase/types";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

  if (!contacts.length) {
    return (
      <>
        <div className="text-center py-16">
          <p className="text-body text-foreground/40 mb-1">No contacts yet</p>
          <p className="text-caption text-foreground/20 mb-4">
            Add a contact manually or sync from HubSpot.
          </p>
          <Button onClick={() => onSetAddContactOpen(true)} className="gap-2">
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
      <Tabs defaultValue="about" className="w-full">
        <TabsList className="bg-transparent p-0 h-auto border-b border-border/15 w-full justify-start gap-0 rounded-none mb-6">
          {["about", "strategy", "outreach", "story"].map(tab => (
            <TabsTrigger
              key={tab}
              value={tab}
              className="px-4 py-2.5 text-caption font-medium rounded-none border-b-2 border-transparent data-[state=active]:border-foreground data-[state=active]:text-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none text-foreground/30 hover:text-foreground/50 transition-colors capitalize"
            >
              {tab}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="about" className="mt-0">
          <div className="max-w-2xl space-y-8">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-8 gap-y-5">
              <div>
                <label className="field-label block mb-1">First Name</label>
                <input
                  type="text"
                  value={localFirstName}
                  onChange={(e) => handleFirstNameChange(e.target.value)}
                  onBlur={handleFieldBlur}
                  placeholder="First"
                  className="w-full bg-transparent border-0 border-b border-border/30 focus:border-primary/60 outline-none text-body text-foreground placeholder:text-foreground/25 pb-1.5 transition-colors"
                />
              </div>
              <div>
                <label className="field-label block mb-1">Last Name</label>
                <input
                  type="text"
                  value={localLastName}
                  onChange={(e) => handleLastNameChange(e.target.value)}
                  onBlur={handleFieldBlur}
                  placeholder="Last"
                  className="w-full bg-transparent border-0 border-b border-border/30 focus:border-primary/60 outline-none text-body text-foreground placeholder:text-foreground/25 pb-1.5 transition-colors"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-8 gap-y-5">
              <div>
                <div className="field-label">Email</div>
                {effectiveContact?.email ? (
                  <a href={`mailto:${effectiveContact.email}`} className="text-body text-foreground/80 hover:text-primary transition-colors">
                    {effectiveContact.email}
                  </a>
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

            {/* ── Activity ── */}
            <div className="space-y-4">
              {/* Score + Recency */}
              <div className="flex items-center gap-4">
                {activity.score > 0 ? (
                  <div className="flex items-baseline gap-1.5">
                    <span className={`text-display font-semibold tabular-nums ${
                      activity.tier === "hot" ? "text-orange-400"
                      : activity.tier === "warm" ? "text-amber-400"
                      : activity.tier === "cool" ? "text-blue-400"
                      : "text-foreground/30"
                    }`}>
                      {activity.score}
                    </span>
                    <span className="text-micro text-foreground/15">/100</span>
                  </div>
                ) : (
                  <span className="text-caption text-foreground/20 italic">No iorad activity</span>
                )}

                {activity.daysSinceActive !== null && (
                  <span className={`text-micro font-medium px-2 py-0.5 rounded ${
                    activity.daysSinceActive <= 7
                      ? "bg-success/10 text-success"
                      : activity.daysSinceActive <= 30
                      ? "bg-primary/10 text-primary/70"
                      : activity.daysSinceActive <= 90
                      ? "bg-foreground/[0.05] text-foreground/35"
                      : "bg-destructive/8 text-destructive/60"
                  }`}>
                    {activity.daysSinceActive <= 7 ? "Active now"
                      : activity.daysSinceActive <= 30 ? `${activity.recencyLabel}`
                      : activity.daysSinceActive <= 90 ? `Cooling · ${activity.recencyLabel}`
                      : `At risk · ${activity.recencyLabel}`}
                  </span>
                )}
              </div>

              {/* Metrics grid — only show fields with data */}
              {activity.score > 0 && (
                <div className="flex flex-wrap gap-x-8 gap-y-3">
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
                      {activity.viewerSince && <div className="text-micro text-foreground/20">since {activity.viewerSince}</div>}
                    </div>
                  )}
                  {activity.monthlyAnswers > 0 && (
                    <div>
                      <div className="field-label">This month</div>
                      <div className="text-body font-semibold tabular-nums text-foreground">{activity.monthlyAnswers}</div>
                    </div>
                  )}
                  {activity.prevMonthAnswers > 0 && (
                    <div>
                      <div className="field-label">Last month</div>
                      <div className="text-body font-semibold tabular-nums text-foreground">{activity.prevMonthAnswers}</div>
                    </div>
                  )}
                  {activity.totalAnswers > 0 && (
                    <div>
                      <div className="field-label">All time</div>
                      <div className="text-body font-semibold tabular-nums text-foreground">{activity.totalAnswers}</div>
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
                  {activity.documentingProduct && (
                    <div>
                      <div className="field-label">Documenting</div>
                      <div className="text-caption text-foreground/50">{activity.documentingProduct}</div>
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

            <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/40 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-body font-semibold text-amber-900 dark:text-amber-200">Context for AI</h3>
                  <p className="text-micro text-amber-700/70 dark:text-amber-400/60 mt-0.5">Add details here before generating Strategy, Outreach & Story tabs</p>
                </div>
                <span className={`text-micro transition-opacity duration-300 ${
                  saveStatus === "saving" ? "text-amber-600/60 dark:text-amber-400/50 opacity-100"
                  : saveStatus === "saved" ? "text-emerald-600 dark:text-emerald-400 opacity-100"
                  : "opacity-0"
                }`}>
                  {saveStatus === "saving" ? "Saving…" : saveStatus === "saved" ? "✓ Saved" : ""}
                </span>
              </div>
              <div>
                <label className="text-caption font-semibold text-amber-900/80 dark:text-amber-200/80 block mb-1.5">Role / Focus Area</label>
                <input
                  type="text"
                  value={localRoleFocus}
                  onChange={(e) => handleRoleFocusChange(e.target.value)}
                  onBlur={handleFieldBlur}
                  placeholder="e.g. Instructional Design, Training Operations"
                  className="w-full bg-white/60 dark:bg-white/5 border border-amber-200/80 dark:border-amber-700/40 rounded-lg px-3 py-2 text-body text-foreground placeholder:text-foreground/30 outline-none focus:ring-2 focus:ring-amber-300/50 dark:focus:ring-amber-600/40 focus:border-amber-300 dark:focus:border-amber-600 transition-all"
                />
              </div>
              <div>
                <label className="text-caption font-semibold text-amber-900/80 dark:text-amber-200/80 block mb-1.5">Notes</label>
                <textarea
                  value={localUserNotes}
                  onChange={(e) => handleUserNotesChange(e.target.value)}
                  onBlur={handleFieldBlur}
                  placeholder="Any context that helps generate better content — e.g. 'Recently promoted, scaling onboarding across 12 offices, prefers direct communication'"
                  rows={3}
                  className="w-full bg-white/60 dark:bg-white/5 border border-amber-200/80 dark:border-amber-700/40 rounded-lg px-3 py-2 text-body text-foreground placeholder:text-foreground/30 outline-none focus:ring-2 focus:ring-amber-300/50 dark:focus:ring-amber-600/40 focus:border-amber-300 dark:focus:border-amber-600 transition-all resize-none leading-[1.7]"
                />
              </div>
            </div>

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
        </TabsContent>

        <TabsContent value="strategy" className="mt-0">
          <StrategyTab
            contactName={firstName}
            cardsLoading={cardsLoading}
            isInboundStrategyResponse={isInboundStrategyResponse}
            inboundStrategyData={inboundStrategyData}
            inboundStrategyFields={inboundStrategyFields}
            cards={cards}
            regeneratingSection={regeneratingSection}
            ensureRunning={ensureRunning}
            onRegenerate={() => onRegenerateSection("strategy")}
          />
        </TabsContent>

        <TabsContent value="outreach" className="mt-0">
          <OutreachTab
            contactName={firstName}
            cardsLoading={cardsLoading}
            rawAccountJson={rawAccountJson}
            emailSequence={assets.email_sequence}
            linkedinSequence={assets.linkedin_sequence}
            regeneratingSection={regeneratingSection}
            ensureRunning={ensureRunning}
            onRegenerate={() => onRegenerateSection("outreach")}
          />
        </TabsContent>

        <TabsContent value="story" className="mt-0">
          <StoryTab
            contactName={firstName}
            isInboundStoryResponse={isInboundStoryResponse}
            rawAccountJson={rawAccountJson}
            storyBaseUrl={storyUrl}
            loomUrl={effectiveLoomUrl}
            ioradUrl={effectiveIoradUrl}
            loomEmbedUrl={loomEmbedUrl}
            ioradEmbedUrl={ioradEmbedUrl}
            onLoomUrlChange={() => {}}
            onIoradUrlChange={() => {}}
            regeneratingSection={regeneratingSection}
            ensureRunning={ensureRunning}
            onRegenerate={() => onRegenerateSection("story")}
          />
        </TabsContent>
      </Tabs>

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
            <AlertDialogDescription>This will permanently remove the contact. This action cannot be undone.</AlertDialogDescription>
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
