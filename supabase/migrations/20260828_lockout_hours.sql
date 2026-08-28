alter table scheduling_settings add column if not exists lockout_hours int not null default 24;
