/* Service Worker für das Diakon-Lernprogramm.
   Sorgt dafür, dass die App als PWA installierbar ist und beim Start auch
   bei einer kurzen Unterbrechung der Internetverbindung nicht komplett leer bleibt.

   WICHTIG beim nächsten Update von index.html: CACHE_NAME unten um 1 erhöhen
   (z. B. "diakon-lern-v2"), sonst behalten manche installierten Apps noch die
   alte, zwischengespeicherte Version der Seite. */
const CACHE_NAME = "diakon-lern-v4";
const PRECACHE_URLS = [
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./apple-touch-icon.png",
  "./logo-round.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  // Die eigentliche Seite (index.html / Navigation): immer zuerst das Netzwerk versuchen,
  // damit niemand an einer veralteten Version hängen bleibt. Nur bei fehlender
  // Internetverbindung greift der zwischengespeicherte Stand als Reserve.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          caches.open(CACHE_NAME).then((cache) => cache.put(req, res.clone()));
          return res;
        })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }

  // Alles andere (Icons, Manifest, usw.): aus dem Cache, falls vorhanden, sonst Netzwerk.
  event.respondWith(
    caches.match(req).then((cached) => cached || fetch(req))
  );
});
