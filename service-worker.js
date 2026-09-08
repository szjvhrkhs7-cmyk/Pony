const CACHE_NAME = "seeker-chronicles-v16-reference-ui";
const APP_SHELL = [
  "./",
  "./index.html",
  "./notebook/app.mjs",
  "./notebook/db.mjs",
  "./notebook/model.mjs",
  "./notebook/cloud.mjs",
  "./notebook/text.mjs",
  "./notebook/book.css",
  "./notebook/refinement.css",
  "./notebook/reference-v3.css",
  "./notebook/ui-enhancements.mjs",
  "./manifest.webmanifest",
  "./assets/d20.svg",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
  "./assets/aged-paper.webp",
  "./assets/adventurer-desk.webp",
  "./assets/map-sketch.svg",
  "./assets/strada-default.svg",
  ...["400", "500", "600", "700"].map(
    (w) => `./assets/fonts/garamond-${w}.ttf`,
  ),
];
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)),
  );
  self.skipWaiting();
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (k) => k.startsWith("seeker-chronicles-") && k !== CACHE_NAME,
            )
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});
self.addEventListener("fetch", (event) => {
  const req = event.request,
    url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin) return;
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((response) =>
          response.ok ? response : caches.match("./index.html"),
        )
        .catch(() => caches.match("./index.html")),
    );
    return;
  }
  if (
    !APP_SHELL.some(
      (path) => new URL(path, self.registration.scope).href === url.href,
    )
  )
    return;
  event.respondWith(
    caches
      .open(CACHE_NAME)
      .then(async (cache) => (await cache.match(req)) || fetch(req)),
  );
});
