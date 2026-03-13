import { useQueryClient } from "@tanstack/react-query";
import { BookOpen, ExternalLink, Eye, Linkedin, Loader2, Mail, Pencil, Plus, Sparkles, Trash2, UserSearch, Zap, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface ContactsSectionProps {
  companyId: string;
  contacts: any[];
  snapshots: any[];
  company: any;
  isPartnerCategory: boolean;
  companyNameSlug: string;
  findingContacts: boolean;
  generatingContactId: string | null;
  editingContactId: string | null;
  editRoleFocus: string;
  editUserNotes: string;
  onSetEditingContactId: (id: string | null) => void;
  onSetEditRoleFocus: (val: string) => void;
  onSetEditUserNotes: (val: string) => void;
  onGenerateForContact: (contactId: string) => void;
  onDeleteContact: (contactId: string) => void;
  addContactOpen: boolean;
  onSetAddContactOpen: (open: boolean) => void;
  newContact: { name: string; title: string; email: string; linkedin: string };
  onSetNewContact: (updater: (prev: any) => any) => void;
  onAddContact: () => void;
  savingContact: boolean;
  contactSearch: string;
  onSetContactSearch: (val: string) => void;
  onRegenerateContacts: () => void;
  regeneratingSection: string | null;
  ensureRunning: boolean;
  deleteContactId: string | null;
  onSetDeleteContactId: (id: string | null) => void;
  deletingContact: boolean;
  onConfirmDelete: () => void;
}

export default function ContactsSection({
  companyId,
  contacts,
  snapshots,
  company,
  isPartnerCategory,
  companyNameSlug,
  findingContacts,
  generatingContactId,
  editingContactId,
  editRoleFocus,
  editUserNotes,
  onSetEditingContactId,
  onSetEditRoleFocus,
  onSetEditUserNotes,
  onGenerateForContact,
  onDeleteContact,
  addContactOpen,
  onSetAddContactOpen,
  newContact,
  onSetNewContact,
  onAddContact,
  savingContact,
  contactSearch,
  onSetContactSearch,
  onRegenerateContacts,
  regeneratingSection,
  ensureRunning,
  deleteContactId,
  onSetDeleteContactId,
  deletingContact,
  onConfirmDelete,
}: ContactsSectionProps) {
  const queryClient = useQueryClient();
  const companyAny = company as any;

  const filteredContacts = contacts
    .filter((c) => {
      if (c.email?.toLowerCase().includes("student")) return false;
      if (!contactSearch) return true;
      const q = contactSearch.toLowerCase();
      return c.name?.toLowerCase().includes(q) || c.title?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q);
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
    if (rank > 0) return { label: "Low", cls: "bg-muted text-muted-foreground border-border/40" };
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
    <>
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
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={onRegenerateContacts}
                disabled={regeneratingSection === "contacts" || ensureRunning}
              >
                {(regeneratingSection === "contacts" || ensureRunning) ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                Find Contacts
              </Button>
            )}
            <Dialog open={addContactOpen} onOpenChange={onSetAddContactOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="ghost" className="gap-1 text-xs h-7"><Plus className="w-3.5 h-3.5" /> Add</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Add Contact</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div><Label>Name *</Label><Input value={newContact.name} onChange={e => onSetNewContact(p => ({ ...p, name: e.target.value }))} placeholder="Jane Smith" /></div>
                  <div><Label>Title</Label><Input value={newContact.title} onChange={e => onSetNewContact(p => ({ ...p, title: e.target.value }))} placeholder="VP of Learning" /></div>
                  <div><Label>Email</Label><Input type="email" value={newContact.email} onChange={e => onSetNewContact(p => ({ ...p, email: e.target.value }))} placeholder="jane@company.com" /></div>
                  <div><Label>LinkedIn</Label><Input value={newContact.linkedin} onChange={e => onSetNewContact(p => ({ ...p, linkedin: e.target.value }))} placeholder="https://linkedin.com/in/..." /></div>
                  <Button onClick={onAddContact} disabled={!newContact.name.trim() || savingContact} className="w-full">
                    {savingContact ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Looking up…</> : (!newContact.email.trim() && !newContact.linkedin.trim()) ? "Add & Enrich via Apollo" : "Add Contact"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {contacts.filter((c: any) => !c.email?.toLowerCase().includes("student")).length > 0 && (
          <div className="px-4 pb-3">
            <Input placeholder="Search contacts…" value={contactSearch} onChange={e => onSetContactSearch(e.target.value)} className="h-7 text-xs" />
          </div>
        )}

        <div className="px-4 pb-4">
          {contacts.filter((c: any) => !c.email?.toLowerCase().includes("student")).length > 0 ? (
            <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollSnapType: "x mandatory" }}>
              {filteredContacts.map((contact) => {
                const firstName = contact.name.split(" ")[0].toLowerCase().replace(/[^a-z]/g, "");
                const storyUrl = isPartnerCategory && company.partner
                  ? `/${company.partner}/${companyNameSlug}/stories/${firstName}`
                  : `/stories/${companyNameSlug}/${firstName}`;

                const profile = (contact as any).contact_profile as any;
                const isGenerating = generatingContactId === contact.id;
                const rankBadge = getRankBadge(contact);
                const ioradActivity = getIoradActivity(contact);
                const hasSnap = snapshots.length > 0;

                return (
                  <div key={contact.id} className="border border-border/50 rounded-lg bg-secondary/20 hover:bg-secondary/30 transition-colors flex flex-col flex-shrink-0 w-72" style={{ scrollSnapAlign: "start" }}>
                    <div className="p-3 flex flex-col gap-2 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                          {rankBadge && <span className={`text-[10px] px-1.5 py-0.5 rounded border font-semibold w-fit mb-0.5 ${rankBadge.cls}`}>{rankBadge.label}</span>}
                          <div className="text-[14px] font-semibold leading-tight">{contact.name}</div>
                          {contact.title && <div className="text-[12px] text-muted-foreground leading-snug">{contact.title}</div>}
                          {(contact as any).role_focus && <div className="text-[11px] text-primary/70 leading-snug">{(contact as any).role_focus}</div>}
                          {contact.email && (
                            <a href={`mailto:${contact.email}`} className="text-[11px] text-muted-foreground hover:text-primary flex items-center gap-1 truncate" title={contact.email}>
                              <Mail className="w-3 h-3 flex-shrink-0" /><span className="truncate">{contact.email}</span>
                            </a>
                          )}
                        </div>
                        <div className="flex items-center gap-0.5 flex-shrink-0">
                          {contact.linkedin && <a href={contact.linkedin} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary p-1" title="LinkedIn"><Linkedin className="w-3.5 h-3.5" /></a>}
                          {storyUrl && hasSnap && <a href={storyUrl} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary p-1" title="View story"><ExternalLink className="w-3.5 h-3.5" /></a>}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-primary"
                            title="Edit contact context"
                            onClick={() => {
                              onSetEditingContactId(editingContactId === contact.id ? null : contact.id);
                              onSetEditRoleFocus((contact as any).role_focus || "");
                              onSetEditUserNotes((contact as any).user_notes || "");
                            }}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive" title="Delete contact" onClick={() => onDeleteContact(contact.id)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>

                      {(ioradActivity.isCreator || ioradActivity.isViewer || ioradActivity.hasExtension || ioradActivity.monthAnswers > 0) && (
                        <div className="flex flex-wrap gap-1">
                          {ioradActivity.isCreator && <span className="text-[10px] px-1.5 py-0.5 rounded border border-primary/30 bg-primary/10 text-primary font-medium flex items-center gap-0.5" title="Has created tutorials"><BookOpen className="w-2.5 h-2.5" /> Creator</span>}
                          {ioradActivity.isViewer && !ioradActivity.isCreator && <span className="text-[10px] px-1.5 py-0.5 rounded border border-info/30 bg-info/10 text-info font-medium flex items-center gap-0.5" title="Has viewed tutorials"><Eye className="w-2.5 h-2.5" /> Viewer</span>}
                          {ioradActivity.monthAnswers > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded border border-warning/30 bg-warning/10 text-warning font-medium" title={`${ioradActivity.monthAnswers} answers this month`}>{ioradActivity.monthAnswers} ans/mo</span>}
                          {ioradActivity.hasExtension && <span className="text-[10px] px-1.5 py-0.5 rounded border border-border/40 bg-secondary text-muted-foreground font-medium flex items-center gap-0.5" title="Extension connected"><Zap className="w-2.5 h-2.5" /> Ext</span>}
                        </div>
                      )}

                      {profile?.key_metrics && (
                        <div className="flex gap-2 text-[10px] text-muted-foreground">
                          {profile.key_metrics.tutorials_created != null && <span title="Tutorials created"><span className="font-semibold text-foreground">{profile.key_metrics.tutorials_created}</span> created</span>}
                          {profile.key_metrics.tutorials_viewed != null && <span title="Tutorials viewed"><span className="font-semibold text-foreground">{profile.key_metrics.tutorials_viewed}</span> viewed</span>}
                          {profile.key_metrics.plan && <span className="ml-auto text-[10px] px-1.5 py-0 rounded bg-secondary text-muted-foreground">{profile.key_metrics.plan}</span>}
                        </div>
                      )}

                      <div className="mt-1 pt-2 border-t border-border/40 flex-1">
                        {profile?.account_narrative ? <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-4">{profile.account_narrative}</p> : isGenerating ? <p className="text-[11px] text-muted-foreground/50 italic flex items-center gap-1.5"><Loader2 className="w-3 h-3 animate-spin inline" /> Generating summary…</p> : <p className="text-[11px] text-muted-foreground/50 italic">No AI summary yet</p>}
                      </div>

                      <Button
                        size="sm"
                        className="w-full gap-1.5 text-micro mt-2"
                        variant={isGenerating ? "secondary" : "default"}
                        onClick={() => onGenerateForContact(contact.id)}
                        disabled={isGenerating || !!generatingContactId || ensureRunning}
                      >
                        {isGenerating
                          ? <><Loader2 className="w-3 h-3 animate-spin" /> Generating…</>
                          : <><Sparkles className="w-3 h-3" /> Generate for {contact.name.split(" ")[0]}</>}
                      </Button>

                      {editingContactId === contact.id && (
                        <div className="mt-2 pt-2 border-t border-border/40 space-y-2">
                          <div>
                            <Label className="text-[11px] text-muted-foreground">Role / Focus Area</Label>
                            <Input placeholder="e.g. Instructional Design, Sales Enablement" value={editRoleFocus} onChange={(e) => onSetEditRoleFocus(e.target.value)} className="mt-1 h-8 text-xs" />
                          </div>
                          <div>
                            <Label className="text-[11px] text-muted-foreground">Notes for AI</Label>
                            <Textarea placeholder="Anything that should shape strategy & outreach — budget holder, met at conference, already trialing, reports to CTO..." value={editUserNotes} onChange={(e) => onSetEditUserNotes(e.target.value)} className="mt-1 text-xs min-h-[60px] resize-y" rows={3} />
                          </div>
                          <div className="flex justify-end gap-2">
                            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => onSetEditingContactId(null)}>Cancel</Button>
                            <Button
                              size="sm"
                              className="h-7 text-xs gap-1"
                              onClick={async () => {
                                const { error } = await supabase.from("contacts").update({ role_focus: editRoleFocus || null, user_notes: editUserNotes || null }).eq("id", contact.id);
                                if (error) {
                                  toast.error("Failed to save");
                                  return;
                                }
                                toast.success("Contact updated");
                                queryClient.invalidateQueries({ queryKey: ["contacts", companyId] });
                                onSetEditingContactId(null);
                              }}
                            >
                              <Save className="w-3 h-3" /> Save
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : companyAny?.buyer_name ? (
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
