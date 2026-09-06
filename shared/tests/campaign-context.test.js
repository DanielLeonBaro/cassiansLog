// Verifies URL-derived campaign API, navigation, and browser-cache isolation.
import assert from "node:assert/strict";
import {
  campaignApiPath,
  campaignPagePath,
  campaignSlugFromPath,
  campaignStorageKey,
} from "../js/campaign-context.js";

const originalLocation = globalThis.location;
const originalStorage = globalThis.localStorage;
const values = new Map([["dnd-wiki-pages-v1", "legacy-wiki"]]);
globalThis.localStorage = {
  getItem: (key) => values.has(key) ? values.get(key) : null,
  setItem: (key, value) => values.set(key, value),
};

assert.equal(campaignSlugFromPath("/c/aotr/wiki/fiora"), "aotr");
assert.equal(campaignSlugFromPath("/compendium/"), "");
globalThis.location = { pathname: "/c/aotr/wiki/" };
assert.equal(campaignApiPath("api/wiki"), "/api/campaigns/aotr/wiki");
assert.equal(campaignApiPath("api/compendium/catalog"), "/api/compendium/catalog");
assert.equal(campaignPagePath("char"), "/c/aotr/char/");
assert.equal(campaignStorageKey("dnd-wiki-pages-v1"), "dnd-wiki-pages-v1:campaign:aotr");
assert.equal(values.get("dnd-wiki-pages-v1:campaign:aotr"), "legacy-wiki");

globalThis.location = { pathname: "/c/other/music/" };
assert.equal(campaignStorageKey("dnd-music-tracks"), "dnd-music-tracks:campaign:other");
assert.equal(values.has("dnd-music-tracks:campaign:other"), false, "New campaigns never import legacy cache values.");

if (originalLocation === undefined) delete globalThis.location;
else globalThis.location = originalLocation;
if (originalStorage === undefined) delete globalThis.localStorage;
else globalThis.localStorage = originalStorage;

console.log("Campaign URL, API, and browser-cache isolation tests passed.");
