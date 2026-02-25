
-- 1. internal_signals table
CREATE TABLE public.internal_signals (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  author_id uuid NOT NULL,
  author_name text NOT NULL,
  author_avatar text,
  title text NOT NULL,
  description text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  reactions jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.internal_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can select internal_signals"
  ON public.internal_signals FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert internal_signals"
  ON public.internal_signals FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update internal_signals"
  ON public.internal_signals FOR UPDATE
  TO authenticated USING (true);

-- 2. signal_comments table
CREATE TABLE public.signal_comments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  signal_id uuid NOT NULL REFERENCES public.internal_signals(id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  author_name text NOT NULL,
  author_avatar text,
  body text NOT NULL,
  parent_id uuid REFERENCES public.signal_comments(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.signal_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can select signal_comments"
  ON public.signal_comments FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert signal_comments"
  ON public.signal_comments FOR INSERT
  TO authenticated WITH CHECK (true);

-- 3. signal_notifications table
CREATE TABLE public.signal_notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  signal_id uuid NOT NULL REFERENCES public.internal_signals(id) ON DELETE CASCADE,
  type text NOT NULL,
  actor_name text NOT NULL,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.signal_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own signal_notifications"
  ON public.signal_notifications FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Authenticated users can insert signal_notifications"
  ON public.signal_notifications FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "Users can update own signal_notifications"
  ON public.signal_notifications FOR UPDATE
  TO authenticated USING (auth.uid() = user_id);

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.signal_notifications;
