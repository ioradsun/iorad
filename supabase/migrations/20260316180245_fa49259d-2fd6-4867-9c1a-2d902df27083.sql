
-- Step 1: Rename category → account_type
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS account_type text NOT NULL DEFAULT 'company';
UPDATE public.companies SET account_type = CASE category
  WHEN 'business' THEN 'company'
  WHEN 'school'   THEN 'school'
  WHEN 'partner'  THEN 'partner'
  ELSE 'company'
END;
ALTER TABLE public.companies DROP COLUMN category;

-- Step 2: Rename stage → lifecycle_stage
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS lifecycle_stage text NOT NULL DEFAULT 'prospect';
UPDATE public.companies SET lifecycle_stage = CASE stage
  WHEN 'prospect'   THEN 'prospect'
  WHEN 'active_opp' THEN 'opportunity'
  WHEN 'customer'   THEN 'customer'
  WHEN 'expansion'  THEN 'customer'
  ELSE 'prospect'
END;
ALTER TABLE public.companies DROP COLUMN stage;

-- Step 3: Add sales_motion
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS sales_motion text NOT NULL DEFAULT 'new-logo';
UPDATE public.companies SET sales_motion = CASE lifecycle_stage
  WHEN 'prospect'    THEN 'new-logo'
  WHEN 'opportunity' THEN 'active-deal'
  WHEN 'customer'    THEN 'expansion'
  ELSE 'new-logo'
END;

-- Step 4: Add relationship_type
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS relationship_type text NOT NULL DEFAULT 'direct';
UPDATE public.companies SET relationship_type = CASE
  WHEN partner IS NOT NULL AND partner != '' THEN 'partner-managed'
  ELSE 'direct'
END;

-- Step 5: Add brief_type
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS brief_type text NOT NULL DEFAULT 'prospectBrief';
UPDATE public.companies SET brief_type = CASE lifecycle_stage
  WHEN 'prospect'    THEN 'prospectBrief'
  WHEN 'opportunity' THEN 'opportunityBrief'
  WHEN 'customer'    THEN 'expansionBrief'
  ELSE 'prospectBrief'
END;

-- Step 6: Sync is_existing_customer
UPDATE public.companies SET is_existing_customer = (lifecycle_stage = 'customer');

-- Step 7: Rename ai_config prompt columns
ALTER TABLE public.ai_config RENAME COLUMN business_system_prompt TO prospect_brief_system_prompt;
ALTER TABLE public.ai_config RENAME COLUMN business_prompt_template TO prospect_brief_template;
ALTER TABLE public.ai_config RENAME COLUMN school_system_prompt TO opportunity_brief_system_prompt;
ALTER TABLE public.ai_config RENAME COLUMN school_prompt_template TO opportunity_brief_template;
ALTER TABLE public.ai_config RENAME COLUMN partner_system_prompt TO expansion_brief_system_prompt;
ALTER TABLE public.ai_config RENAME COLUMN partner_prompt_template TO expansion_brief_template;

-- Step 8: Indexes
CREATE INDEX IF NOT EXISTS idx_companies_account_type ON public.companies(account_type);
CREATE INDEX IF NOT EXISTS idx_companies_lifecycle_stage ON public.companies(lifecycle_stage);
CREATE INDEX IF NOT EXISTS idx_companies_sales_motion ON public.companies(sales_motion);
CREATE INDEX IF NOT EXISTS idx_companies_relationship_type ON public.companies(relationship_type);
CREATE INDEX IF NOT EXISTS idx_companies_brief_type ON public.companies(brief_type);

-- Expected companies columns after migration:
--   account_type:      company | school | partner
--   lifecycle_stage:   prospect | opportunity | customer
--   sales_motion:      new-logo | active-deal | expansion
--   relationship_type: direct | partner-managed
--   brief_type:        prospectBrief | opportunityBrief | expansionBrief
--
-- Dropped columns: category, stage
-- ai_config prompt columns renamed to prospect_brief_*, opportunity_brief_*, expansion_brief_*
