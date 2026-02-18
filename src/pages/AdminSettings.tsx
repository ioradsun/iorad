import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAppSettings, useUpdateSettings, DbAppSettings } from "@/hooks/useSupabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Save, Loader2, Plus, Trash2, GripVertical, Sun, Moon, Shield, User, Download, RotateCcw, ClipboardPaste, ChevronDown, ChevronRight, Pencil, Play, Square, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useTheme, applyCustomVars, clearCustomVars } from "@/hooks/useTheme";

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
    <div className="max-w-4xl mx-auto">
      <Tabs defaultValue="people" className="space-y-6">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="people">People</TabsTrigger>
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
          <TabsTrigger value="ai">AI & Prompts</TabsTrigger>
          <TabsTrigger value="events">Compelling Events</TabsTrigger>
          <TabsTrigger value="partners">Partners</TabsTrigger>
          <TabsTrigger value="processing">Processing</TabsTrigger>
        </TabsList>
        <TabsContent value="people"><PeopleTab /></TabsContent>
        <TabsContent value="appearance"><AppearanceTab /></TabsContent>
        <TabsContent value="ai"><AIConfigTab /></TabsContent>
        <TabsContent value="events"><CompellingEventsTab /></TabsContent>
        <TabsContent value="partners"><PartnersTab /></TabsContent>
        <TabsContent value="processing"><ProcessingTab /></TabsContent>
      </Tabs>
    </div>
  );
}

// ─── PEOPLE TAB ───
interface PeopleUser {
  id: string;
  email: string;
  name: string;
  avatar: string | null;
  role: string;
  last_sign_in: string | null;
  created_at: string;
}

function PeopleTab() {
  const queryClient = useQueryClient();

  const { data: users, isLoading } = useQuery<PeopleUser[]>({
    queryKey: ["admin-people"],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/list-users`,
        {
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
            "Content-Type": "application/json",
          },
        }
      );
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  });

  const toggleRole = useMutation({
    mutationFn: async ({ user_id, role }: { user_id: string; role: string }) => {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/list-users`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ user_id, role }),
        }
      );
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-people"] });
      toast.success("Role updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <Loader />;

  return (
    <div className="space-y-4">
      <div className="panel space-y-4">
        <div className="panel-header">Team Members</div>
        <p className="text-xs text-muted-foreground">
          All @iorad.com users who have signed in. Admins have access to this settings page.
        </p>
        <div className="space-y-2">
          {users?.map((u) => (
            <div
              key={u.id}
              className="flex items-center gap-3 px-4 py-3 rounded-lg border border-border bg-secondary/50"
            >
              <Avatar className="h-8 w-8">
                <AvatarImage src={u.avatar || undefined} />
                <AvatarFallback className="text-xs">
                  {u.name?.slice(0, 2).toUpperCase() || "?"}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{u.name}</div>
                <div className="text-xs text-muted-foreground truncate">{u.email}</div>
              </div>
              {u.last_sign_in && (
                <span className="text-xs text-muted-foreground hidden sm:block">
                  Last sign-in: {new Date(u.last_sign_in).toLocaleDateString()}
                </span>
              )}
              <button
                onClick={() =>
                  toggleRole.mutate({
                    user_id: u.id,
                    role: u.role === "admin" ? "user" : "admin",
                  })
                }
                disabled={toggleRole.isPending}
                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
                  u.role === "admin"
                    ? "bg-primary/15 text-primary border border-primary/30"
                    : "bg-muted text-muted-foreground border border-border hover:border-primary/30"
                }`}
              >
                {u.role === "admin" ? (
                  <Shield className="w-3 h-3" />
                ) : (
                  <User className="w-3 h-3" />
                )}
                {u.role === "admin" ? "Admin" : "Full User"}
              </button>
            </div>
          ))}
          {users?.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              No @iorad.com users have signed in yet.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── APPEARANCE TAB ───

const APP_VARS_KEY = "iorad-custom-app-vars";
const STORY_VARS_KEY = "iorad-custom-story-vars";

/** Grouped token definitions — covers every CSS custom property used in the design system */
const TOKEN_GROUPS: { label: string; key: string; tokens: string[] }[] = [
  {
    label: "Brand / Primary",
    key: "brand",
    tokens: [
      "--primary", "--primary-foreground",
      "--secondary", "--secondary-foreground",
      "--accent", "--accent-foreground",
      "--destructive", "--destructive-foreground",
      "--ring",
    ],
  },
  {
    label: "Surfaces & Text",
    key: "surfaces",
    tokens: [
      "--background", "--foreground",
      "--card", "--card-foreground",
      "--popover", "--popover-foreground",
      "--muted", "--muted-foreground",
      "--border", "--input",
    ],
  },
  {
    label: "Status / Scores",
    key: "status",
    tokens: [
      "--success", "--success-foreground",
      "--warning", "--warning-foreground",
      "--info", "--info-foreground",
      "--pink", "--pink-foreground",
      "--score-high", "--score-medium", "--score-low",
    ],
  },
  {
    label: "Sidebar",
    key: "sidebar",
    tokens: [
      "--sidebar-background", "--sidebar-foreground",
      "--sidebar-primary", "--sidebar-primary-foreground",
      "--sidebar-accent", "--sidebar-accent-foreground",
      "--sidebar-border", "--sidebar-ring",
    ],
  },
  {
    label: "Typography & Spacing",
    key: "typography",
    tokens: [
      "--font-display", "--font-body",
      "--font-size-title", "--font-size-sub",
      "--font-size-body", "--font-size-sm", "--font-size-xs",
      "--radius",
    ],
  },
  {
    label: "Buttons",
    key: "buttons",
    tokens: [
      "--btn-primary-bg", "--btn-primary-fg", "--btn-primary-hover",
      "--btn-secondary-bg", "--btn-secondary-fg",
      "--btn-destructive-bg", "--btn-destructive-fg",
      "--btn-radius", "--btn-font-size",
    ],
  },
  {
    label: "Pills & Badges",
    key: "pills",
    tokens: [
      "--pill-success-bg", "--pill-success-fg",
      "--pill-warning-bg", "--pill-warning-fg",
      "--pill-error-bg", "--pill-error-fg",
      "--pill-info-bg", "--pill-info-fg",
      "--pill-neutral-bg", "--pill-neutral-fg",
      "--pill-radius", "--pill-font-size",
    ],
  },
  {
    label: "Stat Card Icons",
    key: "stat-icons",
    tokens: [
      "--stat-total-bg", "--stat-total-fg",
      "--stat-inbound-bg", "--stat-inbound-fg",
      "--stat-outbound-bg", "--stat-outbound-fg",
    ],
  },
  {
    label: "Source Type Pills",
    key: "source-pills",
    tokens: [
      "--source-inbound-bg", "--source-inbound-fg", "--source-inbound-border",
      "--source-outbound-bg", "--source-outbound-fg", "--source-outbound-border",
    ],
  },
];

const STORY_TOKEN_GROUPS: { label: string; key: string; tokens: string[] }[] = [
  {
    label: "Story Surfaces",
    key: "story-surfaces",
    tokens: [
      "--story-bg", "--story-fg",
      "--story-muted", "--story-subtle",
      "--story-border", "--story-surface",
    ],
  },
  {
    label: "Story Accent",
    key: "story-accent",
    tokens: [
      "--story-accent", "--story-accent-dim",
      "--story-accent-border", "--story-accent-strong",
      "--story-gradient-from", "--story-gradient-to",
    ],
  },
  {
    label: "Story Buttons / CTAs",
    key: "story-cta",
    tokens: [
      "--story-cta-bg", "--story-cta-fg", "--story-cta-hover",
      "--story-btn-bg", "--story-btn-fg",
    ],
  },
];

const ALL_APP_TOKENS = TOKEN_GROUPS.flatMap(g => g.tokens);
const ALL_STORY_TOKENS = STORY_TOKEN_GROUPS.flatMap(g => g.tokens);

function getCSSVarValue(name: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function buildCSS(tokens: string[], themeLabel: string, label: string) {
  const lines = tokens.map(t => `  ${t}: ${getCSSVarValue(t)};`);
  return `/* iorad Scout — ${label} Export\n * Theme: ${themeLabel}\n * Exported: ${new Date().toISOString()}\n */\n\n:root {\n${lines.join("\n")}\n}\n`;
}

function downloadCSS(css: string, filename: string) {
  const blob = new Blob([css], { type: "text/css" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function parseCSSVars(cssText: string): Record<string, string> {
  const result: Record<string, string> = {};
  const regex = /(--[\w-]+)\s*:\s*([^;]+);/g;
  let match;
  while ((match = regex.exec(cssText)) !== null) {
    result[match[1].trim()] = match[2].trim();
  }
  return result;
}

/** Persist vars to localStorage and apply to DOM */
function saveVars(storageKey: string, incoming: Record<string, string>, existingRaw: string | null) {
  const existing = existingRaw ? JSON.parse(existingRaw) : {};
  const merged = { ...existing, ...incoming };
  applyCustomVars(merged);
  localStorage.setItem(storageKey, JSON.stringify(merged));
}

/** Detect if a CSS value looks like a color (hex, hsl numbers, rgb, named) */
function looksLikeColor(value: string): boolean {
  return (
    /^#[0-9a-f]{3,8}$/i.test(value) ||
    /^rgba?\(/.test(value) ||
    /^hsla?\(/.test(value) ||
    /^\d+\s+\d/.test(value) // HSL triplet like "220 20% 7%"
  );
}

/** Render a color swatch for a given computed var value */
function ColorSwatch({ varName }: { varName: string }) {
  const raw = getCSSVarValue(varName);
  const isHSLTriplet = /^\d+\s+[\d.]+%\s+[\d.]+%/.test(raw);
  const bg = isHSLTriplet ? `hsl(${raw})` : raw;
  if (!raw || !looksLikeColor(raw)) return null;
  return (
    <span
      className="inline-block w-4 h-4 rounded-sm border border-border flex-shrink-0"
      style={{ background: bg }}
      title={raw}
    />
  );
}

/** Single editable token row */
function TokenRow({
  name,
  storageKey,
  onSaved,
}: {
  name: string;
  storageKey: string;
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const currentValue = getCSSVarValue(name);

  const startEdit = () => {
    setDraft(currentValue);
    setEditing(true);
  };

  const apply = () => {
    if (!draft.trim()) return;
    const override = { [name]: draft.trim() };
    saveVars(storageKey, override, localStorage.getItem(storageKey));
    setEditing(false);
    onSaved();
    toast.success(`${name} updated`);
  };

  const cancel = () => setEditing(false);

  return (
    <div className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-secondary/50 group">
      <ColorSwatch varName={name} />
      <span className="font-mono text-xs text-muted-foreground flex-1 truncate" title={name}>{name}</span>
      {editing ? (
        <>
          <Input
            className="h-6 text-xs font-mono w-48 px-1.5 py-0"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") apply(); if (e.key === "Escape") cancel(); }}
            autoFocus
          />
          <Button size="sm" className="h-6 text-xs px-2" onClick={apply}>Apply</Button>
          <Button size="sm" variant="ghost" className="h-6 text-xs px-1" onClick={cancel}>✕</Button>
        </>
      ) : (
        <>
          <span className="font-mono text-xs text-foreground/70 max-w-[140px] truncate" title={currentValue}>{currentValue}</span>
          <button
            className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-secondary"
            onClick={startEdit}
            title="Edit"
          >
            <Pencil className="w-3 h-3 text-muted-foreground" />
          </button>
        </>
      )}
    </div>
  );
}

/** Collapsible group of token rows */
function TokenGroup({
  label,
  tokens,
  storageKey,
  onSaved,
}: {
  label: string;
  tokens: string[];
  storageKey: string;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-border rounded-md overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-3 py-2 bg-secondary/40 hover:bg-secondary/70 transition-colors text-left"
        onClick={() => setOpen(o => !o)}
      >
        <span className="text-xs font-mono font-medium">{label}</span>
        <span className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground">{tokens.length} tokens</span>
          {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </span>
      </button>
      {open && (
        <div className="divide-y divide-border/40 px-1 py-1">
          {tokens.map(t => (
            <TokenRow key={t} name={t} storageKey={storageKey} onSaved={onSaved} />
          ))}
        </div>
      )}
    </div>
  );
}

/** Full stylesheet card with export, paste import, reset, and live inline editor */
function StylesheetCard({
  title,
  description,
  tokenGroups,
  allTokens,
  storageKey,
  exportFilename,
}: {
  title: string;
  description: React.ReactNode;
  tokenGroups: { label: string; key: string; tokens: string[] }[];
  allTokens: string[];
  storageKey: string;
  exportFilename: string;
  exportLabel: string;
}) {
  const { theme } = useTheme();
  const themeLabel = theme === "light" ? "Clean Light" : "iorad Dark";
  const [hasOverride, setHasOverride] = useState(!!localStorage.getItem(storageKey));
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteValue, setPasteValue] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [, forceRefresh] = useState(0);

  const handleExport = () => {
    downloadCSS(buildCSS(allTokens, themeLabel, title), exportFilename);
    toast.success(`${title} exported`);
  };

  const handleApplyPaste = () => {
    const vars = parseCSSVars(pasteValue);
    const count = Object.keys(vars).length;
    if (count === 0) {
      toast.error("No CSS custom properties found. Paste valid CSS with --variable: value; declarations.");
      return;
    }
    saveVars(storageKey, vars, localStorage.getItem(storageKey));
    setHasOverride(true);
    setPasteOpen(false);
    setPasteValue("");
    forceRefresh(n => n + 1);
    toast.success(`Applied ${count} CSS variables`);
  };

  const handleReset = () => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) clearCustomVars(JSON.parse(raw));
    } catch {}
    localStorage.removeItem(storageKey);
    setHasOverride(false);
    setPasteOpen(false);
    setPasteValue("");
    forceRefresh(n => n + 1);
    toast.success(`${title} overrides cleared`);
  };

  const handleTokenSaved = () => {
    setHasOverride(true);
    forceRefresh(n => n + 1);
  };

  return (
    <div className="rounded-lg border border-border bg-secondary/30 p-4 space-y-3">
      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">{title}</p>
          {hasOverride && (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
              custom
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>

      {/* Actions */}
      <div className="grid grid-cols-4 gap-2">
        <Button variant="outline" size="sm" className="gap-1.5" onClick={handleExport}>
          <Download className="w-3.5 h-3.5" />
          Export
        </Button>
        <Button
          variant="outline"
          size="sm"
          className={`gap-1.5 ${pasteOpen ? "border-primary text-primary" : ""}`}
          onClick={() => { setPasteOpen(o => !o); setEditorOpen(false); }}
        >
          <ClipboardPaste className="w-3.5 h-3.5" />
          Paste CSS
        </Button>
        <Button
          variant="outline"
          size="sm"
          className={`gap-1.5 ${editorOpen ? "border-primary text-primary" : ""}`}
          onClick={() => { setEditorOpen(o => !o); setPasteOpen(false); }}
        >
          <Pencil className="w-3.5 h-3.5" />
          Edit Tokens
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-muted-foreground"
          onClick={handleReset}
          disabled={!hasOverride}
          title="Remove custom overrides and restore defaults"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Reset
        </Button>
      </div>

      {/* Paste CSS panel */}
      {pasteOpen && (
        <div className="space-y-2">
          <p className="text-[11px] text-muted-foreground">Paste a CSS block with <code>--variable: value;</code> declarations:</p>
          <Textarea
            className="font-mono text-xs min-h-[140px] resize-y"
            placeholder={`:root {\n  --primary: 308 100% 42%;\n  --story-bg: #ffffff;\n  /* ... */\n}`}
            value={pasteValue}
            onChange={(e) => setPasteValue(e.target.value)}
            autoFocus
          />
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" size="sm" onClick={() => { setPasteOpen(false); setPasteValue(""); }}>Cancel</Button>
            <Button size="sm" onClick={handleApplyPaste} disabled={!pasteValue.trim()}>Apply</Button>
          </div>
        </div>
      )}

      {/* Inline token editor */}
      {editorOpen && (
        <div className="space-y-2">
          <p className="text-[11px] text-muted-foreground">Click any token row to edit its value. Changes apply instantly.</p>
          <div className="space-y-1.5">
            {tokenGroups.map(g => (
              <TokenGroup
                key={g.key}
                label={g.label}
                tokens={g.tokens}
                storageKey={storageKey}
                onSaved={handleTokenSaved}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

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

      <div className="panel space-y-4">
        <div className="panel-header">Stylesheets</div>
        <p className="text-xs text-muted-foreground">
          Export theme tokens as CSS, edit individual tokens inline, or paste a full CSS override block.
          Changes apply instantly and persist across reloads.
        </p>
        <div className="space-y-3">
          <StylesheetCard
            title="App Stylesheet"
            description="All design tokens for the Scout admin app — surfaces, brand colours, typography, sidebar, status badges."
            tokenGroups={TOKEN_GROUPS}
            allTokens={ALL_APP_TOKENS}
            storageKey={APP_VARS_KEY}
            exportFilename={`iorad-app-theme-${theme}-${new Date().toISOString().slice(0, 10)}.css`}
            exportLabel="Export app.css"
          />
          <StylesheetCard
            title="Story Stylesheet"
            description={<>All <code className="text-primary">--story-*</code> tokens for the public ABM microsite — surfaces, accents, gradients, CTAs.</>}
            tokenGroups={STORY_TOKEN_GROUPS}
            allTokens={ALL_STORY_TOKENS}
            storageKey={STORY_VARS_KEY}
            exportFilename={`iorad-story-theme-${theme}-${new Date().toISOString().slice(0, 10)}.css`}
            exportLabel="Export story.css"
          />
        </div>
      </div>
    </div>
  );
}



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

  // Outbound state
  const [outboundSystemPrompt, setOutboundSystemPrompt] = useState("");
  const [promptTemplate, setPromptTemplate] = useState("");
  const [companyPrompt, setCompanyPrompt] = useState("");
  const [strategyPrompt, setStrategyPrompt] = useState("");
  const [outreachPrompt, setOutreachPrompt] = useState("");
  const [storyPrompt, setStoryPrompt] = useState("");
  const [transcriptPrompt, setTranscriptPrompt] = useState("");

  // Inbound state
  const [inboundSystemPrompt, setInboundSystemPrompt] = useState("");
  const [inboundStrategyPrompt, setInboundStrategyPrompt] = useState("");
  const [inboundOutreachPrompt, setInboundOutreachPrompt] = useState("");
  const [inboundStoryPrompt, setInboundStoryPrompt] = useState("");
  const [inboundTranscriptPrompt, setInboundTranscriptPrompt] = useState("");

  // AI state
  const [model, setModel] = useState("");

  useEffect(() => {
    if (data) {
      setOutboundSystemPrompt((data as any).system_prompt || "");
      setPromptTemplate((data as any).prompt_template || "");
      setCompanyPrompt((data as any).company_prompt || "");
      setStrategyPrompt((data as any).strategy_prompt || "");
      setOutreachPrompt((data as any).outreach_prompt || "");
      setStoryPrompt((data as any).story_prompt || "");
      setTranscriptPrompt((data as any).transcript_prompt || "");
      setInboundSystemPrompt((data as any).inbound_system_prompt || "");
      setInboundStrategyPrompt((data as any).inbound_strategy_prompt || "");
      setInboundOutreachPrompt((data as any).inbound_outreach_prompt || "");
      setInboundStoryPrompt((data as any).inbound_story_prompt || "");
      setInboundTranscriptPrompt((data as any).inbound_transcript_prompt || "");
      setModel(data.model);
    }
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("ai_config").update({
        system_prompt: outboundSystemPrompt,
        prompt_template: promptTemplate,
        company_prompt: companyPrompt,
        strategy_prompt: strategyPrompt,
        outreach_prompt: outreachPrompt,
        story_prompt: storyPrompt,
        transcript_prompt: transcriptPrompt,
        inbound_system_prompt: inboundSystemPrompt,
        inbound_strategy_prompt: inboundStrategyPrompt,
        inbound_outreach_prompt: inboundOutreachPrompt,
        inbound_story_prompt: inboundStoryPrompt,
        inbound_transcript_prompt: inboundTranscriptPrompt,
        model,
      } as any).eq("id", 1);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai_config"] });
      toast.success("AI config saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleExport = () => {
    const sections = [
      { label: "Inbound — System Prompt", value: inboundSystemPrompt },
      { label: "Inbound — Strategy Tab Prompt", value: inboundStrategyPrompt },
      { label: "Inbound — Outreach Tab Prompt", value: inboundOutreachPrompt },
      { label: "Inbound — Custom Loom & iorad Prompt", value: inboundStoryPrompt },
      { label: "Inbound — Transcript Analysis Prompt", value: inboundTranscriptPrompt },
      { label: "Outbound — System Prompt", value: outboundSystemPrompt },
      { label: "Outbound — Story Mega Prompt Template", value: promptTemplate },
      { label: "Outbound — Company Tab Prompt", value: companyPrompt },
      { label: "Outbound — Strategy Tab Prompt", value: strategyPrompt },
      { label: "Outbound — Outreach Tab Prompt", value: outreachPrompt },
      { label: "Outbound — Custom Loom & iorad Prompt", value: storyPrompt },
      { label: "Outbound — Transcript Analysis Prompt", value: transcriptPrompt },
    ];
    const md = sections
      .map(({ label, value }) => `## ${label}\n\n\`\`\`\n${(value || "").trim() || "(empty)"}\n\`\`\``)
      .join("\n\n---\n\n");
    const blob = new Blob([`# iorad AI Prompt Configuration\n\nExported: ${new Date().toISOString()}\n\n---\n\n${md}`], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `iorad-prompts-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Prompts exported as Markdown");
  };

  if (isLoading) return <Loader />;

  const inboundSections = [
    { key: "inbound_strategy", label: "Strategy Tab", description: "Qualification, discovery, and conversion strategy for warm leads.", value: inboundStrategyPrompt, setter: setInboundStrategyPrompt },
    { key: "inbound_outreach", label: "Outreach Tab", description: "Nurture sequences, demo follow-ups, and onboarding-oriented messaging.", value: inboundOutreachPrompt, setter: setInboundOutreachPrompt },
    { key: "inbound_story", label: "Story Mega Prompt", description: "Behavioral Momentum → Institutionalization Engine. Generates the personalized institutional brief on the Story tab for inbound companies.", value: inboundStoryPrompt, setter: setInboundStoryPrompt },
    { key: "inbound_transcript", label: "Transcript Analysis", description: "Analyze inbound demo/onboarding call transcripts — extract adoption signals and expansion opportunities.", value: inboundTranscriptPrompt, setter: setInboundTranscriptPrompt },
  ];

  const outboundSections = [
    { key: "company", label: "Company Tab", description: "Company overview tab content (account summary, key facts).", value: companyPrompt, setter: setCompanyPrompt },
    { key: "strategy", label: "Strategy Tab", description: "Strategy tab content (dashboard cards, plays, leverage points).", value: strategyPrompt, setter: setStrategyPrompt },
    { key: "outreach", label: "Outreach Tab", description: "Outreach tab content (email sequences, LinkedIn messages).", value: outreachPrompt, setter: setOutreachPrompt },
    { key: "story", label: "Custom Loom & iorad", description: "Story tab content — produces bespoke Loom scripts and iorad tutorial assets.", value: storyPrompt, setter: setStoryPrompt },
    { key: "transcript", label: "Transcript Analysis", description: "Fathom meeting transcript analysis — extracts strategic account intelligence for CS handoff.", value: transcriptPrompt, setter: setTranscriptPrompt },
  ];

  const SaveBar = () => (
    <div className="flex gap-3 pt-2">
      <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="flex-1 gap-2">
        {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        Save
      </Button>
      <Button variant="outline" className="gap-2" onClick={handleExport}>
        <Download className="w-4 h-4" />
        Export .md
      </Button>
    </div>
  );

  return (
    <div className="space-y-4">
      <Tabs defaultValue="inbound" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="inbound">Inbound Prompt</TabsTrigger>
          <TabsTrigger value="outbound">Outbound Prompt</TabsTrigger>
          <TabsTrigger value="ai">AI</TabsTrigger>
        </TabsList>

        {/* ── INBOUND ── */}
        <TabsContent value="inbound" className="space-y-6">
          <div className="panel space-y-4 border-l-2 border-primary/40">
            <div className="panel-header">System Prompt</div>
            <p className="text-xs text-muted-foreground">High-level system instruction prepended to every inbound generation.</p>
            <Textarea
              value={inboundSystemPrompt}
              onChange={e => setInboundSystemPrompt(e.target.value)}
              className="bg-secondary font-mono text-xs min-h-[200px]"
              placeholder="Enter the inbound system prompt here…"
            />
          </div>
          {inboundSections.map(({ key, label, description, value, setter }) => (
            <div key={key} className="panel space-y-4 border-l-2 border-primary/40">
              <div className="panel-header">{label}</div>
              <p className="text-xs text-muted-foreground">{description}</p>
              <Textarea
                value={value}
                onChange={e => setter(e.target.value)}
                className="bg-secondary font-mono text-xs min-h-[300px]"
                placeholder={`Enter the inbound ${label.toLowerCase()} prompt here…`}
              />
            </div>
          ))}
          <SaveBar />
        </TabsContent>

        {/* ── OUTBOUND ── */}
        <TabsContent value="outbound" className="space-y-6">
          <div className="panel space-y-4">
            <div className="panel-header">System Prompt</div>
            <p className="text-xs text-muted-foreground">High-level system instruction prepended to every outbound generation.</p>
            <Textarea
              value={outboundSystemPrompt}
              onChange={e => setOutboundSystemPrompt(e.target.value)}
              className="bg-secondary font-mono text-xs min-h-[200px]"
              placeholder="Enter the outbound system prompt here…"
            />
          </div>
          <div className="panel space-y-4">
            <div className="panel-header">Story Mega Prompt Template</div>
            <p className="text-xs text-muted-foreground">
              Full prompt template with JSON schema for story microsites. Placeholders: <code className="text-primary">{"{{company_name}}"}</code>, <code className="text-primary">{"{{signals}}"}</code>, etc.
            </p>
            <Textarea
              value={promptTemplate}
              onChange={e => setPromptTemplate(e.target.value)}
              className="bg-secondary font-mono text-xs min-h-[300px]"
              placeholder="Enter the story mega prompt template here…"
            />
          </div>
          {outboundSections.map(({ key, label, description, value, setter }) => (
            <div key={key} className="panel space-y-4">
              <div className="panel-header">{label}</div>
              <p className="text-xs text-muted-foreground">{description}</p>
              <Textarea
                value={value}
                onChange={e => setter(e.target.value)}
                className="bg-secondary font-mono text-xs min-h-[300px]"
                placeholder={`Enter the outbound ${label.toLowerCase()} prompt here…`}
              />
            </div>
          ))}
          <SaveBar />
        </TabsContent>

        {/* ── AI ── */}
        <TabsContent value="ai" className="space-y-6">
          <div className="panel space-y-4">
            <div className="panel-header">Model Selection</div>
            <p className="text-xs text-muted-foreground">The AI model used for all content generation.</p>
            <Select value={model} onValueChange={setModel}>
              <SelectTrigger className="bg-secondary"><SelectValue /></SelectTrigger>
              <SelectContent>
                {AVAILABLE_MODELS.map(m => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <SaveBar />
        </TabsContent>
      </Tabs>
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

// ─── BULK GENERATE PANEL ───
interface BulkCompany { id: string; name: string; source_type: string }
interface BulkResult { id: string; name: string; status: "done" | "error"; message?: string }

function BulkGeneratePanel() {
  const [running, setRunning] = useState(false);
  const [companies, setCompanies] = useState<BulkCompany[]>([]);
  const [results, setResults] = useState<BulkResult[]>([]);
  const [current, setCurrent] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<string | null>(null);
  const [loadingList, setLoadingList] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const abortRef = useRef(false);

  const loadMissingStories = async () => {
    setLoadingList(true);
    try {
      const { data: cardsRows } = await supabase.from("company_cards").select("company_id");
      const existingIds = new Set((cardsRows || []).map((r: any) => r.company_id));
      const { data: allCompanies } = await supabase.from("companies").select("id, name, source_type").order("name");
      const missing = (allCompanies || []).filter((c: any) => !existingIds.has(c.id));
      setCompanies(missing);
      setResults([]);
    } catch (e: any) {
      toast.error("Failed to load companies: " + e.message);
    } finally {
      setLoadingList(false);
    }
  };

  const invokeWithRetry = async (fn: string, body: object, retries = 1): Promise<{ data: any; error: any }> => {
    for (let attempt = 0; attempt <= retries; attempt++) {
      const result = await supabase.functions.invoke(fn, { body });
      const isNetworkErr = result.error?.message?.includes("Failed to send a request");
      if (!isNetworkErr || attempt === retries) return result;
      await new Promise(r => setTimeout(r, 2000));
    }
    return { data: null, error: new Error("Max retries exceeded") };
  };

  const runAll = async () => {
    if (companies.length === 0) return;
    abortRef.current = false;
    setRunning(true);
    setResults([]);
    setCurrent(null);
    setCurrentStep(null);

    // Create ONE processing_jobs row for the entire run
    const { data: jobRow, error: jobErr } = await supabase
      .from("processing_jobs")
      .insert({
        status: "running",
        trigger: "manual",
        total_companies_targeted: companies.length,
        companies_processed: 0,
        companies_succeeded: 0,
        companies_failed: 0,
      })
      .select()
      .single();

    if (jobErr || !jobRow) {
      toast.error("Failed to create job record");
      setRunning(false);
      return;
    }
    setJobId(jobRow.id);

    const localResults: BulkResult[] = [];
    let succeeded = 0;
    let failed = 0;

    for (const company of companies) {
      if (abortRef.current) break;
      setCurrent(company.name);

      // 1-minute delay between companies (except first)
      if (localResults.length > 0) {
        for (let s = 0; s < 60; s++) {
          if (abortRef.current) break;
          await new Promise(r => setTimeout(r, 1000));
        }
      }
      if (abortRef.current) break;

      // Mark which company is currently processing
      await supabase.from("processing_jobs").update({
        settings_snapshot: { current_company: company.name },
      }).eq("id", jobRow.id);

      try {
        const isInbound = company.source_type === "inbound";

        if (!isInbound) {
          setCurrentStep("Signals");
          const { data: sigData, error: sigErr } = await invokeWithRetry("run-signals", { company_id: company.id, mode: "full" });
          if (sigErr) throw new Error(sigErr.message || "Signals step failed");
          if (sigData?.error) throw new Error(sigData.error);
        }

        if (!isInbound) {
          setCurrentStep("Contacts");
          await invokeWithRetry("find-contacts", { company_id: company.id });
        }

        if (isInbound) {
          setCurrentStep("Profiles");
          await invokeWithRetry("extract-contact-profile", { company_id: company.id });
        }

        const tabs = ["company", "strategy", "outreach", "story"];
        for (const tab of tabs) {
          if (abortRef.current) break;
          setCurrentStep(tab.charAt(0).toUpperCase() + tab.slice(1));
          const { data, error } = await invokeWithRetry("generate-cards", { company_id: company.id, tab });
          if (error) throw new Error(error.message || `${tab} generation failed`);
          if (data?.error) throw new Error(data.error);
        }

        succeeded++;
        const result: BulkResult = { id: company.id, name: company.name, status: "done" };
        localResults.push(result);
        setResults(prev => [...prev, result]);
      } catch (e: any) {
        failed++;
        const result: BulkResult = { id: company.id, name: company.name, status: "error", message: e.message };
        localResults.push(result);
        setResults(prev => [...prev, result]);
      }

      // Update the single job row after each company (store current company name for the status page)
      await supabase.from("processing_jobs").update({
        companies_processed: localResults.length,
        companies_succeeded: succeeded,
        companies_failed: failed,
        settings_snapshot: { current_company: companies[localResults.length]?.name ?? null },
      }).eq("id", jobRow.id);
    }

    // Mark the job done
    const finalStatus = abortRef.current ? "canceled" : "completed";
    await supabase.from("processing_jobs").update({
      status: finalStatus,
      finished_at: new Date().toISOString(),
      companies_processed: localResults.length,
      companies_succeeded: succeeded,
      companies_failed: failed,
    }).eq("id", jobRow.id);

    setCurrent(null);
    setCurrentStep(null);
    setRunning(false);
    setJobId(null);

    // Send notification
    try {
      await supabase.functions.invoke("send-notification", {
        body: {
          subject: `Story Generation Complete — ${succeeded} succeeded, ${failed} failed`,
          results: localResults,
        },
      });
    } catch (notifErr) {
      console.warn("Notification send failed (non-fatal):", notifErr);
    }

    await loadMissingStories();
  };

  const stop = () => { abortRef.current = true; };

  const done = results.filter(r => r.status === "done").length;
  const errors = results.filter(r => r.status === "error").length;
  const total = companies.length;

  return (
    <div className="panel space-y-4">
      <div className="panel-header flex items-center justify-between">
        <span>Generate All Missing Stories</span>
        <span className="text-[11px] font-normal text-muted-foreground font-mono">Runs inbound + outbound</span>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">
        Finds every company with no story generated yet and runs the full pipeline one at a time with a 1-minute delay between each.
      </p>

      {/* Load / action buttons */}
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" onClick={loadMissingStories} disabled={loadingList || running} className="gap-1.5">
          {loadingList ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <AlertCircle className="w-3.5 h-3.5" />}
          {companies.length > 0 ? `${companies.length} companies need stories` : "Check Missing Stories"}
        </Button>
        {companies.length > 0 && !running && (
          <Button size="sm" onClick={runAll} className="gap-1.5">
            <Play className="w-3.5 h-3.5" /> Run {companies.length} Companies
          </Button>
        )}
        {running && (
          <Button size="sm" variant="destructive" onClick={stop} className="gap-1.5">
            <Square className="w-3.5 h-3.5" /> Stop
          </Button>
        )}
      </div>

      {/* Progress */}
      {(running || results.length > 0) && (
        <div className="space-y-2">
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="text-foreground font-medium">{done + errors} / {total}</span>
            {done > 0 && <span className="text-primary flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" />{done} done</span>}
            {errors > 0 && <span className="text-destructive flex items-center gap-1"><XCircle className="w-3.5 h-3.5" />{errors} failed</span>}
          </div>

          <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-300"
              style={{ width: `${total > 0 ? ((done + errors) / total) * 100 : 0}%` }}
            />
          </div>

          {current && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-primary flex-shrink-0" />
              <span className="truncate">
                <span className="text-foreground font-medium">{current}</span>
                {currentStep && <span> — {currentStep}…</span>}
              </span>
            </div>
          )}

          {results.length > 0 && (
            <div className="max-h-[200px] overflow-y-auto space-y-1 mt-1 pr-1">
              {[...results].reverse().map(r => (
                <div key={r.id} className="flex items-start gap-2 text-[12px]">
                  {r.status === "done"
                    ? <CheckCircle2 className="w-3.5 h-3.5 text-primary mt-0.5 flex-shrink-0" />
                    : <XCircle className="w-3.5 h-3.5 text-destructive mt-0.5 flex-shrink-0" />}
                  <span className={r.status === "error" ? "text-destructive" : "text-foreground"}>
                    {r.name}{r.message && <span className="text-muted-foreground"> — {r.message}</span>}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
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

      <BulkGeneratePanel />

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
