# Testhulpmiddelen

Er is geen build en geen testpakket. Deze bestanden helpen om wijzigingen veilig te testen, zonder de echte data te raken.

| Bestand | Wat het doet |
|---|---|
| `test-server.mjs` | Lokale server op poort 5181. `/` is de echte app, `/stub` en `/stub2` dezelfde app met een nagebootste Supabase. |
| `stub.js` | Nagebootste Supabase voor één gebruiker. Data in `sessionStorage` (`stub-db`), wachtwoord `goed`. Zet `sessionStorage['stub-offline']` om zonder bereik te testen. |
| `stub2.js` | Nagebootste Supabase voor meerdere gebruikers met huishoudens, uitnodigingen en Delen (zoals migratie 005). Data in `localStorage` (`stub2-db`), dus gedeeld tussen tabbladen. |
| `db/test-005.mjs`, `db/test-006.mjs`, `db/test-007.mjs` | Draaien de migraties op PGlite (Postgres in het geheugen) en controleren rechten en RLS als echte gebruikers. |
| `db/pglite.mjs` | Laadt PGlite uit `tools/node_modules`, of anders uit de map van Be Strong ernaast. |

## Gebruik

```bash
node tools/test-server.mjs
```

Open daarna `http://localhost:5181/stub`. Na een wijziging aan `stub.js`: twee keer herladen, want de service worker bewaart het bestand. Haal de service worker na het testen weg (DevTools › Application › Service workers).

```bash
node tools/db/test-007.mjs
```

Elke test eindigt met `ALLES OK` of met het aantal fouten.

## Let op

- De stubs volgen de app tot en met migratie 007. Voeg nieuwe kolommen toe aan `defaults` als een migratie kolommen toevoegt.
- Een nieuwe migratie krijgt een eigen test `db/test-NNN.mjs`: eerst de vorige migraties met wat bestaande data, dan de nieuwe, dan de controles.
