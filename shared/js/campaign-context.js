// Derives campaign context from URLs and builds scoped links, APIs, and browser keys.
import { isLocalRuntimeHost } from "./runtime-host.js";

const CAMPAIGN_PATH = /^\/c\/([a-z]{2,48})(?:\/|$)/;
const CAMPAIGN_API_RESOURCES = new Set([
  "characters", "wiki", "music", "combat-loot", "public-initiative", "screens", "settings",
]);

let contextPromise;
const LOCAL_CAMPAIGNS_KEY = "cassianslog-local-campaigns-v1";

function defaultLocalCampaign() {
  return {
    id: "campaign-breugaire",
    name: "Apotheosis of the Rings",
    description: "",
    banner: "",
    slug: "aotr",
    joined: true,
    role: "admin",
    joinEnabled: false,
    createdAt: null,
    updatedAt: null,
  };
}

export function localCampaigns(storage = globalThis.localStorage) {
  let stored = [];
  try {
    const value = JSON.parse(storage?.getItem(LOCAL_CAMPAIGNS_KEY) || "[]");
    if (Array.isArray(value)) stored = value.filter((campaign) => campaign?.slug && campaign?.name);
  } catch {
    // A malformed local catalog should not stop localhost pages from opening.
  }
  const campaigns = stored.some((campaign) => campaign.slug === "aotr")
    ? stored
    : [defaultLocalCampaign(), ...stored];
  return campaigns.map((campaign) => ({
    ...defaultLocalCampaign(),
    ...campaign,
    joined: true,
    role: "admin",
  }));
}

export function localCampaign(slug, storage = globalThis.localStorage) {
  return localCampaigns(storage).find((campaign) => campaign.slug === slug) || {
    ...defaultLocalCampaign(),
    id: `local-${slug}`,
    name: slug,
    slug,
  };
}

export function saveLocalCampaign(slug, changes, storage = globalThis.localStorage) {
  const campaigns = localCampaigns(storage);
  const index = campaigns.findIndex((campaign) => campaign.slug === slug);
  const campaign = {
    ...(index >= 0 ? campaigns[index] : localCampaign(slug, storage)),
    ...changes,
    slug,
    joined: true,
    role: "admin",
    updatedAt: new Date().toISOString(),
  };
  if (index >= 0) campaigns.splice(index, 1, campaign);
  else campaigns.push(campaign);
  storage?.setItem(LOCAL_CAMPAIGNS_KEY, JSON.stringify(campaigns));
  return campaign;
}

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
      })
      .catch((error) => {
        if (isLocalRuntimeHost()) return localCampaign(slug);
        throw error;
      });
  }
  return contextPromise;
}

export async function campaignCanManage() {
  const campaign = await currentCampaign();
  return campaign?.role === "dm" || campaign?.role === "admin";
}
