
-- Schedule daily backfill at 02:00 UTC to catch any HubSpot companies
-- that webhooks may have missed (e.g. companies created before the webhook was set up)
SELECT cron.schedule(
  'hubspot-backfill-daily',
  '0 2 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT value FROM pg_settings WHERE name = 'app.supabase_url') || '/functions/v1/backfill-hubspot',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT value FROM pg_settings WHERE name = 'app.service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);
