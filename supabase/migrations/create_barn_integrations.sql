-- Stores OAuth tokens for third-party integrations (QuickBooks, etc.)
-- One row per barn per provider.

create table if not exists barn_integrations (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  provider        text not null,
  access_token    text not null,
  refresh_token   text not null,
  realm_id        text,
  token_expiry    timestamptz not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (user_id, provider)
);

alter table barn_integrations enable row level security;

-- Only the owning user can read/write their own integration tokens
create policy "owner access" on barn_integrations
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
