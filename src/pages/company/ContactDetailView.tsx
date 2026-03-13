import { useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Linkedin, Loader2, Pencil, Plus, Save, Sparkles, Trash2, UserSearch, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Json } from "@/integrations/supabase/types";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import OutreachTab from "./OutreachTab";
import StoryTab from "./StoryTab";
import StrategyTab from "./StrategyTab";
import { parseJson, toIoradEmbedUrl, toLoomEmbedUrl } from "./types";
import type { DashboardCard, EmailTouch, LinkedInStep, StoryAssets } from "./types";

interface ContactDetailViewProps {
  companyId: string;
  company: any;
  companyNameSlug: string;
  isPartnerCategory: boolean;
  contacts: any[];
  selectedContactId: string;
  editingContactId: string | null;
  editRoleFocus: string;
  editUserNotes: string;
  onSetEditingContactId: (id: string | null) => void;
  onSetEditRoleFocus: (val: string) => void;
  onSetEditUserNotes: (val: string) => void;
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
  generatingContactId: string | null;
  onGenerateForContact: (contactId: string) => void;
  setupRunning: boolean;
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
  editingContactId,
  editRoleFocus,
  editUserNotes,
  onSetEditingContactId,
  onSetEditRoleFocus,
  onSetEditUserNotes,
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
  generatingContactId,
  onGenerateForContact,
  setupRunning,
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

  const ioradActivity = useMemo(() => {
    if (!effectiveContact) return null;
    const hp = (effectiveContact.hubspot_properties as any) || {};
    return {
      isCreator: !!hp.first_tutorial_create_date,
      isViewer: !!(hp.first_tutorial_view_date || hp.first_tutorial_learn_date),
      hasExtension: parseInt(hp.extension_connections || "0", 10) > 0,
      monthAnswers: parseInt(hp.answers_with_own_tutorial_month_count || "0", 10) || 0,
      rank: hp.rank,
      engagement: hp.engagement_segment,
    };
  }, [effectiveContact]);

  if (!contacts.length) {
    return (
      <>
        <div className="text-center py-16">
          <UserSearch className="w-10 h-10 text-foreground/15 mx-auto mb-4" />
          <p className="text-body text-foreground/45 mb-2">No contacts yet</p>
          <p className="text-caption text-foreground/25 mb-4">Add a contact manually or sync from HubSpot to get started.</p>
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
      {effectiveContact && (
        <>
          <div className="group/contact">
            <div className="flex items-baseline justify-between gap-4">
              <div className="flex items-baseline gap-3">
                <h2 className="text-title font-semibold">{effectiveContact.name}</h2>
              </div>

              <div className="flex items-center gap-1 opacity-0 group-hover/contact:opacity-100 transition-opacity">
                <button
                  onClick={() => {
                    if (editingContactId === effectiveContact.id) {
                      onSetEditingContactId(null);
                      return;
                    }
                    onSetEditingContactId(effectiveContact.id);
                    onSetEditRoleFocus((effectiveContact as any).role_focus || "");
                    onSetEditUserNotes((effectiveContact as any).user_notes || "");
                  }}
                  className="p-1.5 rounded text-foreground/25 hover:text-foreground hover:bg-secondary transition-colors"
                  title="Edit"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => onSetDeleteContactId(effectiveContact.id)}
                  className="p-1.5 rounded text-foreground/25 hover:text-destructive hover:bg-destructive/10 transition-colors"
                  title="Delete"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {effectiveContact.title && (
              <p className="text-body text-foreground/65 mt-0.5">{effectiveContact.title}</p>
            )}

            <div className="flex items-center gap-3 mt-1 text-caption text-foreground/45">
              {effectiveContact.email && (
                <a href={`mailto:${effectiveContact.email}`} className="hover:text-primary transition-colors">
                  {effectiveContact.email}
                </a>
              )}
              {effectiveContact.linkedin && (
                <a href={effectiveContact.linkedin} target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors flex items-center gap-1">
                  <Linkedin className="w-3 h-3" /> LinkedIn
                </a>
              )}
              {(effectiveContact as any).role_focus && (
                <>
                  <span className="text-foreground/15">·</span>
                  <span className="text-primary/70">{(effectiveContact as any).role_focus}</span>
                </>
              )}
            </div>

            {ioradActivity && (
              <div className="flex flex-wrap items-center gap-1.5 mt-2 text-micro">
                {ioradActivity.isCreator && <span className="px-2 py-0.5 rounded-full bg-primary/12 text-primary">Creator</span>}
                {ioradActivity.isViewer && <span className="px-2 py-0.5 rounded-full bg-secondary text-foreground/70">Viewer</span>}
                {ioradActivity.hasExtension && <span className="px-2 py-0.5 rounded-full bg-secondary text-foreground/70">Extension</span>}
                {ioradActivity.monthAnswers > 0 && <span className="px-2 py-0.5 rounded-full bg-secondary text-foreground/70">{ioradActivity.monthAnswers} answers/mo</span>}
              </div>
            )}

            {(effectiveContact as any)?.contact_profile?.key_metrics && (
              <div className="flex items-center gap-3 mt-2 text-caption text-foreground/45">
                {(effectiveContact as any).contact_profile.key_metrics.tutorials_created !== undefined && <span>{(effectiveContact as any).contact_profile.key_metrics.tutorials_created} created</span>}
                {(effectiveContact as any).contact_profile.key_metrics.tutorials_viewed !== undefined && <span>{(effectiveContact as any).contact_profile.key_metrics.tutorials_viewed} viewed</span>}
              </div>
            )}

            {(effectiveContact as any)?.contact_profile?.account_narrative && (
              <p className="text-caption text-foreground/45 leading-relaxed mt-3 max-w-2xl italic">
                {(effectiveContact as any).contact_profile.account_narrative}
              </p>
            )}
          </div>

          {editingContactId === effectiveContact.id && (
            <div className="mt-4 pt-4 border-t border-border/20 space-y-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Role / Focus Area</Label>
                  <Input placeholder="e.g. Instructional Design" value={editRoleFocus} onChange={(e) => onSetEditRoleFocus(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Notes for AI</Label>
                  <Textarea value={editUserNotes} onChange={(e) => onSetEditUserNotes(e.target.value)} rows={3} className="mt-1" />
                </div>
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="ghost" onClick={() => onSetEditingContactId(null)}>Cancel</Button>
                  <Button
                    size="sm"
                    className="gap-1"
                    onClick={async () => {
                      const { error } = await supabase.from("contacts").update({ role_focus: editRoleFocus || null, user_notes: editUserNotes || null }).eq("id", effectiveContact.id);
                      if (error) {
                        toast.error("Failed to save");
                        return;
                      }
                      toast.success("Contact updated");
                      queryClient.invalidateQueries({ queryKey: ["contacts", companyId] });
                      onSetEditingContactId(null);
                    }}
                  >
                    <Save className="w-3.5 h-3.5" /> Save
                  </Button>
                </div>
            </div>
          )}

          <div className="flex items-center gap-3 py-5 mt-2 border-t border-border/20">
            <Button className="gap-2" onClick={() => onGenerateForContact(effectiveContact.id)} disabled={!!generatingContactId || setupRunning}>
              {generatingContactId === effectiveContact.id
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</>
                : <><Sparkles className="w-4 h-4" /> Generate for {firstName}</>}
            </Button>

            {storyUrl && (
              <a href={storyUrl} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" className="gap-2">
                  <ExternalLink className="w-4 h-4" /> View {firstName}'s Story
                </Button>
              </a>
            )}
          </div>

          <Collapsible defaultOpen>
            <CollapsibleTrigger className="flex items-center gap-2 w-full py-3 group/trigger">
              <ChevronRight className="w-3.5 h-3.5 text-foreground/15 transition-transform data-[state=open]:rotate-90 group-hover/trigger:text-foreground/45" />
              <span className="text-caption font-medium text-foreground/45 group-hover/trigger:text-foreground transition-colors">Strategy</span>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <StrategyTab
                contactName={firstName}
                cardsLoading={cardsLoading}
                isInboundStrategyResponse={isInboundStrategyResponse}
                inboundStrategyData={inboundStrategyData}
                inboundStrategyFields={inboundStrategyFields}
                cards={cards}
                regeneratingSection={regeneratingSection}
                setupRunning={setupRunning}
                onRegenerate={() => onRegenerateSection("strategy")}
              />
            </CollapsibleContent>
          </Collapsible>

          <Collapsible>
            <CollapsibleTrigger className="flex items-center gap-2 w-full py-3 group/trigger">
              <ChevronRight className="w-3.5 h-3.5 text-foreground/15 transition-transform data-[state=open]:rotate-90 group-hover/trigger:text-foreground/45" />
              <span className="text-caption font-medium text-foreground/45 group-hover/trigger:text-foreground transition-colors">Outreach</span>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <OutreachTab
                contactName={firstName}
                cardsLoading={cardsLoading}
                rawAccountJson={rawAccountJson}
                emailSequence={assets.email_sequence}
                linkedinSequence={assets.linkedin_sequence}
                regeneratingSection={regeneratingSection}
                setupRunning={setupRunning}
                onRegenerate={() => onRegenerateSection("outreach")}
              />
            </CollapsibleContent>
          </Collapsible>

          <Collapsible>
            <CollapsibleTrigger className="flex items-center gap-2 w-full py-3 group/trigger">
              <ChevronRight className="w-3.5 h-3.5 text-foreground/15 transition-transform data-[state=open]:rotate-90 group-hover/trigger:text-foreground/45" />
              <span className="text-caption font-medium text-foreground/45 group-hover/trigger:text-foreground transition-colors">Story</span>
            </CollapsibleTrigger>
            <CollapsibleContent>
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
                setupRunning={setupRunning}
                onRegenerate={() => onRegenerateSection("story")}
              />
            </CollapsibleContent>
          </Collapsible>
        </>
      )}

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
