-- Add schedule_privacy to barn_settings

ALTER TABLE profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('owner', 'staff', 'horse_owner'));

ALTER TABLE barn_settings
  ADD COLUMN IF NOT EXISTS schedule_privacy text NOT NULL DEFAULT 'show_details'
  CHECK (schedule_privacy IN ('show_details', 'show_busy'));
