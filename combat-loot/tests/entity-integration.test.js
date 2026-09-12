// Verifies compact Character and NPC choices for tracker links.
import assert from "node:assert/strict";
import { loadCombatEntityOptions } from "../../integrations/combat-entities/index.js";

const options = await loadCombatEntityOptions({
  loadCharacters: async () => [
    { id: "cassian", name: "Cassian", inventory: ["not copied"] },
  ],
  loadNpcs: async () => ({
    npcs: [{ id: "goblin", document: { id: "goblin", name: "Goblin", actions: ["not copied"] } }],
  }),
});

assert.deepEqual(options, [
  { kind: "character", id: "cassian", name: "Cassian" },
  { kind: "npc", id: "goblin", name: "Goblin" },
]);

console.log("Combat entity integration tests passed.");
