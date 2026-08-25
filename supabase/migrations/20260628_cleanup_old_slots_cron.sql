-- Run daily at 2am UTC: delete lesson_slots older than 30 days
-- Requires pg_cron enabled (already enabled)
select cron.schedule(
  'cleanup-old-slots',
  '0 2 * * *',
  $$
  delete from lesson_slots
  where date < (current_date - interval '30 days')
  $$
);
