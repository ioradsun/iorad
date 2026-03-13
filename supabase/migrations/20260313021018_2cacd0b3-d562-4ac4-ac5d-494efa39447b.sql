-- Drop the legacy single-column unique index causing the error
DROP INDEX IF EXISTS public.company_cards_company_id_unique;

-- Drop duplicate composite index (keep only uq_company_cards_company_contact)
DROP INDEX IF EXISTS public.company_cards_company_contact_uniq;