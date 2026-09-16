// Certifies Druid/Land and Ranger/Hunter levels 1-20, Extras, and multiclass math.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { evaluateCharacter } from "../js/rules/engine.js";
import { applyCharacterRest } from "../js/rules/runtime.js";
import { v4ExtraGroups } from "../js/tracker/v4-content.js";
import { applyRulesMetadata } from "../../compendium/js/api.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const dataRoot = path.resolve(here, "../../compendium/data");
const fixture = JSON.parse(fs.readFileSync(path.join(here, "fixtures/druid-ranger-levels-1-20.json"), "utf8"));
const manifest = JSON.parse(fs.readFileSync(path.join(dataRoot, "manifest.json"), "utf8"));
const metadata = JSON.parse(fs.readFileSync(path.join(dataRoot, "rules-metadata.json"), "utf8")).entries;
const catalog = applyRulesMetadata(manifest.categories.flatMap((category) =>
  JSON.parse(fs.readFileSync(path.join(dataRoot, category.file), "utf8")).entries), metadata);

const definitions = {
  "druid:5e": { classId: "phbClassDruid", subclassId: "phbSubclassCircleOfTheLand", subclassLevel: 2 },
  "druid:5.5e": { classId: "phb24ClassDruid", subclassId: "phb24SubclassCircleOfTheLand", subclassLevel: 3 },
  "ranger:5e": { classId: "phbClassRanger", subclassId: "phbSubclassHunter", subclassLevel: 3 },
  "ranger:5.5e": { classId: "phb24ClassRanger", subclassId: "phb24SubclassHunter", subclassLevel: 3 },
};

function asiSelections(classId, start, ability, level) {
  return Object.fromEntries([4, 8, 12, 16, 19].map((asiLevel, index) => [
    `${classId}:selection:${start + index}`,
    [asiLevel <= level && index < 2 ? `${ability}-2` : "manual-feat"],
  ]));
}

function selectionsFor(kind, ruleset, level, definition) {
  if (kind === "druid") return {
    [`${definition.classId}:selection:0`]: ["nature", "perception"],
    ...(ruleset === "5.5e" ? {
      [`${definition.classId}:selection:1`]: ["warden"],
      [`${definition.classId}:selection:2`]: ["primal-strike"],
    } : {}),
    ...asiSelections(definition.classId, ruleset === "5.5e" ? 3 : 1, "wisdom", level),
    ...(level >= definition.subclassLevel ? { [`${definition.subclassId}:selection:0`]: [ruleset === "5e" ? "forest" : "temperate"] } : {}),
  };
  const favoredCount = level < 6 ? 1 : level < 14 ? 2 : 3;
  const terrainCount = level < 6 ? 1 : level < 10 ? 2 : 3;
  return {
    [`${definition.classId}:selection:0`]: ["nature", "perception", "survival"],
    ...(ruleset === "5e" ? {
      [`${definition.classId}:selection:1`]: ["beasts", "dragons", "undead"].slice(0, favoredCount),
      [`${definition.classId}:selection:2`]: ["forest", "mountain", "swamp"].slice(0, terrainCount),
      [`${definition.classId}:selection:3`]: ["archery"],
    } : {
      [`${definition.classId}:selection:1`]: [
        "ID_WOTC_PHB24_CLASS_FEATURE_MASTERY_PROPERTY_LONGBOW_SLOW",
        "ID_WOTC_PHB24_CLASS_FEATURE_MASTERY_PROPERTY_LONGSWORD_SAP",
      ],
      [`${definition.classId}:selection:2`]: ["perception-expertise"],
      [`${definition.classId}:selection:3`]: ["nature-expertise", "survival-expertise"],
      [`${definition.classId}:selection:4`]: ["archery"],
    }),
    ...asiSelections(definition.classId, ruleset === "5.5e" ? 5 : 4, "wisdom", level),
    ...(level >= definition.subclassLevel ? {
      [`${definition.subclassId}:selection:0`]: ["colossus-slayer"],
      [`${definition.subclassId}:selection:1`]: ["multiattack-defense"],
      ...(ruleset === "5e" ? {
        [`${definition.subclassId}:selection:2`]: ["volley"],
        [`${definition.subclassId}:selection:3`]: ["evasion"],
      } : {}),
    } : {}),
  };
}

function character(kind, ruleset, level) {
  const definition = definitions[`${kind}:${ruleset}`];
  return {
    id: `${kind}-${ruleset}-${level}`, name: `${kind} ${level}`, hp: { max: 0, current: 0, temp: 0 }, characterSchemaVersion: 2,
    build: {
      version: 1, mode: "rules", status: "complete", ruleset,
      preferences: { hitPoints: "fixed", encumbrance: "none", enabledSources: [], prerequisites: true },
      levels: [{ classId: definition.classId, subclassId: level >= definition.subclassLevel ? definition.subclassId : "", level, hitPointRolls: [] }],
      abilityScores: { method: "standard", base: kind === "druid"
        ? { str: 10, dex: 14, con: 14, int: 12, wis: 16, cha: 8 }
        : { str: 10, dex: 16, con: 14, int: 8, wis: 16, cha: 12 } },
      selections: selectionsFor(kind, ruleset, level, definition),
      spells: { knownIds: [], spellbookIds: [], assignments: {} }, inventory: [], description: {}, overrides: {},
    },
  };
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
    const druid = evaluateCharacter({ character: character("druid", ruleset, level), catalog });
    assertManualWarnings(druid, level >= definitions[`druid:${ruleset}`].subclassLevel ? 1 : 0, `${ruleset} Druid ${level}`);
    assert.equal(druid.sheet.hp.max, fixture.druid.hp[level - 1]);
    assert.equal(druid.sheet.proficiency, fixture.proficiency[level - 1]);
    const druidProfile = druid.sheet.spellcasting.profiles.find(({ id }) => id === "druid");
    assert.equal(druidProfile.saveDC, fixture.saveDC[level - 1]);
    assert.equal(druidProfile.preparedLimit, fixture.druid.prepared[ruleset][level - 1]);
    assert.equal(druidProfile.cantripLimit, fixture.druid.cantrips[level - 1]);
    assert.deepEqual(druid.sheet.spellcasting.slots.map(({ max }) => max), fixture.druid.slots[level - 1]);
    assert.equal(druid.sheet.resources.find(({ name }) => name === "Wild Shape")?.uses.max || 0, fixture.druid.wildShape[ruleset][level - 1]);
    assert.equal(v4ExtraGroups(druid.sheet).some(({ id, extras }) => id === "wild-shape" && extras.some(({ name }) => name === "Wild Shape Forms")), level >= 2);

    const ranger = evaluateCharacter({ character: character("ranger", ruleset, level), catalog });
    assertManualWarnings(ranger, 1, `${ruleset} Ranger ${level}`);
    assert.equal(ranger.sheet.hp.max, fixture.ranger.hp[level - 1]);
    assert.equal(ranger.sheet.proficiency, fixture.proficiency[level - 1]);
    assert.equal(ranger.sheet.combat.attacksPerAction, level >= 5 ? 2 : 1);
    assert.deepEqual(ranger.sheet.spellcasting.slots.map(({ max }) => max), fixture.ranger.slots[ruleset][level - 1]);
    const rangerProfile = ranger.sheet.spellcasting.profiles.find(({ id }) => id === "ranger");
    assert.equal(rangerProfile?.knownLimit || 0, ruleset === "5e" ? fixture.ranger.known5e[level - 1] : 0);
    assert.equal(rangerProfile?.preparedLimit || 0, ruleset === "5.5e" ? fixture.ranger.prepared55[level - 1] : 0);
  }
}

for (const [key, definition] of Object.entries(definitions)) {
  assert.equal(metadata[definition.classId].automation.status, "rules-ready", `${key} class metadata`);
  assert.equal(metadata[definition.subclassId].automation.status, "rules-ready", `${key} subclass metadata`);
}

for (const ruleset of ["5e", "5.5e"]) {
  const druidDefinition = definitions[`druid:${ruleset}`];
  const rangerDefinition = definitions[`ranger:${ruleset}`];
  const multiclass = character("druid", ruleset, 5);
  multiclass.id = `druid-ranger-${ruleset}`;
  multiclass.build.levels.push({ classId: rangerDefinition.classId, subclassId: rangerDefinition.subclassId, level: 5, hitPointRolls: [] });
  Object.assign(multiclass.build.selections, selectionsFor("ranger", ruleset, 5, rangerDefinition));
  const result = evaluateCharacter({ character: multiclass, catalog });
  assertManualWarnings(result, 2, `${ruleset} Druid 5 / Ranger 5`);
  assert.equal(result.sheet.hp.max, 78);
  assert.equal(result.sheet.spellcasting.casterLevel, ruleset === "5e" ? 7 : 8);
  assert.deepEqual(result.sheet.spellcasting.slots.map(({ max }) => max), ruleset === "5e" ? [4, 3, 3, 1] : [4, 3, 3, 2]);
  assert.deepEqual(result.sheet.spellcasting.profiles.map(({ id }) => id), ["druid", "ranger"]);

  const wildShape = result.sheet.resources.find(({ definitionId, name }) => definitionId === druidDefinition.classId && name === "Wild Shape");
  const rested = applyCharacterRest({ runtime: { hp: { current: 1 }, uses: [{ id: wildShape.id, current: 0 }] }, sheet: result.sheet, ruleset, kind: "short" });
  assert.equal(rested.runtime.uses.find(({ id }) => id === wildShape.id).current, ruleset === "5e" ? 2 : 1);
}

const landDruid = evaluateCharacter({ character: character("druid", "5.5e", 3), catalog });
assert.equal(landDruid.sheet.actions.find(({ name }) => name === "Land's Aid").resourceId, landDruid.sheet.resources.find(({ name }) => name === "Wild Shape").id);

console.log("Druid and Ranger level 1-20, Extras, and multiclass certification tests passed.");
