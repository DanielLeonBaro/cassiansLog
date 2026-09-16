// Certifies Cleric/Life Domain and Paladin/Devotion levels 1-20 in both rulesets.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { evaluateCharacter } from "../js/rules/engine.js";
import { applyCharacterRest } from "../js/rules/runtime.js";
import { applyRulesMetadata } from "../../compendium/js/api.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const dataRoot = path.resolve(here, "../../compendium/data");
const fixture = JSON.parse(fs.readFileSync(path.join(here, "fixtures/cleric-paladin-levels-1-20.json"), "utf8"));
const manifest = JSON.parse(fs.readFileSync(path.join(dataRoot, "manifest.json"), "utf8"));
const metadata = JSON.parse(fs.readFileSync(path.join(dataRoot, "rules-metadata.json"), "utf8")).entries;
const catalog = applyRulesMetadata(manifest.categories.flatMap((category) =>
  JSON.parse(fs.readFileSync(path.join(dataRoot, category.file), "utf8")).entries), metadata);

const definitions = {
  "cleric:5e": { classId: "phbClassCleric", subclassId: "phbSubclassLifeDomain", subclassLevel: 1 },
  "cleric:5.5e": { classId: "phb24ClassCleric", subclassId: "phb24SubclassLifeDomain", subclassLevel: 3 },
  "paladin:5e": { classId: "phbClassPaladin", subclassId: "phbSubclassOathOfDevotion", subclassLevel: 3 },
  "paladin:5.5e": { classId: "phb24ClassPaladin", subclassId: "phb24SubclassOathOfDevotion", subclassLevel: 3 },
};

function selectionsFor(kind, ruleset, level, definition) {
  const asiLevels = [4, 8, 12, 16, 19];
  const asiStart = kind === "cleric" ? (ruleset === "5.5e" ? 3 : 1) : (ruleset === "5.5e" ? 3 : 2);
  const selections = {
    [`${definition.classId}:selection:0`]: kind === "cleric" ? ["insight", "religion"] : ["athletics", "persuasion"],
  };
  if (kind === "cleric" && ruleset === "5.5e") {
    selections[`${definition.classId}:selection:1`] = ["protector"];
    selections[`${definition.classId}:selection:2`] = ["divine-strike"];
  }
  if (kind === "paladin") {
    if (ruleset === "5.5e") selections[`${definition.classId}:selection:1`] = [
      "ID_WOTC_PHB24_CLASS_FEATURE_MASTERY_PROPERTY_LONGSWORD_SAP",
      "ID_WOTC_PHB24_CLASS_FEATURE_MASTERY_PROPERTY_JAVELIN_SLOW",
    ];
    selections[`${definition.classId}:selection:${ruleset === "5.5e" ? 2 : 1}`] = ["defense"];
  }
  asiLevels.forEach((asiLevel, index) => {
    selections[`${definition.classId}:selection:${asiStart + index}`] = [
      asiLevel <= level && index < 2 ? `${kind === "cleric" ? "wisdom" : "charisma"}-2` : "manual-feat",
    ];
  });
  return selections;
}

function character(kind, ruleset, level) {
  const definition = definitions[`${kind}:${ruleset}`];
  return {
    id: `${kind}-${ruleset}-${level}`,
    name: `${kind} ${level}`,
    hp: { max: 0, current: 0, temp: 0 },
    characterSchemaVersion: 2,
    build: {
      version: 1, mode: "rules", status: "complete", ruleset,
      preferences: { hitPoints: "fixed", encumbrance: "none", enabledSources: [], prerequisites: true },
      levels: [{ classId: definition.classId, subclassId: level >= definition.subclassLevel ? definition.subclassId : "", level, hitPointRolls: [] }],
      abilityScores: { method: "standard", base: kind === "cleric"
        ? { str: 10, dex: 12, con: 14, int: 8, wis: 16, cha: 14 }
        : { str: 15, dex: 10, con: 14, int: 8, wis: 12, cha: 16 } },
      selections: selectionsFor(kind, ruleset, level, definition),
      spells: { knownIds: [], spellbookIds: [], assignments: {} }, inventory: [], description: {}, overrides: {},
    },
  };
}

function assertExpectedWarnings(result, expected, label) {
  assert.equal(result.warnings.length, expected, `${label} warning count`);
  result.warnings.forEach((warning) => {
    assert.equal(warning.code, "manual-automation");
    assert.equal(warning.path, "build.spells");
    assert.equal(warning.blocking, false);
  });
}

for (const ruleset of ["5e", "5.5e"]) {
  for (let level = 1; level <= 20; level += 1) {
    const cleric = evaluateCharacter({ character: character("cleric", ruleset, level), catalog });
    assertExpectedWarnings(cleric, level >= definitions[`cleric:${ruleset}`].subclassLevel ? 1 : 0, `${ruleset} Cleric ${level}`);
    assert.equal(cleric.sheet.hp.max, fixture.cleric.hp[level - 1]);
    assert.equal(cleric.sheet.proficiency, fixture.proficiency[level - 1]);
    const clericProfile = cleric.sheet.spellcasting.profiles.find(({ id }) => id === "cleric");
    assert.equal(clericProfile.saveDC, fixture.saveDC[level - 1]);
    assert.equal(clericProfile.preparedLimit, fixture.cleric.prepared[ruleset][level - 1]);
    assert.equal(clericProfile.cantripLimit, fixture.cleric.cantrips[level - 1]);
    assert.deepEqual(cleric.sheet.spellcasting.slots.map(({ max }) => max), fixture.fullCasterSlots[level - 1]);
    assert.equal(cleric.sheet.resources.find(({ name }) => name === "Channel Divinity")?.uses.max || 0, fixture.cleric.channelDivinity[ruleset][level - 1]);

    const paladin = evaluateCharacter({ character: character("paladin", ruleset, level), catalog });
    assertExpectedWarnings(paladin, level >= 3 ? 1 : 0, `${ruleset} Paladin ${level}`);
    assert.equal(paladin.sheet.hp.max, fixture.paladin.hp[level - 1]);
    assert.equal(paladin.sheet.proficiency, fixture.proficiency[level - 1]);
    assert.equal(paladin.sheet.combat.attacksPerAction, level >= 5 ? 2 : 1);
    assert.equal(paladin.sheet.resources.find(({ name }) => name === "Lay On Hands").uses.max, level * 5);
    assert.equal(paladin.sheet.resources.find(({ name }) => name === "Channel Divinity")?.uses.max || 0, fixture.paladin.channelDivinity[ruleset][level - 1]);
    assert.deepEqual(paladin.sheet.spellcasting.slots.map(({ max }) => max), fixture.paladin.slots[ruleset][level - 1]);
    const paladinProfile = paladin.sheet.spellcasting.profiles.find(({ id }) => id === "paladin");
    assert.equal(paladinProfile?.preparedLimit || 0, fixture.paladin.prepared[ruleset][level - 1]);
    if (paladinProfile) assert.equal(paladinProfile.saveDC, fixture.saveDC[level - 1]);
  }
}

for (const [key, definition] of Object.entries(definitions)) {
  assert.equal(metadata[definition.classId].automation.status, "rules-ready", `${key} class metadata`);
  assert.equal(metadata[definition.subclassId].automation.status, "rules-ready", `${key} subclass metadata`);
}

for (const ruleset of ["5e", "5.5e"]) {
  const clericDefinition = definitions[`cleric:${ruleset}`];
  const paladinDefinition = definitions[`paladin:${ruleset}`];
  const multiclass = character("cleric", ruleset, 5);
  multiclass.id = `cleric-paladin-${ruleset}`;
  multiclass.build.levels.push({ classId: paladinDefinition.classId, subclassId: paladinDefinition.subclassId, level: 5, hitPointRolls: [] });
  Object.assign(multiclass.build.selections, selectionsFor("paladin", ruleset, 5, paladinDefinition));
  const result = evaluateCharacter({ character: multiclass, catalog });
  assertExpectedWarnings(result, 2, `${ruleset} Cleric 5 / Paladin 5`);
  assert.equal(result.sheet.hp.max, 78);
  assert.equal(result.sheet.proficiency, 4);
  assert.equal(result.sheet.spellcasting.casterLevel, ruleset === "5e" ? 7 : 8);
  assert.deepEqual(result.sheet.spellcasting.slots.map(({ max }) => max), ruleset === "5e" ? [4, 3, 3, 1] : [4, 3, 3, 2]);
  assert.deepEqual(result.sheet.spellcasting.profiles.map(({ id }) => id), ["cleric", "paladin"]);
  assert.ok(result.trace["spellcasting.casterLevel"].sources.some(({ sourceId, value }) => sourceId === paladinDefinition.classId && value === (ruleset === "5e" ? 2 : 3)));

  const channel = result.sheet.resources.find(({ definitionId, name }) => definitionId === clericDefinition.classId && name === "Channel Divinity");
  const shortRest = applyCharacterRest({ runtime: { hp: { current: 1 }, uses: [{ id: channel.id, current: 0 }] }, sheet: result.sheet, ruleset, kind: "short" });
  assert.equal(shortRest.runtime.uses.find(({ id }) => id === channel.id).current, 1);
}

for (const [ruleset, level] of [["5e", 2], ["5.5e", 3]]) {
  const result = evaluateCharacter({ character: character("cleric", ruleset, level), catalog });
  const preserveLife = result.sheet.actions.find(({ name }) => name === "Preserve Life");
  const channel = result.sheet.resources.find(({ name }) => name === "Channel Divinity");
  assert.equal(preserveLife.resourceId, channel.id, `${ruleset} subclass action spends the class Channel Divinity pool`);
}

for (const ruleset of ["5e", "5.5e"]) {
  const result = evaluateCharacter({ character: character("paladin", ruleset, 3), catalog });
  const sacredWeapon = result.sheet.actions.find(({ name }) => name === "Sacred Weapon");
  const channel = result.sheet.resources.find(({ name }) => name === "Channel Divinity");
  assert.equal(sacredWeapon.resourceId, channel.id, `${ruleset} Sacred Weapon spends the class Channel Divinity pool`);
}

console.log("Cleric and Paladin level 1-20 and multiclass certification tests passed.");
