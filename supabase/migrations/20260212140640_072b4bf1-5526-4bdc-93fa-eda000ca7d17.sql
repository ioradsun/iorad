
-- Add buyer contact fields to companies table
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS buyer_name TEXT;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS buyer_title TEXT;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS buyer_email TEXT;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS buyer_linkedin TEXT;
