alter table horses add column if not exists sort_order integer;

-- Initialize sort_order based on current name ordering per barn
update horses h
set sort_order = sub.rn
from (
  select id, row_number() over (order by name) as rn
  from horses
) sub
where h.id = sub.id;
