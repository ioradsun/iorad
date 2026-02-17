
-- Create meetings table for Fathom integration
CREATE TABLE public.meetings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  fathom_meeting_id text NOT NULL UNIQUE,
  title text NOT NULL,
  meeting_date timestamp with time zone,
  duration_seconds integer,
  summary text,
  action_items jsonb DEFAULT '[]'::jsonb,
  transcript text,
  attendees jsonb DEFAULT '[]'::jsonb,
  fathom_url text,
  synced_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;

-- RLS policies (matching existing pattern)
CREATE POLICY "Anon can read meetings" ON public.meetings FOR SELECT USING (true);
CREATE POLICY "Anon can insert meetings" ON public.meetings FOR INSERT WITH CHECK (true);
CREATE POLICY "Anon can update meetings" ON public.meetings FOR UPDATE USING (true);
CREATE POLICY "Authenticated users can read meetings" ON public.meetings FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert meetings" ON public.meetings FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated users can update meetings" ON public.meetings FOR UPDATE USING (true);
CREATE POLICY "Authenticated users can delete meetings" ON public.meetings FOR DELETE USING (true);

-- Index for fast company lookups
CREATE INDEX idx_meetings_company_id ON public.meetings(company_id);
CREATE INDEX idx_meetings_fathom_id ON public.meetings(fathom_meeting_id);
