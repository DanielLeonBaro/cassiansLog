// Verifies freeform NPC data can feed V4 without conversion or hidden-field leakage.
import assert from "node:assert/strict";
import { projectNpcForPlayer } from "../../shared/js/npc-visibility.js";
import { v4SummaryModel } from "../../char/js/tracker/v4-layout.js";
import { v4DetailRecord, v4FeatureGroups } from "../../char/js/tracker/v4-content.js";
import { v4InventoryItemModel } from "../../char/js/tracker/v4-inventory.js";

const freeformNpc = {
  id: "masked-one",
  name: "Known Face",
  status: "Active",
  class: "Spy",
  background: "Secret agent",
  walk: 30,
  passivePerception: 14,
  defenses: { resistances: ["Poison"] },
  features: [{ name: "Public Feature", description: "Hidden feature detail", source: "NPC stat block" }],
  inventory: [{ name: "Dagger", quantity: 2, weight: 1 }],
  secret: "Serves Strahd",
};
const snapshot = structuredClone(freeformNpc);

const summary = v4SummaryModel(freeformNpc);
assert.deepEqual(summary.movement, ["Walk 30 ft"]);
assert.deepEqual(summary.senses, ["Passive Perception 14"]);
assert.deepEqual(summary.defenses, ["Resistance: Poison"]);
assert.equal(summary.background, "Secret agent");
assert.equal(freeformNpc.build, undefined, "V4 presentation must not force a freeform NPC conversion.");
assert.deepEqual(freeformNpc, snapshot, "V4 freeform models must not mutate the NPC document.");

const groups = v4FeatureGroups(freeformNpc);
assert.equal(groups[0].features[0].name, "Public Feature");
assert.equal(v4InventoryItemModel(freeformNpc.inventory[0]).runtimeManaged, false);

const player = projectNpcForPlayer(freeformNpc, {
  name: true,
  "features.0.name": true,
});
assert.equal(player.document.name, "Known Face");
assert.equal(player.document.secret, undefined);
assert.equal(player.document.background, undefined);
assert.equal(player.document.features[0].description, undefined);
assert.equal(v4SummaryModel(player.document).background, "—");
const playerFeature = v4FeatureGroups(player.document)[0].features[0];
assert.equal(playerFeature.name, "Public Feature");
assert.equal(v4DetailRecord(player.document, "feature", playerFeature.id).description, "No description recorded.");

console.log("V4 freeform NPC presentation and redaction models passed.");
