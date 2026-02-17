
ALTER TABLE public.ai_config
  ADD COLUMN inbound_strategy_prompt text NOT NULL DEFAULT '',
  ADD COLUMN inbound_outreach_prompt text NOT NULL DEFAULT '',
  ADD COLUMN inbound_story_prompt text NOT NULL DEFAULT '',
  ADD COLUMN inbound_transcript_prompt text NOT NULL DEFAULT '';
