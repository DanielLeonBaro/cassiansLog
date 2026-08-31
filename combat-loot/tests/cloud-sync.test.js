// Verifies combat cloud synchronization.
import assert from "node:assert/strict";
import { createCombatCloudSync } from "../js/cloud-sync.js";

const writes = [];
let notice = "";
let restored = false;
const restore = createCombatCloudSync({
  applyCloudWorkspace: () => { restored = true; },
  confirmUpload: () => true,
  getLocalDraft: () => ({ currentDocument: { tables: [] } }),
  getLocalPartyLibrary: () => [{ id: "party", name: "Heroes", members: [] }],
  getLocalPresets: () => [{ id: "battle", document: { tables: [] } }],
  readCloud: async () => ({ presets: [], draft: null }),
  showToast: (message) => { notice = message; },
  writeCloud: async (url, body) => { writes.push({ url, body }); },
});

await restore();
assert.deepEqual(writes.map(({ url }) => url), [
  "api/combat-loot/presets/battle",
  "api/combat-loot/draft",
  "api/combat-loot/party-library",
]);
assert.equal(restored, false);
assert.equal(notice, "Local Combat & Loot data copied to D1.");

let appliedCloud = null;
const restoreParties = createCombatCloudSync({
  applyCloudWorkspace: (cloud) => { appliedCloud = cloud; },
  getLocalDraft: () => null,
  getLocalPartyLibrary: () => [],
  getLocalPresets: () => [],
  readCloud: async () => ({
    presets: [],
    draft: null,
    partyLibrary: { version: 1, parties: [{ id: "p", name: "Heroes", members: [] }] },
  }),
  showToast: () => {},
});
await restoreParties();
assert.equal(appliedCloud.partyLibrary.parties[0].name, "Heroes");

console.log("Combat cloud synchronization tests passed.");
