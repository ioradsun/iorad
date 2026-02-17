
-- Activity events captured from HubSpot engagement timeline
CREATE TABLE public.customer_activity (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  activity_type text NOT NULL,          -- e.g. PAGE_VIEW, FORM_SUBMISSION, EMAIL_OPEN, EMAIL_CLICK, CTA_CLICK, MEETING
  title text NOT NULL DEFAULT '',
  url text,
  occurred_at timestamp with time zone NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}',
  hubspot_event_id text,                -- dedup key
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.customer_activity ENABLE ROW LEVEL SECURITY;

-- Policies matching the rest of the app
CREATE POLICY "Anon can read customer_activity" ON public.customer_activity FOR SELECT USING (true);
CREATE POLICY "Anon can insert customer_activity" ON public.customer_activity FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated users can read customer_activity" ON public.customer_activity FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert customer_activity" ON public.customer_activity FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated users can update customer_activity" ON public.customer_activity FOR UPDATE USING (true);
CREATE POLICY "Authenticated users can delete customer_activity" ON public.customer_activity FOR DELETE USING (true);

-- Indexes for fast lookup
CREATE INDEX idx_customer_activity_company ON public.customer_activity(company_id, occurred_at DESC);
CREATE UNIQUE INDEX idx_customer_activity_hubspot_event ON public.customer_activity(hubspot_event_id) WHERE hubspot_event_id IS NOT NULL;
