
-- Granular sync event log: one row per entity touched by any sync process
CREATE TABLE IF NOT EXISTS public.sync_events (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at  timestamptz NOT NULL DEFAULT now(),
  source      text NOT NULL,
  job_id      text,
  entity_type text NOT NULL,
  entity_id   uuid,
  entity_name text,
  action      text NOT NULL,
  diff        jsonb DEFAULT '{}',
  batch_seq   int,
  cursor_val  text,
  meta        jsonb DEFAULT '{}'
);

-- Indexes
CREATE INDEX idx_sync_events_created_at ON public.sync_events (created_at DESC);
CREATE INDEX idx_sync_events_source ON public.sync_events (source, created_at DESC);
CREATE INDEX idx_sync_events_job_id ON public.sync_events (job_id, created_at DESC) WHERE job_id IS NOT NULL;

-- RLS
ALTER TABLE public.sync_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON public.sync_events USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can read" ON public.sync_events FOR SELECT TO authenticated USING (true);

-- Realtime for live feed
ALTER PUBLICATION supabase_realtime ADD TABLE public.sync_events;
