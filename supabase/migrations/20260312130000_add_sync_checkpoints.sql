CREATE TABLE IF NOT EXISTS public.sync_checkpoints (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sync_checkpoints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON public.sync_checkpoints
  USING (true) WITH CHECK (true);
