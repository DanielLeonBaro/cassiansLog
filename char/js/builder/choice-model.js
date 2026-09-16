// Owns catalog-driven Class, Background, Species/Race, subclass, and rule-choice edits.
import { normalizeCharacterDocument } from "../model.js";
import { evaluateCharacterBuild } from "../rules/evaluator.js";
import { filterBuilderCatalogEntries } from "./home-model.js";

export const BUILDER_CERTIFIED_LEVELS = Object.freeze([1, 2, 3, 4, 5]);

const rootTypes = {
  class: new Set(["class"]),
  background: new Set(["background"]),
  species: new Set(["race", "species"]),
  subclass: new Set(["archetype", "subclass"]),
};

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalized(value) {
  return text(value).toLocaleLowerCase();
}

function entryMatchesKind(entry, kind) {
  return rootTypes[kind]?.has(normalized(entry?.type))
    || (kind === "class" && entry?.category === "classes")
    || (kind === "background" && entry?.category === "backgrounds")
    || (kind === "species" && entry?.category === "races")
    || (kind === "subclass" && entry?.category === "subclasses");
}

function entryRulesetMatches(entry, ruleset) {
  return entry?.ruleset === ruleset || entry?.ruleset === "agnostic";
}

function entryIndex(entries) {
  const index = new Map();
  (Array.isArray(entries) ? entries : []).forEach((entry) => {
    if (text(entry?.id)) index.set(text(entry.id), entry);
    if (text(entry?.originalId)) index.set(text(entry.originalId), entry);
  });
  return index;
}

function selectedRootId(document, kind) {
  if (kind === "class") return document.build.levels[0]?.classId || "";
  if (kind === "subclass") return document.build.levels[0]?.subclassId || "";
  if (kind === "background") return document.build.backgroundId;
  if (kind === "species") return document.build.speciesId;
  return "";
}

function uniqueEntries(entries) {
  const seen = new Set();
  return entries.filter((entry) => {
    if (!entry?.id || seen.has(entry.id)) return false;
    seen.add(entry.id);
    return true;
  }).sort((left, right) => (
    text(left.name).localeCompare(text(right.name))
      || text(left.publication || left.source).localeCompare(text(right.publication || right.source))
      || left.id.localeCompare(right.id)
  ));
}

function subclassSupportsClass(subclass, classEntry) {
  if (!subclass || !classEntry) return false;
  const supports = [
    ...(Array.isArray(subclass.facets?.supports) ? subclass.facets.supports : []),
    ...text(subclass.supports).split(","),
  ].map(normalized).filter(Boolean);
  const className = normalized(classEntry.name);
  const classFeatures = (Array.isArray(classEntry.rules?.features) ? classEntry.rules.features : [])
    .map((feature) => normalized(feature?.name))
    .filter(Boolean);
  const supportedNames = new Set([
    ...classFeatures,
    `${className} subclass`,
    `${className} archetype`,
  ]);
  return supports.some((value) => supportedNames.has(value));
}

export function builderRootEntries(entries, value, kind) {
  const document = normalizeCharacterDocument(value);
  const filtered = filterBuilderCatalogEntries(entries, document).filter((entry) => entryMatchesKind(entry, kind));
  const selectedId = selectedRootId(document, kind);
  const selected = entryIndex(entries).get(selectedId);
  const candidates = selected && entryMatchesKind(selected, kind) && entryRulesetMatches(selected, document.build.ruleset)
    ? [...filtered, selected]
    : filtered;

  if (kind !== "subclass") return uniqueEntries(candidates);
  const classEntry = entryIndex(entries).get(document.build.levels[0]?.classId);
  return uniqueEntries(candidates.filter((entry) => subclassSupportsClass(entry, classEntry)));
}

function sourceAliases(entry) {
  return [text(entry?.id), text(entry?.originalId)].filter(Boolean);
}

function clearSelectionsFromSources(document, sources) {
  const prefixes = sources.flatMap(sourceAliases).map((id) => `${id}:selection:`);
  document.build.selections = Object.fromEntries(Object.entries(document.build.selections)
    .filter(([key]) => !prefixes.some((prefix) => key.startsWith(prefix))));
}

function reconcileSelections(document, entries) {
  const evaluation = evaluateCharacterBuild({ character: document, catalog: entries });
  const validKeys = new Set(evaluation.choices.map(({ key }) => key));
  document.build.selections = Object.fromEntries(Object.entries(document.build.selections)
    .filter(([key]) => validKeys.has(key)));
  return normalizeCharacterDocument(document);
}

function selectableRoot(entries, document, kind, id) {
  if (!id) return null;
  return builderRootEntries(entries, document, kind).find((entry) => entry.id === id || entry.originalId === id) || null;
}

export function applyBuilderRootSelection(value, entries, kind, id) {
  const document = normalizeCharacterDocument(value);
  if (!["class", "background", "species"].includes(kind)) return document;
  const nextId = text(id);
  const nextEntry = selectableRoot(entries, document, kind, nextId);
  if (nextId && !nextEntry) return document;

  if (kind === "class") {
    const previous = document.build.levels[0];
    const index = entryIndex(entries);
    clearSelectionsFromSources(document, [index.get(previous?.classId), index.get(previous?.subclassId)]);
    if (!nextEntry) document.build.levels = document.build.levels.slice(1);
    else {
      const level = BUILDER_CERTIFIED_LEVELS.includes(previous?.level) ? previous.level : 1;
      const nextLevel = { ...(previous || {}), classId: nextEntry.id, subclassId: "", level, hitPointRolls: previous?.hitPointRolls || [] };
      document.build.levels = [nextLevel, ...document.build.levels.slice(1)];
    }
  } else {
    const field = kind === "background" ? "backgroundId" : "speciesId";
    const previous = entryIndex(entries).get(document.build[field]);
    clearSelectionsFromSources(document, [previous]);
    document.build[field] = nextEntry?.id || "";
  }
  document.build.status = "incomplete";
  return reconcileSelections(document, entries);
}

export function applyBuilderClassLevel(value, entries, level) {
  const document = normalizeCharacterDocument(value);
  const nextLevel = Math.trunc(Number(level));
  if (!document.build.levels[0]?.classId || !BUILDER_CERTIFIED_LEVELS.includes(nextLevel)) return document;
  const current = document.build.levels[0];
  const classEntry = entryIndex(entries).get(current.classId);
  const subclassLevel = Number(classEntry?.rules?.subclassLevel || 0);
  if (current.subclassId && subclassLevel && nextLevel < subclassLevel) {
    clearSelectionsFromSources(document, [entryIndex(entries).get(current.subclassId)]);
    current.subclassId = "";
  }
  current.level = nextLevel;
  document.build.status = "incomplete";
  return reconcileSelections(document, entries);
}

export function applyBuilderSubclassSelection(value, entries, id) {
  const document = normalizeCharacterDocument(value);
  const current = document.build.levels[0];
  if (!current?.classId) return document;
  const nextId = text(id);
  const nextEntry = selectableRoot(entries, document, "subclass", nextId);
  if (nextId && !nextEntry) return document;
  const classEntry = entryIndex(entries).get(current.classId);
  const subclassLevel = Number(classEntry?.rules?.subclassLevel || 0);
  if (nextEntry && (!subclassLevel || current.level < subclassLevel)) return document;
  clearSelectionsFromSources(document, [entryIndex(entries).get(current.subclassId)]);
  current.subclassId = nextEntry?.id || "";
  document.build.status = "incomplete";
  return reconcileSelections(document, entries);
}

export function applyBuilderRuleSelection(value, entries, key, selectedIds) {
  const document = normalizeCharacterDocument(value);
  const evaluation = evaluateCharacterBuild({ character: document, catalog: entries });
  const choice = evaluation.choices.find((candidate) => candidate.key === key && candidate.status !== "unavailable");
  if (!choice) return document;
  const values = [...new Set((Array.isArray(selectedIds) ? selectedIds : [selectedIds]).map(text).filter(Boolean))];
  const allowed = new Set(choice.options.filter(({ available }) => available).map(({ id }) => id));
  if (values.length > choice.maximum || values.some((id) => !allowed.has(id))) return document;
  if (values.length) document.build.selections[key] = values;
  else delete document.build.selections[key];
  document.build.status = "incomplete";
  return normalizeCharacterDocument(document);
}

function stepRootIds(document, step) {
  if (step === "class") return [document.build.levels[0]?.classId, document.build.levels[0]?.subclassId].filter(Boolean);
  if (step === "background") return [document.build.backgroundId].filter(Boolean);
  if (step === "species") return [document.build.speciesId].filter(Boolean);
  return [];
}

export function builderStepEvaluation(value, entries, step) {
  const document = normalizeCharacterDocument(value);
  const evaluation = evaluateCharacterBuild({ character: document, catalog: entries });
  const relevantSources = new Set(stepRootIds(document, step));
  let changed = true;
  while (changed) {
    changed = false;
    evaluation.activeEntries.forEach((entry) => {
      if (!relevantSources.has(entry.sourceId) || relevantSources.has(entry.id)) return;
      relevantSources.add(entry.id);
      changed = true;
    });
  }
  const choices = evaluation.choices.filter((choice) => relevantSources.has(choice.sourceId));
  const choiceKeys = new Set(choices.map(({ key }) => key));
  const rootPath = step === "class" ? "build.levels." : `build.${step === "species" ? "speciesId" : "backgroundId"}`;
  const warnings = evaluation.warnings.filter((warning) => (
    text(warning.path).startsWith(rootPath)
      || relevantSources.has(warning.entryId)
      || relevantSources.has(warning.sourceId)
      || choiceKeys.has(warning.choiceKey)
  ));
  return { evaluation, choices, warnings, relevantSources };
}

export function builderSubclassLevel(value, entries) {
  const document = normalizeCharacterDocument(value);
  const classEntry = entryIndex(entries).get(document.build.levels[0]?.classId);
  const level = Number(classEntry?.rules?.subclassLevel || 0);
  return Number.isFinite(level) && level > 0 ? level : 0;
}
