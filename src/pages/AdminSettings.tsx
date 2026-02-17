import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAppSettings, useUpdateSettings, DbAppSettings } from "@/hooks/useSupabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Save, Loader2, Plus, Trash2, GripVertical, Sun, Moon, Palette } from "lucide-react";
import { toast } from "sonner";
import { useTheme } from "@/hooks/useTheme";

const AVAILABLE_MODELS = [
  { value: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash (default)" },
  { value: "google/gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite (fastest)" },
  { value: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro (strongest)" },
  { value: "google/gemini-3-flash-preview", label: "Gemini 3 Flash Preview" },
  { value: "google/gemini-3-pro-preview", label: "Gemini 3 Pro Preview" },
  { value: "openai/gpt-5", label: "GPT-5" },
  { value: "openai/gpt-5-mini", label: "GPT-5 Mini" },
  { value: "openai/gpt-5-nano", label: "GPT-5 Nano (cheapest)" },
];

export default function AdminSettings() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Admin Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Configure AI, processing, partners, and compelling events.</p>
      </div>
      <Tabs defaultValue="appearance" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
          <TabsTrigger value="ai">AI & Prompt</TabsTrigger>
          <TabsTrigger value="events">Compelling Events</TabsTrigger>
          <TabsTrigger value="partners">Partners</TabsTrigger>
          <TabsTrigger value="processing">Processing</TabsTrigger>
        </TabsList>
        <TabsContent value="appearance"><AppearanceTab /></TabsContent>
        <TabsContent value="ai"><AIConfigTab /></TabsContent>
        <TabsContent value="events"><CompellingEventsTab /></TabsContent>
        <TabsContent value="partners"><PartnersTab /></TabsContent>
        <TabsContent value="processing"><ProcessingTab /></TabsContent>
      </Tabs>
    </div>
  );
}

// ─── APPEARANCE TAB ───
function AppearanceTab() {
  const { theme, setTheme } = useTheme();
  return (
    <div className="space-y-6">
      <div className="panel space-y-4">
        <div className="panel-header">Theme</div>
        <p className="text-xs text-muted-foreground">Choose between iorad dark theme and the clean light theme.</p>
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => setTheme("dark")}
            className={`flex flex-col items-center gap-3 p-6 rounded-xl border-2 transition-all ${
              theme === "dark"
                ? "border-primary bg-primary/10"
                : "border-border hover:border-muted-foreground/30"
            }`}
          >
            <Moon className="w-8 h-8 text-primary" />
            <span className="text-sm font-medium">iorad Dark</span>
            <span className="text-xs text-muted-foreground">Default dark theme</span>
          </button>
          <button
            onClick={() => setTheme("light")}
            className={`flex flex-col items-center gap-3 p-6 rounded-xl border-2 transition-all ${
              theme === "light"
                ? "border-primary bg-primary/10"
                : "border-border hover:border-muted-foreground/30"
            }`}
          >
            <Sun className="w-8 h-8 text-primary" />
            <span className="text-sm font-medium">Clean Light</span>
            <span className="text-xs text-muted-foreground">Light, corporate theme</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── AI CONFIG TAB ───
function AIConfigTab() {
  const { data, isLoading } = useQuery({
    queryKey: ["ai_config"],
    queryFn: async () => {
      const { data, error } = await supabase.from("ai_config").select("*").eq("id", 1).single();
      if (error) throw error;
      return data;
    },
  });
  const queryClient = useQueryClient();
  const [prompt, setPrompt] = useState("");
  const [promptTemplate, setPromptTemplate] = useState("");
  const [cardsPromptTemplate, setCardsPromptTemplate] = useState("");
  const [model, setModel] = useState("");

  useEffect(() => {
    if (data) {
      setPrompt(data.system_prompt);
      setPromptTemplate((data as any).prompt_template || "");
      setCardsPromptTemplate((data as any).cards_prompt_template || "");
      setModel(data.model);
    }
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("ai_config").update({ system_prompt: prompt, prompt_template: promptTemplate, cards_prompt_template: cardsPromptTemplate, model } as any).eq("id", 1);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai_config"] });
      toast.success("AI config saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <Loader />;

  return (
    <div className="space-y-6">
      <div className="panel space-y-4">
        <div className="panel-header">Model Selection</div>
        <Select value={model} onValueChange={setModel}>
          <SelectTrigger className="bg-secondary"><SelectValue /></SelectTrigger>
          <SelectContent>
            {AVAILABLE_MODELS.map(m => (
              <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="panel space-y-4">
        <div className="panel-header">System Prompt</div>
        <p className="text-xs text-muted-foreground">High-level system instruction prepended to every snapshot generation.</p>
        <Textarea
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          className="bg-secondary font-mono text-xs min-h-[200px]"
        />
      </div>
      <div className="panel space-y-4">
        <div className="panel-header">Prompt Template & JSON Schema</div>
        <p className="text-xs text-muted-foreground">
          Full prompt template with JSON schema. Use placeholders: <code className="text-primary">{"{{company_name}}"}</code>, <code className="text-primary">{"{{industry}}"}</code>, <code className="text-primary">{"{{partner_platform}}"}</code>, <code className="text-primary">{"{{compelling_events}}"}</code>, <code className="text-primary">{"{{signals}}"}</code>
        </p>
        <Textarea
          value={promptTemplate}
          onChange={e => setPromptTemplate(e.target.value)}
          className="bg-secondary font-mono text-xs min-h-[400px]"
        />
      </div>
      <div className="panel space-y-4">
        <div className="panel-header">Cards Prompt Template (CRM Dashboard)</div>
        <p className="text-xs text-muted-foreground">
          Master prompt for the "Generate Cards" feature. Produces dashboard cards + email/LinkedIn outreach sequences. Leave empty to use the built-in default.
        </p>
        <Textarea
          value={cardsPromptTemplate}
          onChange={e => setCardsPromptTemplate(e.target.value)}
          className="bg-secondary font-mono text-xs min-h-[400px]"
          placeholder="Leave empty to use default cards prompt…"
        />
      </div>
      <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="w-full gap-2">
        {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        Save AI Config
      </Button>
    </div>
  );
}

// ─── COMPELLING EVENTS TAB ───
function CompellingEventsTab() {
  const queryClient = useQueryClient();
  const { data: events, isLoading } = useQuery({
    queryKey: ["compelling_events"],
    queryFn: async () => {
      const { data, error } = await supabase.from("compelling_events").select("*").order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const [newLabel, setNewLabel] = useState("");

  const addMutation = useMutation({
    mutationFn: async (label: string) => {
      const maxOrder = events?.length ? Math.max(...events.map(e => e.sort_order)) + 1 : 0;
      const { error } = await supabase.from("compelling_events").insert({ label, sort_order: maxOrder });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["compelling_events"] });
      setNewLabel("");
      toast.success("Event added");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("compelling_events").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["compelling_events"] });
      toast.success("Event removed");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("compelling_events").update({ is_active: active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["compelling_events"] }),
  });

  if (isLoading) return <Loader />;

  return (
    <div className="space-y-4">
      <div className="panel space-y-4">
        <div className="panel-header">Compelling Event Taxonomy</div>
        <p className="text-xs text-muted-foreground">These events are injected into the AI prompt and used to categorize buyer signals.</p>
        <div className="space-y-2">
          {events?.map(event => (
            <div
              key={event.id}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg border text-sm ${
                event.is_active ? "border-border bg-secondary" : "border-border/50 bg-muted/30 opacity-60"
              }`}
            >
              <GripVertical className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="flex-1">{event.label}</span>
              <button
                onClick={() => toggleMutation.mutate({ id: event.id, active: !event.is_active })}
                className={`text-xs px-2 py-0.5 rounded ${event.is_active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}
              >
                {event.is_active ? "Active" : "Inactive"}
              </button>
              <button
                onClick={() => deleteMutation.mutate(event.id)}
                className="text-muted-foreground hover:text-destructive transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            value={newLabel}
            onChange={e => setNewLabel(e.target.value)}
            placeholder="Add new compelling event…"
            className="bg-secondary"
            onKeyDown={e => e.key === "Enter" && newLabel.trim() && addMutation.mutate(newLabel.trim())}
          />
          <Button
            size="sm"
            onClick={() => newLabel.trim() && addMutation.mutate(newLabel.trim())}
            disabled={!newLabel.trim() || addMutation.isPending}
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── PARTNERS TAB ───
function PartnersTab() {
  const queryClient = useQueryClient();
  const { data: partners, isLoading } = useQuery({
    queryKey: ["partner_config"],
    queryFn: async () => {
      const { data, error } = await supabase.from("partner_config").select("*").order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<any>({});

  const startEdit = (p: any) => {
    setEditing(p.id);
    setForm({ ...p, embed_bullets: p.embed_bullets?.join("\n") || "" });
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { id, created_at, ...rest } = form;
      const { error } = await supabase.from("partner_config").update({
        label: rest.label,
        positioning: rest.positioning,
        embed_bullets: rest.embed_bullets.split("\n").map((b: string) => b.trim()).filter(Boolean),
        color: rest.color,
        gradient: rest.gradient,
      }).eq("id", editing!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["partner_config"] });
      setEditing(null);
      toast.success("Partner updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <Loader />;

  return (
    <div className="space-y-4">
      <div className="panel space-y-4">
        <div className="panel-header">Partner Platforms</div>
        <p className="text-xs text-muted-foreground">Configure partner branding, positioning, and embed bullets used in story pages and AI prompts.</p>
        <div className="space-y-3">
          {partners?.map(p => (
            <div key={p.id} className="border border-border rounded-lg overflow-hidden">
              <div
                className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-secondary/50 transition-colors"
                onClick={() => editing === p.id ? setEditing(null) : startEdit(p)}
              >
                <div className="w-4 h-4 rounded-full shrink-0" style={{ background: p.color }} />
                <span className="font-medium text-sm flex-1">{p.label}</span>
                <span className="text-xs text-muted-foreground">{p.id}</span>
              </div>
              {editing === p.id && (
                <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Label</Label>
                      <Input value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} className="bg-secondary" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Color (hex)</Label>
                      <div className="flex gap-2">
                        <Input value={form.color} onChange={e => setForm({ ...form, color: e.target.value })} className="bg-secondary" />
                        <div className="w-10 h-10 rounded border shrink-0" style={{ background: form.color }} />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Positioning</Label>
                    <Input value={form.positioning} onChange={e => setForm({ ...form, positioning: e.target.value })} className="bg-secondary" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Gradient Classes</Label>
                    <Input value={form.gradient} onChange={e => setForm({ ...form, gradient: e.target.value })} className="bg-secondary" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Embed Bullets (one per line)</Label>
                    <Textarea
                      value={form.embed_bullets}
                      onChange={e => setForm({ ...form, embed_bullets: e.target.value })}
                      className="bg-secondary font-mono text-xs min-h-[100px]"
                    />
                  </div>
                  <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} size="sm" className="gap-2">
                    {saveMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                    Save Partner
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── PROCESSING TAB (existing settings) ───
function ProcessingTab() {
  const { data: dbSettings, isLoading } = useAppSettings();
  const updateMutation = useUpdateSettings();
  const [settings, setSettings] = useState<Partial<DbAppSettings>>({});

  useEffect(() => {
    if (dbSettings) setSettings({ ...dbSettings });
  }, [dbSettings]);

  const update = <K extends keyof DbAppSettings>(key: K, value: DbAppSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    try {
      const { id, updated_at, ...rest } = settings as DbAppSettings;
      await updateMutation.mutateAsync(rest);
      toast.success("Settings saved");
    } catch (err: any) {
      toast.error(`Failed to save: ${err.message}`);
    }
  };

  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

  if (isLoading) return <Loader />;

  return (
    <div className="space-y-6">
      <div className="panel space-y-4">
        <div className="panel-header">Scheduling</div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-xs">Run Frequency</Label>
            <Select value={settings.run_frequency || "weekly"} onValueChange={v => update("run_frequency", v)}>
              <SelectTrigger className="bg-secondary"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="manual">Manual Only</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {settings.run_frequency === "weekly" && (
            <div className="space-y-2">
              <Label className="text-xs">Day of Week</Label>
              <Select value={settings.weekly_run_day || "Monday"} onValueChange={v => update("weekly_run_day", v)}>
                <SelectTrigger className="bg-secondary"><SelectValue /></SelectTrigger>
                <SelectContent>{days.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-2">
            <Label className="text-xs">Run Time (Local)</Label>
            <Input type="time" value={settings.run_time_local || "09:00"} onChange={e => update("run_time_local", e.target.value)} className="bg-secondary" />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Timezone</Label>
            <Input value={settings.timezone || ""} onChange={e => update("timezone", e.target.value)} className="bg-secondary" />
          </div>
        </div>
      </div>

      <div className="panel space-y-4">
        <div className="panel-header">Processing</div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-xs">Batch Size</Label>
            <Input type="number" min={10} max={100} value={settings.batch_size ?? 25} onChange={e => update("batch_size", Number(e.target.value))} className="bg-secondary" />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Coverage Mode</Label>
            <Select value={settings.coverage_mode || "top_n"} onValueChange={v => update("coverage_mode", v)}>
              <SelectTrigger className="bg-secondary"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Companies</SelectItem>
                <SelectItem value="top_n">Top N by Score</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {settings.coverage_mode === "top_n" && (
            <div className="space-y-2">
              <Label className="text-xs">Top N Value</Label>
              <Input type="number" min={50} max={1000} value={settings.top_n ?? 200} onChange={e => update("top_n", Number(e.target.value))} className="bg-secondary" />
            </div>
          )}
          <div className="space-y-2">
            <Label className="text-xs">Max Companies per Run</Label>
            <Input type="number" min={1} max={1000} value={settings.max_companies_per_run ?? 250} onChange={e => update("max_companies_per_run", Number(e.target.value))} className="bg-secondary" />
          </div>
        </div>
      </div>

      <div className="panel space-y-4">
        <div className="panel-header">Thresholds & Lookback</div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-xs">Snapshot Threshold (0–100)</Label>
            <Input type="number" min={0} max={100} value={settings.snapshot_threshold ?? 40} onChange={e => update("snapshot_threshold", Number(e.target.value))} className="bg-secondary" />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Snapshot Max Age (days)</Label>
            <Input type="number" min={1} value={settings.snapshot_max_age_days ?? 30} onChange={e => update("snapshot_max_age_days", Number(e.target.value))} className="bg-secondary" />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Jobs Lookback (days)</Label>
            <Input type="number" min={1} value={settings.jobs_lookback_days ?? 60} onChange={e => update("jobs_lookback_days", Number(e.target.value))} className="bg-secondary" />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">News Lookback (days)</Label>
            <Input type="number" min={1} value={settings.news_lookback_days ?? 90} onChange={e => update("news_lookback_days", Number(e.target.value))} className="bg-secondary" />
          </div>
        </div>
      </div>

      <Button onClick={handleSave} disabled={updateMutation.isPending} className="w-full gap-2">
        {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        Save Processing Settings
      </Button>
    </div>
  );
}

function Loader() {
  return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
}
