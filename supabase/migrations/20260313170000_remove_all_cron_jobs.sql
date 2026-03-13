DO $outer$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'hubspot-incremental-sync') THEN
    PERFORM cron.unschedule('hubspot-incremental-sync');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'scout-scoring') THEN
    PERFORM cron.unschedule('scout-scoring');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'scout-auto-sync') THEN
    PERFORM cron.unschedule('scout-auto-sync');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'hubspot-contact-sync') THEN
    PERFORM cron.unschedule('hubspot-contact-sync');
  END IF;
END
$outer$;
