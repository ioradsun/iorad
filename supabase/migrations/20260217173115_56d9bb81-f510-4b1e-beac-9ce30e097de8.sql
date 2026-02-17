
-- Create company_cards table
CREATE TABLE public.company_cards (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  cards_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  assets_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  account_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  model_version text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Unique constraint so we can upsert (one row per company, latest wins)
CREATE UNIQUE INDEX company_cards_company_id_unique ON public.company_cards(company_id);

-- Enable RLS
ALTER TABLE public.company_cards ENABLE ROW LEVEL SECURITY;

-- RLS policies (same pattern as snapshots)
CREATE POLICY "Anon can read company_cards" ON public.company_cards FOR SELECT USING (true);
CREATE POLICY "Anon can insert company_cards" ON public.company_cards FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated users can read company_cards" ON public.company_cards FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert company_cards" ON public.company_cards FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated users can update company_cards" ON public.company_cards FOR UPDATE USING (true);
CREATE POLICY "Anon can update company_cards" ON public.company_cards FOR UPDATE USING (true);

-- Add cards_prompt_template column to ai_config
ALTER TABLE public.ai_config ADD COLUMN cards_prompt_template text NOT NULL DEFAULT '';
