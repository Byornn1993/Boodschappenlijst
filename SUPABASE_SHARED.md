# Gedeeld Supabase-project: afspraken

Dit document geldt voor alle apps die het Supabase-project **Be Strong** gebruiken. Er staat een kopie in elk app-project. Pas je iets aan, doe dat dan in beide kopieën.

| App | Rol in dit project |
|---|---|
| **Be Strong** | Eigenaar van het project, fitness-app |
| **Boodschappenlijst** | Gast-app, boodschappen, challenges en "later kopen" |

**Bjorn Finance staat hier los van.** Dat is een ander Supabase-project en daar verandert niets aan.

---

## 1. Structuur en namen

Alle tabellen staan in het schema `public`. Elke app heeft een eigen prefix. Be Strong is de uitzondering: die tabellen hebben geen prefix en blijven waar ze zijn.

We gebruiken geen eigen schema. Dat vraagt extra API-instellingen en rechten en levert voor één gebruiker geen extra veiligheid op. De beveiliging zit in RLS.

Regels voor Boodschappenlijst:

| Wat | Regel | Voorbeeld |
|---|---|---|
| Tabel | `lists_` + meervoud, in kleine letters | `lists_items` |
| Functie | `lists_` + naam | `lists_set_updated_at` |
| Policy | `<tabel>_<actie>` | `lists_items_select` |
| Index | `<tabel>_<kolommen>_idx` | `lists_items_user_id_idx` |
| Verplichte kolommen | `id`, `user_id`, `created_at`, `updated_at` | |

Een gast-app verwijst nooit naar een tabel of functie van een andere app, ook niet naar `set_updated_at`. Zo kan een wijziging in de ene app de andere niet breken. Alleen `auth.users` is gedeeld.

### Tabellen van Boodschappenlijst

| Tabel | Inhoud | Komt uit het artifact |
|---|---|---|
| `lists_items` | Lijstje en vaste items | collectie `items` |
| `lists_challenges` | Challenges | collectie `challenges` |
| `lists_wishlist` | Later kopen | collectie `wishlist` |

---

## 2. Van Be Strong: niet aanraken

Een gast-app mag deze onderdelen niet lezen, wijzigen, verwijderen of hernoemen.

**Tabellen**

- `profiles`
- `exercises`, `exercise_prefs`
- `workout_templates`, `template_exercises`, `template_sets`
- `workouts`, `workout_exercises`, `workout_sets`
- `measurement_types`, `body_measurements`
- `goals`, `dashboard_widgets`

**Functies**

- `set_updated_at`, `handle_new_user`, `exercise_visible`
- `upsert_workout`, `upsert_template`, `import_workouts`

**Trigger**

- `on_auth_user_created` op `auth.users`

Alles zonder prefix `lists_` is dus verboden terrein voor Boodschappenlijst. Gebruik ook nooit een opdracht die op een heel schema werkt, zoals `grant ... on all tables in schema public` of `drop schema`.

---

## 3. Hoe een app verbindt

Elke app gebruikt dezelfde project-URL en dezelfde publishable key, via environment variables. De waarden staan in het Supabase-dashboard onder Project Settings › API. Lokaal komen ze in `.env`, dat niet in git mag staan. Online komen ze in de GitHub repository variables.

```bash
VITE_SUPABASE_URL=https://jouw-project-ref.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxxxxxxxxxxxxxx
```

De publishable key is de nieuwe naam voor de anon key. Hij mag in de frontend staan, want RLS beschermt de data.

> **NOOIT de secret key of service role key in de frontend, in git of in een chat.** Die key slaat alle beveiliging over en geeft toegang tot de data van alle apps.

### Eén login voor beide apps

Er is één account in Supabase Auth. Registreren staat uit, dus een app heeft geen aanmeldscherm nodig. Dezelfde gebruiker heeft in beide apps hetzelfde `user_id`. Je logt wel per app apart in.

Vier regels voorkomen dat de apps elkaar storen:

1. **Eigen `storageKey`.** Apps op hetzelfde webadres delen hun browseropslag.
   - Be Strong gebruikt `bestrong-auth`.
   - Boodschappenlijst gebruikt `lists-auth`.
2. **Alleen lokaal uitloggen.** Gebruik `supabase.auth.signOut({ scope: 'local' })`. De standaard logt je op alle apps en toestellen uit.
3. **Redirect URL's toevoegen.** Elk app-adres moet in het dashboard staan onder Authentication › URL Configuration › Redirect URLs. Geef bij een wachtwoordreset of inloglink altijd `redirectTo` mee, anders kom je in Be Strong terecht.
4. **Eigen namen voor lokale opslag.** Dat geldt voor IndexedDB en localStorage. Gebruik de prefix `lists-`. Be Strong gebruikt `bestrong-`.

```ts
createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'lists-auth' },
});
```

---

## 4. Standaard RLS-template

Elke tabel heeft een `user_id` en alleen de eigenaar ziet zijn data. Niet-ingelogde bezoekers (`anon`) krijgen geen enkele toegang.

**Eenmalig, in de eerste migratie:**

```sql
create or replace function public.lists_set_updated_at()
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
```

**Per tabel** (vervang `lists_voorbeeld` door de echte naam):

```sql
create table public.lists_voorbeeld (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index lists_voorbeeld_user_id_idx on public.lists_voorbeeld (user_id);

create trigger lists_set_updated_at before insert or update on public.lists_voorbeeld
  for each row execute function public.lists_set_updated_at();

alter table public.lists_voorbeeld enable row level security;

revoke all on table public.lists_voorbeeld from anon, authenticated, public;
grant select, insert, update, delete on table public.lists_voorbeeld to authenticated;

create policy lists_voorbeeld_select on public.lists_voorbeeld for select to authenticated
  using (user_id = (select auth.uid()));
create policy lists_voorbeeld_insert on public.lists_voorbeeld for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy lists_voorbeeld_update on public.lists_voorbeeld for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy lists_voorbeeld_delete on public.lists_voorbeeld for delete to authenticated
  using (user_id = (select auth.uid()));
```

**Live bijwerken tussen toestellen** (per tabel die dat nodig heeft):

```sql
alter publication supabase_realtime add table public.lists_voorbeeld;
```

Realtime houdt zich aan dezelfde RLS-regels. De app moet ingelogd zijn voordat hij zich abonneert.

---

## 5. Migraties

Elke wijziging aan de database is een genummerd SQL-bestand in het project van de app zelf.

| App | Map | Naam |
|---|---|---|
| Be Strong | `supabase/migrations/` | Blijft zoals het is, met datum en nummer |
| Boodschappenlijst | `supabase/migrations/` in de eigen repository | `001_basis.sql`, `002_...sql` |

Regels:

1. Pas een uitgevoerd bestand nooit meer aan. Maak voor een wijziging een nieuw bestand met het volgende nummer.
2. Eén bestand is één geheel: zet `begin;` bovenaan en `commit;` onderaan. Mislukt iets, dan wordt niets doorgevoerd.
3. Voer een bestand uit in de SQL Editor van het dashboard. Gebruik geen `supabase db push`: de twee apps hebben aparte migratiemappen voor dezelfde database, en dat commando kent er maar één.
4. Noteer na het uitvoeren de datum in `supabase/migrations/LOG.md` van de app.
5. Test een migratie eerst lokaal, en controleer dat Be Strong daarna nog werkt.
6. Een bestand met `drop`, `delete` of `truncate` voer je alleen uit na een bewuste controle door Bjorn.

---

## 6. Aandachtspunten gratis plan

- **500 MB database voor alle apps samen.** Kijk af en toe in het dashboard hoeveel er in gebruik is.
- **Geen foto's of bestanden in de database.** Sla alleen tekst en getallen op.
- **Het project pauzeert na 1 week zonder activiteit.** Dan werken beide apps tegelijk niet meer. Je zet het project terug aan in het dashboard, de data blijft bewaard. Omdat twee apps het project gebruiken, gebeurt dit minder snel.
- **Reken niet op automatische back-ups.** Maak zelf af en toe een export van wat je niet kwijt wilt.
- **Maximaal 2 gratis projecten.** Die zijn in gebruik door Bjorn Finance en Be Strong. Nieuwe apps kunnen hier ook bij, met een eigen prefix.
