-- Add hubspot_object_id to companies for HubSpot sync resolution
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS hubspot_object_id text;

-- Index for fast lookups during sync
CREATE INDEX IF NOT EXISTS idx_companies_hubspot_object_id ON public.companies(hubspot_object_id) WHERE hubspot_object_id IS NOT NULL;