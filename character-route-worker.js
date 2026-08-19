const CHARACTER_ROUTE = /^\/char\/[a-z0-9][a-z0-9-]{0,127}\/?$/i;

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || !CHARACTER_ROUTE.test(url.pathname)) return;

  event.respondWith(fetch(event.request).then((response) => {
    if (response.status !== 404) return response;
    const templateURL = new URL("/char/template/", url);
    templateURL.search = url.search;
    return fetch(templateURL.toString());
  }));
});
