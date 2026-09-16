// Verifies Character Builder step states, navigation, resume selection, and new draft defaults.
import assert from "node:assert/strict";
import {
  CHARACTER_BUILDER_STEPS,
  adjacentCharacterBuilderStep,
  characterBuilderStepStates,
  createCharacterBuildDraft,
  latestCharacterBuildDraft,
  normalizedCharacterBuilderStep,
  resumeCharacterBuilderStep,
} from "../js/builder/model.js";

assert.deepEqual(CHARACTER_BUILDER_STEPS.map(({ id }) => id), [
  "home", "class", "background", "species", "abilities", "equipment", "description", "review",
]);

const created = createCharacterBuildDraft({
  draftId: "draft-model",
  now: "2026-09-14T08:00:00.000Z",
});
assert.equal(created.document.characterSchemaVersion, 2);
assert.equal(created.document.build.mode, "rules");
assert.equal(created.document.build.ruleset, "5e");
assert.equal(created.currentStep, "home");
assert.equal(created.sync.state, "pending");
assert.throws(() => createCharacterBuildDraft({ draftId: "bad_id" }), /ID is invalid/);

const initialStates = characterBuilderStepStates(created.document);
assert.deepEqual(initialStates, {
  home: "complete",
  class: "incomplete",
  background: "incomplete",
  species: "incomplete",
  abilities: "incomplete",
  equipment: "warning",
  description: "warning",
  review: "blocked",
});
assert.equal(resumeCharacterBuilderStep(created), "class", "A complete current step resumes at the first incomplete required step.");

const classDraft = { ...created, currentStep: "class" };
assert.equal(resumeCharacterBuilderStep(classDraft), "class", "An incomplete current step remains the resume point.");
assert.equal(adjacentCharacterBuilderStep("class", 1), "background");
assert.equal(adjacentCharacterBuilderStep("class", -1), "home");
assert.equal(adjacentCharacterBuilderStep("home", -1), "home");
assert.equal(adjacentCharacterBuilderStep("review", 1), "review");
assert.equal(normalizedCharacterBuilderStep("unknown"), "home");

const completeDocument = structuredClone(created.document);
completeDocument.build.levels = [{ classId: "class-fighter", level: 1 }];
completeDocument.build.backgroundId = "background-soldier";
completeDocument.build.speciesId = "race-human";
completeDocument.build.abilityScores.base = { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 };
completeDocument.build.inventory = [{ instanceId: "sword-1", definitionId: "longsword", quantity: 1 }];
completeDocument.build.description = { appearance: "Travel-worn armor." };
completeDocument.build.status = "complete";
assert.deepEqual(characterBuilderStepStates(completeDocument), {
  home: "complete",
  class: "complete",
  background: "complete",
  species: "complete",
  abilities: "complete",
  equipment: "complete",
  description: "complete",
  review: "complete",
});
assert.equal(resumeCharacterBuilderStep({ ...created, currentStep: "home", document: completeDocument }), "review");

const older = { ...classDraft, draftId: "draft-older", updatedAt: "2026-09-14T08:01:00.000Z" };
const newer = { ...classDraft, draftId: "draft-newer", updatedAt: "2026-09-14T08:02:00.000Z", sync: { state: "failed" } };
assert.equal(latestCharacterBuildDraft({ older, newer }).draftId, "draft-newer");
assert.equal(latestCharacterBuildDraft({ removed: { ...newer, pendingDelete: true } }), null);
assert.equal(latestCharacterBuildDraft({ manual: { ...newer, document: { build: { mode: "manual" } } } }), null);
assert.deepEqual(created.document.build.levels, [], "Progress derivation must not mutate the draft document.");

console.log("Character Builder shell model tests passed.");
