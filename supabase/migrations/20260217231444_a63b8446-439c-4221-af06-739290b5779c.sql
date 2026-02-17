
-- Store all HubSpot properties as JSON blobs
ALTER TABLE public.companies ADD COLUMN hubspot_properties jsonb DEFAULT '{}';
ALTER TABLE public.contacts ADD COLUMN hubspot_properties jsonb DEFAULT '{}';
