// Produces the final structural review and materialized legacy projection.
import { normalizeCharacterDocument } from "../model.js";
import { evaluateCharacter } from "../rules/engine.js";
import { evaluateCharacterBuild } from "../rules/evaluator.js";
import { abilityScoreValidation } from "./ability-model.js";
import { descriptionLegacyProjection, descriptionStepValidation } from "./description-model.js";
import { equipmentStepValidation } from "./equipment-model.js";
import { characterBuilderStepStates } from "./model.js";
import { builderSpellState } from "./spell-model.js";

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function uniqueWarnings(warnings) {
  const seen = new Set();
  return warnings.filter((warning) => {
    const key = [warning.code, warning.path, warning.entryId, warning.sourceId, warning.message].join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const STEP_IMPACTS = Object.freeze({
  home: "Edition-specific rules and source filtering may be incomplete.",
  class: "Level, hit points, hit dice, attacks, class/subclass features, resources, and spellcasting may be missing or incorrect.",
  background: "Skills, proficiencies, languages, feats, features, and starting equipment may be missing.",
  species: "Speed, senses, languages, proficiencies, traits, and granted abilities may be missing.",
  abilities: "Modifiers, saves, skills, initiative, hit points, Armor Class, attacks, and spell values may be incorrect.",
  equipment: "Armor Class, attacks, damage, weight, encumbrance, and item modifiers may be incomplete.",
  spells: "Known, prepared, spellbook, granted spells, and spell actions may be incomplete.",
});

function pendingImpact(issue) {
  const path = String(issue.path || "");
  const step = path.startsWith("build.spells") ? "spells"
    : path.startsWith("build.inventory") ? "equipment"
      : path.split(".")[1];
  return STEP_IMPACTS[step] || "Some automatic values or important features may be missing until this choice is completed.";
}

function asPending(issue) {
  return { ...issue, impact: pendingImpact(issue) };
}

export function reviewCharacterBuild(value, entries = []) {
  const document = normalizeCharacterDocument(value);
  const evaluation = evaluateCharacterBuild({ character: document, catalog: entries });
  const result = evaluateCharacter({ character: document, catalog: entries });
  const abilityValidation = abilityScoreValidation(document);
  const equipmentValidation = equipmentStepValidation(document, entries);
  const descriptionValidation = descriptionStepValidation(document);
  const spellValidation = builderSpellState(document, entries);
  const states = characterBuilderStepStates(document, {
    evaluation,
    catalog: entries,
    abilityValidation,
    equipmentValidation,
    descriptionValidation,
    spellValidation,
  });
  const requiredSteps = ["home", "class", "background", "species", "abilities"];
  const structural = requiredSteps
    .filter((step) => !["complete", "warning"].includes(states[step]))
    .map((step) => ({ code: "required-step", path: `build.${step}`, blocking: true, message: `${step[0].toUpperCase()}${step.slice(1)} has unresolved required choices.` }));
  const hardBlockers = descriptionValidation.errors.map((message) => ({
    code: "invalid-character-identity", path: "build.description", blocking: true, message,
  }));
  const validationWarnings = [
    ...abilityValidation.errors.map((message) => ({ code: "invalid-ability-scores", path: "build.abilityScores", blocking: true, message })),
    ...equipmentValidation.errors.map((message) => ({ code: "invalid-equipment", path: "build.inventory", blocking: true, message })),
    ...spellValidation.errors.map((message) => ({ code: "incomplete-spell-repertoire", path: "build.spells", blocking: true, message })),
  ];
  const ruleNotices = evaluation.activeEntries.flatMap((active) => {
    const entry = entries.find((candidate) => candidate.id === active.id);
    return Array.isArray(entry?.rules?.warnings) ? entry.rules.warnings : [];
  });
  const warnings = uniqueWarnings([...result.warnings, ...ruleNotices, ...validationWarnings]);
  const automationWarnings = warnings.filter(({ code }) => ["partial-automation", "manual-automation"].includes(code));
  const pending = uniqueWarnings([...structural, ...warnings.filter(({ blocking }) => blocking), ...automationWarnings]).map(asPending);
  const blockers = uniqueWarnings(hardBlockers);
  const notices = warnings.filter(({ blocking, code }) => !blocking && !["partial-automation", "manual-automation"].includes(code));
  const overrides = Object.entries(document.build.overrides).map(([path, override]) => ({ path, value: override.value, reason: text(override.reason) }));
  return {
    document,
    sheet: result.sheet,
    trace: result.trace,
    states,
    blockers,
    pending,
    notices,
    overrides,
    summary: {
      class: result.sheet.class || "—",
      subclass: result.sheet.subclass || "—",
      species: result.sheet.race || "—",
      background: result.sheet.background || "—",
      level: result.sheet.level || 0,
      inventory: document.build.inventory.length,
      spells: document.build.spells.knownIds.length + document.build.spells.spellbookIds.length,
    },
    canFinish: blockers.length === 0,
    requiresConfirmation: pending.length > 0,
  };
}

export function prepareCharacterBuildFinalization(value, entries = [], { confirmIncomplete = false } = {}) {
  const review = reviewCharacterBuild(value, entries);
  if (!review.canFinish) return { ...review, finalized: false, document: review.document };
  if (review.requiresConfirmation && !confirmIncomplete) {
    return { ...review, confirmationRequired: true, finalized: false, document: review.document };
  }
  const source = review.document;
  const completionWarnings = review.pending.map(({ code, path, message, impact }) => ({ code, path, message, impact }));
  const build = {
    ...source.build,
    status: completionWarnings.length ? "incomplete" : "complete",
  };
  if (completionWarnings.length) build.completionWarnings = completionWarnings;
  else delete build.completionWarnings;
  const next = normalizeCharacterDocument({
    ...source,
    ...review.sheet,
    ...descriptionLegacyProjection(source),
    id: source.id,
    name: source.name,
    status: source.status || "Active",
    build,
  });
  return { ...review, finalized: true, document: next };
}
