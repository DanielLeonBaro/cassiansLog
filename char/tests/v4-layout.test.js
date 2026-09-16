// Verifies V4 summary normalization without changing legacy tracker documents.
import assert from "node:assert/strict";
import { V4_TAB_DEFINITIONS, v4SummaryModel } from "../js/tracker/v4-layout.js";

assert.deepEqual(V4_TAB_DEFINITIONS.map(({ label }) => label), [
  "Actions", "Spells", "Inventory", "Features & Traits", "Extras",
]);

const character = {
  walk: 30,
  fly: 0,
  swim: 20,
  passivePerception: 14,
  darkvision: 60,
  senses: [{ name: "Tremorsense 10 ft" }],
  proficiencies: { armor: ["Light Armor"], tools: ["Smith's Tools"] },
  languages: ["Common", "Dwarvish"],
  defenses: { resistances: ["Fire"], immunities: ["Poisoned"], vulnerabilities: ["Cold"] },
  conditions: [{ id: "prone", name: "Prone" }, "Grappled"],
  concentration: { id: "bless", name: "Bless" },
  exhaustion: 2,
  background: "Soldier",
};
const snapshot = structuredClone(character);
const summary = v4SummaryModel(character);
assert.deepEqual(summary.movement, ["Walk 30 ft", "Swim 20 ft"]);
assert.deepEqual(summary.senses, ["Passive Perception 14", "Tremorsense 10 ft", "Darkvision 60 ft"]);
assert.ok(summary.proficiencies.includes("armor: Light Armor"));
assert.ok(summary.proficiencies.includes("Language: Common"));
assert.deepEqual(summary.defenses, ["Resistance: Fire", "Immunity: Poisoned", "Vulnerability: Cold"]);
assert.deepEqual(summary.conditions, ["Prone", "Grappled", "Exhaustion 2", "Concentrating: Bless"]);
assert.equal(summary.background, "Soldier");
assert.deepEqual(character, snapshot, "Summary derivation must not mutate character data.");

const empty = v4SummaryModel({});
assert.deepEqual(empty.movement, []);
assert.deepEqual(empty.conditions, []);
assert.equal(empty.background, "—");

console.log("V4 Character summary model passed.");
