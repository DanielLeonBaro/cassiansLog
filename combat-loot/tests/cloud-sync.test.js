import assert from "node:assert/strict";
import { createCombatCloudSync } from "../js/cloud-sync.js";

const writes = [];
let notice = "";
let restored = false;
const restore = createCombatCloudSync({
  applyCloudWorkspace: () => { restored = true; },
  confirmUpload: () => true,
  getLocalDraft: () => ({ currentDocument: { tables: [] } }),
  getLocalPresets: () => [{ id: "battle", document: { tables: [] } }],
  readCloud: async () => ({ presets: [], draft: null }),
  showToast: (message) => { notice = message; },
  writeCloud: async (url, body) => { writes.push({ url, body }); },
});

await restore();
assert.deepEqual(writes.map(({ url }) => url), [
  "api/combat-loot/presets/battle",
  "api/combat-loot/draft",
]);
assert.equal(restored, false);
assert.equal(notice, "Local Combat & Loot data copied to D1.");

console.log("Combat cloud synchronization tests passed.");
