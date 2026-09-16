// Owns versioned Character document normalization and legacy sheet projection.
import { cloneJSON } from "../../shared/js/text.js";

export const CHARACTER_SCHEMA_VERSION = 2;
export const CHARACTER_BUILD_VERSION = 1;
export const CHARACTER_RULESETS = Object.freeze(["5e", "5.5e"]);

const rulesets = new Set(CHARACTER_RULESETS);
const buildModes = new Set(["manual", "rules"]);
const buildStatuses = new Set(["incomplete", "complete"]);
const progressionModes = new Set(["xp", "milestone"]);
const hitPointModes = new Set(["fixed", "manual"]);
const encumbranceModes = new Set(["none", "standard", "variant"]);
const abilityMethods = new Set(["standard", "point-buy", "manual", "rolled"]);
const automationFilters = new Set(["", "rules-ready", "partial", "manual"]);
const equipmentMethods = new Set(["equipment", "gold"]);
const abilityIds = ["str", "dex", "con", "int", "wis", "cha"];
const currencyIds = ["cp", "sp", "ep", "gp", "pp"];

function isRecord(value) {
  return Object.prototype.toString.call(value) === "[object Object]";
}

function cloneRecord(value) {
  return isRecord(value) ? cloneJSON(value) : {};
}

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function selected(value, allowed, fallback) {
  return allowed.has(value) ? value : fallback;
}

function finiteNumber(value, fallback) {
  if (value === "" || value === null || value === undefined) return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function uniqueTextList(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(text).filter(Boolean))];
}

function normalizePreferences(value, mode) {
  const preferences = cloneRecord(value);
  const contentFilters = cloneRecord(preferences.contentFilters);
  return {
    ...preferences,
    progression: selected(preferences.progression, progressionModes, "xp"),
    hitPoints: selected(preferences.hitPoints, hitPointModes, mode === "rules" ? "fixed" : "manual"),
    encumbrance: selected(preferences.encumbrance, encumbranceModes, "standard"),
    coinWeight: preferences.coinWeight !== false,
    prerequisites: preferences.prerequisites !== false,
    enabledSources: uniqueTextList(preferences.enabledSources),
    contentFilters: {
      ...contentFilters,
      publisher: text(contentFilters.publisher),
      automation: selected(contentFilters.automation, automationFilters, ""),
    },
  };
}

function normalizeLevels(value) {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).map((candidate) => {
    const level = Math.trunc(finiteNumber(candidate.level, 1));
    return {
      ...cloneJSON(candidate),
      classId: text(candidate.classId),
      subclassId: text(candidate.subclassId),
      level: Math.max(1, Math.min(20, level)),
      hitPointRolls: Array.isArray(candidate.hitPointRolls)
        ? candidate.hitPointRolls
          .map((roll) => finiteNumber(roll, null))
          .filter((roll) => roll !== null)
        : [],
    };
  });
}

function normalizeAbilityScores(value, mode) {
  const abilityScores = cloneRecord(value);
  const base = cloneRecord(abilityScores.base);
  abilityIds.forEach((ability) => {
    const score = finiteNumber(base[ability], null);
    if (score === null) delete base[ability];
    else base[ability] = score;
  });
  return {
    ...abilityScores,
    method: selected(abilityScores.method, abilityMethods, mode === "rules" ? "standard" : "manual"),
    base,
  };
}

function normalizeSpells(value) {
  const spells = cloneRecord(value);
  const assignments = cloneRecord(spells.assignments);
  return {
    ...spells,
    knownIds: uniqueTextList(spells.knownIds),
    spellbookIds: uniqueTextList(spells.spellbookIds),
    assignments: Object.fromEntries(Object.entries(assignments).flatMap(([id, candidate]) => {
      const spellId = text(id);
      if (!spellId || !isRecord(candidate)) return [];
      return [[spellId, {
        ...cloneJSON(candidate),
        profileId: text(candidate.profileId),
        repertoire: text(candidate.repertoire),
      }]];
    })),
  };
}

function normalizeInventory(value) {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).map((candidate) => ({
    ...cloneJSON(candidate),
    instanceId: text(candidate.instanceId),
    definitionId: text(candidate.definitionId),
    quantity: Math.max(0, finiteNumber(candidate.quantity, 1)),
    containerId: text(candidate.containerId),
  }));
}

function normalizeCurrency(value) {
  const currency = cloneRecord(value);
  currencyIds.forEach((coin) => {
    currency[coin] = Math.max(0, Math.trunc(finiteNumber(currency[coin], 0)));
  });
  return currency;
}

function normalizeOverrides(value) {
  if (!isRecord(value)) return {};
  return Object.fromEntries(Object.entries(value).flatMap(([path, candidate]) => {
    const normalizedPath = text(path);
    if (!normalizedPath || !isRecord(candidate)) return [];
    return [[normalizedPath, {
      ...cloneJSON(candidate),
      reason: text(candidate.reason),
    }]];
  }));
}

function normalizeBuild(value, { defaultRuleset = "5e", defaultCurrency = {} } = {}) {
  const build = cloneRecord(value);
  const mode = selected(build.mode, buildModes, "manual");
  const fallbackRuleset = rulesets.has(defaultRuleset) ? defaultRuleset : "5e";
  return {
    ...build,
    version: CHARACTER_BUILD_VERSION,
    mode,
    status: selected(build.status, buildStatuses, mode === "rules" ? "incomplete" : "complete"),
    ruleset: selected(build.ruleset, rulesets, fallbackRuleset),
    catalogVersion: text(build.catalogVersion),
    preferences: normalizePreferences(build.preferences, mode),
    levels: normalizeLevels(build.levels),
    speciesId: text(build.speciesId),
    backgroundId: text(build.backgroundId),
    abilityScores: normalizeAbilityScores(build.abilityScores, mode),
    selections: cloneRecord(build.selections),
    spells: normalizeSpells(build.spells),
    equipmentMethod: selected(build.equipmentMethod, equipmentMethods, "equipment"),
    inventory: normalizeInventory(build.inventory),
    currency: normalizeCurrency(build.currency ?? defaultCurrency),
    description: cloneRecord(build.description),
    overrides: normalizeOverrides(build.overrides),
  };
}

export function normalizeCharacterDocument(value, options = {}) {
  const character = cloneRecord(value);
  return {
    ...character,
    characterSchemaVersion: CHARACTER_SCHEMA_VERSION,
    build: normalizeBuild(character.build, { ...options, defaultCurrency: character.currency }),
  };
}

export function projectManualCharacterSheet(value, options = {}) {
  const character = normalizeCharacterDocument(value, options);
  if (character.build.mode !== "manual") {
    throw new TypeError("Manual sheet projection requires build.mode to be manual.");
  }
  const { characterSchemaVersion, build, ...sheet } = character;
  return cloneJSON(sheet);
}
