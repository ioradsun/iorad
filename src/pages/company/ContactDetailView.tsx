import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Save, UserSearch } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Json } from "@/integrations/supabase/types";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
          {editingContactId === effectiveContact.id && (
            <div className="space-y-3 mb-4">
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

          {(effectiveContact as any)?.contact_profile?.account_narrative && (
            <p className="text-caption text-foreground/40 leading-relaxed italic max-w-2xl mb-4">
              {(effectiveContact as any).contact_profile.account_narrative}
            </p>
          )}

          {/* Sub-tabs: Strategy / Outreach / Story */}
          <Tabs defaultValue="strategy" className="mt-6">
            <TabsList className="bg-transparent p-0 h-auto border-b border-border/20 w-full justify-start gap-0 rounded-none">
              <TabsTrigger
                value="strategy"
                className="px-4 py-2 text-caption font-medium rounded-none border-b-2 border-transparent data-[state=active]:border-foreground data-[state=active]:text-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none text-foreground/35 hover:text-foreground/50"
              >
                Strategy
              </TabsTrigger>
              <TabsTrigger
                value="outreach"
                className="px-4 py-2 text-caption font-medium rounded-none border-b-2 border-transparent data-[state=active]:border-foreground data-[state=active]:text-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none text-foreground/35 hover:text-foreground/50"
              >
                Outreach
              </TabsTrigger>
              <TabsTrigger
                value="story"
                className="px-4 py-2 text-caption font-medium rounded-none border-b-2 border-transparent data-[state=active]:border-foreground data-[state=active]:text-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none text-foreground/35 hover:text-foreground/50"
              >
                Story
              </TabsTrigger>
            </TabsList>

            <TabsContent value="strategy" className="mt-4">
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
            </TabsContent>

            <TabsContent value="outreach" className="mt-4">
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
            </TabsContent>

            <TabsContent value="story" className="mt-4">
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
            </TabsContent>
          </Tabs>
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