-- Add contact_profile column for AI-extracted product usage profiles
ALTER TABLE public.contacts
ADD COLUMN contact_profile jsonb DEFAULT NULL;

-- Add profile_extracted_at to track when the profile was last generated
ALTER TABLE public.contacts
ADD COLUMN profile_extracted_at timestamp with time zone DEFAULT NULL;

COMMENT ON COLUMN public.contacts.contact_profile IS 'AI-extracted structured product usage profile from raw HubSpot properties';
COMMENT ON COLUMN public.contacts.profile_extracted_at IS 'Timestamp of last AI profile extraction';