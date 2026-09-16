// Verifies explicit V4 action-use planning and consumption.
import assert from "node:assert/strict";
import { consumeV4ActionUse, planV4ActionUse } from "../js/tracker/v4-actions.js";

const character = {
  actions: [
    { id: "surge", name: "Action Surge", uses: { current: 1, max: 1, reset: "short" } },
    { id: "at-will", name: "Attack" },
    { id: "linked", name: "Linked Feature", resourceId: "focus" },
    { id: "spell-action", name: "Spell Action", slotLevel: 1, source: "wizard" },
  ],
  resources: [{ id: "focus", name: "Focus", uses: { current: 2, max: 3, reset: "long" } }],
  spellcasting: { slots: [
    { id: "wizard-1", profileId: "wizard", level: 1, current: 2, max: 2 },
    { id: "wizard-2", profileId: "wizard", level: 2, current: 1, max: 1 },
    { id: "cleric-1", profileId: "cleric", level: 1, current: 3, max: 3 },
  ] },
};

const limited = planV4ActionUse(character, "surge");
assert.equal(limited.canConfirm, true);
assert.equal(limited.selectedId, "resource:surge");
assert.deepEqual(limited.options.map((option) => option.label), ["Action Surge"]);
const spentLimited = consumeV4ActionUse(character, "surge", limited.selectedId);
assert.equal(spentLimited.applied, true);
assert.equal(character.actions[0].uses.current, 0);
assert.equal(consumeV4ActionUse(character, "surge").applied, false);

assert.deepEqual(planV4ActionUse(character, "linked").options.map((option) => option.id), ["resource:focus"]);
consumeV4ActionUse(character, "linked");
assert.equal(character.resources[0].uses.current, 1);

const slots = planV4ActionUse(character, "spell-action");
assert.deepEqual(slots.options.map((option) => option.id), ["slot:wizard-1", "slot:wizard-2"]);
consumeV4ActionUse(character, "spell-action", "slot:wizard-2");
assert.equal(character.spellcasting.slots[1].current, 0);
assert.equal(character.spellcasting.slots[2].current, 3, "A different profile must not be consumed.");

const atWill = consumeV4ActionUse(character, "at-will");
assert.equal(atWill.applied, true);
assert.equal(atWill.consumed, null);
assert.equal(planV4ActionUse(character, "missing").canConfirm, false);

console.log("V4 Character action-use tests passed.");
