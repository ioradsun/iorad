export type SignalType = "job" | "news";
export type SnapshotStatus = "Generated" | "Low Signal" | "No Change" | "Error";
export type JobStatus = "queued" | "running" | "completed" | "failed" | "canceled";
export type JobItemStatus = "queued" | "running" | "succeeded" | "failed" | "skipped";
export type JobTrigger = "scheduled" | "manual";
export type RunFrequency = "daily" | "weekly" | "manual";
export type CoverageMode = "all" | "top_n";
export type WeekDay = "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" | "Saturday" | "Sunday";

export interface Company {
  id: string;
  name: string;
  domain: string | null;
  partner: string | null;
  partner_rep_email: string | null;
  partner_rep_name: string | null;
  hq_country: string | null;
  industry: string | null;
  headcount: number | null;
  is_existing_customer: boolean;
  persona: string | null;
  created_at: string;
  updated_at: string;
  last_processed_at: string | null;
  last_score_total: number | null;
  snapshot_status: SnapshotStatus | null;
  signals_count: number;
  score_breakdown?: ScoreBreakdown;
}

export interface Signal {
  id: string;
  company_id: string;
  type: SignalType;
  title: string;
  url: string;
  date: string | null;
  raw_excerpt: string;
  evidence_snippets: string[];
  discovered_at: string;
  last_seen_at: string;
}

export interface ScoreBreakdown {
  relevance: number;
  urgency: number;
  buyer_signal: number;
  rules_fired: string[];
  evidence_urls: string[];
}

export interface Snapshot {
  id: string;
  company_id: string;
  score_total: number;
  score_breakdown: ScoreBreakdown;
  snapshot_json: SnapshotJSON | null;
  model_version: string;
  prompt_version: string;
  created_at: string;
}

export interface SnapshotJSON {
  trigger_summary: string;
  evidence: {
    snippet: string;
    source_url: string;
    source_type: SignalType;
    date: string | null;
  }[];
  why_now: string[];
  likely_initiative: string;
  suggested_persona_targets: string[];
  confidence_level: "High" | "Medium" | "Low";
  confidence_reason: string;
  missing_data_questions: string[];
}

export interface ProcessingJob {
  id: string;
  status: JobStatus;
  trigger: JobTrigger;
  started_at: string;
  finished_at: string | null;
  settings_snapshot: AppSettings;
  total_companies_targeted: number;
  companies_processed: number;
  companies_succeeded: number;
  companies_failed: number;
  error_summary: string | null;
}

export interface ProcessingJobItem {
  id: string;
  job_id: string;
  company_id: string;
  company_name?: string;
  status: JobItemStatus;
  error_message: string | null;
  started_at: string | null;
  finished_at: string | null;
  signals_found_count: number;
  snapshot_status: SnapshotStatus | null;
}

export interface AppSettings {
  run_frequency: RunFrequency;
  weekly_run_day: WeekDay;
  run_time_local: string;
  timezone: string;
  batch_size: number;
  coverage_mode: CoverageMode;
  top_n: number;
  snapshot_threshold: number;
  jobs_lookback_days: number;
  news_lookback_days: number;
  max_companies_per_run: number;
  snapshot_max_age_days: number;
}

export interface CSVRow {
  company_name: string;
  domain: string | null;
  partner: string | null;
  partner_rep_email: string | null;
  partner_rep_name: string | null;
  hq_country: string | null;
  industry: string | null;
  headcount: number | null;
  is_existing_customer: boolean;
  persona: string | null;
}

export interface ValidationError {
  row: number;
  field: string;
  message: string;
}
