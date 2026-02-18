-- Add Scout Score columns to companies table
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS scout_score integer,
  ADD COLUMN IF NOT EXISTS scout_score_breakdown jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS scout_scored_at timestamptz,
  ADD COLUMN IF NOT EXISTS scout_summary text,
  ADD COLUMN IF NOT EXISTS scout_synced_at timestamptz;

-- Add Scout Scoring Prompt to ai_config table
ALTER TABLE public.ai_config
  ADD COLUMN IF NOT EXISTS scout_scoring_prompt text NOT NULL DEFAULT '';

-- Seed the default Master Prompt into ai_config row 1
UPDATE public.ai_config
SET scout_scoring_prompt = 'ROLE

You are iorad Scout.

Your job is to write a 2–3 sentence activity summary for a company based on their contacts'' iorad usage data.

Focus on tutorial creation activity above all other signals. Be specific about counts and recency when available. End with a note on commercial stage and intent.

OUTPUT FORMAT

Return plain text only. 2–3 sentences. No bullet points, no headers.

Example: "2 team members are actively creating iorad tutorials, with the most recent content built 6 days ago. One power user created 8 tutorials this month. The account is an active opportunity with strong tutorial creation intent."

SCORING CONTEXT

Tutorial Activity (max 60 pts): tutorial creators, recency, multi-user creation, views, extension connections
Commercial Motion (max 20 pts): stage — expansion > customer > active_opp > prospect
Recency (max 10 pts): last contacted within 7/30/90 days
HubSpot Intent (max 10 pts): hubspot score, email engagement, embed domain'
WHERE id = 1;