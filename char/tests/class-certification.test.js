// Certifies Fighter and Wizard levels 1-20 plus multiclass boundaries against reviewed golden tables.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { evaluateCharacter } from "../js/rules/engine.js";
import { applyCharacterRest, recoverRuntimeSpellSlots } from "../js/rules/runtime.js";
import { applyRulesMetadata } from "../../compendium/js/api.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const dataRoot = path.resolve(here, "../../compendium/data");
const fixture = JSON.parse(fs.readFileSync(path.join(here, "fixtures/fighter-wizard-levels-1-20.json"), "utf8"));
const manifest = JSON.parse(fs.readFileSync(path.join(dataRoot, "manifest.json"), "utf8"));
const metadata = JSON.parse(fs.readFileSync(path.join(dataRoot, "rules-metadata.json"), "utf8")).entries;
const catalog = applyRulesMetadata(manifest.categories.flatMap((category) =>
  JSON.parse(fs.readFileSync(path.join(dataRoot, category.file), "utf8")).entries), metadata);

const definitions = {
  "fighter:5e": { classId: "phbClassFighter", subclassId: "phbSubclassChampion" },
  "fighter:5.5e": { classId: "phb24ClassFighter", subclassId: "phb24SubclassChampion" },
  "wizard:5e": { classId: "phbClassWizard", subclassId: "phbSubclassSchoolOfEvocation" },
  "wizard:5.5e": { classId: "phb24ClassWizard", subclassId: "phb24SubclassEvoker" },
};

function character(kind, ruleset, level) {
  const definition = definitions[`${kind}:${ruleset}`];
  const asiLevels = kind === "fighter" ? [4, 6, 8, 12, 14, 16, 19] : [4, 8, 12, 16, 19];
  const asiStart = kind === "fighter" ? (ruleset === "5.5e" ? 3 : 2) : (ruleset === "5.5e" ? 2 : 1);
  const asiSelections = Object.fromEntries(asiLevels.map((asiLevel, index) => [
    `${definition.classId}:selection:${asiStart + index}`,
    [asiLevel <= level ? (index < (kind === "wizard" ? 2 : 1) ? `${kind === "wizard" ? "intelligence" : "strength"}-2` : "manual-feat") : "manual-feat"],
  ]));
  const masteryCount = level < 4 ? 3 : level < 10 ? 4 : level < 16 ? 5 : 6;
  const selections = kind === "fighter" ? {
    [`${definition.classId}:selection:0`]: ["athletics", "perception"],
    [`${definition.classId}:selection:1`]: ["protection"],
    ...(ruleset === "5.5e" ? { [`${definition.classId}:selection:2`]: [
      "ID_WOTC_PHB24_CLASS_FEATURE_MASTERY_PROPERTY_GREATSWORD_GRAZE",
      "ID_WOTC_PHB24_CLASS_FEATURE_MASTERY_PROPERTY_LONGBOW_SLOW",
      "ID_WOTC_PHB24_CLASS_FEATURE_MASTERY_PROPERTY_LONGSWORD_SAP",
      "ID_WOTC_PHB24_CLASS_FEATURE_MASTERY_PROPERTY_DAGGER_NICK",
      "ID_WOTC_PHB24_CLASS_FEATURE_MASTERY_PROPERTY_BATTLEAXE_TOPPLE",
      "ID_WOTC_PHB24_CLASS_FEATURE_MASTERY_PROPERTY_RAPIER_VEX",
    ].slice(0, masteryCount) } : {}),
    ...asiSelections,
    ...(level >= (ruleset === "5e" ? 10 : 7) ? { [`${definition.subclassId}:selection:0`]: ["defense"] } : {}),
  } : {
    [`${definition.classId}:selection:0`]: ["arcana", "history"],
    ...(ruleset === "5.5e" ? { [`${definition.classId}:selection:1`]: ["arcana-expertise"] } : {}),
    ...asiSelections,
  };
  const subclassLevel = kind === "wizard" && ruleset === "5e" ? 2 : 3;
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
      levels: [{ classId: definition.classId, subclassId: level >= subclassLevel ? definition.subclassId : "", level, hitPointRolls: [] }],
      abilityScores: { method: "standard", base: kind === "fighter"
        ? { str: 15, dex: 14, con: 14, int: 10, wis: 12, cha: 8 }
        : { str: 8, dex: 14, con: 14, int: 16, wis: 12, cha: 10 } },
      selections,
      spells: { knownIds: [], spellbookIds: [], assignments: {} },
      inventory: [],
      description: {},
      overrides: {},
    },
  };
}

for (const ruleset of ["5e", "5.5e"]) {
  for (let level = 1; level <= 20; level += 1) {
    const fighter = evaluateCharacter({ character: character("fighter", ruleset, level), catalog });
    assert.deepEqual(fighter.warnings, [], `${ruleset} Fighter ${level} must have no unresolved rules`);
    assert.equal(fighter.sheet.hp.max, fixture.fighter.hp[level - 1]);
    assert.equal(fighter.sheet.proficiency, fixture.fighter.proficiency[level - 1]);
    assert.equal(fighter.sheet.stats.str.save, fixture.fighter.primarySave[level - 1]);
    assert.equal(fighter.sheet.combat.attacksPerAction, fixture.fighter.attacksPerAction[level - 1]);
    assert.equal(fighter.sheet.features.length, fixture.fighter.featureCounts[ruleset][level - 1]);
    const secondWind = fighter.sheet.resources.find((resource) => resource.name === "Second Wind");
    assert.equal(secondWind.uses.max, fixture.fighter.secondWind[ruleset][level - 1]);
    assert.equal(fighter.sheet.combat.criticalThreshold, fixture.fighter.criticalThreshold[level - 1]);
    assert.ok(fighter.trace["stats.str.save"].sources.length >= 2);
    if (ruleset === "5.5e" && level === 5) {
      const rested = applyCharacterRest({ runtime: { hp: { current: 1 }, uses: [{ id: secondWind.id, current: 0 }] }, sheet: fighter.sheet, ruleset, kind: "short" });
      assert.equal(rested.runtime.uses.find((use) => use.id === secondWind.id).current, 1, "2024 Short Rest restores one Second Wind use");
    }

    const wizard = evaluateCharacter({ character: character("wizard", ruleset, level), catalog });
    assert.deepEqual(wizard.warnings, [], `${ruleset} Wizard ${level} must have no unresolved rules`);
    assert.equal(wizard.sheet.hp.max, fixture.wizard.hp[level - 1]);
    assert.equal(wizard.sheet.proficiency, fixture.wizard.proficiency[level - 1]);
    const profile = wizard.sheet.spellcasting.profiles[0];
    assert.equal(profile.saveDC, fixture.wizard.saveDC[ruleset][level - 1]);
    assert.equal(profile.preparedLimit, fixture.wizard.prepared[ruleset][level - 1]);
    assert.equal(profile.cantripLimit, fixture.wizard.cantrips[level - 1]);
    assert.equal(profile.spellbookMinimum, fixture.wizard.spellbookMinimum[level - 1]);
    assert.deepEqual(wizard.sheet.spellcasting.slots.map((slot) => slot.max), fixture.wizard.slots[level - 1]);
    assert.ok(wizard.trace["spellcasting.profiles.wizard.saveDC"].sources.length >= 3);
    if (ruleset === "5e" && level === 5) {
      const resource = wizard.sheet.resources.find((item) => item.name === "Arcane Recovery");
      const recovered = recoverRuntimeSpellSlots({
        runtime: { hp: { current: 1 }, uses: [{ id: resource.id, current: 1 }], slots: wizard.sheet.spellcasting.slots.map((slot) => ({ id: slot.id, current: 0 })) },
        sheet: wizard.sheet,
        profileId: "wizard",
        slots: [{ id: "spell-slot:2", amount: 1 }, { id: "spell-slot:1", amount: 1 }],
      });
      assert.equal(recovered.applied, true);
      assert.equal(recovered.runtime.slots.find((slot) => slot.id === "spell-slot:2").current, 1);
      assert.equal(recovered.runtime.uses.find((use) => use.id === resource.id).current, 0);
    }
  }
}

function multiclassCharacter(ruleset) {
  const fighter = definitions[`fighter:${ruleset}`];
  const wizard = definitions[`wizard:${ruleset}`];
  const fighterAsiStart = ruleset === "5.5e" ? 3 : 2;
  const wizardAsiStart = ruleset === "5.5e" ? 2 : 1;
  return {
    id: `fighter-wizard-${ruleset}`,
    name: "Fighter Wizard",
    hp: { max: 0, current: 0, temp: 0 },
    characterSchemaVersion: 2,
    build: {
      version: 1, mode: "rules", status: "complete", ruleset,
      preferences: { hitPoints: "fixed", encumbrance: "none", enabledSources: [], prerequisites: true },
      levels: [
        { classId: fighter.classId, subclassId: fighter.subclassId, level: 5, hitPointRolls: [] },
        { classId: wizard.classId, subclassId: wizard.subclassId, level: 5, hitPointRolls: [] },
      ],
      abilityScores: { method: "standard", base: { str: 15, dex: 10, con: 14, int: 16, wis: 12, cha: 8 } },
      selections: {
        [`${fighter.classId}:selection:0`]: ["athletics", "perception"],
        [`${fighter.classId}:selection:1`]: ["protection"],
        ...(ruleset === "5.5e" ? { [`${fighter.classId}:selection:2`]: [
          "ID_WOTC_PHB24_CLASS_FEATURE_MASTERY_PROPERTY_GREATSWORD_GRAZE",
          "ID_WOTC_PHB24_CLASS_FEATURE_MASTERY_PROPERTY_LONGBOW_SLOW",
          "ID_WOTC_PHB24_CLASS_FEATURE_MASTERY_PROPERTY_LONGSWORD_SAP",
          "ID_WOTC_PHB24_CLASS_FEATURE_MASTERY_PROPERTY_DAGGER_NICK",
        ] } : {}),
        [`${fighter.classId}:selection:${fighterAsiStart}`]: ["strength-2"],
        [`${wizard.classId}:selection:0`]: ["arcana", "history"],
        ...(ruleset === "5.5e" ? { [`${wizard.classId}:selection:1`]: ["arcana-expertise"] } : {}),
        [`${wizard.classId}:selection:${wizardAsiStart}`]: ["intelligence-2"],
      },
      spells: { knownIds: [], spellbookIds: [], assignments: {} }, inventory: [], description: {}, overrides: {},
    },
  };
}

for (const ruleset of ["5e", "5.5e"]) {
  const result = evaluateCharacter({ character: multiclassCharacter(ruleset), catalog });
  assert.deepEqual(result.warnings, [], `${ruleset} Fighter 5 / Wizard 5 must resolve without warnings`);
  assert.equal(result.sheet.level, 10);
  assert.equal(result.sheet.proficiency, 4);
  assert.equal(result.sheet.hp.max, 74);
  assert.deepEqual(result.sheet.hitDice.map(({ die, max }) => ({ die, max })), [{ die: "d10", max: 5 }, { die: "d6", max: 5 }]);
  assert.equal(result.sheet.combat.attacksPerAction, 2);
  assert.deepEqual(result.sheet.spellcasting.slots.map((slot) => slot.max), [4, 3, 2], "Fighter adds no caster levels");
  assert.equal(result.sheet.spellcasting.profiles.find((profile) => profile.id === "wizard").level, 5);
}

for (const definition of Object.values(definitions)) {
  assert.equal(metadata[definition.classId].automation.status, "rules-ready");
  assert.equal(metadata[definition.subclassId].automation.status, "rules-ready");
  assert.deepEqual(metadata[definition.classId].automation.reasons, []);
}

const archer = character("fighter", "5e", 1);
archer.build.selections["phbClassFighter:selection:1"] = ["archery"];
archer.build.inventory = [{ instanceId: "bow-1", definitionId: "certifiedLongbow", quantity: 1, containerId: "" }];
const archerResult = evaluateCharacter({
  character: archer,
  catalog: [...catalog, {
    id: "certifiedLongbow",
    originalId: "ID_TEST_CERTIFIED_LONGBOW",
    name: "Certified Longbow",
    type: "Weapon",
    ruleset: "5e",
    automation: { status: "rules-ready", reasons: [], expressions: [] },
    rules: { inventory: { kind: "weapon", equippable: true, activation: "equipped", weapon: { attackType: "ranged", damage: "1d8", damageType: "Piercing", proficient: true } } },
    setters: {},
  }],
  runtime: { hp: { current: 1 }, inventory: [{ instanceId: "bow-1", equipped: true }] },
});
const bowAction = archerResult.sheet.actions.find((action) => action.instanceId === "bow-1");
assert.equal(bowAction.attackBonus, 6, "Archery adds +2 to a ranged weapon attack");
assert.ok(archerResult.trace["actions.weapon:bow-1.attack"].sources.some((source) => source.label === "Archery" && source.value === 2));

const missingSubclass = character("fighter", "5e", 3);
missingSubclass.build.levels[0].subclassId = "";
assert.ok(evaluateCharacter({ character: missingSubclass, catalog }).warnings.some((warning) =>
  warning.code === "subclass-required" && warning.blocking));

console.log("Fighter and Wizard level 1-20 and multiclass certification tests passed.");
