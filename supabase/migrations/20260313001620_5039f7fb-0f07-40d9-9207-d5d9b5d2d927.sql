-- Create unique index needed for the ON CONFLICT clause
CREATE UNIQUE INDEX IF NOT EXISTS uq_company_cards_company_contact
  ON public.company_cards (company_id, COALESCE(contact_id, '00000000-0000-0000-0000-000000000000'));

-- Create the merge function
CREATE OR REPLACE FUNCTION public.merge_company_card(
  p_company_id uuid,
  p_contact_id uuid,
  p_cards_json jsonb DEFAULT NULL,
  p_assets_json jsonb DEFAULT NULL,
  p_account_json jsonb DEFAULT NULL,
  p_model_version text DEFAULT NULL
) RETURNS void AS $$
BEGIN
  INSERT INTO company_cards (company_id, contact_id, cards_json, assets_json, account_json, model_version)
  VALUES (
    p_company_id,
    p_contact_id,
    COALESCE(p_cards_json, '[]'::jsonb),
    COALESCE(p_assets_json, '{}'::jsonb),
    COALESCE(p_account_json, '{}'::jsonb),
    p_model_version
  )
  ON CONFLICT (company_id, COALESCE(contact_id, '00000000-0000-0000-0000-000000000000'))
  DO UPDATE SET
    cards_json = CASE
      WHEN p_cards_json IS NOT NULL THEN p_cards_json
      ELSE company_cards.cards_json
    END,
    assets_json = CASE
      WHEN p_assets_json IS NOT NULL THEN company_cards.assets_json || p_assets_json
      ELSE company_cards.assets_json
    END,
    account_json = CASE
      WHEN p_account_json IS NOT NULL THEN company_cards.account_json || p_account_json
      ELSE company_cards.account_json
    END,
    model_version = COALESCE(p_model_version, company_cards.model_version);
END;
$$ LANGUAGE plpgsql;