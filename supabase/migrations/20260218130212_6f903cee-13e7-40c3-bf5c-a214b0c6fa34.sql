
-- Step 1: Add category and stage columns to companies
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'business',
  ADD COLUMN IF NOT EXISTS stage    text NOT NULL DEFAULT 'prospect';

-- Step 2: Auto-migrate existing companies
-- outbound with partner → partner/prospect
UPDATE public.companies
  SET category = 'partner', stage = 'prospect'
  WHERE source_type = 'outbound' AND partner IS NOT NULL AND partner != '';

-- outbound without partner → business/prospect
UPDATE public.companies
  SET category = 'business', stage = 'prospect'
  WHERE source_type = 'outbound' AND (partner IS NULL OR partner = '');

-- inbound → business/prospect
UPDATE public.companies
  SET category = 'business', stage = 'prospect'
  WHERE source_type = 'inbound';

-- Step 3: Add new prompt columns to ai_config for each category
ALTER TABLE public.ai_config
  ADD COLUMN IF NOT EXISTS school_system_prompt   text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS school_prompt_template text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS business_system_prompt   text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS business_prompt_template text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS partner_system_prompt   text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS partner_prompt_template text NOT NULL DEFAULT '';

-- Step 4: Pre-populate the new prompt columns from existing prompts
-- partner_* ← current system_prompt + prompt_template (outbound)
-- business_* ← current inbound_system_prompt + inbound_story_prompt
-- school_* ← blank (new vertical)
UPDATE public.ai_config
  SET
    partner_system_prompt   = COALESCE(system_prompt, ''),
    partner_prompt_template = COALESCE(prompt_template, ''),
    business_system_prompt  = COALESCE(inbound_system_prompt, ''),
    business_prompt_template = COALESCE(inbound_story_prompt, ''),
    school_system_prompt    = '',
    school_prompt_template  = ''
  WHERE id = 1;
