// Verifies screen Compendium snapshots.
import assert from "node:assert/strict";

const detail = {
  id: "phbWeaponDagger",
  category: "items",
  name: "Dagger",
  publication: "Player’s Handbook",
  summary: "A small weapon.",
  description: "Damage 1d4.",
  prerequisite: "",
  requirements: "Simple weapon proficiency",
  supports: "Finesse",
  setters: { damage: "1d4", weight: "1 lb." },
  rules: { grants: [], selections: [], stats: [{ name: "damage", value: "1d4" }] },
};
global.fetch = async (url) => {
  if (String(url).includes("api/compendium/categories/items")) {
    return { ok: true, json: async () => ({ entries: [detail] }) };
  }
  return { ok: false, json: async () => ({}) };
};

const { compendiumReferenceSnapshot } = await import(`../../integrations/screen-data/index.js?test=${Date.now()}`);
const snapshot = await compendiumReferenceSnapshot({ id: detail.id, category: "items" }, {
  categories: [{ id: "items", file: "items.json" }],
});
assert.equal(snapshot.title, "Dagger");
assert.match(snapshot.body, /Player’s Handbook/);
assert.match(snapshot.body, /A small weapon/);
assert.match(snapshot.body, /Damage 1d4/);
assert.match(snapshot.body, /Simple weapon proficiency/);
assert.match(snapshot.body, /Finesse/);
assert.match(snapshot.body, /\*\*Damage:\*\* 1d4/);
assert.match(snapshot.body, /Stat rules/);
snapshot.body = snapshot.body.replaceAll("1d4", "1d6");
assert.equal(detail.description, "Damage 1d4.", "Editing a widget snapshot must not mutate Compendium data.");

console.log("Screen Compendium snapshot tests passed.");
