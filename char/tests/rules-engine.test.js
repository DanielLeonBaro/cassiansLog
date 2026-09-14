// Verifies core rules-mode calculations, compatibility projection, and source traces.
import assert from "node:assert/strict";
import { evaluateCharacter } from "../js/rules/engine.js";
import { resetCharacterOverride, setCharacterOverride } from "../js/rules/overrides.js";
import { normalizeCharacterRuntime } from "../js/rules/runtime.js";

function entry({
  id,
  originalId,
  name = id,
  type = "Class Feature",
  ruleset = "agnostic",
  automation = "rules-ready",
  grants = [],
  stats = [],
  hitDie = "",
  defense,
  sheet = "",
  sheetAttributes = {},
}) {
  return {
    id,
    originalId,
    name,
    type,
    category: "features",
    publication: ruleset === "5.5e" ? "Player's Handbook (2024)" : "Player's Handbook",
    source: ruleset === "5.5e" ? "Player's Handbook (2024)" : "Player's Handbook",
    publisher: "Wizards of the Coast",
    ruleset,
    automation: { status: automation, reasons: [], expressions: [] },
    prerequisite: "",
    requirements: "",
    sheet,
    sheetAttributes,
    setters: hitDie ? { hd: hitDie } : {},
    ...(defense ? { defense } : {}),
    rules: { grants, selections: [], stats },
  };
}

const catalog = [
  entry({
    id: "fighter5e",
    originalId: "ID_CLASS_FIGHTER_5E",
    name: "Fighter",
    type: "Class",
    ruleset: "5e",
    hitDie: "d10",
    grants: [
      { id: "ID_SAVE_STRENGTH" },
      { id: "ID_SAVE_CONSTITUTION" },
      { id: "ID_SKILL_ATHLETICS" },
      { id: "ID_EXPERTISE_ATHLETICS" },
      { id: "ID_JACK_OF_ALL_TRADES", level: "2" },
      { id: "ID_SECOND_WIND" },
      { id: "ID_ACTION_SURGE", level: "2" },
      { id: "ID_COUNTER_REACTION" },
    ],
    stats: [{ name: "wisdom", value: "2", level: "6" }],
  }),
  entry({
    id: "wizard55e",
    originalId: "ID_CLASS_WIZARD_55E",
    name: "Wizard",
    type: "Class",
    ruleset: "5.5e",
    hitDie: "d6",
    grants: [
      { id: "ID_SAVE_INTELLIGENCE" },
      { id: "ID_SAVE_WISDOM" },
      { id: "ID_SKILL_ARCANA" },
    ],
  }),
  entry({
    id: "rogue5e",
    originalId: "ID_CLASS_ROGUE_5E",
    name: "Rogue",
    type: "Class",
    ruleset: "5e",
    hitDie: "d8",
  }),
  entry({
    id: "human5e",
    originalId: "ID_RACE_HUMAN_5E",
    name: "Human",
    type: "Race",
    ruleset: "5e",
    grants: [
      { id: "ID_LANGUAGE_COMMON" },
      { id: "ID_PROFICIENCY_ARMOR_LIGHT" },
      { id: "ID_DAMAGE_RESISTANCE_FIRE" },
      { id: "ID_DAMAGE_IMMUNITY_POISON" },
      { id: "ID_CONDITION_IMMUNITY_CHARMED" },
      { id: "ID_VULNERABILITY_COLD" },
    ],
    stats: [
      { name: "strength", value: "2" },
      { name: "dexterity", value: "1" },
      { name: "ac:misc", value: "1" },
      { name: "initiative", value: "1" },
      { name: "innate speed", value: "30", bonus: "base" },
      { name: "speed:fly", value: "30", bonus: "base" },
      { name: "speed:climb", value: "speed", bonus: "base" },
      { name: "speed:swim", value: "15", bonus: "base" },
      { name: "darkvision:range", value: "60", bonus: "base" },
      { name: "blindsight:range", value: "10", bonus: "base" },
      { name: "tremorsense:range", value: "5", bonus: "base" },
      { name: "truesight:range", value: "5", bonus: "base" },
      { name: "additional:hp:max", value: "2" },
    ],
  }),
  entry({
    id: "human55e",
    originalId: "ID_RACE_HUMAN_55E",
    name: "Human",
    type: "Race",
    ruleset: "5.5e",
    stats: [
      { name: "intelligence", value: "2" },
      { name: "innate speed", value: "30", bonus: "base" },
    ],
  }),
  entry({
    id: "sage5e",
    originalId: "ID_BACKGROUND_SAGE_5E",
    name: "Sage",
    type: "Background",
    ruleset: "5e",
    grants: [{ id: "ID_SKILL_PERCEPTION" }, { id: "ID_KEEN_OBSERVER" }, { id: "ID_LORE_BONUS" }],
  }),
  entry({
    id: "sage55e",
    originalId: "ID_BACKGROUND_SAGE_55E",
    name: "Sage",
    type: "Background",
    ruleset: "5.5e",
  }),
  entry({ id: "saveStrength", originalId: "ID_SAVE_STRENGTH", stats: [{ name: "strength:save:proficiency", value: "proficiency", bonus: "proficiency" }] }),
  entry({ id: "saveConstitution", originalId: "ID_SAVE_CONSTITUTION", stats: [{ name: "constitution:save:proficiency", value: "proficiency", bonus: "proficiency" }] }),
  entry({ id: "saveIntelligence", originalId: "ID_SAVE_INTELLIGENCE", stats: [{ name: "intelligence:save:proficiency", value: "proficiency", bonus: "proficiency" }] }),
  entry({ id: "saveWisdom", originalId: "ID_SAVE_WISDOM", stats: [{ name: "wisdom:save:proficiency", value: "proficiency", bonus: "proficiency" }] }),
  entry({ id: "athletics", originalId: "ID_SKILL_ATHLETICS", stats: [{ name: "athletics:proficiency", value: "proficiency", bonus: "proficiency" }] }),
  entry({ id: "athleticsExpertise", originalId: "ID_EXPERTISE_ATHLETICS", stats: [{ name: "athletics:proficiency", value: "proficiency", bonus: "double" }] }),
  entry({ id: "perception", originalId: "ID_SKILL_PERCEPTION", stats: [{ name: "perception:proficiency", value: "proficiency", bonus: "proficiency" }] }),
  entry({ id: "arcana", originalId: "ID_SKILL_ARCANA", stats: [{ name: "arcana:proficiency", value: "proficiency", bonus: "proficiency" }] }),
  entry({
    id: "jack",
    originalId: "ID_JACK_OF_ALL_TRADES",
    name: "Jack of All Trades",
    stats: [
      { name: "acrobatics:misc", value: "proficiency:half", requirements: "!ID_SKILL_ACROBATICS" },
      { name: "insight:misc", value: "proficiency:half:up", requirements: "!ID_SKILL_INSIGHT" },
      { name: "investigation:misc", value: "proficiency:half", requirements: "!ID_SKILL_INVESTIGATION" },
      { name: "perception:misc", value: "proficiency:half", requirements: "!ID_SKILL_PERCEPTION" },
    ],
  }),
  entry({ id: "keen", originalId: "ID_KEEN_OBSERVER", name: "Keen Observer", stats: [{ name: "perception:passive", value: "5" }] }),
  entry({ id: "lore", originalId: "ID_LORE_BONUS", name: "Lore Training", stats: [{ name: "history:misc", value: "intelligence:modifier" }] }),
  entry({ id: "common", originalId: "ID_LANGUAGE_COMMON", name: "Common", type: "Language" }),
  entry({ id: "lightArmor", originalId: "ID_PROFICIENCY_ARMOR_LIGHT", name: "Light Armor", type: "Proficiency" }),
  entry({
    id: "fireResistance",
    originalId: "ID_DAMAGE_RESISTANCE_FIRE",
    name: "Resistance (Fire)",
    type: "Condition",
    defense: { kind: "resistances", value: "Fire" },
  }),
  entry({ id: "poisonImmunity", originalId: "ID_DAMAGE_IMMUNITY_POISON", name: "Damage Immunity (Poison)", type: "Condition" }),
  entry({ id: "charmImmunity", originalId: "ID_CONDITION_IMMUNITY_CHARMED", name: "Immunity (Charmed)", type: "Condition" }),
  entry({ id: "coldVulnerability", originalId: "ID_VULNERABILITY_COLD", name: "Vulnerability (Cold)", type: "Condition" }),
  entry({
    id: "secondWind",
    originalId: "ID_SECOND_WIND",
    name: "Second Wind",
    sheet: "Regain hit points.",
    sheetAttributes: { action: "Bonus Action", usage: "1/Short Rest" },
  }),
  entry({
    id: "actionSurge",
    originalId: "ID_ACTION_SURGE",
    name: "Action Surge",
    sheet: "Take one additional action.",
    sheetAttributes: { usage: "{{proficiency}}/Long Rest" },
  }),
  entry({
    id: "counterReaction",
    originalId: "ID_COUNTER_REACTION",
    name: "Counter Maneuver",
    sheet: "Respond to an incoming attack.",
    sheetAttributes: { action: "Reaction", range: "30 ft", attack: "+5 vs AC", damage: "1d8 force" },
  }),
];

function buildCharacter({
  ruleset = "5e",
  levels = [{ classId: "fighter5e", subclassId: "", level: 5, hitPointRolls: [] }],
  speciesId = "human5e",
  backgroundId = "sage5e",
  scores = { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 },
} = {}) {
  return {
    id: "core-fixture",
    name: "Core Fixture",
    class: "Stale Class",
    race: "Stale Race",
    level: 99,
    proficiency: 9,
    customTop: { preserved: true },
    stats: { stale: true },
    characterSchemaVersion: 2,
    build: {
      version: 1,
      mode: "rules",
      status: "incomplete",
      ruleset,
      levels,
      speciesId,
      backgroundId,
      abilityScores: { method: "manual", base: scores },
      selections: {},
    },
  };
}

function skill(sheet, ability, name) {
  return sheet.stats[ability].skills.find((candidate) => candidate.name === name);
}

const character = buildCharacter();
const runtime = {
  hp: { current: 22, temp: 4 },
  hitDice: [{ die: "d10", current: 2 }],
  uses: [
    { id: "rule-resource:secondWind", current: 0 },
    { id: "rule-resource:actionSurge", current: 2 },
  ],
  conditions: ["Poisoned", { id: "blessed", name: "Blessed", reset: "short" }],
  concentration: { id: "bless", name: "Bless" },
  exhaustion: 2,
};
const snapshot = structuredClone({ character, catalog, runtime });
const result = evaluateCharacter({ character, catalog, runtime });
assert.deepEqual({ character, catalog, runtime }, snapshot, "rules evaluation must not mutate caller inputs");
assert.equal(result.sheet.class, "Fighter");
assert.equal(result.sheet.race, "Human");
assert.equal(result.sheet.background, "Sage");
assert.equal(result.sheet.level, 5);
assert.equal(result.sheet.proficiency, 3);
assert.deepEqual(result.sheet.customTop, { preserved: true });

assert.deepEqual(result.sheet.stats.str, {
  score: 17,
  modifier: 3,
  save: 6,
  skills: [{ name: "Athletics", modifier: 9, proficiency: true }],
});
assert.equal(result.sheet.stats.dex.score, 15);
assert.equal(result.sheet.stats.dex.modifier, 2);
assert.equal(result.sheet.stats.wis.score, 10, "future level-gated stat rules must not apply early");
assert.equal(skill(result.sheet, "dex", "Acrobatics").modifier, 3, "half proficiency rounds down");
assert.equal(skill(result.sheet, "wis", "Insight").modifier, 2, "explicit half-up rounds up");
assert.equal(skill(result.sheet, "int", "Investigation").modifier, 2);
assert.equal(skill(result.sheet, "wis", "Perception").modifier, 3, "half proficiency must not stack with proficiency");
assert.equal(skill(result.sheet, "int", "History").modifier, 2, "ability-modifier rule values are supported");
assert.equal(result.sheet.passivePerception, 18);
assert.equal(result.sheet.passiveInvestigation, 12);
assert.equal(result.sheet.passiveInsight, 12);
assert.deepEqual(result.sheet.hp, { max: 41, current: 22, temp: 4 });
assert.deepEqual(result.sheet.hitDice, [{ die: "d10", current: 2, max: 5 }]);
assert.equal(result.sheet.ac, 13);
assert.equal(result.sheet.initiative, 3);
assert.deepEqual(result.sheet.movement, { walk: 30, fly: 30, climb: 30, swim: 15, burrow: 0 });
assert.equal(result.sheet.walk, 30);
assert.equal(result.sheet.fly, 30);
assert.deepEqual(result.sheet.senses, { darkvision: 60, blindsight: 10, tremorsense: 5, truesight: 5 });
assert.equal(result.sheet.darkvision, 60);
assert.deepEqual(result.sheet.languages, ["Common"]);
assert.ok(result.sheet.proficiencies.includes("Light Armor"));
assert.deepEqual(result.sheet.defenses, {
  resistances: ["Fire"],
  immunities: ["Poison"],
  vulnerabilities: ["Cold"],
  conditionImmunities: ["Charmed"],
});
assert.deepEqual(result.sheet.actions.map((action) => [action.name, action.action]), [
  ["Unarmed Strike", "Action"],
  ["Counter Maneuver", "Reaction"],
  ["Second Wind", "Bonus Action"],
]);
assert.equal(result.sheet.actions[1].range, "30 ft");
assert.equal(result.sheet.actions[1].attack, "+5 vs AC");
assert.equal(result.sheet.actions[1].damage, "1d8 force");
assert.equal(result.sheet.actions[2].resourceId, "rule-resource:secondWind");
assert.deepEqual(result.sheet.resources.map((resource) => [resource.name, resource.uses]), [
  ["Action Surge", { current: 2, max: 3, reset: "long" }],
  ["Second Wind", { current: 0, max: 1, reset: "short" }],
]);
assert.deepEqual(result.sheet.conditions.map((condition) => condition.name), ["Blessed", "Poisoned"]);
assert.deepEqual(result.sheet.concentration, { id: "bless", name: "Bless" });
assert.equal(result.sheet.exhaustion, 2);
assert.equal(result.warnings.length, 0);

assert.deepEqual(result.trace["stats.str.score"], {
  value: 17,
  sources: [
    { kind: "base", sourceId: "build.abilityScores.base.str", label: "Base Strength", value: 15 },
    {
      kind: "rules",
      sourceId: "human5e",
      originalId: "ID_RACE_HUMAN_5E",
      label: "Human",
      ruleIndex: 0,
      value: 2,
    },
  ],
});
assert.deepEqual(result.trace["stats.str.save"].sources.map((source) => source.kind), ["ability", "proficiency"]);
assert.deepEqual(result.trace["stats.str.skills.0.modifier"].sources.map((source) => source.kind), ["ability", "proficiency"]);
assert.equal(result.trace["stats.str.skills.0.proficiency"].value, "expertise");
assert.equal(result.trace["stats.str.skills.0.proficiency"].sources[0].multiplier, 2);
assert.equal(result.trace["stats.dex.skills.0.proficiency"].value, "half");
assert.equal(result.trace["stats.dex.skills.0.proficiency"].sources[0].rounding, "down");
assert.equal(result.trace.passivePerception.value, 18);
assert.deepEqual(result.trace.passivePerception.sources.map((source) => source.kind), ["base", "skill", "rules"]);
assert.deepEqual(result.trace["hp.max"].sources.map((source) => source.kind), [
  "hit-die-max", "hit-die-fixed", "hit-die-fixed", "hit-die-fixed", "hit-die-fixed", "ability",
  "rules",
]);
assert.equal(result.trace.ac.value, 13);
assert.deepEqual(result.trace.ac.sources.map((source) => source.kind), ["base", "ability", "rules"]);
assert.equal(result.trace["movement.walk"].value, 30);
assert.equal(result.trace["movement.climb"].sources[0].kind, "reference");
assert.equal(result.trace["senses.darkvision"].value, 60);
assert.equal(result.trace.languages.sources[0].sourceId, "common");
assert.equal(result.trace["resources.rule-resource:actionSurge.max"].value, 3);
assert.equal(result.trace["resources.rule-resource:secondWind.current"].sources[0].kind, "runtime");
assert.equal(result.trace.conditions.sources.length, 2);
assert.equal(result.trace.concentration.sources[0].sourceId, "runtime.concentration");
assert.deepEqual(
  normalizeCharacterRuntime({ runtime, sheet: result.sheet }).uses.map((use) => use.id).sort(),
  ["rule-resource:actionSurge", "rule-resource:secondWind"],
  "action resource references must not create duplicate runtime pools",
);
assert.deepEqual(
  evaluateCharacter({ character, catalog: [...catalog].reverse(), runtime }),
  result,
  "catalog ordering must not change sheet values, traces, or warnings",
);

const modern = evaluateCharacter({
  character: buildCharacter({
    ruleset: "5.5e",
    levels: [{ classId: "wizard55e", subclassId: "", level: 9, hitPointRolls: [] }],
    speciesId: "human55e",
    backgroundId: "sage55e",
    scores: { str: 8, dex: 14, con: 12, int: 16, wis: 14, cha: 10 },
  }),
  catalog,
});
assert.equal(modern.sheet.proficiency, 4);
assert.equal(modern.sheet.stats.int.score, 18);
assert.equal(modern.sheet.stats.int.modifier, 4);
assert.equal(modern.sheet.stats.int.save, 8);
assert.equal(skill(modern.sheet, "int", "Arcana").modifier, 8);
assert.equal(modern.sheet.stats.wis.save, 6);
assert.equal(modern.warnings.length, 0);

const proficiencyBoundaries = [[1, 2], [5, 3], [9, 4], [13, 5], [17, 6]];
proficiencyBoundaries.forEach(([level, expected]) => {
  const boundary = evaluateCharacter({
    character: buildCharacter({
      levels: [{ classId: "fighter5e", subclassId: "", level, hitPointRolls: [] }],
    }),
    catalog,
  });
  assert.equal(boundary.sheet.proficiency, expected, `level ${level} proficiency`);
});

const multiclass = evaluateCharacter({
  character: buildCharacter({
    levels: [
      { classId: "fighter5e", subclassId: "", level: 3, hitPointRolls: [] },
      { classId: "rogue5e", subclassId: "", level: 2, hitPointRolls: [] },
    ],
  }),
  catalog,
});
assert.equal(multiclass.sheet.level, 5);
assert.equal(multiclass.sheet.proficiency, 3);
assert.equal(multiclass.sheet.class, "Fighter / Rogue");
assert.deepEqual(multiclass.sheet.hitDice, [
  { die: "d10", current: 3, max: 3 },
  { die: "d8", current: 2, max: 2 },
]);
assert.equal(multiclass.sheet.hp.max, 39);

const manualDocument = buildCharacter({
  levels: [{ classId: "fighter5e", subclassId: "", level: 3, hitPointRolls: [4, 7] }],
});
manualDocument.build.preferences = { hitPoints: "manual" };
const manualResult = evaluateCharacter({ character: manualDocument, catalog });
assert.equal(manualResult.sheet.hp.max, 26);
assert.deepEqual(manualResult.trace["hp.max"].sources.slice(0, 3).map((source) => source.kind), [
  "hit-die-max", "hit-die-roll", "hit-die-roll",
]);

const invalidRollDocument = structuredClone(manualDocument);
invalidRollDocument.build.levels[0].hitPointRolls = [11];
const invalidRoll = evaluateCharacter({ character: invalidRollDocument, catalog });
assert.ok(invalidRoll.warnings.some((warning) => warning.code === "invalid-hit-point-roll"));

let overriddenCharacter = setCharacterOverride(character, "stats.con.score", 16, "Table-approved ancestry change");
overriddenCharacter = setCharacterOverride(overriddenCharacter, "proficiency", 5, "Campaign proficiency rule");
overriddenCharacter = setCharacterOverride(overriddenCharacter, "stats.dex.modifier", 4, "Magical agility");
overriddenCharacter = setCharacterOverride(overriddenCharacter, "movement.walk", 40, "Permanent boon");
overriddenCharacter = setCharacterOverride(overriddenCharacter, "hp.max", 50, "Rolled at session zero");
overriddenCharacter = setCharacterOverride(overriddenCharacter, "languages", ["Common", "Draconic"], "Campaign language");
overriddenCharacter = setCharacterOverride(overriddenCharacter, "resources.rule-resource:actionSurge.max", 5, "Campaign action surge rule");
const overridden = evaluateCharacter({ character: overriddenCharacter, catalog });
assert.equal(overridden.sheet.stats.con.score, 16);
assert.equal(overridden.sheet.stats.con.modifier, 3, "score override propagates to its modifier");
assert.equal(overridden.sheet.proficiency, 5);
assert.equal(skill(overridden.sheet, "str", "Athletics").modifier, 13, "proficiency override propagates");
assert.equal(overridden.sheet.ac, 15, "Dexterity modifier override propagates to AC");
assert.equal(overridden.sheet.initiative, 5, "Dexterity modifier override propagates to initiative");
assert.equal(overridden.sheet.walk, 40, "movement override propagates to legacy projection");
assert.equal(overridden.sheet.movement.climb, 40, "movement override propagates to referenced speeds");
assert.equal(overridden.sheet.hp.max, 50);
assert.deepEqual(overridden.sheet.languages, ["Common", "Draconic"]);
assert.equal(overridden.trace.languages.overridden, true);
assert.equal(overridden.sheet.resources.find((resource) => resource.name === "Action Surge").uses.max, 5);
assert.equal(overridden.trace["hp.max"].automaticValue, 51);
assert.equal(overridden.trace["hp.max"].overridden, true);
assert.equal(overridden.trace["hp.max"].override.reason, "Rolled at session zero");
assert.equal(overridden.trace["hp.max"].sources.at(-1).kind, "override");

const reset = resetCharacterOverride(overriddenCharacter, "hp.max");
assert.equal(evaluateCharacter({ character: reset, catalog }).sheet.hp.max, 51, "reset restores automatic value");
assert.equal(overriddenCharacter.build.overrides["hp.max"].value, 50, "override helpers must not mutate input");
assert.throws(() => setCharacterOverride(character, "ac", 20, ""), /reason is required/i);

const badOverrides = structuredClone(character);
badOverrides.build.overrides = {
  ac: { value: "not-a-number", reason: "Bad data" },
  initiative: { value: 20, reason: "" },
  "future.value": { value: 1, reason: "Future stage" },
};
const badOverrideResult = evaluateCharacter({ character: badOverrides, catalog });
assert.equal(badOverrideResult.sheet.ac, 13);
assert.equal(badOverrideResult.sheet.initiative, 3);
assert.ok(badOverrideResult.warnings.some((warning) => warning.code === "invalid-override"));
assert.ok(badOverrideResult.warnings.some((warning) => warning.code === "unsupported-override"));

const unsupportedCatalog = [entry({
  id: "unsupportedClass",
  originalId: "ID_UNSUPPORTED_CLASS",
  name: "Unsupported Class",
  type: "Class",
  ruleset: "5e",
  sheet: "Unsupported action data.",
  sheetAttributes: { action: "Teleport", usage: "Channel Divinity" },
  stats: [
    { name: "speed", value: "35", bonus: "base" },
    { name: "strength", value: "10", requirements: "[unsupported-flag]" },
  ],
})];
const unsupported = evaluateCharacter({
  character: buildCharacter({
    levels: [{ classId: "unsupportedClass", subclassId: "", level: 1, hitPointRolls: [] }],
    speciesId: "",
    backgroundId: "",
  }),
  catalog: unsupportedCatalog,
});
assert.ok(unsupported.warnings.some((warning) => warning.code === "unsupported-rule-expression"));
assert.equal(unsupported.sheet.walk, 35, "supported speed rules apply while unsupported conditions remain warned");
assert.equal(unsupported.sheet.stats.str.score, 15, "unsupported conditions must not apply their values");

const malformedRuntime = evaluateCharacter({
  character,
  catalog,
  runtime: { conditions: {}, concentration: 4, exhaustion: 99 },
});
assert.deepEqual(malformedRuntime.sheet.conditions, []);
assert.equal(malformedRuntime.sheet.concentration, null);
assert.equal(malformedRuntime.sheet.exhaustion, 6);
assert.ok(malformedRuntime.warnings.filter((warning) => warning.code === "invalid-runtime-state").length >= 3);

const incomplete = evaluateCharacter({
  character: buildCharacter({ scores: { str: 15 } }),
  catalog,
});
assert.equal(incomplete.sheet.stats.dex.score, 11, "rules still apply to the warned neutral placeholder");
assert.ok(incomplete.warnings.some((warning) =>
  warning.code === "missing-ability-score" && warning.path === "build.abilityScores.base.dex"));

const legacy = {
  id: "legacy",
  name: "Legacy",
  level: 7,
  proficiency: 3,
  passivePerception: 15,
  stats: { custom: "unchanged" },
};
assert.deepEqual(evaluateCharacter({ character: legacy, catalog }), {
  sheet: legacy,
  trace: {},
  warnings: [],
});

console.log("Character core rules engine tests passed.");
