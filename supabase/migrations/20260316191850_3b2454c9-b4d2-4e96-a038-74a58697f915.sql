CREATE TABLE IF NOT EXISTS public.backfill_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  job_type text NOT NULL DEFAULT 'plan_names',
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status text NOT NULL DEFAULT 'running',
  contacts_total integer DEFAULT 0,
  contacts_processed integer DEFAULT 0,
  contacts_updated integer DEFAULT 0,
  contacts_skipped integer DEFAULT 0,
  companies_rescored integer DEFAULT 0,
  current_offset integer DEFAULT 0,
  error text DEFAULT null
);

ALTER TABLE public.backfill_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read" ON public.backfill_log
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Service role full access" ON public.backfill_log
  FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX idx_backfill_log_started_at ON public.backfill_log(started_at DESC);