CREATE TABLE public.recent_companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  visited_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, company_id)
);

ALTER TABLE public.recent_companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own recents"
  ON public.recent_companies FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own recents"
  ON public.recent_companies FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own recents"
  ON public.recent_companies FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own recents"
  ON public.recent_companies FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);