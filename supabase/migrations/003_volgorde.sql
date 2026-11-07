-- Boodschappenlijst: eigen volgorde per lijst
-- Uitvoeren in het Supabase-project Be Strong, via SQL Editor. Eén keer.
-- Voegt alleen kolommen toe en vult die met de volgorde die de app nu toont. Er verdwijnt geen data.
-- Een item kan op Lijstje én bij Vast staan, daarom heeft lists_items twee volgordes.

begin;

alter table public.lists_items
  add column list_order double precision,
  add column std_order double precision;
alter table public.lists_challenges add column sort_order double precision;
alter table public.lists_wishlist add column sort_order double precision;

-- Huidige volgorde overnemen: items op naam, challenges op aanmaakdatum, Later kopen eerst ★ en dan op datum.
update public.lists_items as t set list_order = r.n, std_order = r.n
from (select id, row_number() over (partition by user_id order by lower(name), id) as n from public.lists_items) as r
where r.id = t.id;

update public.lists_challenges as t set sort_order = r.n
from (select id, row_number() over (partition by user_id order by created_at, id) as n from public.lists_challenges) as r
where r.id = t.id;

update public.lists_wishlist as t set sort_order = r.n
from (select id, row_number() over (partition by user_id order by priority desc, created_at, id) as n from public.lists_wishlist) as r
where r.id = t.id;

commit;
