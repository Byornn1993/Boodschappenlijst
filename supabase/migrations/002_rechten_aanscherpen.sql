-- Boodschappenlijst: rechten aanscherpen
-- Supabase geeft nieuwe tabellen automatisch ruime rechten. 001 haalde die weg voor anon, maar niet voor authenticated.
-- Dit bestand laat voor ingelogde gebruikers alleen select, insert, update en delete over.
-- Er verandert geen data en de app merkt hier niets van.

begin;

revoke truncate, references, trigger on table public.lists_items from authenticated;
revoke truncate, references, trigger on table public.lists_challenges from authenticated;
revoke truncate, references, trigger on table public.lists_wishlist from authenticated;

commit;
