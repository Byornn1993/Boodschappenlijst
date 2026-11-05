# Boodschappenlijst

Persoonlijke app voor boodschappen, challenges en "later kopen". Eén HTML-pagina op GitHub Pages, met de data in het Supabase-project van Be Strong.

- **Afspraken over de database:** [SUPABASE_SHARED.md](SUPABASE_SHARED.md)
- **Migraties:** `supabase/migrations/`, uitgevoerd in de SQL Editor en bijgehouden in `LOG.md`
- **Beveiliging:** de publishable key in `index.html` is openbaar bedoeld. Row Level Security beschermt de data. Zet hier nooit een secret of service role key.
