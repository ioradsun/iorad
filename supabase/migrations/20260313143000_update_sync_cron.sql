DO $outer$
BEGIN
  -- Remove old cron jobs
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'hubspot-contact-sync') THEN
    PERFORM cron.unschedule('hubspot-contact-sync');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'scout-auto-sync') THEN
    PERFORM cron.unschedule('scout-auto-sync');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'scout-scoring') THEN
    PERFORM cron.unschedule('scout-scoring');
  END IF;

  -- Incremental sync (companies + contacts) — every 2 hours
  PERFORM cron.schedule(
    'hubspot-incremental-sync',
    '15 */2 * * *',
    $cron$
    SELECT net.http_post(
      url := current_setting('app.supabase_url') || '/functions/v1/import-from-hubspot',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key')
      ),
      body := '{"action":"sync_all"}'::jsonb
    );
    $cron$
  );

  -- Scoring — every 6 hours
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
