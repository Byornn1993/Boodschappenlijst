-- Boodschappenlijst: Thuis in twee lijsten, Vandaag en Later
-- Uitvoeren in het Supabase-project Be Strong, via SQL Editor. Eén keer.
-- Voegt alleen een kolom toe aan lists_tasks. Alle bestaande taken staan daarna bij Vandaag (later = false).
-- Een taak die aan een andere lijst gekoppeld is (link), staat altijd bij Vandaag.
-- RLS, rechten en Realtime van lists_tasks blijven zoals ze zijn.

begin;

alter table public.lists_tasks
  add column later boolean not null default false;

alter table public.lists_tasks
  add constraint lists_tasks_later_check check (not (later and link is not null));

commit;
