// Certifies Barbarian/Berserker and Monk/Open Hand levels 1-20, resources, martial actions, and multiclass rules.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { evaluateCharacter } from "../js/rules/engine.js";
import { applyCharacterRest } from "../js/rules/runtime.js";
import { applyRulesMetadata } from "../../compendium/js/api.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const dataRoot = path.resolve(here, "../../compendium/data");
const fixture = JSON.parse(fs.readFileSync(path.join(here, "fixtures/barbarian-monk-levels-1-20.json"), "utf8"));
const manifest = JSON.parse(fs.readFileSync(path.join(dataRoot, "manifest.json"), "utf8"));
const metadata = JSON.parse(fs.readFileSync(path.join(dataRoot, "rules-metadata.json"), "utf8")).entries;
const catalog = applyRulesMetadata(manifest.categories.flatMap((category) =>
  JSON.parse(fs.readFileSync(path.join(dataRoot, category.file), "utf8")).entries), metadata);

const definitions = {
  "barbarian:5e": { classId: "phbClassBarbarian", subclassId: "phbSubclassPathOfTheBerserker" },
  "barbarian:5.5e": { classId: "phb24ClassBarbarian", subclassId: "phb24SubclassPathOfTheBerserker" },
  "monk:5e": { classId: "phbClassMonk", subclassId: "phbSubclassWayOfTheOpenHand" },
  "monk:5.5e": { classId: "phb24ClassMonk", subclassId: "phb24SubclassWarriorOfTheOpenHand" },
};

const masteryIds = [
  "ID_WOTC_PHB24_CLASS_FEATURE_MASTERY_PROPERTY_GREATAXE_CLEAVE",
  "ID_WOTC_PHB24_CLASS_FEATURE_MASTERY_PROPERTY_HANDAXE_VEX",
  "ID_WOTC_PHB24_CLASS_FEATURE_MASTERY_PROPERTY_JAVELIN_SLOW",
  "ID_WOTC_PHB24_CLASS_FEATURE_MASTERY_PROPERTY_MAUL_TOPPLE",
];

function asiSelections(classId, start, level) {
  return Object.fromEntries([4, 8, 12, 16, 19]
    .map((asiLevel, index) => [asiLevel, index])
    .filter(([asiLevel]) => level >= asiLevel)
    .map(([, index]) => [`${classId}:selection:${start + index}`, ["manual-feat"]]));
}

function selectionsFor(kind, ruleset, level, definition) {
  if (kind === "barbarian") return {
    [`${definition.classId}:selection:0`]: ["athletics", "intimidation"],
    ...(ruleset === "5.5e" ? {
      [`${definition.classId}:selection:1`]: masteryIds.slice(0, fixture.barbarian.weaponMastery55[level - 1]),
      ...(level >= 3 ? { [`${definition.classId}:selection:2`]: ["perception"] } : {}),
    } : {}),
    ...asiSelections(definition.classId, ruleset === "5.5e" ? 3 : 1, level),
  };
  return {
    [`${definition.classId}:selection:0`]: ["acrobatics", "stealth"],
    [`${definition.classId}:selection:1`]: ["flute"],
    ...asiSelections(definition.classId, 2, level),
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
      levels: [{ classId: definition.classId, subclassId: level >= 3 ? definition.subclassId : "", level, hitPointRolls: [] }],
      abilityScores: { method: "standard", base: kind === "barbarian"
        ? { str: 16, dex: 14, con: 16, int: 8, wis: 12, cha: 10 }
        : { str: 10, dex: 16, con: 14, int: 10, wis: 16, cha: 8 } },
      selections: selectionsFor(kind, ruleset, level, definition),
      spells: { knownIds: [], spellbookIds: [], assignments: {} },
      inventory: [],
      description: {},
      overrides: {},
    },
  };
}

function assertManualBoundary(result, label) {
  assert.ok(result.warnings.length > 0, `${label} keeps explicit manual branches visible`);
  result.warnings.forEach((warning) => {
    assert.equal(warning.code, "manual-automation", `${label}: ${warning.message}`);
    assert.equal(warning.blocking, false, `${label}: ${warning.message}`);
  });
}

for (const ruleset of ["5e", "5.5e"]) {
  for (let level = 1; level <= 20; level += 1) {
    const barbarian = evaluateCharacter({ character: character("barbarian", ruleset, level), catalog });
    assertManualBoundary(barbarian, `${ruleset} Barbarian ${level}`);
    assert.equal(barbarian.sheet.hp.max, fixture.barbarian.hp[level - 1]);
    assert.equal(barbarian.sheet.proficiency, fixture.proficiency[level - 1]);
    assert.equal(barbarian.sheet.ac, fixture.barbarian.ac[level - 1]);
    assert.equal(barbarian.sheet.walk, fixture.barbarian.movementBonus[level - 1]);
    assert.equal(barbarian.sheet.combat.attacksPerAction, level >= 5 ? 2 : 1);
    const rage = barbarian.sheet.resources.find(({ name }) => name === "Rage");
    assert.equal(rage.uses.max, fixture.barbarian.rages[level - 1]);
    const rageAction = barbarian.sheet.actions.find(({ name }) => name === "Rage");
    assert.equal(rageAction.resourceId, rage.id);
    assert.match(rageAction.damage, new RegExp(`\\+${fixture.barbarian.rageDamage[level - 1]}`));
    if (ruleset === "5.5e") {
      const mastery = barbarian.sheet.features.filter(({ name }) => /mastery/i.test(name));
      assert.ok(mastery.length >= 1);
    }

    const monk = evaluateCharacter({ character: character("monk", ruleset, level), catalog });
    assertManualBoundary(monk, `${ruleset} Monk ${level}`);
    assert.equal(monk.sheet.hp.max, fixture.monk.hp[level - 1]);
    assert.equal(monk.sheet.proficiency, fixture.proficiency[level - 1]);
    assert.equal(monk.sheet.ac, fixture.monk.ac[level - 1]);
    assert.equal(monk.sheet.walk, fixture.monk.movementBonus[level - 1]);
    assert.equal(monk.sheet.combat.attacksPerAction, level >= 5 ? 2 : 1);
    const unarmed = monk.sheet.actions.find(({ id }) => id === "unarmed-strike");
    const die = fixture.monk.martialArts[ruleset][level - 1];
    assert.equal(unarmed.attackBonus, fixture.monk.attackBonus[level - 1]);
    assert.equal(unarmed.damage, `${die}+3 Bludgeoning`);
    assert.equal(monk.trace["actions.unarmed-strike.damage"].sources[0].value, die);
    const points = monk.sheet.resources.find(({ name }) => ruleset === "5e" ? name === "Ki Points" : name === "Focus Points");
    assert.equal(points?.uses.max || 0, fixture.monk.points[level - 1]);
    if (level >= 2) {
      assert.equal(monk.sheet.actions.find(({ name }) => name === "Flurry of Blows").resourceId, points.id);
      assert.equal(8 + monk.sheet.stats.wis.modifier + monk.sheet.proficiency, fixture.monk.saveDC[level - 1]);
    }
    if (level >= 6) {
      const wholeness = monk.sheet.resources.find(({ name }) => name === "Wholeness of Body");
      assert.equal(wholeness.uses.max, ruleset === "5e" ? 1 : 3);
      assert.equal(monk.sheet.actions.find(({ name }) => name === "Wholeness of Body").resourceId, wholeness.id);
    }
    if (level >= 14) {
      Object.keys(monk.sheet.stats).forEach((ability) => assert.equal(monk.trace[`stats.${ability}.save.proficiency`].value, "proficient"));
    }
  }

  for (const kind of ["barbarian", "monk"]) {
    const definition = definitions[`${kind}:${ruleset}`];
    assert.equal(metadata[definition.classId].automation.status, "rules-ready", `${ruleset} ${kind} metadata`);
    assert.equal(metadata[definition.subclassId].automation.status, "rules-ready", `${ruleset} ${kind} subclass metadata`);
  }
}

const armorCatalog = [...catalog,
  {
    id: "task28Shield", name: "Task 28 Shield", type: "Armor", ruleset: "agnostic",
    automation: { status: "rules-ready", reasons: [], expressions: [] }, setters: {},
    rules: { inventory: { kind: "armor", equippable: true, activation: "equipped", armor: { type: "shield", bonus: 2 } } },
  },
  {
    id: "task28Leather", name: "Task 28 Leather", type: "Armor", ruleset: "agnostic",
    automation: { status: "rules-ready", reasons: [], expressions: [] }, setters: {},
    rules: { inventory: { kind: "armor", equippable: true, activation: "equipped", armor: { type: "light", base: 11, dexterity: "full" } } },
  },
  {
    id: "task28Heavy", name: "Task 28 Heavy Armor", type: "Armor", ruleset: "agnostic",
    automation: { status: "rules-ready", reasons: [], expressions: [] }, setters: {},
    rules: { inventory: { kind: "armor", equippable: true, activation: "equipped", armor: { type: "heavy", base: 16, dexterity: "none" } } },
  },
];

function equippedResult(kind, definitionId) {
  const source = character(kind, "5.5e", 5);
  source.build.inventory = [{ instanceId: "armor-1", definitionId, quantity: 1, containerId: "" }];
  return evaluateCharacter({ character: source, catalog: armorCatalog, runtime: { hp: { current: 1 }, inventory: [{ instanceId: "armor-1", equipped: true }] } });
}

assert.deepEqual({ ac: equippedResult("barbarian", "task28Shield").sheet.ac, walk: equippedResult("barbarian", "task28Shield").sheet.walk }, { ac: 17, walk: 10 });
assert.deepEqual({ ac: equippedResult("barbarian", "task28Leather").sheet.ac, walk: equippedResult("barbarian", "task28Leather").sheet.walk }, { ac: 13, walk: 10 });
assert.deepEqual({ ac: equippedResult("barbarian", "task28Heavy").sheet.ac, walk: equippedResult("barbarian", "task28Heavy").sheet.walk }, { ac: 16, walk: 0 });
assert.deepEqual({ ac: equippedResult("monk", "task28Shield").sheet.ac, walk: equippedResult("monk", "task28Shield").sheet.walk }, { ac: 15, walk: 0 });
assert.deepEqual({ ac: equippedResult("monk", "task28Leather").sheet.ac, walk: equippedResult("monk", "task28Leather").sheet.walk }, { ac: 14, walk: 0 });

for (const ruleset of ["5e", "5.5e"]) {
  const barbarianDefinition = definitions[`barbarian:${ruleset}`];
  const monkDefinition = definitions[`monk:${ruleset}`];
  const multiclass = character("barbarian", ruleset, 5);
  multiclass.id = `barbarian-monk-${ruleset}`;
  multiclass.build.levels.push({ classId: monkDefinition.classId, subclassId: monkDefinition.subclassId, level: 5, hitPointRolls: [] });
  Object.assign(multiclass.build.selections, selectionsFor("monk", ruleset, 5, monkDefinition));
  const result = evaluateCharacter({ character: multiclass, catalog });
  assertManualBoundary(result, `${ruleset} Barbarian 5 / Monk 5`);
  assert.equal(result.sheet.hp.max, 95);
  assert.equal(result.sheet.ac, 15, "first multiclass Unarmored Defense formula applies without stacking");
  assert.equal(result.sheet.walk, 20);
  assert.equal(result.sheet.combat.attacksPerAction, 2);
  assert.equal(result.sheet.actions.find(({ id }) => id === "unarmed-strike").damage, `${fixture.monk.martialArts[ruleset][4]}+3 Bludgeoning`);
  const rage = result.sheet.resources.find(({ definitionId, name }) => definitionId === barbarianDefinition.classId && name === "Rage");
  const points = result.sheet.resources.find(({ definitionId, name }) => definitionId === monkDefinition.classId && /Points$/.test(name));
  const rested = applyCharacterRest({ runtime: { hp: { current: 1 }, uses: [{ id: rage.id, current: 0 }, { id: points.id, current: 0 }] }, sheet: result.sheet, ruleset, kind: "short" });
  assert.equal(rested.runtime.uses.find(({ id }) => id === rage.id).current, ruleset === "5e" ? 0 : 1);
  assert.equal(rested.runtime.uses.find(({ id }) => id === points.id).current, 5);
}

console.log("Barbarian and Monk level 1-20, martial actions, resources, armor gates, and multiclass certification tests passed.");
