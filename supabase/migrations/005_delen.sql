-- Boodschappenlijst: Boodschappen en Vast delen
-- Uitvoeren in het Supabase-project Be Strong, via SQL Editor. Eén keer.
-- Iedere gebruiker zit in precies één huishouden. Boodschappen en Vast (lists_items) horen bij het huishouden,
-- Thuis, Challenges en Later kopen blijven van één gebruiker en veranderen niet.
-- Bestaande gebruikers krijgen elk een eigen huishouden met al hun items erin: er verandert niets tot iemand deelt.
-- Uitnodigen, accepteren, weigeren en stoppen met delen gaan alleen via de functies onderaan.
-- De drie nieuwe tabellen zijn voor de app niet direct leesbaar of schrijfbaar.
-- Alles staat in één transactie: gaat er iets mis, dan wordt niets doorgevoerd.

begin;

-- ───────────────────────── tabellen ─────────────────────────
create table public.lists_households (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);

-- Primaire sleutel op user_id: één huishouden per gebruiker.
create table public.lists_household_members (
  user_id uuid primary key references auth.users (id) on delete cascade,
  household_id uuid not null references public.lists_households (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index lists_household_members_household_id_idx on public.lists_household_members (household_id);

-- Uitnodiging op e-mailadres. Accepteren kan alleen wie met dat adres is ingelogd.
create table public.lists_invites (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.lists_households (id) on delete cascade,
  email text not null check (email = lower(email) and char_length(email) between 3 and 320),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade, -- wie uitnodigde
  created_at timestamptz not null default now(),
  unique (household_id, email)
);
create index lists_invites_email_idx on public.lists_invites (email);
create index lists_invites_user_id_idx on public.lists_invites (user_id);

alter table public.lists_households enable row level security;
alter table public.lists_household_members enable row level security;
alter table public.lists_invites enable row level security;
-- Geen policies en geen rechten: alleen de functies hieronder (security definer) komen erbij.
revoke all on table public.lists_households from anon, authenticated, public;
revoke all on table public.lists_household_members from anon, authenticated, public;
revoke all on table public.lists_invites from anon, authenticated, public;

-- ───────────────────────── bestaande gebruikers: elk een eigen huishouden ─────────────────────────
-- Het huishouden krijgt hetzelfde id als de gebruiker. Dat is alleen een startwaarde, er hangt niets aan.
insert into public.lists_households (id)
  select distinct user_id from public.lists_items;
insert into public.lists_household_members (user_id, household_id)
  select distinct user_id, user_id from public.lists_items;

-- ───────────────────────── hulpfuncties ─────────────────────────
-- Het huishouden van de ingelogde gebruiker, of null. Voor de policies.
-- Bewust niet "stable": bij het allereerste item van een nieuwe gebruiker maakt de standaardwaarde van household_id
-- het huishouden pas aan tijdens dezelfde opdracht. Een stable functie zou dat niet zien en het item weigeren.
-- De policies roepen haar aan als (select ...), dus ze draait nog steeds maar één keer per opdracht.
create function public.lists_my_household()
returns uuid
language sql
volatile
security definer
set search_path = ''
as $$
  select household_id from public.lists_household_members where user_id = auth.uid()
$$;

-- Het huishouden van de ingelogde gebruiker; maakt er een aan als het er nog niet is.
create function public.lists_ensure_household()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  h uuid;
begin
  if me is null then raise exception 'niet ingelogd' using errcode = '42501'; end if;
  select household_id into h from public.lists_household_members where user_id = me;
  if h is null then
    insert into public.lists_households default values returning id into h;
    insert into public.lists_household_members (user_id, household_id) values (me, h)
      on conflict (user_id) do nothing;
    select household_id into h from public.lists_household_members where user_id = me;
  end if;
  return h;
end;
$$;

-- ───────────────────────── lists_items hoort bij het huishouden ─────────────────────────
alter table public.lists_items add column household_id uuid references public.lists_households (id) on delete cascade;
update public.lists_items set household_id = user_id;
alter table public.lists_items
  alter column household_id set not null,
  alter column household_id set default public.lists_ensure_household();

-- Elke naam één keer per huishouden (was: per gebruiker).
drop index public.lists_items_user_id_name_idx;
create unique index lists_items_household_id_name_idx on public.lists_items (household_id, lower(name));
create index lists_items_user_id_idx on public.lists_items (user_id);

-- user_id = wie het item aanmaakte. Iedereen in het huishouden mag alle items zien en wijzigen.
drop policy lists_items_select on public.lists_items;
drop policy lists_items_insert on public.lists_items;
drop policy lists_items_update on public.lists_items;
drop policy lists_items_delete on public.lists_items;
create policy lists_items_select on public.lists_items for select to authenticated
  using (household_id = (select public.lists_my_household()));
create policy lists_items_insert on public.lists_items for insert to authenticated
  with check (user_id = (select auth.uid()) and household_id = (select public.lists_my_household()));
create policy lists_items_update on public.lists_items for update to authenticated
  using (household_id = (select public.lists_my_household()))
  with check (household_id = (select public.lists_my_household()));
create policy lists_items_delete on public.lists_items for delete to authenticated
  using (household_id = (select public.lists_my_household()));

-- ───────────────────────── functies voor de app ─────────────────────────
-- Stand van zaken voor het scherm Delen.
create function public.lists_share_status()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  h uuid := public.lists_ensure_household();
  my_email text;
begin
  select lower(email) into my_email from auth.users where id = me;
  return jsonb_build_object(
    'members', coalesce((
      select jsonb_agg(jsonb_build_object('email', u.email, 'me', m.user_id = me) order by m.created_at)
      from public.lists_household_members m join auth.users u on u.id = m.user_id
      where m.household_id = h), '[]'::jsonb),
    'sent', coalesce((
      select jsonb_agg(i.email order by i.created_at)
      from public.lists_invites i where i.household_id = h), '[]'::jsonb),
    'received', coalesce((
      select jsonb_agg(jsonb_build_object('id', i.id, 'from', u.email) order by i.created_at)
      from public.lists_invites i join auth.users u on u.id = i.user_id
      where i.email = my_email and i.household_id <> h), '[]'::jsonb)
  );
end;
$$;

create function public.lists_invite(p_email text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  h uuid := public.lists_ensure_household();
  e text := lower(btrim(p_email));
begin
  if e !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(e) > 320 then
    raise exception 'Dit e-mailadres klopt niet.' using errcode = '22023';
  end if;
  if exists (select 1 from public.lists_household_members m join auth.users u on u.id = m.user_id
             where m.household_id = h and lower(u.email) = e) then
    raise exception 'Je deelt al met dit e-mailadres.' using errcode = '22023';
  end if;
  insert into public.lists_invites (household_id, email, user_id) values (h, e, me)
    on conflict (household_id, email) do nothing;
end;
$$;

create function public.lists_cancel_invite(p_email text)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.lists_invites
  where household_id = public.lists_my_household() and email = lower(btrim(p_email))
$$;

create function public.lists_decline_invite(p_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.lists_invites
  where id = p_id and email = (select lower(email) from auth.users where id = auth.uid())
$$;

-- Accepteren: je eigen Boodschappen en Vast gaan mee naar het nieuwe huishouden.
-- Staat een item al in beide lijsten, dan blijft het één keer staan (op de lijst / vast als het bij één van beide zo was).
create function public.lists_accept_invite(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  old_h uuid := public.lists_ensure_household();
  new_h uuid;
  max_list double precision;
  max_std double precision;
begin
  select i.household_id into new_h from public.lists_invites i
  where i.id = p_id and i.email = (select lower(email) from auth.users where id = me);
  if new_h is null then raise exception 'Deze uitnodiging bestaat niet meer.' using errcode = '22023'; end if;
  if new_h = old_h then delete from public.lists_invites where id = p_id; return; end if;

  -- Beide huishoudens vastzetten, zodat niemand tegelijk iets anders doet.
  perform 1 from public.lists_households where id in (old_h, new_h) order by id for update;
  if exists (select 1 from public.lists_household_members where household_id = old_h and user_id <> me) then
    raise exception 'Je deelt al met iemand. Stop eerst met delen.' using errcode = '22023';
  end if;

  -- Zelfde naam in beide: samenvoegen in het item van het nieuwe huishouden.
  update public.lists_items t set
    standard = t.standard or s.standard,
    on_list  = t.on_list or s.on_list,
    done     = case when t.on_list and s.on_list then t.done and s.done
                    when s.on_list then s.done else t.done end,
    list_order = case when not t.on_list and s.on_list then null else t.list_order end
  from public.lists_items s
  where s.household_id = old_h and t.household_id = new_h and lower(s.name) = lower(t.name);
  delete from public.lists_items s
  where s.household_id = old_h
    and exists (select 1 from public.lists_items t where t.household_id = new_h and lower(t.name) = lower(s.name));

  -- De rest verhuist, achteraan in de bestaande volgorde.
  select coalesce(max(list_order), 0), coalesce(max(std_order), 0) into max_list, max_std
  from public.lists_items where household_id = new_h;
  -- Samengevoegde items die nu pas op de lijst staan, krijgen hier ook een plek achteraan (list_order is dan null).
  update public.lists_items s set
    household_id = new_h,
    list_order = max_list + r.nl,
    std_order = case when s.household_id = old_h then max_std + r.ns else s.std_order end
  from (select id,
          row_number() over (order by household_id = old_h, list_order nulls last, lower(name)) as nl,
          row_number() over (order by std_order nulls last, lower(name)) as ns
        from public.lists_items
        where household_id = old_h or (household_id = new_h and list_order is null)) r
  where s.id = r.id;

  update public.lists_household_members set household_id = new_h, created_at = now() where user_id = me;
  delete from public.lists_invites where id = p_id;
  delete from public.lists_households where id = old_h; -- ook de uitnodigingen die jij had verstuurd
end;
$$;

-- Stoppen met delen: je krijgt een eigen huishouden met een kopie van Boodschappen en Vast zoals ze nu zijn.
create function public.lists_leave()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  old_h uuid := public.lists_ensure_household();
  new_h uuid;
begin
  perform 1 from public.lists_households where id = old_h for update;
  if not exists (select 1 from public.lists_household_members where household_id = old_h and user_id <> me) then
    return; -- je deelt met niemand
  end if;
  insert into public.lists_households default values returning id into new_h;
  insert into public.lists_items (user_id, household_id, name, standard, on_list, done, list_order, std_order)
    select me, new_h, name, standard, on_list, done, list_order, std_order
    from public.lists_items where household_id = old_h;
  update public.lists_household_members set household_id = new_h, created_at = now() where user_id = me;
  delete from public.lists_invites where household_id = old_h and user_id = me;
end;
$$;

-- Alleen ingelogde gebruikers mogen deze functies aanroepen.
revoke all on function public.lists_my_household() from anon, public;
revoke all on function public.lists_ensure_household() from anon, public;
revoke all on function public.lists_share_status() from anon, public;
revoke all on function public.lists_invite(text) from anon, public;
revoke all on function public.lists_cancel_invite(text) from anon, public;
revoke all on function public.lists_decline_invite(uuid) from anon, public;
revoke all on function public.lists_accept_invite(uuid) from anon, public;
revoke all on function public.lists_leave() from anon, public;
grant execute on function public.lists_my_household() to authenticated;
grant execute on function public.lists_ensure_household() to authenticated;
grant execute on function public.lists_share_status() to authenticated;
grant execute on function public.lists_invite(text) to authenticated;
grant execute on function public.lists_cancel_invite(text) to authenticated;
grant execute on function public.lists_decline_invite(uuid) to authenticated;
grant execute on function public.lists_accept_invite(uuid) to authenticated;
grant execute on function public.lists_leave() to authenticated;

commit;
