// Certifies Rogue/Thief levels 1-20 and closes the twelve-class multiclass regression matrix.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { evaluateCharacter } from "../js/rules/engine.js";
import { applyCharacterRest } from "../js/rules/runtime.js";
import { applyRulesMetadata } from "../../compendium/js/api.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const dataRoot = path.resolve(here, "../../compendium/data");
const fixture = JSON.parse(fs.readFileSync(path.join(here, "fixtures/rogue-levels-1-20.json"), "utf8"));
const manifest = JSON.parse(fs.readFileSync(path.join(dataRoot, "manifest.json"), "utf8"));
const metadata = JSON.parse(fs.readFileSync(path.join(dataRoot, "rules-metadata.json"), "utf8")).entries;
const report = JSON.parse(fs.readFileSync(path.join(dataRoot, "character-certification-report.json"), "utf8"));
const catalog = applyRulesMetadata(manifest.categories.flatMap((category) =>
  JSON.parse(fs.readFileSync(path.join(dataRoot, category.file), "utf8")).entries), metadata);

const definitions = {
  "5e": {
    classId: "phbClassRogue", subclassId: "phbSubclassThief",
    warlockId: "phbClassWarlock", warlockSubclassId: "phbSubclassTheFiend",
  },
  "5.5e": {
    classId: "phb24ClassRogue", subclassId: "phb24SubclassThief",
    warlockId: "phb24ClassWarlock", warlockSubclassId: "phb24SubclassFiendPatron",
  },
};

const masteryIds = [
  "ID_WOTC_PHB24_CLASS_FEATURE_MASTERY_PROPERTY_DAGGER_NICK",
  "ID_WOTC_PHB24_CLASS_FEATURE_MASTERY_PROPERTY_SHORTBOW_VEX",
];

function asiSelections(classId, start, level, levels = [4, 8, 10, 12, 16, 19]) {
  return Object.fromEntries(levels
    .map((asiLevel, index) => [asiLevel, index])
    .filter(([asiLevel]) => level >= asiLevel)
    .map(([, index]) => [`${classId}:selection:${start + index}`, ["manual-feat"]]));
}

function rogueSelections(ruleset, level) {
  const { classId } = definitions[ruleset];
  return {
    [`${classId}:selection:0`]: ["acrobatics", "investigation", "sleight-of-hand", "stealth"],
    [`${classId}:selection:1`]: ["sleight-of-hand-expertise", "stealth-expertise"],
    ...(ruleset === "5.5e" ? { [`${classId}:selection:2`]: masteryIds } : {}),
    ...(level >= 6 ? { [`${classId}:selection:${ruleset === "5e" ? 2 : 3}`]: ["acrobatics-expertise", "investigation-expertise"] } : {}),
    ...asiSelections(classId, ruleset === "5e" ? 3 : 4, level),
  };
}

function character(ruleset, level) {
  const definition = definitions[ruleset];
  return {
    id: `rogue-${ruleset}-${level}`,
    name: `Rogue ${level}`,
    hp: { max: 0, current: 0, temp: 0 },
    characterSchemaVersion: 2,
    build: {
      version: 1,
      mode: "rules",
      status: "complete",
      ruleset,
      preferences: { hitPoints: "fixed", encumbrance: "none", enabledSources: [], prerequisites: true },
      levels: [{ classId: definition.classId, subclassId: level >= 3 ? definition.subclassId : "", level, hitPointRolls: [] }],
      abilityScores: { method: "standard", base: { str: 10, dex: 16, con: 14, int: 10, wis: 12, cha: 10 } },
      selections: rogueSelections(ruleset, level),
      spells: { knownIds: [], spellbookIds: [], assignments: {} },
      inventory: [],
      description: {},
      overrides: {},
    },
  };
}

function assertManualBoundary(result, label) {
  assert.ok(result.warnings.length > 0, `${label} keeps conditional rules visible`);
  result.warnings.forEach((warning) => {
    assert.equal(warning.code, "manual-automation", `${label}: ${warning.message}`);
    assert.equal(warning.blocking, false, `${label}: ${warning.message}`);
  });
}

for (const ruleset of ["5e", "5.5e"]) {
  const definition = definitions[ruleset];
  for (let level = 1; level <= 20; level += 1) {
    const result = evaluateCharacter({ character: character(ruleset, level), catalog });
    assertManualBoundary(result, `${ruleset} Rogue ${level}`);
    assert.equal(result.sheet.hp.max, fixture.hp[level - 1]);
    assert.equal(result.sheet.proficiency, fixture.proficiency[level - 1]);
    const stealthIndex = result.sheet.stats.dex.skills.findIndex(({ name }) => name === "Stealth");
    const stealth = result.sheet.stats.dex.skills[stealthIndex];
    assert.equal(stealth.modifier, fixture.stealth[level - 1]);
    assert.equal(stealth.proficiency, true);
    assert.equal(result.trace[`stats.dex.skills.${stealthIndex}.proficiency`].value, "expertise");
    assert.equal(result.sheet.actions.find(({ name }) => name === "Sneak Attack").damage, fixture.sneakAttack[level - 1]);
    if (level >= 2) assert.equal(result.sheet.actions.filter(({ name }) => name.startsWith("Cunning Action:")).length, 3);
    if (level >= 3 && ruleset === "5.5e") assert.equal(result.sheet.movement.climb, result.sheet.movement.walk);
    if (level >= 15) {
      assert.equal(result.sheet.stats.wis.save, 1 + fixture.proficiency[level - 1]);
      assert.equal(result.sheet.stats.cha.save, ruleset === "5.5e" ? fixture.proficiency[level - 1] : 0);
    }
    if (ruleset === "5.5e" && level >= 5) {
      assert.equal(8 + result.sheet.stats.dex.modifier + result.sheet.proficiency, fixture.cunningStrikeSaveDC[level - 1]);
      assert.ok(result.sheet.actions.some(({ name }) => name.startsWith("Cunning Strike:")));
    }
    if (level === 20) {
      const resource = result.sheet.resources.find(({ name }) => name === "Stroke of Luck");
      assert.equal(resource.uses.max, 1);
      assert.equal(result.sheet.actions.find(({ name }) => name === "Stroke of Luck").resourceId, resource.id);
      const shortRest = applyCharacterRest({
        runtime: { hp: { current: 1 }, uses: [{ id: resource.id, current: 0 }] },
        sheet: result.sheet, ruleset, kind: "short",
      });
      assert.equal(shortRest.runtime.uses.find(({ id }) => id === resource.id).current, 1);
    }
  }
  assert.equal(metadata[definition.classId].automation.status, "rules-ready");
  assert.equal(metadata[definition.subclassId].automation.status, "rules-ready");
}

function warlockSelections(ruleset) {
  const { warlockId } = definitions[ruleset];
  if (ruleset === "5e") return {
    [`${warlockId}:selection:0`]: ["arcana", "deception"],
    [`${warlockId}:selection:1`]: ["pact-of-blade"],
    [`${warlockId}:selection:2`]: ["agonizing-blast", "devils-sight", "thirsting-blade"],
    [`${warlockId}:selection:3`]: ["manual-feat"],
  };
  return {
    [`${warlockId}:selection:0`]: ["arcana", "deception"],
    [`${warlockId}:selection:1`]: ["pact-of-blade", "agonizing-blast", "devils-sight", "thirsting-blade", "ascendant-step"],
    [`${warlockId}:selection:2`]: ["manual-feat"],
  };
}

for (const ruleset of ["5e", "5.5e"]) {
  const definition = definitions[ruleset];
  const multiclass = character(ruleset, 5);
  multiclass.id = `rogue-warlock-${ruleset}`;
  multiclass.build.levels.push({
    classId: definition.warlockId,
    subclassId: definition.warlockSubclassId,
    level: 5,
    hitPointRolls: [],
  });
  Object.assign(multiclass.build.selections, warlockSelections(ruleset));
  const result = evaluateCharacter({ character: multiclass, catalog });
  assertManualBoundary(result, `${ruleset} Rogue 5 / Warlock 5`);
  assert.equal(result.sheet.hp.max, 73);
  assert.equal(result.sheet.proficiency, 4);
  assert.equal(result.sheet.spellcasting.casterLevel, 0);
  assert.equal(result.sheet.spellcasting.slots.filter(({ pool }) => pool === "spellcasting").length, 0);
  const pact = result.sheet.spellcasting.slots.find(({ pool }) => pool === "pact");
  assert.equal(pact.max, 2);
  assert.equal(pact.level, 3);
  assert.ok(result.sheet.actions.some(({ name }) => name === "Sneak Attack"));
}

assert.equal(report.allCoreClassesCertified, true);
assert.deepEqual(report.coreClasses.map(({ name }) => name), [
  "Barbarian", "Bard", "Cleric", "Druid", "Fighter", "Monk",
  "Paladin", "Ranger", "Rogue", "Sorcerer", "Warlock", "Wizard",
]);
assert.ok(report.coreClasses.every(({ editions }) =>
  editions["5e"].status === "rules-ready" && editions["5.5e"].status === "rules-ready"));

console.log("Rogue and Thief level 1-20 plus all-core cross-class certification tests passed.");
