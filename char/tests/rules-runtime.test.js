// Verifies pure Character runtime transitions and edition-aware rests.
import assert from "node:assert/strict";
import {
  applyCharacterRest,
  normalizeCharacterRuntime,
  setRuntimeConcentration,
  setRuntimeCondition,
  spendRuntimeResource,
} from "../js/rules/runtime.js";

const sheet = {
  hp: { max: 40 },
  hitDice: [{ die: "d10", max: 3 }, { die: "d8", max: 2 }],
  actions: [{ id: "reaction", uses: { max: 1, reset: "turn" } }],
  resources: [
    { id: "short", uses: { max: 2, reset: "short" } },
    { id: "long", uses: { max: 3, reset: "long" } },
    { id: "daily", uses: { max: 1, reset: "day" } },
  ],
  spellcasting: {
    slots: [
      { id: "pact", max: 2, reset: "short" },
      { id: "spell", max: 4, reset: "long" },
      { id: "manual-slot", max: 1, reset: "manual" },
    ],
  },
};

const runtime = {
  customRuntime: { preserved: true },
  hp: { current: 20, temp: 5 },
  deathSaves: { failures: 2, successes: 1, stable: 1 },
  hitDice: [{ die: "d10", current: 0 }, { die: "d8", current: 0 }],
  uses: [
    { id: "short", current: 0 },
    { id: "long", current: 0 },
    { id: "daily", current: 0 },
    { id: "reaction", current: 0 },
  ],
  slots: [
    { id: "pact", current: 0 },
    { id: "spell", current: 0 },
    { id: "manual-slot", current: 0 },
  ],
  conditions: [
    { id: "brief", name: "Brief", reset: "short" },
    { id: "drained", name: "Drained", reset: "long" },
    { id: "poisoned", name: "Poisoned" },
  ],
  concentration: { id: "bless", name: "Bless" },
  exhaustion: 2,
  restEligibility: { foodAndDrink: true },
};

const snapshot = structuredClone({ runtime, sheet });
const normalized = normalizeCharacterRuntime({ runtime, sheet });
assert.deepEqual({ runtime, sheet }, snapshot, "runtime normalization must not mutate inputs");
assert.deepEqual(normalized.customRuntime, { preserved: true });
assert.deepEqual(normalized.hitDice, [
  { die: "d10", current: 0, max: 3 },
  { die: "d8", current: 0, max: 2 },
]);
assert.deepEqual(
  normalizeCharacterRuntime({ runtime: {}, sheet }).uses.map((use) => use.current),
  [2, 3, 1, 1],
  "new runtime resources start full",
);

const spent = spendRuntimeResource({
  runtime: { ...runtime, uses: [{ id: "short", current: 2 }] },
  sheet,
  resourceId: "short",
});
assert.equal(spent.applied, true);
assert.equal(spent.runtime.uses.find((item) => item.id === "short").current, 1);
const unavailable = spendRuntimeResource({ runtime, sheet, resourceId: "short" });
assert.equal(unavailable.applied, false);
assert.equal(unavailable.warning.code, "insufficient-runtime-resource");

const conditioned = setRuntimeCondition(runtime, { id: "frightened", name: "Frightened" });
assert.ok(conditioned.conditions.some((condition) => condition.id === "frightened"));
assert.equal(runtime.conditions.length, 3, "condition helper must not mutate input");
const clearedCondition = setRuntimeCondition(conditioned, { id: "frightened", name: "Frightened" }, false);
assert.ok(!clearedCondition.conditions.some((condition) => condition.id === "frightened"));
assert.deepEqual(setRuntimeConcentration(runtime, "Haste").concentration, { id: "haste", name: "Haste" });
assert.equal(setRuntimeConcentration(runtime, null).concentration, null);

const shortRest = applyCharacterRest({ runtime, sheet, ruleset: "5e", kind: "short" });
assert.equal(shortRest.applied, true);
assert.equal(shortRest.runtime.uses.find((item) => item.id === "short").current, 2);
assert.equal(shortRest.runtime.uses.find((item) => item.id === "long").current, 0);
assert.equal(shortRest.runtime.uses.find((item) => item.id === "reaction").current, 0);
assert.equal(shortRest.runtime.slots.find((slot) => slot.id === "pact").current, 2);
assert.equal(shortRest.runtime.slots.find((slot) => slot.id === "spell").current, 0);
assert.deepEqual(shortRest.runtime.hp, { current: 20, temp: 5 });
assert.deepEqual(shortRest.runtime.deathSaves, { failures: 2, successes: 1, stable: 1 });
assert.deepEqual(shortRest.runtime.hitDice.map((pool) => pool.current), [0, 0]);
assert.deepEqual(shortRest.runtime.conditions.map((condition) => condition.id), ["drained", "poisoned"]);
assert.deepEqual(shortRest.runtime.concentration, { id: "bless", name: "Bless" });
assert.equal(shortRest.runtime.exhaustion, 2);

const legacyLongRest = applyCharacterRest({ runtime, sheet, ruleset: "5e", kind: "long" });
assert.equal(legacyLongRest.applied, true);
assert.deepEqual(legacyLongRest.runtime.hp, { current: 40, temp: 0 });
assert.deepEqual(legacyLongRest.runtime.deathSaves, { failures: 0, successes: 0, stable: 0 });
assert.deepEqual(legacyLongRest.runtime.hitDice.map((pool) => pool.current), [2, 0]);
assert.equal(legacyLongRest.runtime.uses.find((item) => item.id === "short").current, 2);
assert.equal(legacyLongRest.runtime.uses.find((item) => item.id === "long").current, 3);
assert.equal(legacyLongRest.runtime.uses.find((item) => item.id === "daily").current, 1);
assert.equal(legacyLongRest.runtime.uses.find((item) => item.id === "reaction").current, 0);
assert.equal(legacyLongRest.runtime.slots.find((slot) => slot.id === "manual-slot").current, 0);
assert.deepEqual(legacyLongRest.runtime.conditions.map((condition) => condition.id), ["poisoned"]);
assert.equal(legacyLongRest.runtime.concentration, null);
assert.equal(legacyLongRest.runtime.exhaustion, 1);
assert.ok(legacyLongRest.warnings.some((warning) => warning.code === "default-hit-die-recovery-order"));

const modernLongRest = applyCharacterRest({
  runtime: { ...runtime, restEligibility: undefined },
  sheet,
  ruleset: "5.5e",
  kind: "long",
});
assert.deepEqual(modernLongRest.runtime.hitDice.map((pool) => pool.current), [3, 2]);
assert.equal(modernLongRest.runtime.exhaustion, 1);
assert.equal(modernLongRest.warnings.length, 0);

const noFoodLegacyRest = applyCharacterRest({
  runtime: { ...runtime, restEligibility: undefined },
  sheet,
  ruleset: "5e",
  kind: "long",
});
assert.equal(noFoodLegacyRest.runtime.exhaustion, 2, "2014 exhaustion needs explicit food/drink eligibility");

const ineligible = applyCharacterRest({ runtime: { ...runtime, hp: { current: 0, temp: 0 } }, sheet, kind: "long" });
assert.equal(ineligible.applied, false);
assert.equal(ineligible.warnings[0].code, "rest-ineligible");
assert.throws(() => applyCharacterRest({ runtime, sheet, kind: "dawn" }), /short or long/);
assert.deepEqual({ runtime, sheet }, snapshot, "runtime transitions must remain pure");

console.log("Character rules runtime and rest tests passed.");
