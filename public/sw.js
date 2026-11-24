const BUILD_ASSETS = /* BUILD_ASSETS */ [];
const REVISION = /* BUILD_REVISION */ "development";
const CACHE = "campus-agent-shell-v4:" + REVISION;
const SHELL = ["/", "/index.html", "/styles.css", "/app.js", "/display-date.js", "/taskboard-core.js", "/taskboard.js", "/icon.svg", ...BUILD_ASSETS];
self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)));
  self.skipWaiting();
});
self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith("campus-agent-shell-") && k!==CACHE).map(k=>caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin ||
      url.pathname.startsWith("/api/")) return;
  if (event.request.mode === "navigate") {
    event.respondWith(fetch(event.request).catch(()=>caches.match("/index.html")));
    return;
  }
  event.respondWith(fetch(event.request).catch(()=>caches.match(event.request)));
});
