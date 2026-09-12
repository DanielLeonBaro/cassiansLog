// Verifies allowlist-based NPC field projection never returns hidden values.
import assert from "node:assert/strict";
import { defaultNpcVisibility, normalizeNpcVisibility, npcFieldVisible, projectNpcForPlayer } from "../js/npc-visibility.js";

const visibility = normalizeNpcVisibility({
  name: true,
  "stats.dex.score": true,
  "actions.0.name": true,
  "actions.0.description": false,
  "custom field": true,
  "bad.path.": true,
  "__proto__.secret": true,
});
assert.deepEqual(visibility, { name: true, "stats.dex.score": true, "actions.0.name": true, "custom field": true });
assert.equal(npcFieldVisible(visibility, "name"), true);
assert.equal(npcFieldVisible(visibility, "secret"), false);

const projected = projectNpcForPlayer({
  id: "masked-one",
  name: "Known Face",
  secret: "Hidden allegiance",
  stats: { dex: { score: 16, modifier: 3 }, wis: { score: 12 } },
  actions: [
    { id: "knife", name: "Knife", description: "Secret poison" },
    { id: "escape", name: "Escape", description: "Hidden tunnel" },
  ],
}, visibility);
assert.deepEqual(projected.document, {
  id: "masked-one",
  name: "Known Face",
  stats: { dex: { score: 16 } },
  actions: [{ name: "Knife" }],
});
assert.equal(JSON.stringify(projected).includes("Hidden allegiance"), false);
assert.equal(JSON.stringify(projected).includes("Secret poison"), false);
assert.equal(JSON.stringify(projected).includes("Hidden tunnel"), false);

const shownByDefault = normalizeNpcVisibility({ ...defaultNpcVisibility(), secret: false });
assert.deepEqual(shownByDefault, { $default: true, secret: false });
assert.equal(npcFieldVisible(shownByDefault, "name"), true);
assert.equal(npcFieldVisible(shownByDefault, "secret"), false);
const defaultProjection = projectNpcForPlayer({ id: "open", name: "Visible", secret: "Hidden" }, shownByDefault);
assert.deepEqual(defaultProjection.document, { id: "open", name: "Visible" });
assert.deepEqual(defaultProjection.visibleFields, ["id", "name"]);

console.log("NPC field visibility projection tests passed.");
