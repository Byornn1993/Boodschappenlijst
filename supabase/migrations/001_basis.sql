-- Boodschappenlijst: basis
-- Uitvoeren in het Supabase-project Be Strong, via SQL Editor. Eén keer.
-- Dit bestand maakt alleen nieuwe onderdelen met de prefix lists_ aan.
-- Bestaande Be Strong-tabellen en -data worden niet geraakt. Zie SUPABASE_SHARED.md.
-- Alles staat in één transactie: gaat er iets mis, dan wordt niets doorgevoerd.

begin;

-- ───────────────────────── helper ─────────────────────────
create function public.lists_set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  if tg_op = 'INSERT' then
    new.created_at := coalesce(new.created_at, now());
  else
    new.created_at := old.created_at;
  end if;
  return new;
end;
$$;

revoke all on function public.lists_set_updated_at() from anon, public;

-- ───────────────────────── lists_items: tabs Lijstje en Vast ─────────────────────────
create table public.lists_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  standard boolean not null default false,
  on_list boolean not null default false,
  done boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Elke naam één keer per gebruiker, hoofdletters tellen niet mee. Deze index dient ook als index op user_id.
create unique index lists_items_user_id_name_idx on public.lists_items (user_id, lower(name));

-- ───────────────────────── lists_challenges: tab Challenges ─────────────────────────
create table public.lists_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  goal integer check (goal > 0), -- leeg = challenge met een vinkje
  count integer not null default 0 check (count >= 0),
  done boolean not null default false,
  done_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index lists_challenges_user_id_idx on public.lists_challenges (user_id);

-- ───────────────────────── lists_wishlist: tab Later kopen ─────────────────────────
create table public.lists_wishlist (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  price numeric(10,2) check (price >= 0), -- in euro, leeg = geen prijs
  priority boolean not null default false,
  bought boolean not null default false,
  bought_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index lists_wishlist_user_id_idx on public.lists_wishlist (user_id);

-- ───────────────────────── updated_at automatisch bijhouden ─────────────────────────
create trigger lists_set_updated_at before insert or update on public.lists_items
  for each row execute function public.lists_set_updated_at();
create trigger lists_set_updated_at before insert or update on public.lists_challenges
  for each row execute function public.lists_set_updated_at();
create trigger lists_set_updated_at before insert or update on public.lists_wishlist
  for each row execute function public.lists_set_updated_at();

-- ───────────────────────── Row Level Security ─────────────────────────
alter table public.lists_items enable row level security;
alter table public.lists_challenges enable row level security;
alter table public.lists_wishlist enable row level security;

-- Niet-ingelogde bezoekers krijgen niets, ingelogde gebruikers alleen wat de policies toelaten.
revoke all on table public.lists_items from anon, public;
revoke all on table public.lists_challenges from anon, public;
revoke all on table public.lists_wishlist from anon, public;
grant select, insert, update, delete on table public.lists_items to authenticated;
grant select, insert, update, delete on table public.lists_challenges to authenticated;
grant select, insert, update, delete on table public.lists_wishlist to authenticated;

-- ── lists_items
create policy lists_items_select on public.lists_items for select to authenticated
  using (user_id = (select auth.uid()));
create policy lists_items_insert on public.lists_items for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy lists_items_update on public.lists_items for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy lists_items_delete on public.lists_items for delete to authenticated
  using (user_id = (select auth.uid()));

-- ── lists_challenges
create policy lists_challenges_select on public.lists_challenges for select to authenticated
  using (user_id = (select auth.uid()));
create policy lists_challenges_insert on public.lists_challenges for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy lists_challenges_update on public.lists_challenges for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy lists_challenges_delete on public.lists_challenges for delete to authenticated
  using (user_id = (select auth.uid()));

-- ── lists_wishlist
create policy lists_wishlist_select on public.lists_wishlist for select to authenticated
  using (user_id = (select auth.uid()));
create policy lists_wishlist_insert on public.lists_wishlist for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy lists_wishlist_update on public.lists_wishlist for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy lists_wishlist_delete on public.lists_wishlist for delete to authenticated
  using (user_id = (select auth.uid()));

-- ───────────────────────── Realtime: iPhone en laptop live gelijk ─────────────────────────
alter publication supabase_realtime add table public.lists_items;
alter publication supabase_realtime add table public.lists_challenges;
alter publication supabase_realtime add table public.lists_wishlist;

commit;
