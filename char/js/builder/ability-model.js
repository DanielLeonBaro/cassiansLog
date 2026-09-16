// Owns Character Builder ability methods and method-specific validation.
import { normalizeCharacterDocument } from "../model.js";

export const BUILDER_ABILITIES = Object.freeze([
  Object.freeze({ id: "str", label: "Strength" }),
  Object.freeze({ id: "dex", label: "Dexterity" }),
  Object.freeze({ id: "con", label: "Constitution" }),
  Object.freeze({ id: "int", label: "Intelligence" }),
  Object.freeze({ id: "wis", label: "Wisdom" }),
  Object.freeze({ id: "cha", label: "Charisma" }),
]);
export const STANDARD_ARRAY = Object.freeze([15, 14, 13, 12, 10, 8]);
export const POINT_BUY_BUDGET = 27;
const POINT_BUY_COST = Object.freeze({ 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 });
const methods = new Set(["standard", "point-buy", "manual", "rolled"]);

function integer(value) {
  if (value === "" || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isInteger(number) ? number : null;
}

function baseValues(document) {
  return BUILDER_ABILITIES.map(({ id }) => integer(document.build.abilityScores.base[id]));
}

export function abilityScoreValidation(value) {
  const document = normalizeCharacterDocument(value);
  const method = document.build.abilityScores.method;
  const scores = baseValues(document);
  const errors = [];
  if (scores.some((score) => score === null)) errors.push("Assign all six ability scores.");
  let spent = 0;
  if (!errors.length && method === "standard") {
    const sorted = [...scores].sort((left, right) => right - left);
    if (sorted.some((score, index) => score !== STANDARD_ARRAY[index])) errors.push("Use each standard-array score exactly once.");
  }
  if (!errors.length && method === "point-buy") {
    if (scores.some((score) => !Object.hasOwn(POINT_BUY_COST, score))) errors.push("Point-buy scores must be between 8 and 15.");
    else {
      spent = scores.reduce((sum, score) => sum + POINT_BUY_COST[score], 0);
      if (spent > POINT_BUY_BUDGET) errors.push(`Point buy exceeds ${POINT_BUY_BUDGET} points.`);
    }
  }
  if (!errors.length && method === "manual" && scores.some((score) => score < 1 || score > 30)) {
    errors.push("Manual scores must be whole numbers from 1 to 30.");
  }
  if (!errors.length && method === "rolled" && scores.some((score) => score < 3 || score > 18)) {
    errors.push("Rolled scores must be whole numbers from 3 to 18.");
  }
  const remaining = method === "point-buy" && !errors.length ? POINT_BUY_BUDGET - spent : null;
  return {
    method,
    scores: Object.fromEntries(BUILDER_ABILITIES.map(({ id }, index) => [id, scores[index]])),
    spent,
    remaining,
    errors,
    complete: !errors.length,
    status: errors.length ? "incomplete" : remaining > 0 ? "warning" : "complete",
  };
}

function defaultsForMethod(method, current) {
  const scores = Object.values(current);
  if (method === "standard") {
    return scores.length === 6
      && [...scores].sort((left, right) => right - left).every((score, index) => score === STANDARD_ARRAY[index])
      ? current
      : Object.fromEntries(BUILDER_ABILITIES.map(({ id }, index) => [id, STANDARD_ARRAY[index]]));
  }
  if (method === "point-buy") {
    const valid = scores.length === 6 && scores.every((score) => Object.hasOwn(POINT_BUY_COST, integer(score)))
      && scores.reduce((sum, score) => sum + POINT_BUY_COST[integer(score)], 0) <= POINT_BUY_BUDGET;
    return valid ? current : Object.fromEntries(BUILDER_ABILITIES.map(({ id }) => [id, 8]));
  }
  const [minimum, maximum] = method === "rolled" ? [3, 18] : [1, 30];
  return Object.fromEntries(BUILDER_ABILITIES.map(({ id }) => {
    const score = integer(current[id]);
    return [id, score !== null && score >= minimum && score <= maximum ? score : 10];
  }));
}

export function applyBuilderAbilityMethod(value, method) {
  const document = normalizeCharacterDocument(value);
  if (!methods.has(method)) return document;
  document.build.abilityScores.method = method;
  document.build.abilityScores.base = defaultsForMethod(method, document.build.abilityScores.base);
  document.build.abilityScores.rolls = method === "rolled"
    ? BUILDER_ABILITIES.map(({ id }) => document.build.abilityScores.base[id])
    : [];
  document.build.status = "incomplete";
  return normalizeCharacterDocument(document);
}

export function applyBuilderAbilityScore(value, abilityId, score) {
  const document = normalizeCharacterDocument(value);
  if (!BUILDER_ABILITIES.some(({ id }) => id === abilityId)) return document;
  const nextScore = integer(score);
  if (nextScore === null) return document;
  const candidate = normalizeCharacterDocument(document);
  if (candidate.build.abilityScores.method === "standard") {
    if (!STANDARD_ARRAY.includes(nextScore)) return document;
    const previousScore = candidate.build.abilityScores.base[abilityId];
    const swap = BUILDER_ABILITIES.find(({ id }) => id !== abilityId && candidate.build.abilityScores.base[id] === nextScore);
    if (swap) candidate.build.abilityScores.base[swap.id] = previousScore;
  }
  candidate.build.abilityScores.base[abilityId] = nextScore;
  const validation = abilityScoreValidation(candidate);
  if (validation.errors.some((error) => error.startsWith("Point buy exceeds")
    || error.startsWith("Point-buy scores")
    || error.startsWith("Manual scores")
    || error.startsWith("Rolled scores"))) return document;
  if (candidate.build.abilityScores.method === "rolled") {
    candidate.build.abilityScores.rolls = BUILDER_ABILITIES.map(({ id }) => candidate.build.abilityScores.base[id]);
  }
  candidate.build.status = "incomplete";
  return normalizeCharacterDocument(candidate);
}

export function rollBuilderAbilityScores(value, random = Math.random) {
  const document = applyBuilderAbilityMethod(value, "rolled");
  const rolls = BUILDER_ABILITIES.map(() => {
    const dice = Array.from({ length: 4 }, () => Math.floor(Math.max(0, Math.min(0.999999, Number(random()) || 0)) * 6) + 1);
    dice.sort((left, right) => left - right);
    return dice.slice(1).reduce((sum, die) => sum + die, 0);
  });
  document.build.abilityScores.base = Object.fromEntries(BUILDER_ABILITIES.map(({ id }, index) => [id, rolls[index]]));
  document.build.abilityScores.rolls = rolls;
  document.build.status = "incomplete";
  return normalizeCharacterDocument(document);
}
