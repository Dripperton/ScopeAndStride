alter table profiles add column if not exists push_token text;
alter table profiles add column if not exists scheduling_notifications boolean not null default false;
