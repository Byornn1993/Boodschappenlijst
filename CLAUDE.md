# B lists (Boodschappenlijst): werkafspraken voor Claude

Dit bestand wordt bij elke sessie in deze map automatisch gelezen. Houd het actueel.
Nieuw hier? Lees eerst [HANDOVER.md](HANDOVER.md): wat de app is, hoe hij werkt, wat er nog moet.

## Werkmap en data
- Werk **altijd** in `C:\Users\Gebruiker\OneDrive\Documenten\Persoonlijke apps\B lists` (git, branch `main`).
- Alles wat bij dit project hoort, staat in deze map: code, migraties, tests, documentatie. Maak geen bestanden erbuiten. Tijdelijke testbestanden zet je in `tests/`; persoonlijke data (exports, imports) in `import/` (staat in `.gitignore`).
- De echte data staat in Supabase (project `mngqptjikxeihmmnibio`, tabellen `lists_…`), niet in bestanden.
- Live: https://byornn1993.github.io/Boodschappenlijst/ (repo `Byornn1993/Boodschappenlijst`, **publiek**).

## Wie en hoe
- Eigenaar: Bjorn (nl-BE, geen programmeur). Communiceer in het **Nederlands**: eenvoudig, kort en concreet.
- Neem technische beslissingen zelf en bouw door. Vraag alleen bij echte keuzes voor Bjorn, of bij productie- en data-ingrepen.
- Vraagt Bjorn eerst te sparren of iets te laten zien, toon dan een voorbeeld (mockup) en wacht op zijn akkoord.
- Zeg na elke wijziging kort wat er veranderd is en hoe hij het kan testen.
- Rapporteer eerlijk wat getest is en wat niet (bv. "niet op een echte iPhone getest").
- Eén logische wijziging per commit, Nederlandse commitboodschap, eindigend met de Co-Authored-By-regel.

## Stijl (Bjorns voorkeuren)
- Huisstijl: #101418 (antraciet), #2C3E50, #B08D57 (goud), #DCC9A6, #FBF6EE. Donker en licht thema.
- Mobiel eerst (iPhone, ook vanaf het beginscherm), maar ook goed op de laptop. Tikvlakken minstens 44 px.
- Eenvoud boven extra's. "Ongedaan maken" in plaats van bevestigingsvensters.
- Menubalk onderaan, ook op de laptop. Twee lijsten op één pagina: telefoon = schakelaar, laptop = twee kolommen.
- Dezelfde stijl als Be Strong en Be finance: achtergrondgloed op een vaste laag, doorschijnende kaarten met gouden rand, `--surface` dekkend.

## Harde regels
- **Geen productiemigratie zonder expliciet "ja" van Bjorn.** Schrijf ze in `supabase/migrations/00X_….sql`, test ze met een script in `tests/db/`, leg uit wat ze doet. Daarna (met zijn ok): uitvoeren in de SQL Editor via zijn Chrome, voor en na tellen, datum in `supabase/migrations/LOG.md`.
- **Volgorde:** nieuwe kolom of tabel eerst in de database, dan pas de app pushen.
- Secret/service role key, databasewachtwoord en wachtwoorden van Bjorn of Stéphanie: **nooit vragen, nooit invullen, nooit in de code**. De publishable key mag publiek. Geen e-mailadressen in de code (repo is publiek).
- Geen accounts aanmaken en geen wachtwoorden kiezen: dat doet Bjorn zelf in Supabase.
- Het Supabase-project is **gedeeld**: Be Strong (geen prefix) is eigenaar, Our Network gebruikt `net_`. Raak alleen `lists_`-tabellen en -functies aan; zie `SUPABASE_SHARED.md`. Bjorn Finance is een ander project: nooit aanraken.
- Niets schrappen zonder het eerst te vragen. Geen nieuwe dependencies tenzij ze duidelijk iets oplossen.

## Testen
- Browser: `node tests/test-server.mjs` (of `preview_start` met `lists-test`), dan http://localhost:5181/stub of /stub2, wachtwoord `goed`. Voor en na: service worker afmelden en caches en storage wissen.
- Database: `node tests/db/migratie-00X.mjs` (PGlite uit `..\Be strong\node_modules`).
- Na een push: controleer de live versie met `?v=<commit>` (GitHub Pages bewaart ±10 minuten).
- Node staat in `C:\Program Files\nodejs`. Geen Python: scripts met node.

## Valkuilen
Zie HANDOVER.md, sectie 9. De belangrijkste: `.wrap { min-height: 100lvh }` op aanraakschermen niet weghalen (iPhone-menubalk), `lists_my_household()` moet `volatile` blijven, en verhoog `CACHE` in `sw.js` als de lijst met bestanden verandert.
