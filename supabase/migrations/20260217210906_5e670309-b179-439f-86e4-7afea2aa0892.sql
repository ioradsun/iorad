
-- Add transcript analysis prompt to ai_config
ALTER TABLE public.ai_config ADD COLUMN transcript_prompt text NOT NULL DEFAULT '';

-- Add transcript analysis result to meetings
ALTER TABLE public.meetings ADD COLUMN transcript_analysis jsonb NULL;
