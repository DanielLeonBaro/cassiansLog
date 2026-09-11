// Derives campaign context from URLs and builds scoped links, APIs, and browser keys.
import { isLocalRuntimeHost } from "./runtime-host.js";
import { currentLocalUser, LOCAL_ADMIN_USER, LOCAL_TEST_USERS, LOCAL_USERS } from "./local-users.js";

const CAMPAIGN_PATH = /^\/c\/([a-z]{2,48})(?:\/|$)/;
const CAMPAIGN_SLUG = /^[a-z]{2,48}$/;
const CAMPAIGN_API_RESOURCES = new Set([
  "characters", "wiki", "music", "combat-loot", "public-initiative", "screens", "settings",
]);

let contextPromise;
const LOCAL_CAMPAIGNS_KEY = "cassianslog-local-campaigns-v1";
const LAST_CAMPAIGN_KEY = "cassianslog-last-campaign-v1";
const LAST_CAMPAIGN_COOKIE = "cassianslog_campaign";
const UNSCOPED_CAMPAIGN_PAGE = /^\/(?:char|wiki|music|combat-loot|public-initiative|player-screen|dm-screen)(?:\/|$)/;

function campaignSelectionKey(userId) {
  return `${LAST_CAMPAIGN_KEY}:${String(userId || "anonymous")}`;
}

function storedCampaignSelection(storage, userId) {
  const value = storage?.getItem(campaignSelectionKey(userId)) || "";
  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === "object") {
      return {
        id: String(parsed.id || ""),
        slug: CAMPAIGN_SLUG.test(parsed.slug || "") ? parsed.slug : "",
      };
    }
  } catch {
    // Plain strings are the compatibility shape for early remembered selections.
  }
  return { id: "", slug: CAMPAIGN_SLUG.test(value) ? value : "" };
}

export function rememberedCampaignSlug({
  storage = globalThis.localStorage,
  userId = "",
} = {}) {
  return storedCampaignSelection(storage, userId).slug;
}

export function rememberCampaignSlug(slug, {
  storage = globalThis.localStorage,
  userId = "",
  campaignId = "",
  cookieDocument = globalThis.document,
  protocol = globalThis.location?.protocol || "",
} = {}) {
  if (!CAMPAIGN_SLUG.test(slug)) return false;
  storage?.setItem(campaignSelectionKey(userId), JSON.stringify({ id: String(campaignId || ""), slug }));
  if (cookieDocument && userId) {
    const value = encodeURIComponent(`${userId}:${slug}`);
    const secure = protocol === "https:" ? "; Secure" : "";
    cookieDocument.cookie = `${LAST_CAMPAIGN_COOKIE}=${value}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
  }
  return true;
}

export function selectRememberedCampaign(campaigns, {
  preferredSlug = "",
  storage = globalThis.localStorage,
  userId = "",
  cookieDocument = globalThis.document,
  protocol = globalThis.location?.protocol || "",
} = {}) {
  const joined = Array.isArray(campaigns) ? campaigns.filter((campaign) => campaign?.joined) : [];
  const remembered = storedCampaignSelection(storage, userId);
  const selected = joined.find((campaign) => campaign.slug === preferredSlug)
    || joined.find((campaign) => remembered.id && campaign.id === remembered.id)
    || joined.find((campaign) => campaign.slug === remembered.slug)
    || joined[0]
    || null;
  if (selected) rememberCampaignSlug(selected.slug, {
    storage,
    userId,
    campaignId: selected.id,
    cookieDocument,
    protocol,
  });
  return selected;
}

export function campaignRouteForUnscopedPath(slug, pathname = globalThis.location?.pathname || "") {
  if (!CAMPAIGN_SLUG.test(slug) || campaignSlugFromPath(pathname)) return "";
  if (UNSCOPED_CAMPAIGN_PAGE.test(pathname)) return `/c/${encodeURIComponent(slug)}${pathname}`;
  if (/^\/campaigns\/manage(?:\.html)?\/?$/.test(pathname)) return campaignPath(slug, "manage");
  return "";
}

function defaultLocalMembers() {
  return [
    { userId: LOCAL_ADMIN_USER.id, role: "dm" },
    ...LOCAL_TEST_USERS.map((user) => ({ userId: user.id, role: "player" })),
  ];
}

function defaultLocalCampaign() {
  return {
    id: "campaign-breugaire",
    name: "Apotheosis of the Rings",
    description: "",
    banner: "",
    status: "Active",
    slug: "aotr",
    joinEnabled: false,
    createdAt: null,
    updatedAt: null,
    members: defaultLocalMembers(),
    characterEditors: {},
  };
}

function localCampaignRecords(storage = globalThis.localStorage) {
  let stored = [];
  try {
    const value = JSON.parse(storage?.getItem(LOCAL_CAMPAIGNS_KEY) || "[]");
    if (Array.isArray(value)) stored = value.filter((campaign) => campaign?.slug && campaign?.name);
  } catch {
    // A malformed local catalog should not stop localhost pages from opening.
  }
  return stored.some((campaign) => campaign.slug === "aotr")
    ? stored
    : [defaultLocalCampaign(), ...stored];
}

function normalizedLocalCampaign(campaign) {
  const fallbackMembers = campaign.slug === "aotr"
    ? defaultLocalMembers()
    : [{ userId: LOCAL_ADMIN_USER.id, role: "dm" }];
  return {
    ...defaultLocalCampaign(),
    ...campaign,
    members: Array.isArray(campaign.members) ? campaign.members : fallbackMembers,
    characterEditors: campaign.characterEditors && typeof campaign.characterEditors === "object"
      ? campaign.characterEditors
      : {},
  };
}

function publicLocalCampaign(campaign, user) {
  const membership = campaign.members.find((member) => member.userId === user.id);
  return {
    ...campaign,
    joined: user.isPrimaryAdmin || Boolean(membership),
    role: user.isPrimaryAdmin ? "admin" : membership?.role || null,
  };
}

function writeLocalCampaigns(campaigns, storage = globalThis.localStorage) {
  storage?.setItem(LOCAL_CAMPAIGNS_KEY, JSON.stringify(campaigns));
}

export function localCampaigns(storage = globalThis.localStorage, user = currentLocalUser(storage)) {
  return localCampaignRecords(storage)
    .map(normalizedLocalCampaign)
    .map((campaign) => publicLocalCampaign(campaign, user));
}

export function localCampaign(slug, storage = globalThis.localStorage, user = currentLocalUser(storage)) {
  return localCampaigns(storage, user).find((campaign) => campaign.slug === slug) || null;
}

export function saveLocalCampaign(slug, changes, storage = globalThis.localStorage) {
  const user = currentLocalUser(storage);
  const campaigns = localCampaignRecords(storage).map(normalizedLocalCampaign);
  const index = campaigns.findIndex((campaign) => campaign.slug === slug);
  const campaign = {
    ...(index >= 0 ? campaigns[index] : {
      ...defaultLocalCampaign(),
      id: `local-${slug}`,
      name: slug,
      slug,
      members: [{ userId: user.id, role: "dm" }],
    }),
    ...changes,
    slug,
    updatedAt: new Date().toISOString(),
  };
  if (index >= 0) campaigns.splice(index, 1, campaign);
  else campaigns.push(campaign);
  writeLocalCampaigns(campaigns, storage);
  return publicLocalCampaign(campaign, user);
}

export function joinLocalCampaign(slug, storage = globalThis.localStorage, user = currentLocalUser(storage)) {
  const campaigns = localCampaignRecords(storage).map(normalizedLocalCampaign);
  const campaign = campaigns.find((candidate) => candidate.slug === slug);
  if (!campaign) throw new Error("Campaign not found.");
  if (!user.isPrimaryAdmin && !campaign.members.some((member) => member.userId === user.id)) {
    campaign.members.push({ userId: user.id, role: "player" });
    campaign.updatedAt = new Date().toISOString();
    writeLocalCampaigns(campaigns, storage);
  }
  return publicLocalCampaign(campaign, user);
}

export function localCampaignMembers(slug, storage = globalThis.localStorage) {
  const campaign = localCampaignRecords(storage).map(normalizedLocalCampaign)
    .find((candidate) => candidate.slug === slug);
  if (!campaign) return [];
  return campaign.members.map((member) => {
    const user = LOCAL_USERS.find((candidate) => candidate.id === member.userId);
    return user ? { id: user.id, email: user.email, label: user.label, role: member.role } : null;
  }).filter(Boolean);
}

export function updateLocalCampaignMember(slug, userId, role, storage = globalThis.localStorage) {
  if (!["player", "dm"].includes(role)) throw new Error("Member role must be player or dm.");
  const campaigns = localCampaignRecords(storage).map(normalizedLocalCampaign);
  const campaign = campaigns.find((candidate) => candidate.slug === slug);
  const member = campaign?.members.find((candidate) => candidate.userId === userId);
  if (!campaign || !member) throw new Error("Member not found.");
  const dmCount = campaign.members.filter((candidate) => candidate.role === "dm").length;
  if (member.role === "dm" && role !== "dm" && dmCount <= 1) throw new Error("Assign another DM before demoting the final DM.");
  member.role = role;
  campaign.updatedAt = new Date().toISOString();
  writeLocalCampaigns(campaigns, storage);
  return member;
}

export function removeLocalCampaignMember(slug, userId, storage = globalThis.localStorage) {
  const campaigns = localCampaignRecords(storage).map(normalizedLocalCampaign);
  const campaign = campaigns.find((candidate) => candidate.slug === slug);
  const member = campaign?.members.find((candidate) => candidate.userId === userId);
  if (!campaign || !member) throw new Error("Member not found.");
  const dmCount = campaign.members.filter((candidate) => candidate.role === "dm").length;
  if (member.role === "dm" && dmCount <= 1) throw new Error("Assign another DM before removing the final DM.");
  campaign.members = campaign.members.filter((candidate) => candidate.userId !== userId);
  Object.keys(campaign.characterEditors).forEach((characterId) => {
    campaign.characterEditors[characterId] = campaign.characterEditors[characterId]
      .filter((candidate) => candidate !== userId);
  });
  campaign.updatedAt = new Date().toISOString();
  writeLocalCampaigns(campaigns, storage);
  return true;
}

export function localCharacterEditors(slug, characterId, storage = globalThis.localStorage) {
  const campaign = localCampaignRecords(storage).map(normalizedLocalCampaign)
    .find((candidate) => candidate.slug === slug);
  const ids = Array.isArray(campaign?.characterEditors?.[characterId])
    ? campaign.characterEditors[characterId]
    : [];
  return ids.map((id) => LOCAL_USERS.find((user) => user.id === id)).filter(Boolean);
}

export function saveLocalCharacterEditors(slug, characterId, userIds, storage = globalThis.localStorage) {
  const campaigns = localCampaignRecords(storage).map(normalizedLocalCampaign);
  const campaign = campaigns.find((candidate) => candidate.slug === slug);
  if (!campaign) throw new Error("Campaign not found.");
  const players = new Set(campaign.members.filter((member) => member.role === "player").map((member) => member.userId));
  const editors = [...new Set(userIds)];
  if (editors.some((userId) => !players.has(userId))) throw new Error("Every character editor must be a campaign player.");
  campaign.characterEditors[characterId] = editors;
  campaign.updatedAt = new Date().toISOString();
  writeLocalCampaigns(campaigns, storage);
  return editors;
}

export function assignLocalCharacterEditor(slug, characterId, userId, storage = globalThis.localStorage) {
  const current = localCharacterEditors(slug, characterId, storage).map((user) => user.id);
  return saveLocalCharacterEditors(slug, characterId, [...current, userId], storage);
}

export function localCharacterAccess(slug, characterId, storage = globalThis.localStorage, user = currentLocalUser(storage)) {
  const campaign = localCampaign(slug, storage, user);
  const canManage = campaign?.role === "dm" || campaign?.role === "admin";
  const canEdit = canManage || localCharacterEditors(slug, characterId, storage).some((editor) => editor.id === user.id);
  return { canEdit, canManage };
}

export function campaignSlugFromPath(pathname = globalThis.location?.pathname || "") {
  return CAMPAIGN_PATH.exec(pathname)?.[1] || "";
}

export function currentCampaignSlug() {
  return campaignSlugFromPath();
}

export function campaignPath(slug, path = "") {
  const normalized = String(path).replace(/^\/+|\/+$/g, "");
  return `/c/${encodeURIComponent(slug)}/${normalized}${normalized ? "/" : ""}`;
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
  return slug ? campaignPath(slug, normalized) : `/${normalized}${normalized ? "/" : ""}`;
}

export async function availableCampaigns() {
  if (isLocalRuntimeHost()) return localCampaigns();
  const response = await fetch("/api/campaigns", { headers: { accept: "application/json" } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `Could not load campaigns (${response.status}).`);
  return Array.isArray(body.campaigns) ? body.campaigns : [];
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
  if (isLocalRuntimeHost()) return Promise.resolve(localCampaign(slug));
  if (refresh || !contextPromise) {
    contextPromise = fetch(`/api/campaigns/${encodeURIComponent(slug)}`, { headers: { accept: "application/json" } })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.error || `Could not load campaign (${response.status}).`);
        return body.campaign;
      })
      .catch((error) => { throw error; });
  }
  return contextPromise;
}

export async function campaignCanManage() {
  const campaign = await currentCampaign();
  return campaign?.role === "dm" || campaign?.role === "admin";
}
