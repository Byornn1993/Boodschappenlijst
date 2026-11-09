// Service worker van Boodschappenlijst: de app opent ook zonder bereik.
// De pagina komt eerst van het netwerk (zo zie je updates meteen), zonder bereik uit de cache.
// Iconen, het Supabase-script en lettertypes komen uit de cache en worden op de achtergrond ververst.
// De database (supabase.co) gaat nooit via de cache: daarvoor heeft de app een eigen wachtrij.
const CACHE = "lists-v1";
const SUPABASE_JS = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.3/dist/umd/supabase.js";
const SHELL = ["./", "manifest.webmanifest", "icon.svg", "apple-touch-icon.png", "pwa-192.png", "pwa-512.png", SUPABASE_JS];
const INDEX = new URL("./", self.registration.scope).href;

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith("lists-") && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Pagina: netwerk, maar na 4 seconden zonder antwoord de bewaarde versie.
async function page(req) {
  const cache = await caches.open(CACHE);
  const net = fetch(req).then(res => { if (res.ok) cache.put(INDEX, res.clone()); return res; });
  net.catch(() => {});
  const late = new Promise(r => setTimeout(r, 4000)).then(() => cache.match(INDEX));
  try {
    const first = await Promise.race([net, late]);
    if (first) return first;
    return await net;
  } catch (e) {
    return (await cache.match(INDEX)) || Response.error();
  }
}

// Overige bestanden: meteen uit de cache, en op de achtergrond een nieuwe versie ophalen.
async function asset(req, e) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req);
  const net = fetch(req).then(res => { if (res.ok || res.type === "opaque") cache.put(req, res.clone()); return res; });
  if (hit) { e.waitUntil(net.catch(() => {})); return hit; }
  return net;
}

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (req.mode === "navigate" && url.href.startsWith(self.registration.scope)) return e.respondWith(page(req));
  const own = url.href.startsWith(self.registration.scope) && !url.pathname.endsWith("/sw.js");
  if (own || req.url === SUPABASE_JS || url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com")
    e.respondWith(asset(req, e));
});
