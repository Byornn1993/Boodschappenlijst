# Boodschappenlijst

Persoonlijke app met vijf lijsten: Thuis (taken), Boodschappen, Vast, Challenges en Later kopen. Eén HTML-pagina op GitHub Pages, met de data in het Supabase-project van Be Strong.

- **Afspraken over de database:** [SUPABASE_SHARED.md](SUPABASE_SHARED.md)
- **Migraties:** `supabase/migrations/`, uitgevoerd in de SQL Editor en bijgehouden in `LOG.md`
- **Beveiliging:** de publishable key in `index.html` is openbaar bedoeld. Row Level Security beschermt de data. Zet hier nooit een secret of service role key.

## Hoe het in elkaar zit

Alles staat in `index.html`, in deze volgorde:

1. **Stijl:** huisstijlkleuren als tokens, donker standaard, licht via `prefers-color-scheme` of `data-theme`. De menubalk staat onderaan: op de telefoon over de volle breedte, op de laptop zwevend onder de kolom.
2. **Algemeen:** `pref`/`keep` (instellingen en bewaarde gegevens op het toestel), `say` (melding onderaan, eventueel met "Ongedaan maken"), tabbladen en thema.
3. **Regels in een lijst:** knoppen, vinkjes, vegen (`swipe`), tik op de regel, verslepen (`grip`, `reorder`).
4. **Per lijst:** een `render…`-functie die de lijst tekent, plus aanpassen in de regel (`editForm`). Bij Boodschappen horen ook de afdelingen (`AISLES`) en de suggesties (`suggest`).
5. **Opslaan:** `collection()` per tabel. Wat je ziet = laatst opgehaalde data (`base`) + wachtende wijzigingen (`queue`). De wachtrij staat in localStorage en gaat via `flush()` op volgorde naar Supabase. Zonder bereik blijft hij bewaard.
6. **Verbinding:** Realtime-kanaal, opnieuw verbinden als de app terugkomt van de achtergrond, inloggen en uitloggen.

`sw.js` is de service worker. De pagina komt van het netwerk, en zonder bereik uit de cache. Iconen en het Supabase-script komen uit de cache. Verhoog `CACHE` als de lijst met bestanden verandert.

## Testen

Er is geen build en geen testpakket. Test lokaal met een nagebootste Supabase: dezelfde pagina, maar met een stub in plaats van het CDN-script. Controleer na het pushen de live versie met `?v=<commit>`, want GitHub Pages bewaart pagina's ongeveer 10 minuten.
