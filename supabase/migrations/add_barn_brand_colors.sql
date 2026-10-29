-- Add brand color columns to barn_settings
-- These allow barn owners to update their app colors without a new build.
-- If null, the app falls back to the build-time brand colors (brands/*.json).

alter table barn_settings
  add column if not exists primary_color   text default null,
  add column if not exists secondary_color text default null,
  add column if not exists surface_color   text default null;
