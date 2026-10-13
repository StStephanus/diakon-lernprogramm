/* Service Worker für das Diakon-Lernprogramm.
   Sorgt dafür, dass die App als PWA installierbar ist und beim Start auch
   bei einer kurzen Unterbrechung der Internetverbindung nicht komplett leer bleibt.

   WICHTIG beim nächsten Update von index.html: CACHE_NAME unten um 1 erhöhen
   (z. B. "diakon-lern-v2"), sonst behalten manche installierten Apps noch die
   alte, zwischengespeicherte Version der Seite. */
const CACHE_NAME = "diakon-lern-v10";
/* Audios werden getrennt gespeichert und bleiben bei App-Updates erhalten. */
const AUDIO_CACHE = "diakon-audio-v1";
const PRECACHE_URLS = [
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./apple-touch-icon.png",
  "./logo-round.png",
  "./manifest-pruefer.json",
  "./icon-pruefer-192.png",
  "./icon-pruefer-512.png",
  "./apple-touch-icon-pruefer.png"
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
      Promise.all(keys.filter((k) => k !== CACHE_NAME && k !== AUDIO_CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  // Audios (Supabase Storage): nach dem ersten Abspielen auf dem Gerät speichern.
  if (req.url.includes("/storage/v1/object/public/Audios/")) {
    event.respondWith(handleAudio(event, req));
    return;
  }

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

async function handleAudio(event, req) {
  const cache = await caches.open(AUDIO_CACHE);
  const cached = await cache.match(req.url);
  if (cached) {
    const range = req.headers.get("range");
    if (!range) return cached;
    // Browser (v. a. iOS) fragen Audio stückweise an: passenden Ausschnitt liefern.
    const buf = await cached.arrayBuffer();
    const m = /bytes=(\d*)-(\d*)/.exec(range);
    const start = m && m[1] ? parseInt(m[1], 10) : 0;
    const end = m && m[2] ? Math.min(parseInt(m[2], 10), buf.byteLength - 1) : buf.byteLength - 1;
    return new Response(buf.slice(start, end + 1), {
      status: 206,
      headers: {
        "Content-Type": cached.headers.get("Content-Type") || "audio/mpeg",
        "Content-Range": "bytes " + start + "-" + end + "/" + buf.byteLength,
        "Content-Length": String(end - start + 1),
        "Accept-Ranges": "bytes"
      }
    });
  }
  // Noch nicht gespeichert: normal laden und die ganze Datei im Hintergrund ablegen.
  event.waitUntil(
    fetch(req.url, { mode: "cors" })
      .then((res) => { if (res.status === 200) return cache.put(req.url, res); })
      .catch(() => {})
  );
  return fetch(req);
}
