// Owns Character Builder step order, progress states, resume behavior, and new draft shape.
import { normalizeCharacterDocument } from "../model.js";

export const CHARACTER_BUILDER_STEPS = Object.freeze([
  Object.freeze({ id: "home", label: "Home", required: true }),
  Object.freeze({ id: "class", label: "Class", required: true }),
  Object.freeze({ id: "background", label: "Background", required: true }),
  Object.freeze({ id: "species", label: "Species/Race", required: true }),
  Object.freeze({ id: "abilities", label: "Abilities", required: true }),
  Object.freeze({ id: "equipment", label: "Equipment", required: false }),
  Object.freeze({ id: "description", label: "Description", required: true }),
  Object.freeze({ id: "review", label: "Review", required: true }),
]);

export const CHARACTER_BUILDER_STEP_STATES = Object.freeze(["complete", "incomplete", "warning", "blocked"]);

const stepIds = new Set(CHARACTER_BUILDER_STEPS.map(({ id }) => id));
const abilities = ["str", "dex", "con", "int", "wis", "cha"];

function hasText(value) {
  return typeof value === "string" && Boolean(value.trim());
}

function hasDescription(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.values(value).some((candidate) => (
    hasText(candidate) || (Array.isArray(candidate) && candidate.length > 0)
  ));
}

function evaluatedRootState(step, complete, build, evaluation, catalog) {
  if (!complete || !evaluation) return complete ? "complete" : "incomplete";
  const rootIds = new Set(step === "class"
    ? build.levels.flatMap(({ classId, subclassId }) => [classId, subclassId]).filter(Boolean)
    : [step === "species" ? build.speciesId : build.backgroundId].filter(Boolean));
  const rootPath = step === "class" ? "build.levels." : `build.${step === "species" ? "speciesId" : "backgroundId"}`;
  const choices = evaluation.choices.filter(({ sourceId }) => rootIds.has(sourceId));
  const choiceKeys = new Set(choices.map(({ key }) => key));
  if (choices.some(({ status }) => status === "invalid")) return "blocked";
  if (choices.some(({ status }) => status === "incomplete")) return "incomplete";
  const warnings = evaluation.warnings.filter((warning) => (
    String(warning.path || "").startsWith(rootPath)
      || rootIds.has(warning.entryId)
      || rootIds.has(warning.sourceId)
      || choiceKeys.has(warning.choiceKey)
  ));
  const blocking = warnings.find(({ blocking }) => blocking);
  if (blocking) return ["selection-required", "subclass-required"].includes(blocking.code) ? "incomplete" : "blocked";
  const entries = Array.isArray(catalog) ? catalog : [];
  const hasRuleNotice = entries.some((entry) => rootIds.has(entry.id) && entry.rules?.warnings?.length);
  return warnings.length || hasRuleNotice ? "warning" : "complete";
}

export function characterBuilderStepStates(value, {
  evaluation = null,
  catalog = [],
  abilityValidation = null,
  equipmentValidation = null,
  descriptionValidation = null,
  spellValidation = null,
} = {}) {
  const document = normalizeCharacterDocument(value);
  const build = document.build;
  const required = {
    home: build.mode === "rules" && ["5e", "5.5e"].includes(build.ruleset),
    class: build.levels.some(({ classId, level }) => hasText(classId) && level >= 1),
    background: hasText(build.backgroundId),
    species: hasText(build.speciesId),
    abilities: abilities.every((ability) => Number.isFinite(Number(build.abilityScores.base[ability]))),
  };
  const rootStates = {
    class: evaluatedRootState("class", required.class, build, evaluation, catalog),
    background: evaluatedRootState("background", required.background, build, evaluation, catalog),
    species: evaluatedRootState("species", required.species, build, evaluation, catalog),
  };
  if (["complete", "warning"].includes(rootStates.class) && spellValidation) {
    if (!spellValidation.complete) rootStates.class = "incomplete";
    else if (spellValidation.warnings?.length) rootStates.class = "warning";
  }
  const abilityState = abilityValidation?.status || (required.abilities ? "complete" : "incomplete");
  const equipmentState = equipmentValidation?.status || (build.inventory.length ? "complete" : "warning");
  const descriptionState = descriptionValidation?.status || (hasDescription(build.description) ? "complete" : "warning");
  const structureComplete = required.home
    && ["complete", "warning"].includes(abilityState)
    && ["complete", "warning"].includes(descriptionState)
    && Object.values(rootStates).every((state) => ["complete", "warning"].includes(state));

  return {
    home: required.home ? "complete" : "incomplete",
    ...rootStates,
    abilities: abilityState,
    equipment: equipmentState,
    description: descriptionState,
    review: !structureComplete ? "blocked" : build.status === "complete" ? "complete" : "incomplete",
  };
}

export function normalizedCharacterBuilderStep(value, fallback = "home") {
  const step = String(value || "").trim();
  return stepIds.has(step) ? step : fallback;
}

export function resumeCharacterBuilderStep(draft, options = {}) {
  const states = characterBuilderStepStates(draft?.document, options);
  const current = normalizedCharacterBuilderStep(draft?.currentStep);
  if (states[current] !== "complete") return current;
  return CHARACTER_BUILDER_STEPS.find(({ id, required }) => required && states[id] === "incomplete")?.id
    || CHARACTER_BUILDER_STEPS.find(({ id }) => states[id] !== "complete")?.id
    || "review";
}

export function adjacentCharacterBuilderStep(currentStep, direction) {
  const index = CHARACTER_BUILDER_STEPS.findIndex(({ id }) => id === normalizedCharacterBuilderStep(currentStep));
  const nextIndex = Math.max(0, Math.min(CHARACTER_BUILDER_STEPS.length - 1, index + Math.sign(Number(direction) || 0)));
  return CHARACTER_BUILDER_STEPS[nextIndex].id;
}

export function latestCharacterBuildDraft(drafts) {
  const candidates = Object.values(drafts && typeof drafts === "object" ? drafts : {})
    .filter((draft) => draft?.document?.build?.mode === "rules" && !draft.pendingDelete);
  return candidates.sort((left, right) => (
    String(right.updatedAt || right.createdAt || "").localeCompare(String(left.updatedAt || left.createdAt || ""))
      || String(left.draftId || "").localeCompare(String(right.draftId || ""))
  ))[0] || null;
}

export function createCharacterBuildDraft({
  draftId,
  now = new Date().toISOString(),
  ruleset = "5e",
} = {}) {
  const id = String(draftId || "").trim();
  if (!/^[a-z0-9][a-z0-9-]{0,127}$/i.test(id)) throw new TypeError("Character build draft ID is invalid.");
  return {
    draftId: id,
    currentStep: "home",
    createdAt: now,
    updatedAt: now,
    sync: { state: "pending", error: "" },
    document: normalizeCharacterDocument({
      id: "",
      name: "",
      status: "Draft",
      build: {
        mode: "rules",
        status: "incomplete",
        ruleset,
        preferences: {},
        levels: [],
        speciesId: "",
        backgroundId: "",
        abilityScores: { method: "standard", base: {} },
        selections: {},
        spells: { knownIds: [], spellbookIds: [] },
        inventory: [],
        description: {},
        overrides: {},
      },
    }),
  };
}
