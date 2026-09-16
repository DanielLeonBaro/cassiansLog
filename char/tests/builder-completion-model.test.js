// Verifies Task 16 ability, equipment, spell, description, review, and finish models.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { applyRulesMetadata } from "../../compendium/js/api.js";
import {
  abilityScoreValidation,
  applyBuilderAbilityMethod,
  applyBuilderAbilityScore,
  rollBuilderAbilityScores,
} from "../js/builder/ability-model.js";
import {
  applyBuilderRootSelection,
  applyBuilderRuleSelection,
  builderStepEvaluation,
} from "../js/builder/choice-model.js";
import { applyBuilderDescription, descriptionStepValidation } from "../js/builder/description-model.js";
import {
  addBuilderInventoryItem,
  applyBuilderCurrency,
  applyBuilderEquipmentMethod,
  builderEquipmentEntries,
  equipmentStepValidation,
  removeBuilderInventoryItem,
  updateBuilderInventoryQuantity,
} from "../js/builder/equipment-model.js";
import { applyBuilderHomePreferences } from "../js/builder/home-model.js";
import { characterBuilderStepStates, createCharacterBuildDraft } from "../js/builder/model.js";
import { prepareCharacterBuildFinalization, reviewCharacterBuild } from "../js/builder/review-model.js";
import { applyBuilderSpellSelection, builderSpellState } from "../js/builder/spell-model.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const dataRoot = path.resolve(here, "../../compendium/data");
const index = JSON.parse(fs.readFileSync(path.join(dataRoot, "index.json"), "utf8"));
const metadata = JSON.parse(fs.readFileSync(path.join(dataRoot, "rules-metadata.json"), "utf8")).entries;
const catalog = applyRulesMetadata(index.entries, metadata);

let abilityDocument = createCharacterBuildDraft({ draftId: "ability-methods" }).document;
assert.equal(abilityScoreValidation(abilityDocument).complete, false);
abilityDocument = applyBuilderAbilityMethod(abilityDocument, "standard");
assert.deepEqual(abilityDocument.build.abilityScores.base, { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 });
abilityDocument = applyBuilderAbilityScore(abilityDocument, "str", 14);
assert.deepEqual([abilityDocument.build.abilityScores.base.str, abilityDocument.build.abilityScores.base.dex], [14, 15], "standard-array edits swap used scores");
assert.equal(abilityScoreValidation(abilityDocument).complete, true);

abilityDocument = createCharacterBuildDraft({ draftId: "point-buy-method" }).document;
abilityDocument = applyBuilderAbilityMethod(abilityDocument, "point-buy");
assert.equal(abilityScoreValidation(abilityDocument).remaining, 27);
for (const ability of ["str", "dex", "con"]) abilityDocument = applyBuilderAbilityScore(abilityDocument, ability, 15);
assert.equal(abilityScoreValidation(abilityDocument).remaining, 0);
const pointBuySnapshot = structuredClone(abilityDocument);
assert.deepEqual(applyBuilderAbilityScore(abilityDocument, "int", 15), pointBuySnapshot, "point-buy overspend is rejected");

abilityDocument = applyBuilderAbilityMethod(abilityDocument, "manual");
abilityDocument = applyBuilderAbilityScore(abilityDocument, "int", 20);
assert.equal(abilityDocument.build.abilityScores.base.int, 20);
assert.deepEqual(applyBuilderAbilityScore(abilityDocument, "int", 31), abilityDocument, "manual out-of-range score is rejected");
abilityDocument = rollBuilderAbilityScores(abilityDocument, () => 0);
assert.deepEqual(Object.values(abilityDocument.build.abilityScores.base), [3, 3, 3, 3, 3, 3]);
assert.deepEqual(abilityDocument.build.abilityScores.rolls, [3, 3, 3, 3, 3, 3]);
abilityDocument = rollBuilderAbilityScores(abilityDocument, () => 0.999999);
assert.deepEqual(Object.values(abilityDocument.build.abilityScores.base), [18, 18, 18, 18, 18, 18]);
const malformedRolled = structuredClone(abilityDocument);
malformedRolled.build.abilityScores.base.str = 19;
assert.match(abilityScoreValidation(malformedRolled).errors[0], /3 to 18/);

const manualItem = {
  id: "manual-sword",
  name: "Manual Sword",
  type: "Weapon",
  category: "items",
  ruleset: "5e",
  publisher: "Homebrew",
  publication: "Local Equipment",
  source: "Local Equipment",
  automation: { status: "manual" },
  add: { target: "inventory", value: { name: "Manual Sword" } },
};
let equipmentDocument = createCharacterBuildDraft({ draftId: "equipment-methods" }).document;
assert.equal(builderEquipmentEntries([manualItem], equipmentDocument)[0].id, "manual-sword", "manual items remain selectable");
equipmentDocument = addBuilderInventoryItem(equipmentDocument, [manualItem], "manual-sword", 2, () => "item-one");
assert.deepEqual(equipmentDocument.build.inventory[0], { instanceId: "item-one", definitionId: "manual-sword", quantity: 2, containerId: "" });
equipmentDocument = updateBuilderInventoryQuantity(equipmentDocument, "item-one", 3);
assert.equal(equipmentDocument.build.inventory[0].quantity, 3);
equipmentDocument = applyBuilderEquipmentMethod(equipmentDocument, "gold");
equipmentDocument = applyBuilderCurrency(equipmentDocument, "gp", 125);
assert.equal(equipmentStepValidation(equipmentDocument, [manualItem]).complete, true);
assert.equal(equipmentDocument.build.inventory.length, 1, "switching methods preserves prior work");
equipmentDocument = removeBuilderInventoryItem(equipmentDocument, "item-one");
assert.equal(equipmentDocument.build.inventory.length, 0);
assert.equal(equipmentDocument.build.currency.gp, 125);

function completeChoices(document, step) {
  let next = document;
  for (let guard = 0; guard < 20; guard += 1) {
    const pending = builderStepEvaluation(next, catalog, step).choices.find(({ status }) => status === "incomplete");
    if (!pending) return next;
    next = applyBuilderRuleSelection(next, catalog, pending.key,
      pending.options.filter(({ available }) => available).slice(0, pending.minimum).map(({ id }) => id));
  }
  throw new Error(`${step} choices did not converge.`);
}

function firstSliceDocument({ ruleset, classId, backgroundId, speciesId, automation = "rules-ready" }) {
  let document = createCharacterBuildDraft({ draftId: `finish-${ruleset.replace(".", "-")}-${classId}`, ruleset }).document;
  document = applyBuilderHomePreferences(document, { publisher: "Wizards of the Coast", automation }, catalog);
  document = applyBuilderRootSelection(document, catalog, "class", classId);
  document = completeChoices(document, "class");
  document = applyBuilderRootSelection(document, catalog, "background", backgroundId);
  document = completeChoices(document, "background");
  document = applyBuilderRootSelection(document, catalog, "species", speciesId);
  document = completeChoices(document, "species");
  document = applyBuilderAbilityMethod(document, "standard");
  document = applyBuilderDescription(document, { name: "Task Sixteen Hero" });
  document = applyBuilderDescription(document, { status: "Active" });
  document = applyBuilderDescription(document, { field: "backstory", value: "Built from reviewed choices." });
  return document;
}

let finishDocument = firstSliceDocument({
  ruleset: "5.5e",
  classId: "phb24ClassFighter",
  backgroundId: "phb24BackgroundSoldier",
  speciesId: "phb24RaceHuman",
});
finishDocument = applyBuilderEquipmentMethod(finishDocument, "gold");
finishDocument = applyBuilderCurrency(finishDocument, "gp", 100);
assert.deepEqual(descriptionStepValidation(finishDocument), { errors: [], detailCount: 1, complete: true, status: "complete" });
let review = reviewCharacterBuild(finishDocument, catalog);
assert.equal(review.canFinish, true, review.blockers.map(({ message }) => message).join(" | "));
assert.equal(review.summary.class, "Fighter");
assert.equal(review.summary.species, "Human");
assert.equal(review.summary.background, "Soldier");
const finalized = prepareCharacterBuildFinalization(finishDocument, catalog);
assert.equal(finalized.finalized, true);
assert.equal(finalized.document.build.status, "complete");
assert.equal(finalized.document.id, "task-sixteen-hero");
assert.equal(finalized.document.class, "Fighter");
assert.equal(finalized.document.race, "Human");
assert.equal(finalized.document.background, "Soldier");
assert.equal(finalized.document.currency.gp, 100);
assert.equal(finalized.document.backstory, "Built from reviewed choices.");
assert.ok(finalized.document.stats.str.modifier >= 0, "finalization materializes automatic flat values");

let wizard = firstSliceDocument({
  ruleset: "5e",
  classId: "phbClassWizard",
  backgroundId: "phbBackgroundSage",
  speciesId: "phbRaceHuman",
  automation: "",
});
let spells = builderSpellState(wizard, catalog);
assert.equal(spells.profiles.length, 1);
assert.equal(spells.profiles[0].cantripLimit, 3);
assert.equal(spells.profiles[0].spellbookMinimum, 6);
assert.ok(spells.profiles[0].cantrips.length >= 3 && spells.profiles[0].levelled.length >= 6);
wizard = applyBuilderSpellSelection(wizard, catalog, "wizard", "cantrips", spells.profiles[0].cantrips.slice(0, 3).map(({ id }) => id));
spells = builderSpellState(wizard, catalog);
wizard = applyBuilderSpellSelection(wizard, catalog, "wizard", "levelled", spells.profiles[0].levelled.slice(0, 6).map(({ id }) => id));
spells = builderSpellState(wizard, catalog);
assert.equal(spells.complete, true);
assert.equal(wizard.build.spells.knownIds.length, 3);
assert.equal(wizard.build.spells.spellbookIds.length, 6);
assert.equal(Object.keys(wizard.build.spells.assignments).length, 9);
review = reviewCharacterBuild(wizard, catalog);
assert.equal(review.canFinish, true, review.blockers.map(({ message }) => message).join(" | "));
assert.ok(review.notices.some(({ code }) => code === "manual-automation"), "manual spell automation is visible but non-blocking");
const progress = characterBuilderStepStates(wizard, {
  evaluation: builderStepEvaluation(wizard, catalog, "class").evaluation,
  catalog,
  abilityValidation: abilityScoreValidation(wizard),
  equipmentValidation: equipmentStepValidation(wizard, catalog),
  descriptionValidation: descriptionStepValidation(wizard),
  spellValidation: spells,
});
assert.ok(["complete", "warning"].includes(progress.class));
assert.ok(["complete", "warning"].includes(progress.description));
assert.equal(progress.review, "incomplete");

const blocked = structuredClone(finishDocument);
blocked.name = "";
blocked.id = "bad id";
assert.equal(prepareCharacterBuildFinalization(blocked, catalog).finalized, false);

console.log("Character Builder completion models passed all methods, spell repertoire, review, and materialization.");
