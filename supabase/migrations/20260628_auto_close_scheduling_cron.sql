-- Requires pg_cron and pg_net enabled in Supabase dashboard (Database → Extensions)
-- Replace YOUR_SERVICE_ROLE_KEY below before running

select cron.schedule(
  'auto-close-scheduling',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'https://kzpdukjkttkaligxsmb.supabase.co/functions/v1/auto-close-scheduling',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY'
    ),
    body := '{}'::jsonb
  )
  $$
);
