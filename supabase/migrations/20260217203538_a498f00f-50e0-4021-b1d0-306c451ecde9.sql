
-- Add contact_id to company_cards for per-contact bespoke content
ALTER TABLE public.company_cards ADD COLUMN contact_id uuid REFERENCES public.contacts(id) ON DELETE CASCADE;

-- Drop the old unique constraint on company_id only
ALTER TABLE public.company_cards DROP CONSTRAINT IF EXISTS company_cards_company_id_key;

-- Create new unique constraint on (company_id, contact_id)
-- contact_id NULL = company-level default, non-null = contact-specific
CREATE UNIQUE INDEX company_cards_company_contact_uniq ON public.company_cards (company_id, COALESCE(contact_id, '00000000-0000-0000-0000-000000000000'));
