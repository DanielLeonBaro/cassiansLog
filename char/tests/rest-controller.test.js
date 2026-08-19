import assert from "node:assert/strict";
import { createRestController } from "../js/tracker/rest-controller.js";

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

console.log("Character rest-controller tests passed.");
