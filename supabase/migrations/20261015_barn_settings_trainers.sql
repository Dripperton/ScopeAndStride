alter table barn_settings
  add column if not exists trainers text[] not null default '{}';
