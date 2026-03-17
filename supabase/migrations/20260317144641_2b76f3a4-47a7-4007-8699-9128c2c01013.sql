ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS pql_signal boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_companies_pql_signal
  ON public.companies(pql_signal)
  WHERE pql_signal = true;