-- Remove legacy HubSpot cron jobs and install single 4-hour daily sync cadence.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT jobid FROM cron.job
    WHERE command ILIKE '%hubspot-pipeline%'
       OR command ILIKE '%import-from-hubspot%'
       OR jobname ILIKE '%hubspot%'
  LOOP
    PERFORM cron.unschedule(r.jobid);
  END LOOP;
END $$;

SELECT cron.schedule(
  'hubspot-daily-sync',
  '0 */4 * * *',
  $$
    select net.http_post(
      url := current_setting('app.settings.supabase_url') || '/functions/v1/hubspot-daily-sync',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
      ),
      body := jsonb_build_object('hours_back', 24)
    );
  $$
);
