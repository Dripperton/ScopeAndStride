-- Add care_items array to daily_care_logs to store checked custom care items per log entry
ALTER TABLE daily_care_logs ADD COLUMN IF NOT EXISTS care_items text[] DEFAULT '{}';
