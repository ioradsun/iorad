-- Canonical HubSpot object IDs for deterministic upserts
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS hubspot_object_id text;

ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS hubspot_object_id text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_companies_hubspot_object_id
  ON public.companies(hubspot_object_id)
  WHERE hubspot_object_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_company_hubspot_object_id
  ON public.contacts(company_id, hubspot_object_id)
  WHERE hubspot_object_id IS NOT NULL;

-- Ensure 12-hour HubSpot autosync is actually enabled in production DB paths.
DO $outer$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'scout-auto-sync') THEN
    PERFORM cron.unschedule('scout-auto-sync');
  END IF;

  PERFORM cron.schedule(
    'scout-auto-sync',
    '0 */12 * * *',
    $cron$
    SELECT net.http_post(
      url := (SELECT value FROM pg_settings WHERE name = 'app.supabase_url') || '/functions/v1/score-companies',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT value FROM pg_settings WHERE name = 'app.service_role_key')
      ),
      body := '{"action":"auto_sync","hours_back":12}'::jsonb
    );
    $cron$
  );
END
$outer$;
