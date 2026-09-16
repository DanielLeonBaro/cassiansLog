// Certifies Human, Sage, and Soldier across Fighter/Wizard levels 1-5 in both editions.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { evaluateCharacter } from "../js/rules/engine.js";
import { applyCharacterRest } from "../js/rules/runtime.js";
import { applyRulesMetadata } from "../../compendium/js/api.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const dataRoot = path.resolve(here, "../../compendium/data");
const fixture = JSON.parse(fs.readFileSync(path.join(here, "fixtures/first-slice-origins.json"), "utf8"));
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
const origins = {
  "5e": { speciesId: "phbRaceHuman", backgrounds: { sage: "phbBackgroundSage", soldier: "phbBackgroundSoldier" } },
  "5.5e": { speciesId: "phb24RaceHuman", backgrounds: { sage: "phb24BackgroundSage", soldier: "phb24BackgroundSoldier" } },
};

function firstSliceCharacter(kind, ruleset, background, level) {
  const definition = definitions[`${kind}:${ruleset}`];
  const origin = origins[ruleset];
  const selections = kind === "fighter" ? {
    [`${definition.classId}:selection:0`]: ["acrobatics", "perception"],
    [`${definition.classId}:selection:1`]: ["protection"],
    ...(ruleset === "5.5e" ? { [`${definition.classId}:selection:2`]: [
      "ID_WOTC_PHB24_CLASS_FEATURE_MASTERY_PROPERTY_GREATSWORD_GRAZE",
      "ID_WOTC_PHB24_CLASS_FEATURE_MASTERY_PROPERTY_LONGBOW_SLOW",
      "ID_WOTC_PHB24_CLASS_FEATURE_MASTERY_PROPERTY_LONGSWORD_SAP",
      ...(level >= 4 ? ["ID_WOTC_PHB24_CLASS_FEATURE_MASTERY_PROPERTY_DAGGER_NICK"] : []),
    ] } : {}),
    [`${definition.classId}:selection:${ruleset === "5.5e" ? 3 : 2}`]: ["strength-2"],
  } : {
    [`${definition.classId}:selection:0`]: ["insight", "investigation"],
    ...(ruleset === "5.5e" ? { [`${definition.classId}:selection:1`]: ["investigation-expertise"] } : {}),
    [`${definition.classId}:selection:${ruleset === "5.5e" ? 2 : 1}`]: ["intelligence-2"],
  };
  if (ruleset === "5e") {
    selections[`${origin.speciesId}:selection:0`] = ["elvish"];
    selections[`${origin.backgrounds[background]}:selection:0`] = background === "sage" ? ["dwarvish", "draconic"] : ["dice-set"];
  } else {
    selections[`${origin.speciesId}:selection:0`] = ["small"];
    selections[`${origin.speciesId}:selection:1`] = ["nature"];
    selections[`${origin.speciesId}:selection:2`] = ["tough"];
    selections[`${origin.speciesId}:selection:3`] = ["elvish", "dwarvish"];
    selections[`${origin.backgrounds[background]}:selection:0`] = [background === "sage"
      ? "intelligence-2-constitution-1"
      : "strength-2-constitution-1"];
    if (background === "soldier") selections[`${origin.backgrounds.soldier}:selection:1`] = ["dice-set"];
  }
  const subclassLevel = kind === "wizard" && ruleset === "5e" ? 2 : 3;
  return {
    id: `${kind}-${ruleset}-${background}-${level}`,
    name: `${kind} ${background} ${level}`,
    characterSchemaVersion: 2,
    build: {
      version: 1,
      mode: "rules",
      status: "complete",
      ruleset,
      preferences: { hitPoints: "fixed", encumbrance: "standard", coinWeight: true, enabledSources: [], prerequisites: true },
      levels: [{ classId: definition.classId, subclassId: level >= subclassLevel ? definition.subclassId : "", level, hitPointRolls: [] }],
      speciesId: origin.speciesId,
      backgroundId: origin.backgrounds[background],
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

function skill(sheet, name) {
  return Object.values(sheet.stats).flatMap((ability) => ability.skills || []).find((item) => item.name === name);
}

for (const ruleset of ["5e", "5.5e"]) {
  for (const background of ["sage", "soldier"]) {
    for (const kind of ["fighter", "wizard"]) {
      for (let level = 1; level <= 5; level += 1) {
        const result = evaluateCharacter({ character: firstSliceCharacter(kind, ruleset, background, level), catalog });
        const allowedWarningCodes = ruleset === "5.5e" && background === "sage" ? ["manual-automation"] : [];
        assert.deepEqual(result.warnings.map((warning) => warning.code), allowedWarningCodes, `${kind}/${ruleset}/${background}/${level} warning boundary`);
        assert.equal(result.sheet.hp.max, fixture.human.hp[kind][ruleset][level - 1]);
        assert.equal(result.sheet.walk, fixture.human.speed);
        assert.equal(result.sheet.size, fixture.human.size[ruleset]);
        assert.equal(result.sheet.creatureType, fixture.human.creatureType);
        assert.equal(result.sheet.encumbrance.size, fixture.human.size[ruleset]);
        assert.ok(result.trace.size.sources.length, "size must expose its rule source");
        assert.ok(result.trace["movement.walk"].sources.length, "speed must expose its rule source");
        fixture.backgrounds[background].skills.forEach((name) => assert.equal(skill(result.sheet, name).proficiency, true));
        fixture.backgrounds[background].proficiencies[ruleset].forEach((name) => assert.ok(result.sheet.proficiencies.includes(name)));
        assert.ok(result.sheet.features.some((feature) => feature.name === fixture.backgrounds[background].feature[ruleset]));
        assert.equal(result.sheet.stats.con.score, fixture.scores[kind][ruleset][background].con);
        const primary = kind === "fighter" ? "str" : "int";
        assert.equal(result.sheet.stats[primary].score, fixture.scores[kind][ruleset][background][primary][level - 1]);
        if (kind === "wizard") assert.equal(result.sheet.spellcasting.profiles[0].saveDC, fixture.wizardSaveDC[ruleset][background][level - 1]);
        if (ruleset === "5e") {
          assert.ok(result.sheet.languages.includes("Common"));
          assert.ok(result.sheet.languages.includes("Elvish"));
        } else {
          assert.deepEqual(result.sheet.languages, ["Common", "Dwarvish", "Elvish"]);
          assert.ok(result.sheet.features.some((feature) => feature.name === "Tough"));
          assert.ok(result.trace["hp.max"].sources.some((source) => source.label === "Tough" && source.value === level * 2));
          const rest = applyCharacterRest({ runtime: { hp: { current: 1 }, inspiration: false }, sheet: result.sheet, ruleset, kind: "long" });
          assert.equal(rest.runtime.inspiration, true);
          assert.ok(rest.changes.includes("inspiration"));
        }
      }
    }
  }
}

const soldier = firstSliceCharacter("fighter", "5.5e", "soldier", 1);
soldier.build.inventory = [{ instanceId: "sword-1", definitionId: "certifiedSword", quantity: 1, containerId: "" }];
const soldierResult = evaluateCharacter({
  character: soldier,
  catalog: [...catalog, {
    id: "certifiedSword",
    originalId: "ID_TEST_CERTIFIED_SWORD",
    name: "Certified Sword",
    type: "Weapon",
    ruleset: "5.5e",
    automation: { status: "rules-ready", reasons: [], expressions: [] },
    rules: { inventory: { kind: "weapon", equippable: true, activation: "equipped", weapon: { damage: "1d8", damageType: "Slashing", proficient: true } } },
    setters: {},
  }],
  runtime: { hp: { current: 1 }, inventory: [{ instanceId: "sword-1", equipped: true }] },
});
assert.deepEqual(soldierResult.sheet.actions.find((action) => action.instanceId === "sword-1").styleEffects,
  [{ kind: "damage-roll-twice", oncePerTurn: true }]);

const variant = firstSliceCharacter("fighter", "5e", "sage", 1);
variant.build.selections["phbRaceHuman:selection:1"] = ["variant-human-manual"];
assert.ok(evaluateCharacter({ character: variant, catalog }).warnings.some((warning) => warning.code === "manual-automation" && !warning.blocking));

const mismatch = firstSliceCharacter("fighter", "5e", "sage", 1);
mismatch.build.speciesId = "phb24RaceHuman";
assert.ok(evaluateCharacter({ character: mismatch, catalog }).warnings.some((warning) => warning.code === "ruleset-mismatch" && warning.blocking));

for (const id of [
  "phbRaceHuman", "phb24RaceHuman", "phbBackgroundSage",
  "phb24BackgroundSage", "phbBackgroundSoldier", "phb24BackgroundSoldier",
]) assert.equal(metadata[id].automation.status, "rules-ready");

console.log("First-slice Human, Sage, and Soldier certification tests passed (40 cross-product cases). ");
