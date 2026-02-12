
-- Companies table
CREATE TABLE public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  domain TEXT,
  partner TEXT,
  partner_rep_email TEXT,
  partner_rep_name TEXT,
  hq_country TEXT,
  industry TEXT,
  headcount INTEGER,
  is_existing_customer BOOLEAN NOT NULL DEFAULT false,
  persona TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_processed_at TIMESTAMPTZ,
  last_score_total INTEGER,
  snapshot_status TEXT CHECK (snapshot_status IN ('Generated', 'Low Signal', 'No Change', 'Error'))
);

-- Signals table
CREATE TABLE public.signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('job', 'news')),
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  date DATE,
  raw_excerpt TEXT,
  evidence_snippets JSONB NOT NULL DEFAULT '[]',
  discovered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, url)
);

-- Snapshots table
CREATE TABLE public.snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  score_total INTEGER NOT NULL DEFAULT 0,
  score_breakdown JSONB NOT NULL DEFAULT '{}',
  snapshot_json JSONB,
  model_version TEXT,
  prompt_version TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- App settings (single row pattern)
CREATE TABLE public.app_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  run_frequency TEXT NOT NULL DEFAULT 'weekly' CHECK (run_frequency IN ('daily', 'weekly', 'manual')),
  weekly_run_day TEXT NOT NULL DEFAULT 'Monday',
  run_time_local TEXT NOT NULL DEFAULT '09:00',
  timezone TEXT NOT NULL DEFAULT 'America/New_York',
  batch_size INTEGER NOT NULL DEFAULT 25,
  coverage_mode TEXT NOT NULL DEFAULT 'top_n' CHECK (coverage_mode IN ('all', 'top_n')),
  top_n INTEGER NOT NULL DEFAULT 200,
  snapshot_threshold INTEGER NOT NULL DEFAULT 40,
  jobs_lookback_days INTEGER NOT NULL DEFAULT 60,
  news_lookback_days INTEGER NOT NULL DEFAULT 90,
  max_companies_per_run INTEGER NOT NULL DEFAULT 250,
  snapshot_max_age_days INTEGER NOT NULL DEFAULT 30,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Insert default settings row
INSERT INTO public.app_settings (id) VALUES (1);

-- Processing jobs table
CREATE TABLE public.processing_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'completed', 'failed', 'canceled')),
  trigger TEXT NOT NULL DEFAULT 'manual' CHECK (trigger IN ('scheduled', 'manual')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  settings_snapshot JSONB NOT NULL DEFAULT '{}',
  total_companies_targeted INTEGER NOT NULL DEFAULT 0,
  companies_processed INTEGER NOT NULL DEFAULT 0,
  companies_succeeded INTEGER NOT NULL DEFAULT 0,
  companies_failed INTEGER NOT NULL DEFAULT 0,
  error_summary TEXT
);

-- Processing job items table
CREATE TABLE public.processing_job_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.processing_jobs(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'succeeded', 'failed', 'skipped')),
  error_message TEXT,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  signals_found_count INTEGER NOT NULL DEFAULT 0,
  snapshot_status TEXT CHECK (snapshot_status IN ('Generated', 'Low Signal', 'No Change', 'Error'))
);

-- Indexes for performance
CREATE INDEX idx_signals_company_id ON public.signals(company_id);
CREATE INDEX idx_snapshots_company_id ON public.snapshots(company_id);
CREATE INDEX idx_snapshots_created_at ON public.snapshots(created_at DESC);
CREATE INDEX idx_processing_job_items_job_id ON public.processing_job_items(job_id);
CREATE INDEX idx_companies_last_score ON public.companies(last_score_total DESC NULLS LAST);
CREATE INDEX idx_companies_domain ON public.companies(domain);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON public.companies FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_app_settings_updated_at BEFORE UPDATE ON public.app_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS on all tables
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processing_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processing_job_items ENABLE ROW LEVEL SECURITY;

-- Since this is an internal tool, allow all authenticated users full access
-- Companies
CREATE POLICY "Authenticated users can read companies" ON public.companies FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert companies" ON public.companies FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update companies" ON public.companies FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete companies" ON public.companies FOR DELETE TO authenticated USING (true);

-- Signals
CREATE POLICY "Authenticated users can read signals" ON public.signals FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert signals" ON public.signals FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update signals" ON public.signals FOR UPDATE TO authenticated USING (true);

-- Snapshots
CREATE POLICY "Authenticated users can read snapshots" ON public.snapshots FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert snapshots" ON public.snapshots FOR INSERT TO authenticated WITH CHECK (true);

-- App settings
CREATE POLICY "Authenticated users can read settings" ON public.app_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can update settings" ON public.app_settings FOR UPDATE TO authenticated USING (true);

-- Processing jobs
CREATE POLICY "Authenticated users can read jobs" ON public.processing_jobs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert jobs" ON public.processing_jobs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update jobs" ON public.processing_jobs FOR UPDATE TO authenticated USING (true);

-- Processing job items
CREATE POLICY "Authenticated users can read job items" ON public.processing_job_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert job items" ON public.processing_job_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update job items" ON public.processing_job_items FOR UPDATE TO authenticated USING (true);

-- Also allow anon access for edge functions (service role bypasses RLS, but anon key used from client)
-- For this internal tool, we'll also allow anon read for now to simplify MVP
CREATE POLICY "Anon can read companies" ON public.companies FOR SELECT TO anon USING (true);
CREATE POLICY "Anon can insert companies" ON public.companies FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon can update companies" ON public.companies FOR UPDATE TO anon USING (true);
CREATE POLICY "Anon can read signals" ON public.signals FOR SELECT TO anon USING (true);
CREATE POLICY "Anon can read snapshots" ON public.snapshots FOR SELECT TO anon USING (true);
CREATE POLICY "Anon can read settings" ON public.app_settings FOR SELECT TO anon USING (true);
CREATE POLICY "Anon can update settings" ON public.app_settings FOR UPDATE TO anon USING (true);
CREATE POLICY "Anon can read jobs" ON public.processing_jobs FOR SELECT TO anon USING (true);
CREATE POLICY "Anon can insert jobs" ON public.processing_jobs FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon can update jobs" ON public.processing_jobs FOR UPDATE TO anon USING (true);
CREATE POLICY "Anon can read job items" ON public.processing_job_items FOR SELECT TO anon USING (true);
CREATE POLICY "Anon can insert job items" ON public.processing_job_items FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon can update job items" ON public.processing_job_items FOR UPDATE TO anon USING (true);
CREATE POLICY "Anon can insert signals" ON public.signals FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon can update signals" ON public.signals FOR UPDATE TO anon USING (true);
CREATE POLICY "Anon can insert snapshots" ON public.snapshots FOR INSERT TO anon WITH CHECK (true);
