-- Schedule daily invocation of generate-recurring-invoices edge function
-- The function self-limits: monthly templates only generate on day 1, weekly on their day of week
-- Requires pg_cron and pg_net enabled in Supabase dashboard (Database → Extensions)
-- Replace YOUR_SERVICE_ROLE_KEY below before running in the Supabase SQL editor

select cron.schedule(
  'generate-recurring-invoices',
  '0 1 * * *',
  $$
  select net.http_post(
    url := 'https://kzpdukjkttkaligxsmb.supabase.co/functions/v1/generate-recurring-invoices',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY'
    ),
    body := '{}'::jsonb
  )
  $$
);
