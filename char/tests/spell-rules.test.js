// Verifies automatic spell profiles, repertoire, slots, preparation, rituals, and casting.
import assert from "node:assert/strict";
import { evaluateCharacter } from "../js/rules/engine.js";
import {
  cantripScalingTier,
  pactSpellSlots,
  standardSpellSlots,
} from "../js/rules/spell-calculations.js";
import {
  applyCharacterRest,
  castRuntimeSpell,
  setRuntimeSpellPrepared,
} from "../js/rules/runtime.js";

const STANDARD_ROWS = [
  [], [2], [3], [4, 2], [4, 3], [4, 3, 2], [4, 3, 3], [4, 3, 3, 1],
  [4, 3, 3, 2], [4, 3, 3, 3, 1], [4, 3, 3, 3, 2], [4, 3, 3, 3, 2, 1],
  [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1, 1], [4, 3, 3, 3, 3, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 3, 2, 2, 1, 1],
];
STANDARD_ROWS.forEach((row, level) => assert.deepEqual(standardSpellSlots(level), row));
assert.deepEqual(pactSpellSlots(1), { count: 1, level: 1 });
assert.deepEqual(pactSpellSlots(2), { count: 2, level: 1 });
assert.deepEqual(pactSpellSlots(5), { count: 2, level: 3 });
assert.deepEqual(pactSpellSlots(11), { count: 3, level: 5 });
assert.deepEqual(pactSpellSlots(17), { count: 4, level: 5 });
assert.deepEqual([1, 4, 5, 10, 11, 16, 17, 20].map(cantripScalingTier), [1, 1, 2, 2, 3, 3, 4, 4]);

function catalogEntry({
  id,
  name = id,
  type = "Spell",
  ruleset = "5.5e",
  automation = "rules-ready",
  supports = "",
  grants = [],
  spellcasting,
  level = 0,
  ritual = false,
  concentration = false,
}) {
  return {
    id,
    originalId: `ID_${id.toUpperCase()}`,
    name,
    type,
    category: type === "Spell" ? "spells" : "classes",
    ruleset,
    publication: ruleset === "5.5e" ? "Player's Handbook (2024)" : "Player's Handbook",
    source: ruleset === "5.5e" ? "Player's Handbook (2024)" : "Player's Handbook",
    publisher: "Wizards of the Coast",
    automation: { status: automation, reasons: [], expressions: [] },
    supports,
    prerequisite: "",
    requirements: "",
    rules: { grants, selections: [], stats: [], ...(spellcasting ? { spellcasting } : {}) },
    setters: type === "Spell" ? {
      level: String(level),
      school: "Evocation",
      time: "Action",
      range: "120 feet",
      duration: concentration ? "Concentration, up to 1 minute" : "Instantaneous",
      isConcentration: String(concentration),
      isRitual: String(ritual),
    } : { hd: "d8" },
    add: type === "Spell" ? { target: "spells", value: {
      id,
      name,
      category: level ? `${level}-level Spell` : "Cantrip",
      action: "Action",
      level,
      school: "Evocation",
      range: "120 feet",
      duration: concentration ? "Concentration, up to 1 minute" : "Instantaneous",
      components: "V, S",
      concentration,
      ritual,
      description: `${name} description.`,
    } } : { target: "class", value: name },
  };
}

const wizardProfile = {
  id: "wizard",
  name: "Wizard",
  ability: "int",
  spellList: "Wizard",
  progression: "full",
  repertoire: "spellbook",
  ritual: "spellbook",
  prepared: { type: "ability-plus-level", minimum: 1 },
};
const rangerProfile55 = {
  id: "ranger",
  name: "Ranger",
  ability: "wis",
  spellList: "Ranger",
  progression: "half-up",
  repertoire: "prepared",
  ritual: "prepared",
  prepared: { type: "table", values: { 3: 4 } },
};
const warlockProfile = {
  id: "warlock",
  name: "Warlock",
  ability: "cha",
  spellList: "Warlock",
  progression: "pact",
  repertoire: "known",
  ritual: "none",
};

const catalog55 = [
  catalogEntry({
    id: "wizard55",
    name: "Wizard",
    type: "Class",
    spellcasting: wizardProfile,
    grants: [{ type: "Spell", id: "ID_MISTYSTEP", spellcasting: "wizard", prepared: "true" }],
  }),
  catalogEntry({ id: "ranger55", name: "Ranger", type: "Class", spellcasting: rangerProfile55 }),
  catalogEntry({ id: "warlock55", name: "Warlock", type: "Class", spellcasting: warlockProfile }),
  catalogEntry({ id: "magicMissile", name: "Magic Missile", supports: "Wizard", level: 1 }),
  catalogEntry({ id: "detectMagic", name: "Detect Magic", supports: "Wizard", level: 1, ritual: true, concentration: true }),
  catalogEntry({ id: "eldritchBlast", name: "Eldritch Blast", supports: "Warlock", level: 0 }),
  catalogEntry({ id: "hex", name: "Hex", supports: "Warlock", level: 1, concentration: true }),
  catalogEntry({ id: "huntersMark", name: "Hunter's Mark", supports: "Ranger", level: 1, concentration: true }),
  catalogEntry({ id: "mistyStep", name: "Misty Step", supports: "Wizard", level: 2 }),
  catalogEntry({ id: "partialSpell", name: "Uncertified Spell", supports: "Wizard", automation: "partial", level: 1 }),
  catalogEntry({ id: "legacySpell", name: "Legacy Spell", supports: "Wizard", ruleset: "5e", level: 1 }),
  catalogEntry({ id: "sharedSpell", name: "Shared Spell", supports: "Wizard, Ranger", level: 1 }),
];

function automaticCharacter(ruleset = "5.5e", levels = [
  { classId: "wizard55", level: 3 },
  { classId: "ranger55", level: 3 },
  { classId: "warlock55", level: 5 },
]) {
  return {
    id: "spell-rules",
    name: "Spell Rules",
    hp: { max: 30, current: 30, temp: 0 },
    characterSchemaVersion: 2,
    build: {
      version: 1,
      mode: "rules",
      status: "complete",
      ruleset,
      preferences: { hitPoints: "fixed", enabledSources: [], prerequisites: true },
      levels,
      abilityScores: { method: "standard", base: { str: 8, dex: 14, con: 14, int: 16, wis: 14, cha: 16 } },
      selections: {},
      spells: {
        knownIds: ["eldritchBlast", "hex", "huntersMark", "partialSpell", "legacySpell", "sharedSpell"],
        spellbookIds: ["magicMissile", "detectMagic"],
        assignments: {
          eldritchBlast: { profileId: "warlock", repertoire: "known" },
          hex: { profileId: "warlock", repertoire: "known" },
          huntersMark: { profileId: "ranger", repertoire: "prepared" },
          partialSpell: { profileId: "wizard", repertoire: "spellbook" },
          legacySpell: { profileId: "wizard", repertoire: "spellbook" },
          magicMissile: { profileId: "wizard", repertoire: "spellbook" },
          detectMagic: { profileId: "wizard", repertoire: "spellbook" },
        },
      },
      overrides: {},
    },
  };
}

const runtime = {
  slots: [
    { id: "spell-slot:1", current: 2 },
    { id: "spell-slot:2", current: 1 },
    { id: "spell-slot:3", current: 1 },
    { id: "pact-slot:warlock:3", current: 1 },
  ],
  prepared: [
    { id: "magicMissile", prepared: true },
    { id: "detectMagic", prepared: false },
    { id: "huntersMark", prepared: true },
  ],
};
const character55 = automaticCharacter();
const snapshot = structuredClone({ character55, catalog55, runtime });
const result55 = evaluateCharacter({ character: character55, catalog: catalog55, runtime });
assert.deepEqual({ character55, catalog55, runtime }, snapshot, "spell evaluation must not mutate inputs");
assert.equal(result55.sheet.spellcasting.enabled, true);
assert.equal(result55.sheet.spellcasting.casterLevel, 5, "2024 half casters round up in multiclass slot math");
assert.deepEqual(result55.sheet.spellcasting.slots.map((slot) => [slot.pool, slot.level, slot.current, slot.max]), [
  ["spellcasting", 1, 2, 4],
  ["spellcasting", 2, 1, 3],
  ["spellcasting", 3, 1, 2],
  ["pact", 3, 1, 2],
]);
const profiles55 = new Map(result55.sheet.spellcasting.profiles.map((profile) => [profile.id, profile]));
assert.deepEqual(
  [profiles55.get("wizard").saveDC, profiles55.get("wizard").attackBonus, profiles55.get("wizard").preparedLimit],
  [15, 7, 6],
);
assert.equal(profiles55.get("ranger").preparedLimit, 4);
const spells55 = new Map(result55.sheet.spells.map((spell) => [spell.id, spell]));
assert.equal(spells55.get("magicMissile").prepared, true);
assert.equal(spells55.get("magicMissile").castable, true);
assert.deepEqual(spells55.get("magicMissile").slotOptions, ["spell-slot:1", "spell-slot:2", "spell-slot:3", "pact-slot:warlock:3"]);
assert.equal(spells55.get("detectMagic").prepared, false);
assert.equal(spells55.get("detectMagic").ritualCastable, true);
assert.equal(spells55.get("eldritchBlast").cantripScale, 3);
assert.equal(spells55.get("mistyStep").alwaysPrepared, true);
assert.equal(spells55.get("mistyStep").granted, true);
assert.equal(spells55.get("partialSpell").castable, false);
assert.equal(spells55.get("legacySpell").rulesetCompatible, false);
assert.equal(spells55.get("sharedSpell").castable, false);
assert.ok(result55.warnings.some((warning) => warning.code === "partial-automation" && warning.entryId === "partialSpell"));
assert.ok(result55.warnings.some((warning) => warning.code === "ruleset-mismatch" && warning.entryId === "legacySpell"));
assert.ok(result55.warnings.some((warning) => warning.code === "ambiguous-spellcasting-profile" && warning.entryId === "sharedSpell"));
assert.equal(result55.trace["spellcasting.casterLevel"].value, 5);
assert.equal(result55.trace["spells.eldritchBlast.cantripScale"].value, 3);

const castUp = castRuntimeSpell({ runtime, sheet: result55.sheet, spellId: "magicMissile", slotId: "spell-slot:3" });
assert.equal(castUp.applied, true);
assert.deepEqual(castUp.cast, { spellId: "magicMissile", slotId: "spell-slot:3", castLevel: 3, upcastBy: 2, ritual: false });
assert.equal(castUp.runtime.slots.find((slot) => slot.id === "spell-slot:3").current, 0);
const castHex = castRuntimeSpell({ runtime, sheet: result55.sheet, spellId: "hex", slotId: "pact-slot:warlock:3" });
assert.equal(castHex.applied, true);
assert.deepEqual(castHex.runtime.concentration, { id: "hex", name: "Hex" });
assert.equal(castHex.runtime.slots.find((slot) => slot.id === "pact-slot:warlock:3").current, 0);
const castRitual = castRuntimeSpell({ runtime, sheet: result55.sheet, spellId: "detectMagic", ritual: true });
assert.equal(castRitual.applied, true);
assert.deepEqual(castRitual.runtime.concentration, { id: "detectMagic", name: "Detect Magic" });
assert.deepEqual(castRitual.runtime.slots, result55.sheet.spellcasting.slots.map((slot) => ({ id: slot.id, current: slot.current })));
assert.equal(castRuntimeSpell({ runtime, sheet: result55.sheet, spellId: "mistyStep", slotId: "spell-slot:1" }).warning.code, "spell-slot-too-low");
assert.equal(castRuntimeSpell({ runtime, sheet: result55.sheet, spellId: "magicMissile" }).warning.code, "spell-slot-required");
assert.equal(castRuntimeSpell({ runtime, sheet: result55.sheet, spellId: "partialSpell", slotId: "spell-slot:1" }).warning.code, "spell-not-castable");

const preparationSheet = structuredClone(result55.sheet);
preparationSheet.spellcasting.profiles.find((profile) => profile.id === "wizard").preparedLimit = 1;
const blockedPreparation = setRuntimeSpellPrepared({ runtime, sheet: preparationSheet, spellId: "detectMagic", prepared: true });
assert.equal(blockedPreparation.applied, false);
assert.equal(blockedPreparation.warning.code, "prepared-spell-limit");
const removedPreparation = setRuntimeSpellPrepared({ runtime, sheet: preparationSheet, spellId: "magicMissile", prepared: false });
assert.equal(removedPreparation.applied, true);
assert.equal(removedPreparation.runtime.prepared.find((spell) => spell.id === "magicMissile").prepared, false);
assert.equal(setRuntimeSpellPrepared({ runtime, sheet: result55.sheet, spellId: "eldritchBlast", prepared: false }).warning.code, "fixed-spell-preparation");

const shortRest = applyCharacterRest({ runtime: castHex.runtime, sheet: result55.sheet, ruleset: "5.5e", kind: "short" });
assert.equal(shortRest.runtime.slots.find((slot) => slot.id === "pact-slot:warlock:3").current, 2);
assert.equal(shortRest.runtime.slots.find((slot) => slot.id === "spell-slot:2").current, 1);
const longRest = applyCharacterRest({ runtime, sheet: result55.sheet, ruleset: "5.5e", kind: "long" });
assert.ok(longRest.runtime.slots.every((slot) => slot.current === result55.sheet.spellcasting.slots.find((definition) => definition.id === slot.id)?.max));

const catalog5e = [
  catalogEntry({ id: "wizard5", name: "Wizard", type: "Class", ruleset: "5e", spellcasting: wizardProfile }),
  catalogEntry({
    id: "ranger5",
    name: "Ranger",
    type: "Class",
    ruleset: "5e",
    spellcasting: { ...rangerProfile55, progression: "half-down" },
  }),
];
const result5e = evaluateCharacter({
  character: automaticCharacter("5e", [{ classId: "wizard5", level: 3 }, { classId: "ranger5", level: 3 }]),
  catalog: catalog5e,
});
assert.equal(result5e.sheet.spellcasting.casterLevel, 4, "2014 half casters round down in multiclass slot math");
assert.deepEqual(result5e.sheet.spellcasting.slots.map((slot) => slot.max), [4, 3]);

const paladinProfile5e = {
  id: "paladin",
  name: "Paladin",
  ability: "cha",
  spellList: "Paladin",
  progression: "half-up",
  multiclassProgression: "half-down",
  minimumLevel: 2,
  repertoire: "prepared",
  ritual: "none",
  prepared: { type: "ability-plus-half-level-down", minimum: 1 },
};
const paladin5e = catalogEntry({ id: "paladin5", name: "Paladin", type: "Class", ruleset: "5e", spellcasting: paladinProfile5e });
const soloPaladin = evaluateCharacter({
  character: automaticCharacter("5e", [{ classId: "paladin5", level: 3 }]),
  catalog: [paladin5e],
});
assert.equal(soloPaladin.sheet.spellcasting.casterLevel, 2, "2014 Paladin uses its class slot table equivalent when single-classed");
assert.deepEqual(soloPaladin.sheet.spellcasting.slots.map((slot) => slot.max), [3]);
assert.equal(soloPaladin.sheet.spellcasting.profiles[0].preparedLimit, 4);
const firstLevelPaladin = evaluateCharacter({
  character: automaticCharacter("5e", [{ classId: "paladin5", level: 1 }]),
  catalog: [paladin5e],
});
assert.equal(firstLevelPaladin.sheet.spellcasting.enabled, false, "2014 Paladin spellcasting starts at level 2");

console.log("Character spell rules tests passed.");
