// Verifies URL-derived campaign API, navigation, and browser-cache isolation.
import assert from "node:assert/strict";
import {
  campaignApiPath,
  campaignPagePath,
  campaignPath,
  campaignRouteForUnscopedPath,
  campaignSlugFromPath,
  campaignStorageKey,
  currentCampaign,
  joinLocalCampaign,
  localCampaigns,
  localCampaignMembers,
  localCharacterAccess,
  rememberedCampaignSlug,
  rememberCampaignSlug,
  saveLocalCampaign,
  saveLocalCharacterEditors,
  selectRememberedCampaign,
} from "../js/campaign-context.js";
import { currentLocalUser, LOCAL_TEST_USERS, selectLocalUser } from "../js/local-users.js";

const originalLocation = globalThis.location;
const originalStorage = globalThis.localStorage;
const originalFetch = globalThis.fetch;
const values = new Map([["dnd-wiki-pages-v1", "legacy-wiki"]]);
globalThis.localStorage = {
  getItem: (key) => values.has(key) ? values.get(key) : null,
  setItem: (key, value) => values.set(key, value),
};

const cookieDocument = { cookie: "" };
const joinedCampaigns = [
  { id: "campaign-aotr", slug: "aotr", name: "Apotheosis", joined: true },
  { id: "campaign-sita", slug: "sita", name: "Sita", joined: true },
  { id: "campaign-hidden", slug: "hidden", name: "Hidden", joined: false },
];
assert.equal(rememberCampaignSlug("NOT-VALID", { storage: globalThis.localStorage, userId: "alice", cookieDocument }), false);
assert.equal(rememberCampaignSlug("aotr/other", { storage: globalThis.localStorage, userId: "alice", cookieDocument }), false);
assert.equal(selectRememberedCampaign(joinedCampaigns, {
  preferredSlug: "sita",
  storage: globalThis.localStorage,
  userId: "alice",
  cookieDocument,
  protocol: "https:",
}).slug, "sita");
assert.equal(rememberedCampaignSlug({ storage: globalThis.localStorage, userId: "alice" }), "sita");
assert.match(cookieDocument.cookie, /^cassianslog_campaign=alice%3Asita;/);
assert.match(cookieDocument.cookie, /; Secure$/);
assert.equal(selectRememberedCampaign(joinedCampaigns, {
  storage: globalThis.localStorage,
  userId: "alice",
  cookieDocument,
}).slug, "sita", "A user's last joined campaign should win over list order.");
assert.equal(selectRememberedCampaign([
  joinedCampaigns[0],
  { ...joinedCampaigns[1], slug: "sitarenamed" },
], {
  storage: globalThis.localStorage,
  userId: "alice",
  cookieDocument,
}).slug, "sitarenamed", "Stable campaign identity should preserve selection after a slug rename.");
assert.equal(selectRememberedCampaign(joinedCampaigns, {
  storage: globalThis.localStorage,
  userId: "bob",
  cookieDocument,
}).slug, "aotr", "A user without history should receive the first joined campaign.");
assert.equal(campaignRouteForUnscopedPath("sita", "/char/cassian/"), "/c/sita/char/cassian/");
assert.equal(campaignRouteForUnscopedPath("sita", "/wiki/fiora"), "/c/sita/wiki/fiora");
assert.equal(campaignRouteForUnscopedPath("sita", "/campaigns/manage"), "/c/sita/manage/");
assert.equal(campaignRouteForUnscopedPath("sita", "/compendium/"), "", "Shared Compendium may stay on its global route.");
assert.equal(campaignRouteForUnscopedPath("sita", "/c/aotr/wiki/"), "");

assert.equal(campaignSlugFromPath("/c/aotr/wiki/fiora"), "aotr");
assert.equal(campaignSlugFromPath("/compendium/"), "");
globalThis.location = { pathname: "/c/aotr/wiki/" };
assert.equal(campaignApiPath("api/wiki"), "/api/campaigns/aotr/wiki");
assert.equal(campaignApiPath("api/compendium/catalog"), "/api/compendium/catalog");
assert.equal(campaignPagePath("char"), "/c/aotr/char/");
assert.equal(campaignPath("sita", "wiki"), "/c/sita/wiki/");
for (const resource of ["characters", "wiki", "music", "combat-loot", "public-initiative", "screens", "settings"]) {
  assert.equal(campaignApiPath(`api/${resource}`), `/api/campaigns/aotr/${resource}`);
}
for (const page of ["char", "wiki", "music", "combat-loot", "public-initiative", "player-screen", "dm-screen", "compendium", "manage"]) {
  assert.equal(campaignPagePath(page), `/c/aotr/${page}/`);
}
assert.equal(campaignStorageKey("dnd-wiki-pages-v1"), "dnd-wiki-pages-v1:campaign:aotr");
assert.equal(values.get("dnd-wiki-pages-v1:campaign:aotr"), "legacy-wiki");

globalThis.location = { pathname: "/c/other/music/" };
assert.equal(campaignStorageKey("dnd-music-tracks"), "dnd-music-tracks:campaign:other");
assert.equal(values.has("dnd-music-tracks:campaign:other"), false, "New campaigns never import legacy cache values.");

globalThis.location = { pathname: "/c/aotr/wiki/", hostname: "127.0.0.1" };
globalThis.fetch = async () => new Response("Not found", { status: 404 });
const localAotr = await currentCampaign({ refresh: true });
assert.equal(localAotr.name, "Apotheosis of the Rings");
assert.equal(localAotr.role, "admin");
assert.equal(LOCAL_TEST_USERS.length, 20);
assert.equal(new Set(LOCAL_TEST_USERS.map((user) => user.id)).size, 20);
assert.equal(localCampaignMembers("aotr").filter((member) => member.role === "player").length, 20);
saveLocalCampaign("localgame", { id: "local-game", name: "Local Game", description: "Browser only" });
assert.equal(localCampaigns().find((campaign) => campaign.slug === "localgame")?.description, "Browser only");

const playerOne = LOCAL_TEST_USERS[0];
const playerTwo = LOCAL_TEST_USERS[1];
selectLocalUser(playerOne.id);
assert.equal(currentLocalUser().id, playerOne.id);
assert.equal(localCampaigns().find((campaign) => campaign.slug === "aotr")?.role, "player");
assert.equal(localCampaigns().find((campaign) => campaign.slug === "localgame")?.joined, false);
joinLocalCampaign("localgame");
assert.equal(localCampaigns().find((campaign) => campaign.slug === "localgame")?.role, "player");
saveLocalCharacterEditors("aotr", "cassian", [playerOne.id]);
assert.equal(localCharacterAccess("aotr", "cassian").canEdit, true);
selectLocalUser(playerTwo.id);
assert.equal(localCharacterAccess("aotr", "cassian").canEdit, false);

if (originalLocation === undefined) delete globalThis.location;
else globalThis.location = originalLocation;
if (originalStorage === undefined) delete globalThis.localStorage;
else globalThis.localStorage = originalStorage;
if (originalFetch === undefined) delete globalThis.fetch;
else globalThis.fetch = originalFetch;

console.log("Campaign URL, API, and browser-cache isolation tests passed.");
