
-- AI Config table (stores system prompt, model, and other AI settings)
CREATE TABLE public.ai_config (
  id integer PRIMARY KEY DEFAULT 1,
  system_prompt text NOT NULL DEFAULT '',
  model text NOT NULL DEFAULT 'google/gemini-2.5-flash',
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT ai_config_singleton CHECK (id = 1)
);

ALTER TABLE public.ai_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read ai_config"
  ON public.ai_config FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can update ai_config"
  ON public.ai_config FOR UPDATE TO authenticated
  USING (true);

-- Seed initial row
INSERT INTO public.ai_config (id, system_prompt, model) VALUES (
  1,
  'You are an elite enterprise storyteller and GTM strategist for iorad.
Style: confident, precise, "Don Draper convincing" — never hypey. No generic enablement fluff.

iorad integrates natively inside: Seismic, WorkRamp, 360Learning, Docebo, Gainsight.
Frame iorad as: unlock more value inside what they already use — turning static knowledge into embedded execution.',
  'google/gemini-2.5-flash'
);

-- Compelling Events table
CREATE TABLE public.compelling_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL UNIQUE,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.compelling_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read compelling_events"
  ON public.compelling_events FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert compelling_events"
  ON public.compelling_events FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update compelling_events"
  ON public.compelling_events FOR UPDATE TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete compelling_events"
  ON public.compelling_events FOR DELETE TO authenticated
  USING (true);

-- Allow anon to read for edge function usage
CREATE POLICY "Anon can read compelling_events"
  ON public.compelling_events FOR SELECT TO anon
  USING (true);

-- Seed compelling events
INSERT INTO public.compelling_events (label, sort_order) VALUES
  ('platform rollout/migration', 1),
  ('tool consolidation/replacement', 2),
  ('rapid stack expansion', 3),
  ('hiring surge', 4),
  ('new enablement/L&D leader', 5),
  ('LMS launch/migration', 6),
  ('certification/compliance push', 7),
  ('customer education launch', 8),
  ('new product/feature release', 9),
  ('support burden pressure', 10),
  ('tech consolidation/cost pressure', 11),
  ('lightweight in-app guidance interest', 12),
  ('M&A integration', 13);

-- Partner Config table
CREATE TABLE public.partner_config (
  id text PRIMARY KEY,
  label text NOT NULL,
  positioning text NOT NULL DEFAULT '',
  embed_bullets text[] NOT NULL DEFAULT '{}',
  color text NOT NULL DEFAULT '#10B981',
  gradient text NOT NULL DEFAULT 'from-emerald-900/20 to-green-900/10',
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.partner_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read partner_config"
  ON public.partner_config FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert partner_config"
  ON public.partner_config FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update partner_config"
  ON public.partner_config FOR UPDATE TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete partner_config"
  ON public.partner_config FOR DELETE TO authenticated
  USING (true);

-- Allow anon to read for edge function + public story pages
CREATE POLICY "Anon can read partner_config"
  ON public.partner_config FOR SELECT TO anon
  USING (true);

-- Also allow anon to read ai_config for edge function
CREATE POLICY "Anon can read ai_config"
  ON public.ai_config FOR SELECT TO anon
  USING (true);

-- Seed partner config
INSERT INTO public.partner_config (id, label, positioning, embed_bullets, color, gradient, sort_order) VALUES
  ('seismic', 'Seismic', 'Transforming sales enablement into operational execution',
   ARRAY['Interactive how-to guides embedded directly in Seismic content pages', 'Step-by-step walkthroughs linked from enablement playbooks', 'Live workflow guidance accessible inside sales content hubs'],
   '#1B3A5C', 'from-blue-900/20 to-cyan-900/10', 1),
  ('workramp', 'WorkRamp', 'Closing the gap between learning completion and workflow execution',
   ARRAY['Interactive tutorials embedded within WorkRamp learning paths', 'Guided walkthroughs for onboarding and enablement modules', 'Live application guidance integrated into course completions'],
   '#4F46E5', 'from-indigo-900/20 to-violet-900/10', 2),
  ('360learning', '360Learning', 'Turning collaborative learning into operational competency',
   ARRAY['Step-by-step guides embedded in collaborative courses', 'Interactive walkthroughs for peer-authored content', 'Workflow guidance integrated into learning reactions and paths'],
   '#00B4D8', 'from-cyan-900/20 to-teal-900/10', 3),
  ('docebo', 'Docebo', 'Operationalizing Docebo''s learning infrastructure with execution-ready content',
   ARRAY['Interactive step-by-step guides embedded inside Docebo courses', 'Guided walkthroughs integrated into learning paths and certifications', 'Always-current how-to content distributed across global partner networks'],
   '#FF6B35', 'from-orange-900/20 to-amber-900/10', 4),
  ('gainsight', 'Gainsight', 'Converting customer success playbooks into self-serve execution',
   ARRAY['Interactive guides embedded within Gainsight success playbooks', 'Step-by-step walkthroughs for customer onboarding journeys', 'Workflow guidance integrated into health score action items'],
   '#00C853', 'from-emerald-900/20 to-green-900/10', 5);
