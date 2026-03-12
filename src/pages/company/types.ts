import { Json } from "@/integrations/supabase/types";

export interface ScoreBreakdown {
  relevance?: number; urgency?: number; buyer_signal?: number;
  hiring?: number; news?: number; expansion?: number;
  rules_fired?: string[]; evidence_urls?: string[];
}

export interface SnapshotJSON {
  trigger_summary?: string; why_now?: string | string[];
  likely_initiative?: string; suggested_persona_targets?: string[];
  confidence_level?: string; confidence_reason?: string;
  missing_data_questions?: string[];
  evidence?: { snippet?: string; detail?: string; signal_type?: string; source_url?: string; url?: string; source_type?: string; date?: string | null }[];
  signal_deconstruction?: { observable_facts?: string[]; company_stage?: string; workflow_stress_indicators?: string[] };
  operational_friction?: { cause?: string; effect?: string; bottleneck?: string }[];
  partner_platform_ceiling?: { platform_strengths?: string[]; execution_gaps?: string[]; key_insight?: string };
  embedded_leverage?: { situation?: string; constraint?: string; intervention?: string; transformation?: string };
  quantified_impact?: { metric?: string; assumptions?: string; calculation?: string; result?: string }[];
  executive_narrative?: string;
  outbound_positioning?: { executive_framing?: string; efficiency_framing?: string; risk_framing?: string };
  competitive_insulation?: string[];
}

export interface Strategy { title: string; pitch: string; why_now: string; proof: string; what_to_validate: string[]; sources: string[] }
export interface DashboardCard { id: string; title: string; priority: string; fields?: { label: string; value: string; status?: string; source?: string }[]; actions?: { label: string; value: string }[]; strategies?: Strategy[] }
export interface EmailTouch { subject_lines: string[]; body: string }
export interface LinkedInStep { step: number; timing: string; message: string }
export interface StoryAssets {
  active_strategy?: string;
  primary_asset?: {
    type: string; title: string; purpose: string; covers: string[];
    when_to_send: string; intro_message: string; loom_script: string;
  };
  supporting_asset?: {
    type: string; title: string; environment: string; what_it_guides: string[];
    business_outcome: string; when_to_send: string; intro_message: string; embed_context: string;
  };
}

// --- Helpers ---

export function toArray(val: unknown): string[] {
  if (Array.isArray(val)) return val.map(String);
  if (typeof val === "string" && val) return [val];
  return [];
}

export function parseJson<T>(val: Json | null | undefined): T | null {
  if (!val) return null;
  if (typeof val === "object") return val as unknown as T;
  try { return JSON.parse(String(val)); } catch { return null; }
}

export function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text);
}

export function toLoomEmbedUrl(url: string): string | null {
  if (!url) return null;
  const match = url.match(/loom\.com\/(?:share|embed)\/([a-zA-Z0-9]+)/);
  if (match) return `https://www.loom.com/embed/${match[1]}`;
  return null;
}

export function toIoradEmbedUrl(url: string): string | null {
  if (!url) return null;
  const base = url.split("?")[0];
  return `${base}${url.includes("?") ? "&" : "?"}oembed=1`;
}

// --- Truth Status Badge ---
export const statusColors: Record<string, string> = {
  Provided: "bg-primary/10 text-primary border-primary/20",
  "Source-backed": "bg-info/10 text-info border-info/20",
  Inference: "bg-warning/10 text-warning border-warning/20",
  Hypothesis: "bg-accent/50 text-accent-foreground border-accent",
  Unknown: "bg-muted text-muted-foreground border-border",
};
