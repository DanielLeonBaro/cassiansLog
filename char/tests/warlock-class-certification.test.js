// Certifies Warlock Pact Magic, invocation prerequisites, rests, and multiclass slot separation.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { evaluateCharacter } from "../js/rules/engine.js";
import { evaluateCharacterBuild } from "../js/rules/evaluator.js";
import { applyCharacterRest } from "../js/rules/runtime.js";
import { applyRulesMetadata } from "../../compendium/js/api.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const dataRoot = path.resolve(here, "../../compendium/data");
const fixture = JSON.parse(fs.readFileSync(path.join(here, "fixtures/warlock-levels-1-20.json"), "utf8"));
const manifest = JSON.parse(fs.readFileSync(path.join(dataRoot, "manifest.json"), "utf8"));
const metadata = JSON.parse(fs.readFileSync(path.join(dataRoot, "rules-metadata.json"), "utf8")).entries;
const catalog = applyRulesMetadata(manifest.categories.flatMap((category) =>
  JSON.parse(fs.readFileSync(path.join(dataRoot, category.file), "utf8")).entries), metadata);

const definitions = {
  "5e": { classId: "phbClassWarlock", subclassId: "phbSubclassTheFiend", invocationIndex: 2 },
  "5.5e": { classId: "phb24ClassWarlock", subclassId: "phb24SubclassFiendPatron", invocationIndex: 1 },
};

const invocationIds = {
  "5e": ["agonizing-blast", "devils-sight", "thirsting-blade", "one-with-shadows", "whispers-of-the-grave", "lifedrinker", "visions-of-distant-realms", "witch-sight"],
  "5.5e": ["pact-of-blade", "agonizing-blast", "devils-sight", "thirsting-blade", "ascendant-step", "one-with-shadows", "lifedrinker", "devouring-blade", "witch-sight", "visions-of-distant-realms"],
};

function asiSelections(classId, start, level) {
  return Object.fromEntries([4, 8, 12, 16, 19].map((asiLevel, index) => [
    `${classId}:selection:${start + index}`,
    [asiLevel <= level && index < 2 ? "charisma-2" : "manual-feat"],
  ]));
}

function selectionsFor(ruleset, level) {
  const definition = definitions[ruleset];
  return {
    [`${definition.classId}:selection:0`]: ["arcana", "deception"],
    ...(ruleset === "5e" ? { [`${definition.classId}:selection:1`]: ["pact-of-blade"] } : {}),
    [`${definition.classId}:selection:${definition.invocationIndex}`]: invocationIds[ruleset].slice(0, fixture.invocations[ruleset][level - 1]),
    ...asiSelections(definition.classId, ruleset === "5e" ? 3 : 2, level),
    ...(level >= 10 ? { [`${definition.subclassId}:selection:0`]: ["fiendish-resilience-fire"] } : {}),
  };
}

function character(ruleset, level) {
  const definition = definitions[ruleset];
  return {
    id: `warlock-${ruleset}-${level}`,
    name: `Warlock ${level}`,
    hp: { max: 0, current: 0, temp: 0 },
    characterSchemaVersion: 2,
    build: {
      version: 1,
      mode: "rules",
      status: "complete",
      ruleset,
      preferences: { hitPoints: "fixed", encumbrance: "none", enabledSources: [], prerequisites: true },
      levels: [{ classId: definition.classId, subclassId: definition.subclassId, level, hitPointRolls: [] }],
      abilityScores: { method: "standard", base: { str: 8, dex: 14, con: 14, int: 10, wis: 12, cha: 16 } },
      selections: selectionsFor(ruleset, level),
      spells: { knownIds: [], spellbookIds: [], assignments: {} }, inventory: [], description: {}, overrides: {},
    },
  };
}

function expectedManualWarnings(ruleset, level) {
  const selected = fixture.invocations[ruleset][level - 1] + (ruleset === "5e" && level >= 3 ? 1 : 0);
  const classWarnings = (level >= 11 ? 1 : 0) + (ruleset === "5e" && level >= 20 ? 1 : 0)
    + (ruleset === "5.5e" && level >= 2 ? 1 : 0) + (ruleset === "5.5e" && level >= 9 ? 1 : 0);
  const subclassWarnings = (ruleset === "5e" ? level >= 1 : level >= 3 ? 1 : 0)
    + (level >= 10 ? 1 : 0) + (level >= 14 ? 1 : 0);
  return selected + classWarnings + subclassWarnings;
}

for (const ruleset of ["5e", "5.5e"]) {
  for (let level = 1; level <= 20; level += 1) {
    const result = evaluateCharacter({ character: character(ruleset, level), catalog });
    const graph = evaluateCharacterBuild({ character: character(ruleset, level), catalog });
    assert.equal(result.warnings.length, expectedManualWarnings(ruleset, level), `${ruleset} Warlock ${level} warning count`);
    result.warnings.forEach((warning) => {
      assert.equal(warning.code, "manual-automation", `${ruleset} Warlock ${level} only has explicit manual branches`);
      assert.equal(warning.blocking, false);
    });
    assert.equal(result.sheet.hp.max, fixture.hp[level - 1]);
    assert.equal(result.sheet.proficiency, fixture.proficiency[level - 1]);
    const profile = result.sheet.spellcasting.profiles.find(({ id }) => id === "warlock");
    assert.equal(profile.saveDC, fixture.saveDC[level - 1]);
    assert.equal(profile.cantripLimit, fixture.cantrips[level - 1]);
    assert.equal(profile.knownLimit || 0, ruleset === "5e" ? fixture.known5e[level - 1] : 0);
    assert.equal(profile.preparedLimit || 0, ruleset === "5.5e" ? fixture.prepared55[level - 1] : 0);
    const pact = result.sheet.spellcasting.slots.find(({ pool }) => pool === "pact");
    assert.equal(pact.max, fixture.pactSlots.count[level - 1]);
    assert.equal(pact.level, fixture.pactSlots.level[level - 1]);
    assert.equal(pact.reset, "short");
    assert.equal(graph.choices.find(({ name }) => name === "Eldritch Invocations").selectedIds.length, fixture.invocations[ruleset][level - 1]);

    if (ruleset === "5.5e" && level === 2) {
      const magicalCunning = result.sheet.resources.find(({ name }) => name === "Magical Cunning");
      const shortRest = applyCharacterRest({ runtime: { hp: { current: 1 }, uses: [{ id: magicalCunning.id, current: 0 }] }, sheet: result.sheet, ruleset, kind: "short" });
      const longRest = applyCharacterRest({ runtime: { hp: { current: 1 }, uses: [{ id: magicalCunning.id, current: 0 }] }, sheet: result.sheet, ruleset, kind: "long" });
      assert.equal(shortRest.runtime.uses.find(({ id }) => id === magicalCunning.id).current, 0);
      assert.equal(longRest.runtime.uses.find(({ id }) => id === magicalCunning.id).current, 1);
    }
  }
  assert.equal(metadata[definitions[ruleset].classId].automation.status, "rules-ready", `${ruleset} Warlock metadata`);
  assert.equal(metadata[definitions[ruleset].subclassId].automation.status, "rules-ready", `${ruleset} Fiend metadata`);
}

const invalid = character("5.5e", 5);
invalid.build.selections[`${definitions["5.5e"].classId}:selection:1`] = ["agonizing-blast", "devils-sight", "thirsting-blade", "ascendant-step", "one-with-shadows"];
const invalidResult = evaluateCharacter({ character: invalid, catalog });
const invalidInvocation = evaluateCharacterBuild({ character: invalid, catalog }).choices.find(({ name }) => name === "Eldritch Invocations");
assert.equal(invalidInvocation.options.find(({ id }) => id === "thirsting-blade").unavailableReason, "prerequisite-unmet");
assert.ok(invalidResult.warnings.some(({ code }) => code === "prerequisite-unmet"));

const levelGated = evaluateCharacterBuild({ character: character("5.5e", 4), catalog })
  .choices.find(({ name }) => name === "Eldritch Invocations");
assert.equal(levelGated.options.find(({ id }) => id === "thirsting-blade").unavailableReason, "level-gated");

for (const ruleset of ["5e", "5.5e"]) {
  const multiclass = character(ruleset, 5);
  multiclass.id = `warlock-wizard-${ruleset}`;
  const wizardId = ruleset === "5e" ? "phbClassWizard" : "phb24ClassWizard";
  multiclass.build.levels.push({ classId: wizardId, subclassId: "", level: 5, hitPointRolls: [] });
  Object.assign(multiclass.build.selections, {
    [`${wizardId}:selection:0`]: ["arcana", "history"],
    ...(ruleset === "5.5e" ? { [`${wizardId}:selection:1`]: ["arcana-expertise"] } : {}),
    ...asiSelections(wizardId, ruleset === "5e" ? 1 : 2, 5),
  });
  const result = evaluateCharacter({ character: multiclass, catalog });
  assert.equal(result.sheet.hp.max, 68);
  assert.equal(result.sheet.spellcasting.casterLevel, 5);
  assert.deepEqual(result.sheet.spellcasting.slots.filter(({ pool }) => pool === "spellcasting").map(({ max }) => max), [4, 3, 2]);
  const pact = result.sheet.spellcasting.slots.find(({ pool }) => pool === "pact");
  assert.equal(pact.max, 2);
  assert.equal(pact.level, 3);
  const rested = applyCharacterRest({ runtime: { hp: { current: 1 }, slots: [{ id: pact.id, current: 0 }, { id: "spell-slot:1", current: 0 }] }, sheet: result.sheet, ruleset, kind: "short" });
  assert.equal(rested.runtime.slots.find(({ id }) => id === pact.id).current, 2);
  assert.equal(rested.runtime.slots.find(({ id }) => id === "spell-slot:1").current, 0);
}

console.log("Warlock Pact Magic, invocation prerequisites, rests, and multiclass certification tests passed.");
