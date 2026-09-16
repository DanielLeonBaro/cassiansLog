// Certifies Bard/Lore and Sorcerer/Draconic levels 1-20 plus multiclass boundaries.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { evaluateCharacter } from "../js/rules/engine.js";
import { applyCharacterRest } from "../js/rules/runtime.js";
import { applyRulesMetadata } from "../../compendium/js/api.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const dataRoot = path.resolve(here, "../../compendium/data");
const fixture = JSON.parse(fs.readFileSync(path.join(here, "fixtures/bard-sorcerer-levels-1-20.json"), "utf8"));
const manifest = JSON.parse(fs.readFileSync(path.join(dataRoot, "manifest.json"), "utf8"));
const metadata = JSON.parse(fs.readFileSync(path.join(dataRoot, "rules-metadata.json"), "utf8")).entries;
const catalog = applyRulesMetadata(manifest.categories.flatMap((category) =>
  JSON.parse(fs.readFileSync(path.join(dataRoot, category.file), "utf8")).entries), metadata);

const definitions = {
  "bard:5e": { classId: "phbClassBard", subclassId: "phbSubclassCollegeOfLore", subclassLevel: 3 },
  "bard:5.5e": { classId: "phb24ClassBard", subclassId: "phb24SubclassCollegeOfLore", subclassLevel: 3 },
  "sorcerer:5e": { classId: "phbClassSorcerer", subclassId: "phbSubclassDraconicBloodline", subclassLevel: 1 },
  "sorcerer:5.5e": { classId: "phb24ClassSorcerer", subclassId: "phb24SubclassDraconicSorcery", subclassLevel: 3 },
};

function asiSelections(classId, start, level) {
  return Object.fromEntries([4, 8, 12, 16, 19].map((asiLevel, index) => [
    `${classId}:selection:${start + index}`,
    [asiLevel <= level && index < 2 ? "charisma-2" : "manual-feat"],
  ]));
}

function selectionsFor(kind, ruleset, level, definition) {
  if (kind === "bard") return {
    [`${definition.classId}:selection:0`]: ["performance", "persuasion", "deception"],
    [`${definition.classId}:selection:1`]: ["lute", "lyre", "flute"],
    [`${definition.classId}:selection:2`]: ["performance-expertise", "persuasion-expertise"],
    [`${definition.classId}:selection:3`]: ["deception-expertise", "arcana-expertise"],
    ...asiSelections(definition.classId, 4, level),
    ...(level >= 3 ? { [`${definition.subclassId}:selection:0`]: ["arcana", "history", "investigation"] } : {}),
  };
  return {
    [`${definition.classId}:selection:0`]: ["arcana", "persuasion"],
    [`${definition.classId}:selection:1`]: ["careful-spell", "quickened-spell"],
    [`${definition.classId}:selection:2`]: ruleset === "5e" ? ["subtle-spell"] : ["subtle-spell", "seeking-spell"],
    [`${definition.classId}:selection:3`]: ruleset === "5e" ? ["heightened-spell"] : ["heightened-spell", "transmuted-spell"],
    ...asiSelections(definition.classId, 4, level),
    ...(level >= definition.subclassLevel ? {
      [`${definition.subclassId}:selection:0`]: ["fire"],
    } : {}),
  };
}

function character(kind, ruleset, level) {
  const definition = definitions[`${kind}:${ruleset}`];
  return {
    id: `${kind}-${ruleset}-${level}`,
    name: `${kind} ${level}`,
    hp: { max: 0, current: 0, temp: 0 },
    characterSchemaVersion: 2,
    build: {
      version: 1,
      mode: "rules",
      status: "complete",
      ruleset,
      preferences: { hitPoints: "fixed", encumbrance: "none", enabledSources: [], prerequisites: true },
      levels: [{ classId: definition.classId, subclassId: level >= definition.subclassLevel ? definition.subclassId : "", level, hitPointRolls: [] }],
      abilityScores: { method: "standard", base: { str: 8, dex: 14, con: 14, int: 10, wis: 12, cha: 16 } },
      selections: selectionsFor(kind, ruleset, level, definition),
      spells: { knownIds: [], spellbookIds: [], assignments: {} },
      inventory: [],
      description: {},
      overrides: {},
    },
  };
}

function skill(sheet, name) {
  return Object.values(sheet.stats).flatMap((ability) => ability.skills).find((item) => item.name === name);
}

function assertManualWarnings(result, expected, label) {
  assert.equal(result.warnings.length, expected, `${label} warning count`);
  result.warnings.forEach((warning) => {
    assert.equal(warning.code, "manual-automation");
    assert.equal(warning.blocking, false);
  });
}

for (const ruleset of ["5e", "5.5e"]) {
  for (let level = 1; level <= 20; level += 1) {
    const bard = evaluateCharacter({ character: character("bard", ruleset, level), catalog });
    const bardWarnings = level < 6 ? 0 : level < 10 ? 1 : 2;
    assertManualWarnings(bard, bardWarnings, `${ruleset} Bard ${level}`);
    assert.equal(bard.sheet.hp.max, fixture.bard.hp[level - 1]);
    assert.equal(bard.sheet.proficiency, fixture.proficiency[level - 1]);
    assert.equal(bard.sheet.initiative, 2 + (level >= 2 ? Math.floor(fixture.proficiency[level - 1] / 2) : 0));
    assert.equal(skill(bard.sheet, "Arcana").modifier, level >= (ruleset === "5e" ? 10 : 9)
      ? fixture.proficiency[level - 1] * 2 : level >= 3 ? fixture.proficiency[level - 1] : level >= 2 ? Math.floor(fixture.proficiency[level - 1] / 2) : 0);
    assert.equal(skill(bard.sheet, "Performance").proficiency, true);
    if (level >= (ruleset === "5e" ? 3 : 2)) {
      const performancePath = Object.keys(bard.trace).find((key) => key.endsWith(".proficiency") && bard.trace[key].sources.some(({ sourceId }) => sourceId.includes("performance-expertise")));
      assert.equal(bard.trace[performancePath].value, "expertise");
    }
    const bardProfile = bard.sheet.spellcasting.profiles.find(({ id }) => id === "bard");
    assert.equal(bardProfile.saveDC, fixture.saveDC[level - 1]);
    assert.equal(bardProfile.cantripLimit, fixture.bard.cantrips[level - 1]);
    assert.equal(bardProfile.knownLimit || 0, ruleset === "5e" ? fixture.bard.known5e[level - 1] : 0);
    assert.equal(bardProfile.preparedLimit || 0, ruleset === "5.5e" ? fixture.bard.prepared55[level - 1] : 0);
    assert.deepEqual(bard.sheet.spellcasting.slots.map(({ max }) => max), fixture.slots[level - 1]);
    const inspiration = bard.sheet.resources.find(({ name }) => name === "Bardic Inspiration");
    assert.equal(inspiration.uses.max, fixture.bard.inspirationMax[level - 1]);
    assert.equal(inspiration.uses.reset, level >= 5 ? "short" : "long");
    assert.equal(inspiration.die, fixture.bard.inspirationDie[level - 1]);
    assert.equal(bard.sheet.actions.find(({ name }) => name === "Bardic Inspiration").die, inspiration.die);
    if (level >= 3) assert.equal(bard.sheet.actions.find(({ name }) => name === "Cutting Words").resourceId, inspiration.id);

    const sorcerer = evaluateCharacter({ character: character("sorcerer", ruleset, level), catalog });
    const sorcererWarnings = ruleset === "5e" ? (level >= 2 ? 1 : 0)
      : level < 2 ? 0 : level < 3 ? 1 : level < 5 ? 2 : 3;
    assertManualWarnings(sorcerer, sorcererWarnings, `${ruleset} Sorcerer ${level}`);
    assert.equal(sorcerer.sheet.hp.max, fixture.sorcerer.hp[ruleset][level - 1]);
    assert.equal(sorcerer.sheet.ac, fixture.sorcerer.ac[ruleset][level - 1]);
    assert.equal(sorcerer.sheet.proficiency, fixture.proficiency[level - 1]);
    const sorcererProfile = sorcerer.sheet.spellcasting.profiles.find(({ id }) => id === "sorcerer");
    assert.equal(sorcererProfile.saveDC, fixture.saveDC[level - 1]);
    assert.equal(sorcererProfile.cantripLimit, fixture.sorcerer.cantrips[level - 1]);
    assert.equal(sorcererProfile.knownLimit || 0, ruleset === "5e" ? fixture.sorcerer.known5e[level - 1] : 0);
    assert.equal(sorcererProfile.preparedLimit || 0, ruleset === "5.5e" ? fixture.sorcerer.prepared55[level - 1] : 0);
    assert.deepEqual(sorcerer.sheet.spellcasting.slots.map(({ max }) => max), fixture.slots[level - 1]);
    const sorceryPoints = sorcerer.sheet.resources.find(({ name }) => name === "Sorcery Points");
    assert.equal(sorceryPoints?.uses.max || 0, level >= 2 ? level : 0);
    const expectedMetamagic = ruleset === "5e"
      ? level < 3 ? 0 : level < 10 ? 2 : level < 17 ? 3 : 4
      : level < 2 ? 0 : level < 10 ? 2 : level < 17 ? 4 : 6;
    assert.equal(sorcerer.sheet.features.filter(({ name }) => name.startsWith("Metamagic:")).length, expectedMetamagic);
    if (ruleset === "5.5e") assert.equal(sorcerer.sheet.resources.find(({ name }) => name === "Innate Sorcery")?.uses.max, 2);
  }
}

for (const [key, definition] of Object.entries(definitions)) {
  assert.equal(metadata[definition.classId].automation.status, "rules-ready", `${key} class metadata`);
  assert.equal(metadata[definition.subclassId].automation.status, "rules-ready", `${key} subclass metadata`);
}

for (const ruleset of ["5e", "5.5e"]) {
  const bardDefinition = definitions[`bard:${ruleset}`];
  const sorcererDefinition = definitions[`sorcerer:${ruleset}`];
  const multiclass = character("bard", ruleset, 5);
  multiclass.id = `bard-sorcerer-${ruleset}`;
  multiclass.build.levels.push({ classId: sorcererDefinition.classId, subclassId: sorcererDefinition.subclassId, level: 5, hitPointRolls: [] });
  Object.assign(multiclass.build.selections, selectionsFor("sorcerer", ruleset, 5, sorcererDefinition));
  const result = evaluateCharacter({ character: multiclass, catalog });
  assertManualWarnings(result, ruleset === "5e" ? 1 : 3, `${ruleset} Bard 5 / Sorcerer 5`);
  assert.equal(result.sheet.hp.max, 73, "Draconic HP uses Sorcerer levels, not total character levels");
  assert.equal(result.sheet.spellcasting.casterLevel, 10);
  assert.deepEqual(result.sheet.spellcasting.slots.map(({ max }) => max), [4, 3, 3, 3, 2]);
  assert.deepEqual(result.sheet.spellcasting.profiles.map(({ id }) => id), ["bard", "sorcerer"]);

  const inspiration = result.sheet.resources.find(({ definitionId, name }) => definitionId === bardDefinition.classId && name === "Bardic Inspiration");
  const sorceryPoints = result.sheet.resources.find(({ definitionId, name }) => definitionId === sorcererDefinition.classId && name === "Sorcery Points");
  const shortRest = applyCharacterRest({ runtime: { hp: { current: 1 }, uses: [{ id: inspiration.id, current: 0 }, { id: sorceryPoints.id, current: 0 }] }, sheet: result.sheet, ruleset, kind: "short" });
  assert.equal(shortRest.runtime.uses.find(({ id }) => id === inspiration.id).current, 5);
  assert.equal(shortRest.runtime.uses.find(({ id }) => id === sorceryPoints.id).current, 0);
}

console.log("Bard and Sorcerer level 1-20, resources, and multiclass certification tests passed.");
