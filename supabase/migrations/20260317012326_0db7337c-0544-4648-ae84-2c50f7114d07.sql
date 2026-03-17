ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS expansion_signal boolean NOT NULL DEFAULT false;

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS expansion_signal_at timestamptz DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_companies_expansion_signal
  ON public.companies(expansion_signal)
  WHERE expansion_signal = true;