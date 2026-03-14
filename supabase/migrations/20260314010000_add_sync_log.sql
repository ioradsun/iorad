-- Lightweight log of each daily sync run for the status page
CREATE TABLE IF NOT EXISTS public.sync_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  hours_back integer NOT NULL DEFAULT 24,
  contacts_found integer DEFAULT 0,
  companies_created integer DEFAULT 0,
  companies_updated integer DEFAULT 0,
  contacts_created integer DEFAULT 0,
  contacts_updated integer DEFAULT 0,
  companies_scored integer DEFAULT 0,
  error_count integer DEFAULT 0,
  errors jsonb DEFAULT '[]'::jsonb,
  has_more boolean DEFAULT false,
  status text DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed'))
);

ALTER TABLE public.sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read" ON public.sync_log
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Service role full access" ON public.sync_log
  FOR ALL USING (true) WITH CHECK (true);

-- Index for the status page query (recent runs)
CREATE INDEX idx_sync_log_started_at ON public.sync_log(started_at DESC);
