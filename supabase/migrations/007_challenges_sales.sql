-- Boodschappenlijst: Challenges in twee lijsten, Persoonlijk en Sales
-- Uitvoeren in het Supabase-project Be Strong, via SQL Editor. Eén keer.
-- Voegt alleen een kolom toe aan lists_challenges. Alle bestaande challenges staan daarna bij Persoonlijk (sales = false).
-- RLS, rechten en Realtime van lists_challenges blijven zoals ze zijn.

begin;

alter table public.lists_challenges
  add column sales boolean not null default false;

commit;
