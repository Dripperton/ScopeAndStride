-- Run this once in the Supabase SQL editor to create the barn_settings table.
-- Single-row table: one barn per deployment.

create table if not exists barn_settings (
  id         uuid primary key default gen_random_uuid(),
  barn_name  text not null,
  app_name   text not null default 'Scope & Stride',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Seed the initial row for this barn
insert into barn_settings (barn_name, app_name)
values ('Hollow Creek', 'Scope & Stride')
on conflict do nothing;

-- Only owners can update; everyone authenticated can read
alter table barn_settings enable row level security;

create policy "Anyone authenticated can read barn settings"
  on barn_settings for select
  using (auth.role() = 'authenticated');

create policy "Owners can update barn settings"
  on barn_settings for update
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
        and profiles.role = 'owner'
    )
  );
