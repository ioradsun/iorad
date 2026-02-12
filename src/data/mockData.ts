import { Company, Signal, Snapshot, ProcessingJob, ProcessingJobItem, AppSettings, SnapshotJSON } from "@/types";

export const mockSettings: AppSettings = {
  run_frequency: "weekly",
  weekly_run_day: "Monday",
  run_time_local: "09:00",
  timezone: "America/New_York",
  batch_size: 25,
  coverage_mode: "top_n",
  top_n: 200,
  snapshot_threshold: 40,
  jobs_lookback_days: 60,
  news_lookback_days: 90,
  max_companies_per_run: 250,
  snapshot_max_age_days: 30,
};

export const mockCompanies: Company[] = [
  {
    id: "c1", name: "Acme Corp", domain: "acme.com", created_at: "2025-01-15T10:00:00Z",
    updated_at: "2025-02-10T14:30:00Z", last_processed_at: "2025-02-10T14:30:00Z",
    last_score_total: 85, snapshot_status: "Generated", signals_count: 7,
    score_breakdown: { relevance: 50, urgency: 25, buyer_signal: 10, rules_fired: ["onboarding_mention", "enablement_mention", "recent_job", "multiple_roles", "senior_title"], evidence_urls: ["https://acme.com/careers/123", "https://acme.com/news/launch"] },
  },
  {
    id: "c2", name: "TechStart Inc", domain: "techstart.io", created_at: "2025-01-15T10:00:00Z",
    updated_at: "2025-02-10T14:30:00Z", last_processed_at: "2025-02-10T14:30:00Z",
    last_score_total: 72, snapshot_status: "Generated", signals_count: 5,
    score_breakdown: { relevance: 30, urgency: 22, buyer_signal: 20, rules_fired: ["onboarding_mention", "recent_job", "news_signal", "senior_title", "buyer_org"], evidence_urls: ["https://techstart.io/careers/456"] },
  },
  {
    id: "c3", name: "GlobalEd Solutions", domain: "globaled.com", created_at: "2025-01-15T10:00:00Z",
    updated_at: "2025-02-09T11:00:00Z", last_processed_at: "2025-02-09T11:00:00Z",
    last_score_total: 65, snapshot_status: "Generated", signals_count: 4,
    score_breakdown: { relevance: 30, urgency: 15, buyer_signal: 20, rules_fired: ["customer_education_mention", "recent_job", "buyer_org"], evidence_urls: ["https://globaled.com/jobs/789"] },
  },
  {
    id: "c4", name: "Nimbus SaaS", domain: "nimbus.cloud", created_at: "2025-01-15T10:00:00Z",
    updated_at: "2025-02-08T09:00:00Z", last_processed_at: "2025-02-08T09:00:00Z",
    last_score_total: 45, snapshot_status: "Generated", signals_count: 3,
    score_breakdown: { relevance: 20, urgency: 15, buyer_signal: 10, rules_fired: ["knowledge_base_mention", "recent_job", "senior_title"], evidence_urls: [] },
  },
  {
    id: "c5", name: "Orbit Finance", domain: "orbitfin.co", created_at: "2025-01-15T10:00:00Z",
    updated_at: "2025-02-07T16:00:00Z", last_processed_at: "2025-02-07T16:00:00Z",
    last_score_total: 30, snapshot_status: "Low Signal", signals_count: 1,
    score_breakdown: { relevance: 10, urgency: 10, buyer_signal: 10, rules_fired: ["self_serve_mention"], evidence_urls: [] },
  },
  {
    id: "c6", name: "DataVault", domain: "datavault.io", created_at: "2025-01-16T10:00:00Z",
    updated_at: "2025-02-10T14:30:00Z", last_processed_at: "2025-02-10T14:30:00Z",
    last_score_total: 55, snapshot_status: "Generated", signals_count: 4,
    score_breakdown: { relevance: 30, urgency: 15, buyer_signal: 10, rules_fired: ["onboarding_mention", "recent_job", "senior_title"], evidence_urls: [] },
  },
  {
    id: "c7", name: "CloudPeak", domain: "cloudpeak.dev", created_at: "2025-01-16T10:00:00Z",
    updated_at: "2025-02-06T12:00:00Z", last_processed_at: "2025-02-06T12:00:00Z",
    last_score_total: 20, snapshot_status: "Low Signal", signals_count: 1,
    score_breakdown: { relevance: 10, urgency: 5, buyer_signal: 5, rules_fired: [], evidence_urls: [] },
  },
  {
    id: "c8", name: "Pinnacle HR", domain: "pinnaclehr.com", created_at: "2025-01-17T10:00:00Z",
    updated_at: "2025-02-10T14:30:00Z", last_processed_at: null,
    last_score_total: null, snapshot_status: null, signals_count: 0,
    score_breakdown: undefined,
  },
];

export const mockSignals: Signal[] = [
  {
    id: "s1", company_id: "c1", type: "job", title: "Customer Onboarding Manager",
    url: "https://acme.com/careers/123", date: "2025-02-01",
    raw_excerpt: "We're looking for a Customer Onboarding Manager to lead our onboarding and enablement initiatives...",
    evidence_snippets: [
      "Lead the design and delivery of scalable onboarding programs for enterprise customers.",
      "Build interactive training content and self-serve guides to reduce time-to-value.",
      "Partner with Product to create in-app guidance and tutorial experiences.",
    ],
    discovered_at: "2025-02-10T14:00:00Z", last_seen_at: "2025-02-10T14:00:00Z",
  },
  {
    id: "s2", company_id: "c1", type: "job", title: "Senior Enablement Specialist",
    url: "https://acme.com/careers/124", date: "2025-01-28",
    raw_excerpt: "Join our growing enablement team to build product training and customer education resources...",
    evidence_snippets: [
      "Develop product training materials for customer-facing teams.",
      "Create knowledge base articles and self-serve support documentation.",
    ],
    discovered_at: "2025-02-10T14:00:00Z", last_seen_at: "2025-02-10T14:00:00Z",
  },
  {
    id: "s3", company_id: "c1", type: "news", title: "Acme Corp Raises $50M Series C to Scale Customer Experience",
    url: "https://techcrunch.com/acme-series-c", date: "2025-01-20",
    raw_excerpt: "Acme Corp announced a $50M Series C round led by Sequoia Capital to accelerate product-led growth and customer experience initiatives.",
    evidence_snippets: [
      "Funding will be used to scale customer onboarding and product adoption programs.",
      "Company plans to triple its customer education team by end of year.",
    ],
    discovered_at: "2025-02-10T14:00:00Z", last_seen_at: "2025-02-10T14:00:00Z",
  },
];

const mockSnapshotJSON: SnapshotJSON = {
  trigger_summary: "Acme Corp is actively hiring for onboarding and enablement roles while investing heavily in customer experience following a $50M Series C.",
  evidence: [
    { snippet: "Lead the design and delivery of scalable onboarding programs for enterprise customers.", source_url: "https://acme.com/careers/123", source_type: "job", date: "2025-02-01" },
    { snippet: "Funding will be used to scale customer onboarding and product adoption programs.", source_url: "https://techcrunch.com/acme-series-c", source_type: "news", date: "2025-01-20" },
    { snippet: "Company plans to triple its customer education team by end of year.", source_url: "https://techcrunch.com/acme-series-c", source_type: "news", date: "2025-01-20" },
  ],
  why_now: [
    "Fresh $50M funding earmarked for customer experience scaling.",
    "Multiple onboarding/enablement roles posted in last 30 days.",
    "Growing enterprise customer base requiring structured onboarding.",
  ],
  likely_initiative: "Scaling customer onboarding and enablement programs to support product-led growth and enterprise expansion.",
  suggested_persona_targets: [
    "VP of Customer Experience",
    "Head of Customer Education",
    "Director of Enablement",
  ],
  confidence_level: "High",
  confidence_reason: "Strong job signal correlation with recent funding round specifically targeting customer experience and onboarding.",
  missing_data_questions: [
    "What specific onboarding tools are currently in use?",
    "What is the current customer base size and growth rate?",
  ],
};

export const mockSnapshots: Snapshot[] = [
  {
    id: "snap1", company_id: "c1", score_total: 85,
    score_breakdown: { relevance: 50, urgency: 25, buyer_signal: 10, rules_fired: ["onboarding_mention", "enablement_mention", "recent_job", "multiple_roles", "senior_title"], evidence_urls: ["https://acme.com/careers/123"] },
    snapshot_json: mockSnapshotJSON, model_version: "google/gemini-3-flash-preview", prompt_version: "v1.0",
    created_at: "2025-02-10T14:30:00Z",
  },
];

export const mockJobs: ProcessingJob[] = [
  {
    id: "j1", status: "completed", trigger: "manual",
    started_at: "2025-02-10T14:00:00Z", finished_at: "2025-02-10T14:35:00Z",
    settings_snapshot: mockSettings,
    total_companies_targeted: 8, companies_processed: 8, companies_succeeded: 7, companies_failed: 1,
    error_summary: "1 company failed: CloudPeak (timeout during signal fetch)",
  },
  {
    id: "j2", status: "completed", trigger: "scheduled",
    started_at: "2025-02-03T14:00:00Z", finished_at: "2025-02-03T14:28:00Z",
    settings_snapshot: mockSettings,
    total_companies_targeted: 8, companies_processed: 8, companies_succeeded: 8, companies_failed: 0,
    error_summary: null,
  },
];

export const mockJobItems: ProcessingJobItem[] = [
  { id: "ji1", job_id: "j1", company_id: "c1", company_name: "Acme Corp", status: "succeeded", error_message: null, started_at: "2025-02-10T14:00:00Z", finished_at: "2025-02-10T14:05:00Z", signals_found_count: 7, snapshot_status: "Generated" },
  { id: "ji2", job_id: "j1", company_id: "c2", company_name: "TechStart Inc", status: "succeeded", error_message: null, started_at: "2025-02-10T14:05:00Z", finished_at: "2025-02-10T14:10:00Z", signals_found_count: 5, snapshot_status: "Generated" },
  { id: "ji3", job_id: "j1", company_id: "c7", company_name: "CloudPeak", status: "failed", error_message: "Timeout during signal fetch after 30s", started_at: "2025-02-10T14:30:00Z", finished_at: "2025-02-10T14:31:00Z", signals_found_count: 0, snapshot_status: null },
];
