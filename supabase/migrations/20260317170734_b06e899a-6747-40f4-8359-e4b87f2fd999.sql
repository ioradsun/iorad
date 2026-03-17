-- Add unique constraint so contact upserts work correctly
CREATE UNIQUE INDEX idx_contacts_company_hubspot ON public.contacts (company_id, hubspot_object_id)
WHERE hubspot_object_id IS NOT NULL;