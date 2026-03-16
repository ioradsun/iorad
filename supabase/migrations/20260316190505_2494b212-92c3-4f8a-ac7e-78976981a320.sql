ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS hubspot_object_id text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_company_hubspot_object_id
  ON public.contacts(company_id, hubspot_object_id)
  WHERE hubspot_object_id IS NOT NULL;