// Verifies catalog-driven Character Builder root choices and evaluator-backed feature choices.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { applyRulesMetadata } from "../../compendium/js/api.js";
import {
  applyBuilderClassLevel,
  applyBuilderRootSelection,
  applyBuilderRuleSelection,
  applyBuilderSubclassSelection,
  builderRootEntries,
  builderStepEvaluation,
} from "../js/builder/choice-model.js";
import { applyBuilderHomePreferences } from "../js/builder/home-model.js";
import { characterBuilderStepStates, createCharacterBuildDraft } from "../js/builder/model.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const dataRoot = path.resolve(here, "../../compendium/data");
const index = JSON.parse(fs.readFileSync(path.join(dataRoot, "index.json"), "utf8"));
const metadata = JSON.parse(fs.readFileSync(path.join(dataRoot, "rules-metadata.json"), "utf8")).entries;
const catalog = applyRulesMetadata(index.entries, metadata);

function filteredDraft(ruleset) {
  const draft = createCharacterBuildDraft({ draftId: `choices-${ruleset.replace(".", "-")}`, ruleset });
  return applyBuilderHomePreferences(draft.document, {
    publisher: "Wizards of the Coast",
    automation: "rules-ready",
  }, catalog);
}

function completeVisibleChoices(document, step) {
  let next = document;
  for (let guard = 0; guard < 20; guard += 1) {
    const choice = builderStepEvaluation(next, catalog, step).choices
      .find((candidate) => candidate.status === "incomplete");
    if (!choice) return next;
    const ids = choice.options.filter(({ available }) => available).slice(0, choice.minimum).map(({ id }) => id);
    assert.equal(ids.length, choice.minimum, `${choice.name} should expose enough valid options`);
    next = applyBuilderRuleSelection(next, catalog, choice.key, ids);
  }
  throw new Error(`${step} choices did not converge.`);
}

for (const [ruleset, ids] of Object.entries({
  "5e": {
    fighter: "phbClassFighter",
    wizard: "phbClassWizard",
    champion: "phbSubclassChampion",
    evoker: "phbSubclassSchoolOfEvocation",
    human: "phbRaceHuman",
    sage: "phbBackgroundSage",
    soldier: "phbBackgroundSoldier",
  },
  "5.5e": {
    fighter: "phb24ClassFighter",
    wizard: "phb24ClassWizard",
    champion: "phb24SubclassChampion",
    evoker: "phb24SubclassEvoker",
    human: "phb24RaceHuman",
    sage: "phb24BackgroundSage",
    soldier: "phb24BackgroundSoldier",
  },
})) {
  let document = filteredDraft(ruleset);
  const classes = builderRootEntries(catalog, document, "class");
  assert.ok(classes.some(({ id }) => id === ids.fighter));
  assert.ok(classes.some(({ id }) => id === ids.wizard));
  assert.ok(classes.every((entry) => entry.ruleset === ruleset), `${ruleset} choices must not mix editions`);

  const wrongEdition = ruleset === "5e" ? "phb24ClassFighter" : "phbClassFighter";
  assert.deepEqual(applyBuilderRootSelection(document, catalog, "class", wrongEdition), document, "invalid root choice must not mutate the build");
  document = applyBuilderRootSelection(document, catalog, "class", ids.fighter);
  assert.equal(document.build.levels[0].classId, ids.fighter);
  assert.equal(characterBuilderStepStates(document, {
    evaluation: builderStepEvaluation(document, catalog, "class").evaluation,
    catalog,
  }).class, "incomplete", "required class choices keep progress incomplete");

  document = completeVisibleChoices(document, "class");
  assert.equal(characterBuilderStepStates(document, {
    evaluation: builderStepEvaluation(document, catalog, "class").evaluation,
    catalog,
  }).class, "complete");

  document = applyBuilderClassLevel(document, catalog, 3);
  assert.ok(builderRootEntries(catalog, document, "subclass").some(({ id }) => id === ids.champion));
  assert.ok(!builderRootEntries(catalog, document, "subclass").some(({ id }) => id === ids.evoker), "subclasses must be linked to the selected class");
  assert.equal(characterBuilderStepStates(document, {
    evaluation: builderStepEvaluation(document, catalog, "class").evaluation,
    catalog,
  }).class, "incomplete", "subclass gate must be visible");
  assert.equal(applyBuilderSubclassSelection(document, catalog, ids.evoker).build.levels[0].subclassId, "", "wrong-class subclass must be rejected");
  document = applyBuilderSubclassSelection(document, catalog, ids.champion);
  assert.equal(document.build.levels[0].subclassId, ids.champion);
  document = applyBuilderClassLevel(document, catalog, 1);
  assert.equal(document.build.levels[0].subclassId, "", "lowering below the class gate clears the subclass");

  document = applyBuilderRootSelection(document, catalog, "background", ids.sage);
  document = completeVisibleChoices(document, "background");
  assert.equal(document.build.backgroundId, ids.sage);
  assert.ok(["complete", "warning"].includes(characterBuilderStepStates(document, {
    evaluation: builderStepEvaluation(document, catalog, "background").evaluation,
    catalog,
  }).background));

  document = applyBuilderRootSelection(document, catalog, "species", ids.human);
  const speciesBefore = builderStepEvaluation(document, catalog, "species");
  const requiredChoice = speciesBefore.choices.find(({ minimum }) => minimum > 0);
  assert.ok(requiredChoice, `${ruleset} Human should expose required choices`);
  assert.deepEqual(
    applyBuilderRuleSelection(document, catalog, requiredChoice.key, ["not-an-option"]),
    document,
    "unavailable rule choices must be rejected",
  );
  document = completeVisibleChoices(document, "species");
  assert.equal(document.build.speciesId, ids.human);
  assert.equal(characterBuilderStepStates(document, {
    evaluation: builderStepEvaluation(document, catalog, "species").evaluation,
    catalog,
  }).species, "complete");

  const backgroundIds = builderRootEntries(catalog, document, "background").map(({ id }) => id);
  assert.ok(backgroundIds.includes(ids.sage) && backgroundIds.includes(ids.soldier));
}

const manualCatalog = [{
  id: "manual-class",
  name: "Manual Class",
  type: "Class",
  category: "classes",
  ruleset: "5e",
  publisher: "Homebrew",
  publication: "Local",
  automation: { status: "manual" },
}];
let manualDocument = createCharacterBuildDraft({ draftId: "manual-choice" }).document;
manualDocument = applyBuilderRootSelection(manualDocument, manualCatalog, "class", "manual-class");
assert.equal(manualDocument.build.levels[0].classId, "manual-class", "manual content remains selectable");
assert.equal(characterBuilderStepStates(manualDocument, {
  evaluation: builderStepEvaluation(manualDocument, manualCatalog, "class").evaluation,
  catalog: manualCatalog,
}).class, "warning", "manual content is visibly non-blocking");

console.log("Character Builder Class, Background, Species/Race, and rule-choice model tests passed.");
