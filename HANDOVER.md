# Overdracht: B lists (Boodschappenlijst)

Dit document is bedoeld voor een nieuwe Claude-sessie zonder voorkennis. Lees dit eerst, daarna `CLAUDE.md` (werkafspraken) en `SUPABASE_SHARED.md` (regels voor de gedeelde database).

- **Projectmap:** `C:\Users\Gebruiker\OneDrive\Documenten\Persoonlijke apps\B lists`
- **Live:** https://byornn1993.github.io/Boodschappenlijst/
- **Code:** https://github.com/Byornn1993/Boodschappenlijst (publiek, branch `main`)
- **Stand van dit document:** 21 november 2026

---

## 1. Wat is het

B lists (in de app heet hij "Boodschappenlijst", op het beginscherm "Boodschappen") is een persoonlijke lijstjes-app van Bjorn. Hij staat als app op zijn iPhone en wordt ook op de laptop gebruikt. Er zijn vijf lijsten:

| Tabblad | Wat | Gedeeld? |
|---|---|---|
| **Thuis** | Taken in huis, in twee lijsten: **Vandaag** en **Later**. Een taak kan gekoppeld zijn aan een andere lijst (bv. "Winkelen" aan Boodschappen) en toont dan wat daar nog open staat. | Nee, privé |
| **Boodschappen** | Wat je nu moet kopen. Afvinken = "In mandje", sorteren per afdeling, suggesties van eerder gebruikte items. | **Ja**, met het huishouden |
| **Vast** | Vaste items die je met één knop op Boodschappen zet. | **Ja**, met het huishouden |
| **Challenges** | Uitdagingen met een vinkje of met een doel en +1-teller, in twee lijsten: **Persoonlijk** en **Sales**. | Nee, privé |
| **Later kopen** | Verlanglijst met prijs, ★ voorrang en totaal. | Nee, privé |

Bjorn deelt Boodschappen en Vast met zijn vriendin Stéphanie (zij heeft een eigen account). Haar Thuis, Challenges en Later kopen zijn van haar alleen.

---

## 2. Huidige status

**Werkt en staat live:**
- Inloggen met het Be Strong-account (dezelfde Supabase-login, nieuwe accounts maken kan alleen Bjorn in Supabase).
- Alle vijf lijsten: toevoegen, aanpassen (✎), verwijderen met "Ongedaan maken", afvinken, verslepen in eigen volgorde, vegen op de telefoon (rechts = afvinken, links = weghalen).
- Thuis: Vandaag en Later (telefoon: schakelaar bovenaan; laptop: twee kolommen). Live sinds 17 november.
- Challenges: Persoonlijk en Sales (zelfde opbouw). Live sinds 18 november.
- Delen van Boodschappen en Vast: uitnodigen op e-mailadres via de knop **Delen** onderaan, de ander accepteert of weigert, "Stoppen met delen" geeft ieder een eigen kopie. Live sinds 12 november.
- Werkt offline: wijzigingen gaan in een wachtrij op het toestel en worden verstuurd zodra er bereik is. De app zelf opent ook zonder bereik (service worker).
- Realtime: wijzigingen op het ene toestel verschijnen meteen op het andere (en bij Stéphanie).
- Licht en donker thema, huisstijl goud/antraciet, menubalk onderaan (ook op de laptop).

**Nog niet echt getest (eerlijk):**
- Vandaag/Later en Persoonlijk/Sales zijn alleen met nep-gegevens getest en live op de laptop bekeken, nog niet op Bjorns iPhone. Bjorn gaat het evalueren.
- Vegen is nooit met een echte vinger op een iPhone getest, alleen nagebootst.
- Of Stéphanie de uitnodiging echt heeft geaccepteerd, is niet gecontroleerd. Controle: in de SQL Editor `select household_id, count(*) from public.lists_household_members group by 1;` (2 leden in één huishouden = gekoppeld).

**Half af / ideeën die besproken zijn:**
- Een challenge verplaatsen tussen Persoonlijk en Sales kan nog niet. Voorstel: een keuze in het aanpasformulier (✎), want naast een challenge staan op de telefoon al vijf knoppen.
- Op een smalle telefoon zijn de regels bij Thuis druk (✎, 🗑, pijltje, greepje). Voorstel als Bjorn dat vindt: het sleepgreepje op de telefoon weglaten.
- Afdeling per item zelf kiezen (nu raadt de app de afdeling op naam). Dat vraagt een extra kolom in `lists_items`.

---

## 3. Mappenstructuur

```
B lists/
├─ index.html              De hele app: HTML, CSS en JavaScript in één bestand (± 1550 regels)
├─ sw.js                   Service worker: app opent offline, updates komen meteen door
├─ manifest.webmanifest    PWA-instellingen (naam, kleuren, iconen)
├─ icon.svg, apple-touch-icon.png, pwa-192.png, pwa-512.png   App-iconen
├─ README.md               Korte uitleg hoe de code in elkaar zit
├─ SUPABASE_SHARED.md      Afspraken over het gedeelde Supabase-project (kopie staat ook in Be Strong)
├─ HANDOVER.md             Dit document
├─ CLAUDE.md               Werkafspraken voor Claude
├─ supabase/migrations/    Alle databasewijzigingen, op volgorde (001 t/m 007) + LOG.md (wanneer uitgevoerd)
├─ tests/
│  ├─ test-server.mjs      Lokale testserver op poort 5181 (echte pagina met nep-database)
│  ├─ stub.js              Nep-Supabase voor één gebruiker
│  ├─ stub2.js             Nep-Supabase met meerdere gebruikers, huishoudens en Delen
│  └─ db/migratie-00X.mjs  Tests van de migraties 005, 006 en 007 op PGlite (Postgres in Node)
├─ .claude/launch.json     Startinstelling voor de testserver (naam "lists-test")
└─ import/                 Persoonlijke data van de eenmalige overzetting uit het oude artifact. Staat in .gitignore: NOOIT committen.
```

**Opbouw van `index.html`, van boven naar onder:**
1. **Stijl:** kleuren als CSS-variabelen (`--bg`, `--card`, `--accent`, …), donker standaard, licht via `data-theme`.
2. **HTML:** kop, menubalk (`.tabs`), per tabblad een `<section>` (`viewTask`, `viewList`, `viewStd`, `viewCh`, `viewBuy`), login, het blok Delen en de melding onderaan (`.toast`).
3. **Algemene hulpjes:** `pref`/`keep` (bewaren op het toestel), `say` (melding met "Ongedaan maken"), tabbladen (`setView`), thema.
4. **Regels in een lijst:** `btn`, `checkbox`, `swipe` (vegen), `grip` + `reorder` (verslepen).
5. **Per lijst** een `render…`-functie: `renderTasks`, `renderShopping`, `renderChallenges`, `renderBuys`. Aanpassen gebeurt in de regel zelf met `editForm`. Bij Boodschappen horen `AISLES` (afdelingen) en `suggest` (suggesties).
6. **Opslaan:** `collection()` per tabel. Wat je ziet = laatst opgehaalde data (`base`) + wachtende wijzigingen (`queue`). `flush()` stuurt de wachtrij op volgorde naar Supabase.
7. **Delen:** `loadShare`, `renderShare` en de knoppen; de app roept alleen databasefuncties aan.
8. **Verbinding:** Realtime-kanaal, opnieuw verbinden na de achtergrond, inloggen en uitloggen.

---

## 4. Technologie

- **Gewone HTML, CSS en JavaScript.** Geen framework, geen build-stap, geen npm-pakketten in de app zelf.
- **supabase-js 2.117.3** via de CDN van jsDelivr, met een integrity-hash (SRI) in `index.html`.
- **Supabase** (Postgres met Row Level Security, Auth en Realtime) als database en login.
- **GitHub Pages** als hosting (rechtstreeks vanaf `main`, map `/`).
- **Service worker** (`sw.js`), cache-naam `lists-v2`.
- **Tests:** Node (staat in `C:\Program Files\nodejs`) en PGlite, dat geleend wordt uit `..\Be strong\node_modules`. Er is geen Python op deze pc.

---

## 5. Starten, testen en uitrollen

**Lokaal bekijken met nep-gegevens (raakt de echte data niet):**
1. Start de testserver: `node tests/test-server.mjs` (of in Claude Code: `preview_start` met `lists-test`).
2. Open http://localhost:5181/stub (één gebruiker) of http://localhost:5181/stub2 (meerdere gebruikers, voor Delen). Inloggen met een willekeurig e-mailadres en wachtwoord **goed**.
3. Let op: de service worker bewaart ook `stub.js`. Voor en na het testen in de console: service worker afmelden en caches wissen (`navigator.serviceWorker.getRegistrations()` → `unregister()`, `caches.keys()` → `caches.delete()`), en `localStorage`/`sessionStorage` leegmaken.
4. Test op telefoonbreedte (375 en 320 pixels) én laptopbreedte (721, 860, 1280 pixels).

**Databasewijziging testen:**
- Schrijf de migratie in `supabase/migrations/00X_naam.sql`, in één `begin; … commit;`.
- Maak een test zoals `tests/db/migratie-007.mjs` en draai `node tests/db/migratie-00X.mjs`. Die bouwt een lege Postgres op met alle eerdere migraties, zet er voorbeelddata in en controleert de nieuwe.

**Uitrollen:**
1. Alleen code: committen en `git push` naar `main`. GitHub Pages zet hem binnen 1 à 2 minuten live.
2. Met databasewijziging: **eerst Bjorns expliciete "ja"**. Daarna:
   1. tel vooraf wat er in de tabel staat (`select count(*) …`);
   2. voer de migratie uit in de Supabase SQL Editor via Chrome (zie hieronder);
   3. tel opnieuw en vergelijk;
   4. pas dan de app pushen (anders stuurt de nieuwe app kolommen die nog niet bestaan);
   5. zet de datum in `supabase/migrations/LOG.md`.
3. Controleren of het live staat: `https://byornn1993.github.io/Boodschappenlijst/?v=<commit>` (GitHub Pages bewaart pagina's ongeveer 10 minuten; `?v=` omzeilt dat). Op de telefoon: app volledig afsluiten en opnieuw openen.

**SQL Editor via Chrome (zo is het steeds gedaan):** open `https://supabase.com/dashboard/project/mngqptjikxeihmmnibio/sql/new`, zet de tekst met `monaco.editor.getEditors()[0].setValue(sql)`, controleer met een SHA-256 van `getValue()` dat de tekst exact gelijk is aan het bestand, klik op **Run**. Een waarschuwing "Potential issues" bij bewuste stappen (drop policy, update zonder where) mag je bevestigen. Na afloop vraagt Chrome bij het sluiten "Leave site?": laat Bjorn dat tabblad zelf sluiten.

---

## 6. Data

**Waar:** in het Supabase-project **Be Strong** (`mngqptjikxeihmmnibio`), schema `public`, alle tabellen met prefix `lists_`. Er staat geen data in bestanden of Excel. Op het toestel bewaart de app alleen een kopie (localStorage) voor offline gebruik.

| Tabel | Inhoud | Belangrijke kolommen |
|---|---|---|
| `lists_items` | Boodschappen en Vast (één item kan op beide staan) | `name`, `on_list`, `done`, `standard`, `list_order`, `std_order`, `household_id` (gedeeld), `user_id` (wie het aanmaakte) |
| `lists_tasks` | Thuis | `name`, `link` (`list`/`ch`/`buy` of leeg), `later` (Vandaag/Later), `done`, `done_at`, `sort_order` |
| `lists_challenges` | Challenges | `name`, `goal` (leeg = vinkje), `count`, `sales` (Persoonlijk/Sales), `done`, `done_at`, `sort_order` |
| `lists_wishlist` | Later kopen | `name`, `price` (euro), `priority` (★), `bought`, `bought_at`, `sort_order` |
| `lists_households` | Huishoudens (voor Delen) | `id` |
| `lists_household_members` | Wie in welk huishouden zit (één per gebruiker) | `user_id`, `household_id` |
| `lists_invites` | Openstaande uitnodigingen | `email`, `household_id`, `user_id` (wie uitnodigde) |

- Elke tabel heeft `id`, `created_at`, `updated_at` (automatisch via trigger `lists_set_updated_at`).
- **Beveiliging:** RLS staat overal aan. Thuis, Challenges en Later kopen: alleen je eigen rijen (`user_id = auth.uid()`). Boodschappen en Vast: alle rijen van je huishouden (`household_id = lists_my_household()`). De drie deel-tabellen zijn niet rechtstreeks bereikbaar, alleen via de functies `lists_share_status`, `lists_invite`, `lists_cancel_invite`, `lists_decline_invite`, `lists_accept_invite` en `lists_leave`.
- **Volgorde** in lijsten: getallen (`*_order`), bij verslepen krijgt een item het gemiddelde van zijn buren.
- **Migraties:** `001` basis, `002` rechten, `003` volgorde, `004` Thuis, `005` Delen, `006` Vandaag/Later, `007` Persoonlijk/Sales. Alle zeven zijn op productie uitgevoerd (zie `LOG.md`).

---

## 7. Instellingen en omgevingsvariabelen

Er zijn **geen** omgevingsvariabelen en geen `.env`. In `index.html` staan:
- `SUPABASE_URL` (het adres van het project);
- `SUPABASE_KEY`: de **publishable key**. Die mag openbaar, de beveiliging zit in RLS.

**Nooit** in de code of in een chat: de secret/service role key, het databasewachtwoord of wachtwoorden van Bjorn of Stéphanie. Ook geen e-mailadressen in de code, want de repo is publiek.

Op het toestel (localStorage): `lists-auth` (login), `lists-queue-<gebruiker>` (wachtrij), `lists-cache-<gebruiker>` (offline kopie), `lists-tab`, `lists-theme`, `lists-aisle`, `lists-task-pane`, `lists-ch-pane`, `lists-swipe-tip`.

---

## 8. Beslissingen en waarom

- **Eén HTML-bestand, geen framework:** eenvoudig te begrijpen en uit te rollen, geen build nodig.
- **Supabase van Be Strong delen (prefix `lists_`):** het gratis plan staat maar twee projecten toe (Be Strong en Bjorn Finance). Afspraken staan in `SUPABASE_SHARED.md`.
- **Eén login voor Be Strong en B lists:** uitloggen gebeurt alleen lokaal (`scope: "local"`), zodat de andere app ingelogd blijft.
- **Offline-wachtrij in plaats van rechtstreeks opslaan:** in de winkel is het bereik slecht. Toevoegen gebeurt als `upsert`, zodat een dubbel verstuurde wijziging geen fout geeft.
- **"Ongedaan maken" in plaats van bevestigingsvensters:** sneller en minder storend.
- **Van de lijst halen = item bewaren (verborgen):** zo ontstaan de suggesties. Pas het ✕ bij een suggestie verwijdert echt.
- **Delen via huishoudens en databasefuncties:** de database beslist wie wat ziet. Uitnodigen gaat op e-mailadres zonder code (Bjorns wens). Alleen wie met dat adres inlogt, kan accepteren.
- **Vandaag/Later en Persoonlijk/Sales:** op de telefoon één lijst tegelijk met een schakelaar (Bjorn koos dat boven twee smalle kolommen), op de laptop naast elkaar. Geen automatisch verschuiven om middernacht en geen labeltjes zoals "van gisteren" (Bjorns wens). Gekoppelde taken staan altijd bij Vandaag (afgedwongen in de database).
- **Menubalk onderaan, ook op de laptop:** Bjorns wens. Op de laptop tegen de onderrand, even breed als de lijst.
- **Huisstijl:** kleuren #101418, #2C3E50, #B08D57, #DCC9A6, #FBF6EE; achtergrondgloed op een vaste laag; doorschijnende kaarten met gouden rand. Dezelfde stijl als Be Strong en Be finance.

---

## 9. Bekende valkuilen

- **iPhone, menubalk zweeft bij korte pagina's:** op het beginscherm zet iOS een vaste balk niet tegen de onderrand als de pagina korter is dan het scherm. Oplossing: `.wrap { min-height: 100lvh }` op aanraakschermen. Niet weghalen.
- **iPhone, `background-attachment: fixed` werkt niet:** daarom staat de gloed op `body::before`. `body` moet doorzichtig blijven.
- **GitHub Pages bewaart pagina's ±10 minuten:** daarom haalt de service worker de pagina altijd met `cache: "no-cache"` op en herlaadt hij één keer bij een nieuwe versie. Verhoog `CACHE` in `sw.js` als de lijst met bestanden verandert.
- **Volgorde migratie en push:** nieuwe kolommen of tabellen eerst in de database, dan pas de app pushen.
- **`lists_my_household()` moet `volatile` blijven:** anders weigert de database het allereerste item van een nieuwe gebruiker.
- **Nieuwe accounts:** registreren staat uit. Een account maakt Bjorn zelf in Supabase (Authentication → Users → Add user, met "Auto Confirm"). Claude maakt geen accounts aan en kiest geen wachtwoorden.
- **Testen in de browser:** de service worker cachet ook de nep-database. Na het wijzigen van een stub twee keer herladen, en na het testen de service worker afmelden.
- **Schermafbeeldingen in het testvenster** zijn soms geschaald of lopen vast als het venster verborgen is: meet dan met JavaScript (`getBoundingClientRect`).
- **Git op Windows** meldt "LF will be replaced by CRLF": onschuldig.

---

## 10. Volgende stappen

1. **Bjorns evaluatie verwerken** van Vandaag/Later en Persoonlijk/Sales op zijn iPhone (bv. het sleepgreepje weglaten als de regels te druk zijn).
2. **Controleren of Delen met Stéphanie echt werkt:** zijn ze één huishouden (query in sectie 2)? Zo niet: Bjorn nodigt opnieuw uit via **Delen**, Stéphanie accepteert op haar gsm.
3. **Challenge verplaatsen tussen Persoonlijk en Sales** via het aanpasformulier (✎). Alleen app-code, geen databasewijziging.
4. **Afdeling per item kunnen kiezen** (optioneel, vraagt migratie 008 met een kolom in `lists_items`).
5. **README.md bijwerken** met Vandaag/Later en Persoonlijk/Sales in de uitleg van de structuur.

---

## 11. Samenhang met de andere apps

Alle apps staan in `C:\Users\Gebruiker\OneDrive\Documenten\Persoonlijke apps\` en hebben dezelfde huisstijl.

| App | Map | Verband met B lists |
|---|---|---|
| **Be Strong** (fitness) | `Persoonlijke apps\Be strong` (er staat ook een kopie in `Documenten\Be strong`) | **Eigenaar van het Supabase-project.** B lists is een gast-app met prefix `lists_`. Zelfde login. Raak nooit Be Strong-tabellen of -functies aan. `SUPABASE_SHARED.md` staat in beide repo's: pas je hem aan, doe dat in beide. Be Strong levert ook PGlite voor de migratietests. |
| **Our Network** | `Persoonlijke apps\Our Network` | Ook een gast-app in hetzelfde Supabase-project, met prefix `net_`. Nooit aanraken. |
| **Be finance** (Bjorn Finance) | `Persoonlijke apps\Be finance` | Eigen, apart Supabase-project. Geen verband met de data van B lists. Nooit aanraken. |

Bijnamen die Bjorn gebruikt: "B lists" of "Be list" = deze app, "B strong" = Be Strong, "B finance" = Be finance.
