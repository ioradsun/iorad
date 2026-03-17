CREATE TABLE public.sync_checkpoints (
  key text PRIMARY KEY,
  value text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sync_checkpoints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read" ON public.sync_checkpoints
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Service role full access" ON public.sync_checkpoints
  FOR ALL TO service_role USING (true) WITH CHECK (true);