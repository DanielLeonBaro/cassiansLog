// Derives campaign context from URLs and builds scoped links, APIs, and browser keys.
const CAMPAIGN_PATH = /^\/c\/([a-z]{2,48})(?:\/|$)/;
const CAMPAIGN_API_RESOURCES = new Set([
  "characters", "wiki", "music", "combat-loot", "public-initiative", "screens", "settings",
]);

let contextPromise;

export function campaignSlugFromPath(pathname = globalThis.location?.pathname || "") {
  return CAMPAIGN_PATH.exec(pathname)?.[1] || "";
}

export function currentCampaignSlug() {
  return campaignSlugFromPath();
}

export function campaignApiPath(path) {
  const normalized = String(path || "").replace(/^\//, "");
  const slug = currentCampaignSlug();
  if (!slug || !normalized.startsWith("api/")) return path;
  const tail = normalized.slice(4);
  const resource = tail.split("/")[0];
  return CAMPAIGN_API_RESOURCES.has(resource)
    ? `/api/campaigns/${encodeURIComponent(slug)}/${tail}`
    : `/${normalized}`;
}

export function campaignPagePath(path = "") {
  const normalized = String(path).replace(/^\/+|\/+$/g, "");
  const slug = currentCampaignSlug();
  return slug ? `/c/${encodeURIComponent(slug)}/${normalized}${normalized ? "/" : ""}` : `/${normalized}${normalized ? "/" : ""}`;
}

export function campaignStorageKey(key, storage = globalThis.localStorage) {
  const slug = currentCampaignSlug();
  if (!slug) return key;
  const scoped = `${key}:campaign:${slug}`;
  if (slug === "aotr" && storage && storage.getItem(scoped) === null) {
    const legacy = storage.getItem(key);
    if (legacy !== null) storage.setItem(scoped, legacy);
  }
  return scoped;
}

export function currentCampaign({ refresh = false } = {}) {
  const slug = currentCampaignSlug();
  if (!slug) return Promise.resolve(null);
  if (refresh || !contextPromise) {
    contextPromise = fetch(`/api/campaigns/${encodeURIComponent(slug)}`, { headers: { accept: "application/json" } })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.error || `Could not load campaign (${response.status}).`);
        return body.campaign;
      });
  }
  return contextPromise;
}

export async function campaignCanManage() {
  const campaign = await currentCampaign();
  return campaign?.role === "dm" || campaign?.role === "admin";
}
