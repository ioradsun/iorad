-- Replace the 12-hour auto-sync with a 2-hour incremental contact sync
-- and a 6-hour scoring pass.

DO $outer$
BEGIN
  -- Remove old 12-hour job
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'scout-auto-sync') THEN
    PERFORM cron.unschedule('scout-auto-sync');
  END IF;

  -- 1. Incremental contact sync — every 2 hours
  -- Fetches contacts modified since last checkpoint from HubSpot.
  -- Light: ~2-4 API calls per page of 100 contacts. Runs in <30 seconds
  -- unless there are thousands of changes.
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'hubspot-contact-sync') THEN
    PERFORM cron.unschedule('hubspot-contact-sync');
  END IF;

  PERFORM cron.schedule(
    'hubspot-contact-sync',
    '15 */2 * * *',
    $cron$
    SELECT net.http_post(
      url := current_setting('app.supabase_url') || '/functions/v1/import-from-hubspot',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key')
      ),
      body := '{"action":"sync_contacts"}'::jsonb
    );
    $cron$
  );

  -- 2. Scoring pass — every 6 hours
  -- Re-scores companies that have new contacts or activity since last score.
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'scout-scoring') THEN
    PERFORM cron.unschedule('scout-scoring');
  END IF;

  PERFORM cron.schedule(
    'scout-scoring',
    '0 */6 * * *',
    $cron$
    SELECT net.http_post(
      url := current_setting('app.supabase_url') || '/functions/v1/score-companies',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key')
      ),
      body := '{"action":"auto_sync","hours_back":6}'::jsonb
    );
    $cron$
  );
END
$outer$;
