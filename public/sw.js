/*
 * Service worker — CRM Make Your Com (PWA).
 *
 * Politique VOLONTAIREMENT CONSERVATRICE : on ne met JAMAIS en cache les
 * réponses authentifiées (API, pages dynamiques) — évite toute fuite de
 * données entre sessions et tout affichage périmé. Seuls les assets statiques
 * immuables (chunks Next, icônes) sont cachés. Une page « hors ligne » minimale
 * sert de secours pour les navigations sans réseau.
 */
const STATIC_CACHE = "myc-static-v1";
const STATIC_ASSETS = [
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/manifest.webmanifest",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((c) => c.addAll(STATIC_ASSETS))
      .catch(() => {}),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== STATIC_CACHE).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

const OFFLINE_HTML =
  '<!doctype html><html lang="fr"><head><meta charset="utf-8">' +
  '<meta name="viewport" content="width=device-width,initial-scale=1">' +
  "<title>Hors ligne</title></head>" +
  '<body style="margin:0;height:100vh;display:flex;align-items:center;justify-content:center;background:#0E1936;color:#fff;font-family:system-ui,-apple-system,sans-serif;text-align:center">' +
  '<div><div style="font-size:22px;font-weight:700;letter-spacing:.02em">Make Your Com</div>' +
  '<p style="opacity:.8;max-width:280px;line-height:1.5">Pas de connexion Internet. Reconnecte-toi pour accéder au CRM.</p></div>' +
  "</body></html>";

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  let url;
  try {
    url = new URL(req.url);
  } catch {
    return;
  }
  if (url.origin !== self.location.origin) return;

  // Assets statiques immuables → cache-first.
  if (
    url.pathname.startsWith("/_next/static") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/brand/") ||
    url.pathname === "/manifest.webmanifest"
  ) {
    event.respondWith(
      caches.match(req).then(
        (cached) =>
          cached ||
          fetch(req).then((res) => {
            const copy = res.clone();
            caches.open(STATIC_CACHE).then((c) => c.put(req, copy));
            return res;
          }),
      ),
    );
    return;
  }

  // Navigations (pages) → réseau d'abord, secours hors-ligne.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(
        () =>
          new Response(OFFLINE_HTML, {
            headers: { "Content-Type": "text/html; charset=utf-8" },
          }),
      ),
    );
    return;
  }

  // Tout le reste (API, données dynamiques) → réseau uniquement, jamais caché.
});
