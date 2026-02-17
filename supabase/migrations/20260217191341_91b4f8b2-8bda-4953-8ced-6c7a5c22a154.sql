
ALTER TABLE public.ai_config
  ADD COLUMN company_prompt text NOT NULL DEFAULT '',
  ADD COLUMN strategy_prompt text NOT NULL DEFAULT '',
  ADD COLUMN outreach_prompt text NOT NULL DEFAULT '',
  ADD COLUMN story_prompt text NOT NULL DEFAULT '';
