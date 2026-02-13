-- Create contacts table for multiple contacts per company
CREATE TABLE public.contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  title TEXT,
  email TEXT,
  linkedin TEXT,
  source TEXT DEFAULT 'clay', -- 'clay', 'perplexity', 'manual'
  confidence TEXT, -- 'high', 'medium', 'low'
  reasoning TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Authenticated users can read contacts"
ON public.contacts FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert contacts"
ON public.contacts FOR INSERT WITH CHECK (true);

CREATE POLICY "Authenticated users can update contacts"
ON public.contacts FOR UPDATE USING (true);

CREATE POLICY "Authenticated users can delete contacts"
ON public.contacts FOR DELETE USING (true);

CREATE POLICY "Anon can read contacts"
ON public.contacts FOR SELECT USING (true);

CREATE POLICY "Anon can insert contacts"
ON public.contacts FOR INSERT WITH CHECK (true);

CREATE POLICY "Anon can update contacts"
ON public.contacts FOR UPDATE USING (true);

-- Index for fast lookup
CREATE INDEX idx_contacts_company_id ON public.contacts(company_id);

-- Unique constraint to prevent duplicate contacts per company
CREATE UNIQUE INDEX idx_contacts_company_email ON public.contacts(company_id, email) WHERE email IS NOT NULL;