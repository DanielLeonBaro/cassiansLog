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
  applyBuilderClassLevel,
  applyBuilderRootSelection,
  applyBuilderRuleSelection,
  builderRootEntries,
  builderStepEvaluation,
} from "../js/builder/choice-model.js";
import { applyBuilderDescription, descriptionStepValidation } from "../js/builder/description-model.js";
import {
  addBuilderInventoryItem,
  applyBuilderCurrency,
  applyBuilderEquipmentMethod,
  builderEquipmentEntries,
  builderInventoryContainers,
  equipmentStepValidation,
  removeBuilderInventoryItem,
  updateBuilderInventoryContainer,
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

for (const ruleset of ["5e", "5.5e"]) {
  const seed = createCharacterBuildDraft({ draftId: `level-20-${ruleset.replace(".", "-")}`, ruleset }).document;
  const classes = builderRootEntries(catalog, seed, "class");
  assert.ok(classes.length > 0, `${ruleset} should expose classes`);
  classes.forEach((classEntry, index) => {
    const isolatedCatalog = [classEntry];
    let levelTwenty = applyBuilderRootSelection(seed, isolatedCatalog, "class", classEntry.id);
    levelTwenty = applyBuilderClassLevel(levelTwenty, isolatedCatalog, 20);
    levelTwenty = applyBuilderDescription(levelTwenty, {
      name: `Level 20 ${classEntry.name || classEntry.id}`,
      id: `level-20-${ruleset.replace(".", "-")}-${index}`,
    });
    assert.equal(levelTwenty.build.levels[0].level, 20, `${classEntry.name || classEntry.id} should reach level 20`);
    const review = reviewCharacterBuild(levelTwenty, isolatedCatalog);
    assert.equal(review.canFinish, true, `${classEntry.name || classEntry.id} level 20 should remain finishable`);
    if (classEntry.automation?.status !== "rules-ready") {
      assert.ok(review.pending.some(({ entryId, message }) => entryId === classEntry.id && message.includes("Missing automation:")), `${classEntry.name || classEntry.id} should name missing automation`);
    }
    assert.equal(prepareCharacterBuildFinalization(levelTwenty, isolatedCatalog, { confirmIncomplete: true }).finalized, true, `${classEntry.name || classEntry.id} level 20 should finalize after warning confirmation`);
  });
}

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
const containerItem = {
  ...manualItem,
  id: "manual-pack",
  name: "Manual Pack",
  add: { target: "inventory", value: { name: "Manual Pack" } },
  rules: { inventory: { container: { capacityWeight: 30 } } },
};
let equipmentDocument = createCharacterBuildDraft({ draftId: "equipment-methods" }).document;
assert.equal(builderEquipmentEntries([manualItem], equipmentDocument)[0].id, "manual-sword", "manual items remain selectable");
equipmentDocument = addBuilderInventoryItem(equipmentDocument, [manualItem, containerItem], "manual-sword", 2, () => "item-one");
assert.deepEqual(equipmentDocument.build.inventory[0], { instanceId: "item-one", definitionId: "manual-sword", quantity: 2, containerId: "" });
equipmentDocument = addBuilderInventoryItem(equipmentDocument, [manualItem, containerItem], "manual-pack", 1, () => "pack-one");
equipmentDocument = addBuilderInventoryItem(equipmentDocument, [manualItem, containerItem], "manual-pack", 1, () => "pack-two");
assert.deepEqual(builderInventoryContainers(equipmentDocument, [manualItem, containerItem], "item-one").map(({ instanceId }) => instanceId), ["pack-one", "pack-two"]);
equipmentDocument = updateBuilderInventoryContainer(equipmentDocument, [manualItem, containerItem], "item-one", "pack-one");
equipmentDocument = updateBuilderInventoryContainer(equipmentDocument, [manualItem, containerItem], "pack-two", "pack-one");
const cycleSnapshot = structuredClone(equipmentDocument);
assert.deepEqual(updateBuilderInventoryContainer(equipmentDocument, [manualItem, containerItem], "pack-one", "pack-two"), cycleSnapshot, "container cycles are rejected");
equipmentDocument = updateBuilderInventoryQuantity(equipmentDocument, "item-one", 3);
assert.equal(equipmentDocument.build.inventory[0].quantity, 3);
equipmentDocument = applyBuilderEquipmentMethod(equipmentDocument, "gold");
equipmentDocument = applyBuilderCurrency(equipmentDocument, "gp", 125);
assert.equal(equipmentStepValidation(equipmentDocument, [manualItem, containerItem]).complete, true);
assert.equal(equipmentDocument.build.inventory.length, 3, "switching methods preserves prior work");
equipmentDocument = removeBuilderInventoryItem(equipmentDocument, "pack-one");
assert.equal(equipmentDocument.build.inventory.find(({ instanceId }) => instanceId === "item-one").containerId, "", "removing a container detaches its contents");
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
assert.ok(review.pending.some(({ code }) => code === "manual-automation"), "manual spell automation requires visible incomplete-finish confirmation");
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

let warlock = firstSliceDocument({
  ruleset: "5e",
  classId: "phbClassWarlock",
  backgroundId: "phbBackgroundSage",
  speciesId: "phbRaceHuman",
  automation: "",
});
let warlockSpells = builderSpellState(warlock, catalog);
const warlockProfile = warlockSpells.profiles[0];
assert.ok(warlockProfile.knownLimit > 0, "Warlock fixture should expose a known-spell limit");
assert.ok(warlockProfile.errors.some((error) => error.includes("known spells")), "missing known spells should remain actionable");
const rejectedOverLimit = applyBuilderSpellSelection(warlock, catalog, warlockProfile.id, "levelled", warlockProfile.levelled.slice(0, warlockProfile.knownLimit + 1).map(({ id }) => id));
assert.deepEqual(rejectedOverLimit.build.spells, warlock.build.spells, "known-spell over-selection is rejected");
warlock = applyBuilderSpellSelection(warlock, catalog, warlockProfile.id, "levelled", warlockProfile.levelled.slice(0, warlockProfile.knownLimit).map(({ id }) => id));
warlockSpells = builderSpellState(warlock, catalog);
assert.equal(warlockSpells.profiles[0].selectedLevelledIds.length, warlockProfile.knownLimit);

const blocked = structuredClone(finishDocument);
blocked.name = "";
blocked.id = "bad id";
assert.equal(prepareCharacterBuildFinalization(blocked, catalog).finalized, false);

let incomplete = createCharacterBuildDraft({ draftId: "finish-incomplete" }).document;
incomplete = applyBuilderDescription(incomplete, { name: "Unfinished Hero" });
const incompleteSnapshot = structuredClone(incomplete);
review = reviewCharacterBuild(incomplete, catalog);
assert.equal(review.canFinish, true, "Valid identity permits Finish even when rule sections are pending.");
assert.equal(review.requiresConfirmation, true);
assert.ok(review.pending.some(({ path, impact }) => path === "build.class" && /hit points/i.test(impact)));
assert.ok(review.pending.some(({ path, impact }) => path === "build.abilities" && /Armor Class/i.test(impact)));
const confirmation = prepareCharacterBuildFinalization(incomplete, catalog);
assert.equal(confirmation.finalized, false);
assert.equal(confirmation.confirmationRequired, true);
assert.deepEqual(incomplete, incompleteSnapshot, "Opening or cancelling confirmation must not mutate the draft.");
const incompleteFinalization = prepareCharacterBuildFinalization(incomplete, catalog, { confirmIncomplete: true });
assert.equal(incompleteFinalization.finalized, true);
assert.equal(incompleteFinalization.document.build.status, "incomplete");
assert.ok(incompleteFinalization.document.build.completionWarnings.every(({ message, impact }) => message && impact));

const completedAfterResume = structuredClone(finishDocument);
completedAfterResume.build.completionWarnings = incompleteFinalization.document.build.completionWarnings;
const completedFinalization = prepareCharacterBuildFinalization(completedAfterResume, catalog);
assert.equal(completedFinalization.document.build.status, "complete");
assert.equal(Object.hasOwn(completedFinalization.document.build, "completionWarnings"), false, "Resolved warnings clear after completing the build.");

console.log("Character Builder completion models passed all methods, spell repertoire, review, and materialization.");
