// Provides localhost service-worker fallback for canonical character and campaign routes.
const CHARACTER_ROUTE = /^\/char\/[a-z0-9][a-z0-9-]{0,127}\/?$/i;
const CAMPAIGN_ROUTE = /^\/c\/[a-z]{2,48}\/(char|wiki|music|combat-loot|public-initiative|player-screen|dm-screen|compendium|manage)(?:\/.*)?$/i;

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || (!CHARACTER_ROUTE.test(url.pathname) && !CAMPAIGN_ROUTE.test(url.pathname))) return;

  event.respondWith(fetch(event.request).then((response) => {
    if (response.status !== 404) return response;
    const campaign = CAMPAIGN_ROUTE.exec(url.pathname);
    const feature = campaign?.[1]?.toLowerCase();
    const shell = feature === "char"
      ? (url.pathname.split("/").filter(Boolean).length > 3 ? "/char/template/" : "/char/")
      : feature === "manage" ? "/campaigns/manage.html"
        : feature ? `/${feature}/` : "/char/template/";
    const templateURL = new URL(shell, url);
    templateURL.search = url.search;
    return fetch(templateURL.toString());
  }));
});
