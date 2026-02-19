ALTER TABLE public.processing_jobs DROP CONSTRAINT processing_jobs_trigger_check;

ALTER TABLE public.processing_jobs ADD CONSTRAINT processing_jobs_trigger_check
  CHECK (trigger = ANY (ARRAY[
    'scheduled'::text,
    'manual'::text,
    'bulk_import'::text,
    'score_all'::text,
    'hubspot_sync'::text,
    'hubspot_backfill'::text,
    'hubspot_pipeline'::text
  ]));