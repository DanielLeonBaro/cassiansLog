// Verifies character rest controller.
import assert from "node:assert/strict";
import { createRestController } from "../js/tracker/rest-controller.js";
import { getRestDetails } from "../js/tracker/rest.js";

const character = {
  hp: { current: 3, max: 12, temp: 4 },
  deathSaves: { failures: 2, successes: 1, stable: 1 },
};
const items = [
  { name: "Short", uses: { current: 0, max: 2, reset: "short" } },
  { name: "Long", uses: { current: 0, max: 1, reset: "long" } },
];
const slots = [
  { current: 0, max: 2, reset: "short" },
  { current: 0, max: 1, reset: "long" },
];
let saves = 0;
let refreshes = 0;
const controller = createRestController({
  character,
  documentRoot: { getElementById: () => null, body: { classList: { add() {}, remove() {} } } },
  getAllCharacterItems: () => items,
  getSpellSlots: () => slots,
  refresh: () => { refreshes += 1; },
  save: () => { saves += 1; },
});

controller.shortRest();
assert.equal(items[0].uses.current, 2);
assert.equal(items[1].uses.current, 0);
assert.equal(slots[0].current, 2);
assert.equal(slots[1].current, 0);
assert.equal(character.hp.temp, 0);
assert.deepEqual(character.deathSaves, { failures: 0, successes: 0, stable: 0 });

controller.longRest();
assert.equal(items[1].uses.current, 1);
assert.equal(slots[1].current, 1);
assert.equal(character.hp.current, 12);
assert.equal(saves, 2);
assert.equal(refreshes, 2);

const rulesCharacter = {
  build: { mode: "rules", ruleset: "5.5e" },
  hp: { current: 6, max: 20, temp: 4 },
  deathSaves: { failures: 1, successes: 2, stable: 1 },
  hitDice: [{ die: "d10", current: 0, max: 2 }],
  conditions: [
    { id: "brief", name: "Brief", reset: "short" },
    { id: "poisoned", name: "Poisoned", reset: "manual" },
  ],
  concentration: { id: "bless", name: "Bless" },
  exhaustion: 2,
};
const rulesItems = [
  { id: "short", name: "Short", uses: { current: 0, max: 2, reset: "short" } },
  { id: "long", name: "Long", uses: { current: 0, max: 1, reset: "long" } },
  { id: "manual", name: "Manual", uses: { current: 0, max: 1, reset: "manual" } },
];
const rulesSlots = [
  { id: "pact", current: 0, max: 2, reset: "short" },
  { id: "spell", current: 0, max: 1, reset: "long" },
  { id: "manual-slot", current: 0, max: 1, reset: "manual" },
];
let rulesSaves = 0;
const rulesController = createRestController({
  character: rulesCharacter,
  documentRoot: { getElementById: () => null, body: { classList: { add() {}, remove() {} } } },
  getAllCharacterItems: () => rulesItems,
  getSpellSlots: () => rulesSlots,
  refresh: () => {},
  save: () => { rulesSaves += 1; },
});
const rulesShortDetails = getRestDetails(rulesCharacter, rulesItems, rulesSlots, "short");
assert.match(rulesShortDetails.effects.join(" "), /temporary HP do not change/);
assert.match(rulesShortDetails.effects.join(" "), /Death saving throws and Stable do not change/);
const rulesLongDetails = getRestDetails(rulesCharacter, rulesItems, rulesSlots, "long");
assert.match(rulesLongDetails.effects.join(" "), /All spent hit dice return/);
assert.doesNotMatch(rulesLongDetails.effects.join(" "), /Manual/);
assert.match(rulesLongDetails.toast, /2 resources and 2 spell-slot groups restored/);

rulesController.shortRest();
assert.equal(rulesItems[0].uses.current, 2);
assert.equal(rulesItems[1].uses.current, 0);
assert.equal(rulesSlots[0].current, 2);
assert.deepEqual(rulesCharacter.hp, { current: 6, max: 20, temp: 4 });
assert.deepEqual(rulesCharacter.deathSaves, { failures: 1, successes: 2, stable: 1 });
assert.deepEqual(rulesCharacter.conditions.map((condition) => condition.id), ["poisoned"]);
assert.deepEqual(rulesCharacter.concentration, { id: "bless", name: "Bless" });

rulesController.longRest();
assert.equal(rulesItems[1].uses.current, 1);
assert.equal(rulesItems[2].uses.current, 0);
assert.equal(rulesSlots[1].current, 1);
assert.equal(rulesSlots[2].current, 0);
assert.deepEqual(rulesCharacter.hp, { current: 20, max: 20, temp: 0 });
assert.deepEqual(rulesCharacter.hitDice, [{ die: "d10", current: 2, max: 2 }]);
assert.equal(rulesCharacter.concentration, null);
assert.equal(rulesCharacter.exhaustion, 1);
assert.equal(rulesSaves, 2);

rulesCharacter.hp.current = 0;
assert.equal(rulesController.longRest(), false);
assert.equal(rulesSaves, 2);

console.log("Character rest-controller tests passed.");
