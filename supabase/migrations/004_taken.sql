-- Boodschappenlijst: tab Taken
-- Uitvoeren in het Supabase-project Be Strong, via SQL Editor. Eén keer.
-- Maakt alleen de nieuwe tabel lists_tasks aan. Bestaande tabellen en data worden niet geraakt.
-- Een taak kan gekoppeld zijn aan een andere lijst (bv. "Winkelen" aan Lijstje), dan toont de app die items erbij.

begin;

create table public.lists_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  link text check (link in ('list', 'ch', 'buy')), -- leeg = geen koppeling
  done boolean not null default false,
  done_at timestamptz,
  sort_order double precision,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index lists_tasks_user_id_idx on public.lists_tasks (user_id);

create trigger lists_set_updated_at before insert or update on public.lists_tasks
  for each row execute function public.lists_set_updated_at();

alter table public.lists_tasks enable row level security;

revoke all on table public.lists_tasks from anon, authenticated, public;
grant select, insert, update, delete on table public.lists_tasks to authenticated;

create policy lists_tasks_select on public.lists_tasks for select to authenticated
  using (user_id = (select auth.uid()));
create policy lists_tasks_insert on public.lists_tasks for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy lists_tasks_update on public.lists_tasks for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy lists_tasks_delete on public.lists_tasks for delete to authenticated
  using (user_id = (select auth.uid()));

alter publication supabase_realtime add table public.lists_tasks;

commit;
