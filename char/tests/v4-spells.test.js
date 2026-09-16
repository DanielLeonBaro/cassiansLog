// Verifies V4 spell filters, repertoire labels, casting, rituals, and upcasting.
import assert from "node:assert/strict";
import {
  consumeV4SpellCast,
  createV4SpellFilterState,
  planV4SpellCast,
  spellMatchesV4Filters,
  spellRepertoireLabels,
} from "../js/tracker/v4-spells.js";

const character = {
  hp: { current: 20, max: 20, temp: 0 },
  spellcasting: {
    profiles: [{ id: "wizard", name: "Wizard", preparedLimit: 3 }],
    slots: [
      { id: "slot-1", profileId: "wizard", level: 1, current: 2, max: 2, reset: "long" },
      { id: "slot-2", profileId: "wizard", level: 2, current: 1, max: 1, reset: "long" },
    ],
  },
  spells: [
    { id: "bolt", name: "Fire Bolt", level: 0, known: true, prepared: true, castable: true, school: "Evocation" },
    { id: "missile", name: "Magic Missile", level: 1, spellbook: true, prepared: true, castable: true, preparationRequired: true, source: "wizard", slotOptions: ["slot-1", "slot-2"] },
    { id: "detect", name: "Detect Magic", level: 1, spellbook: true, prepared: false, castable: false, ritual: true, ritualCastable: true, source: "wizard", slotOptions: ["slot-1", "slot-2"] },
    { id: "hex", name: "Hex", level: 1, known: true, prepared: true, castable: true, concentration: true, source: "wizard", slotOptions: ["slot-1", "slot-2"] },
    { id: "gift", name: "Fey Gift", level: 1, granted: true, alwaysPrepared: true, prepared: true, castable: true, uses: { current: 1, max: 1, reset: "long" } },
    { id: "partial", name: "Partial Spell", level: 1, prepared: true, castable: false, automation: "partial", source: "wizard", slotOptions: [] },
  ],
};

assert.deepEqual(createV4SpellFilterState(), { search: "", level: "", preparation: "", repertoire: "" });
assert.equal(spellMatchesV4Filters(character.spells[0], { ...createV4SpellFilterState(), search: "fire evocation" }), true);
assert.equal(spellMatchesV4Filters(character.spells[0], { ...createV4SpellFilterState(), level: "1" }), false);
assert.equal(spellMatchesV4Filters(character.spells[2], { ...createV4SpellFilterState(), preparation: "unprepared" }), true);
assert.equal(spellMatchesV4Filters(character.spells[1], { ...createV4SpellFilterState(), repertoire: "spellbook" }), true);
assert.deepEqual(spellRepertoireLabels(character.spells[4]), ["Granted"]);

const snapshot = structuredClone(character);
const upcastPlan = planV4SpellCast(character, "missile", { mode: "standard", optionId: "slot:slot-2" });
assert.equal(upcastPlan.canConfirm, true);
assert.equal(upcastPlan.selectedId, "slot:slot-2");
assert.deepEqual(character, snapshot, "Spell planning must not mutate runtime state.");
const upcast = consumeV4SpellCast(character, "missile", { mode: "standard", optionId: "slot:slot-2" });
assert.deepEqual(upcast.cast, { spellId: "missile", slotId: "slot-2", castLevel: 2, upcastBy: 1, ritual: false });
assert.equal(character.spellcasting.slots[1].current, 0);

const hex = consumeV4SpellCast(character, "hex", { mode: "standard", optionId: "slot:slot-1" });
assert.equal(hex.applied, true);
assert.deepEqual(character.concentration, { id: "hex", name: "Hex" });
assert.equal(character.spellcasting.slots[0].current, 1);

const slotsBeforeRitual = character.spellcasting.slots.map((slot) => slot.current);
const ritualPlan = planV4SpellCast(character, "detect");
assert.equal(ritualPlan.mode, "ritual", "An unavailable prepared cast should default to its legal ritual mode.");
const ritual = consumeV4SpellCast(character, "detect", { mode: "ritual" });
assert.equal(ritual.cast.ritual, true);
assert.deepEqual(character.spellcasting.slots.map((slot) => slot.current), slotsBeforeRitual);

const granted = consumeV4SpellCast(character, "gift");
assert.equal(granted.applied, true);
assert.equal(character.spells.find((spell) => spell.id === "gift").uses.current, 0);
assert.equal(consumeV4SpellCast(character, "gift").applied, false);
assert.equal(planV4SpellCast(character, "partial").canConfirm, false);
assert.equal(planV4SpellCast(character, "missing").canConfirm, false);

console.log("V4 Character spell interaction tests passed.");
