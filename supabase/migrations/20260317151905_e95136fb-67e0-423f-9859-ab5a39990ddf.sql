
-- sync_log: tracks every hourly sync run
CREATE TABLE public.sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  hours_back integer NOT NULL DEFAULT 2,
  status text NOT NULL DEFAULT 'running',
  contacts_found integer DEFAULT 0,
  companies_scored integer DEFAULT 0,
  error_count integer DEFAULT 0,
  errors jsonb DEFAULT '[]'::jsonb
);

ALTER TABLE public.sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read sync_log" ON public.sync_log
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Service role full access sync_log" ON public.sync_log
  FOR ALL TO public USING (true) WITH CHECK (true);
