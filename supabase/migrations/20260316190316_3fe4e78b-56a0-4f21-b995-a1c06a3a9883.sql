ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS last_sync_changes jsonb DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_companies_iorad_plan ON public.companies(iorad_plan);