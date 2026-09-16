// Owns Home preferences, mutually consistent Compendium filters, and safe ruleset-change previews.
import { normalizeCharacterDocument } from "../model.js";

export const BUILDER_AUTOMATION_FILTERS = Object.freeze(["", "rules-ready", "partial", "manual"]);

const sharedRulesets = new Set(["agnostic"]);
const preferenceValues = {
  progression: new Set(["xp", "milestone"]),
  hitPoints: new Set(["fixed", "manual"]),
  encumbrance: new Set(["none", "standard", "variant"]),
};

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function unique(values) {
  return [...new Set(values.map(text).filter(Boolean))]
    .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));
}

function entryRulesetMatches(entry, ruleset) {
  return entry?.ruleset === ruleset || sharedRulesets.has(entry?.ruleset);
}

function entrySource(entry) {
  return text(entry?.publication) || text(entry?.source);
}

function entryMatchesEnabledSources(entry, enabledSources) {
  if (!enabledSources.length) return true;
  const allowed = new Set(enabledSources.map((value) => value.toLocaleLowerCase()));
  return [entry?.publication, entry?.source, entry?.publisher]
    .map((value) => text(value).toLocaleLowerCase())
    .some((value) => allowed.has(value));
}

export function builderCatalogFilterState(entries, value) {
  const document = normalizeCharacterDocument(value);
  const build = document.build;
  const compatible = (Array.isArray(entries) ? entries : [])
    .filter((entry) => entryRulesetMatches(entry, build.ruleset));
  const publishers = unique(compatible.map((entry) => entry.publisher));
  const requestedPublisher = text(build.preferences.contentFilters.publisher);
  const publisher = publishers.includes(requestedPublisher) ? requestedPublisher : "";
  const publisherEntries = compatible.filter((entry) => !publisher || entry.publisher === publisher);
  const coverageCounts = Object.fromEntries(BUILDER_AUTOMATION_FILTERS.slice(1).map((status) => [
    status,
    publisherEntries.filter((entry) => entry.automation?.status === status).length,
  ]));
  const requestedAutomation = text(build.preferences.contentFilters.automation);
  const automation = BUILDER_AUTOMATION_FILTERS.includes(requestedAutomation)
    && (!requestedAutomation || coverageCounts[requestedAutomation] > 0)
    ? requestedAutomation
    : "";
  const coverageEntries = publisherEntries
    .filter((entry) => !automation || entry.automation?.status === automation);
  const publications = unique(coverageEntries.map(entrySource));
  const validSourceTerms = new Set(coverageEntries
    .flatMap((entry) => [entry.publication, entry.source, entry.publisher])
    .map(text)
    .filter(Boolean));
  const enabledSources = build.preferences.enabledSources
    .filter((source) => validSourceTerms.has(source));
  const filteredEntries = coverageEntries
    .filter((entry) => entryMatchesEnabledSources(entry, enabledSources));

  return {
    ruleset: build.ruleset,
    publisher,
    automation,
    enabledSources,
    publishers,
    publications,
    coverageCounts,
    compatibleCount: compatible.length,
    publisherCount: publisherEntries.length,
    filteredCount: filteredEntries.length,
    filteredEntries,
  };
}

export function filterBuilderCatalogEntries(entries, value) {
  return builderCatalogFilterState(entries, value).filteredEntries;
}

export function applyBuilderHomePreferences(value, changes, entries = []) {
  const document = normalizeCharacterDocument(value);
  const preferences = document.build.preferences;
  const next = changes && typeof changes === "object" ? changes : {};
  for (const name of ["progression", "hitPoints", "encumbrance"]) {
    if (preferenceValues[name].has(next[name])) preferences[name] = next[name];
  }
  if (typeof next.coinWeight === "boolean") preferences.coinWeight = next.coinWeight;
  if (typeof next.prerequisites === "boolean") preferences.prerequisites = next.prerequisites;
  if (Array.isArray(next.enabledSources)) preferences.enabledSources = unique(next.enabledSources);
  if (next.publisher !== undefined) preferences.contentFilters.publisher = text(next.publisher);
  if (next.automation !== undefined && BUILDER_AUTOMATION_FILTERS.includes(next.automation)) {
    preferences.contentFilters.automation = next.automation;
  }
  if (text(next.catalogVersion)) document.build.catalogVersion = text(next.catalogVersion);

  if (Array.isArray(entries) && entries.length) {
    const state = builderCatalogFilterState(entries, document);
    preferences.contentFilters.publisher = state.publisher;
    preferences.contentFilters.automation = state.automation;
    preferences.enabledSources = state.enabledSources;
  }
  return normalizeCharacterDocument(document);
}

function catalogIndex(entries) {
  const index = new Map();
  (Array.isArray(entries) ? entries : []).forEach((entry) => {
    if (text(entry?.id)) index.set(text(entry.id), entry);
    if (text(entry?.originalId)) index.set(text(entry.originalId), entry);
  });
  return index;
}

function selectionValues(value) {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object" && Array.isArray(value.selectedIds)) return value.selectedIds;
  return [];
}

function withSelectionValues(value, values) {
  if (typeof value === "string") return values[0] || "";
  if (Array.isArray(value)) return values;
  if (value && typeof value === "object" && Array.isArray(value.selectedIds)) return { ...value, selectedIds: values };
  return value;
}

export function previewCharacterRulesetChange(value, nextRuleset, entries = []) {
  const document = normalizeCharacterDocument(value);
  const target = ["5e", "5.5e"].includes(nextRuleset) ? nextRuleset : document.build.ruleset;
  if (target === document.build.ruleset) {
    return { changed: false, from: document.build.ruleset, to: target, incompatible: [], document };
  }

  const next = normalizeCharacterDocument(document);
  const build = next.build;
  const index = catalogIndex(entries);
  const incompatible = [];
  const record = (kind, path, id, label = "") => incompatible.push({
    kind,
    path,
    id: text(id),
    label: text(label) || text(index.get(id)?.name) || text(id),
  });
  const incompatibleReference = (id) => {
    const entry = index.get(text(id));
    return Boolean(entry && !entryRulesetMatches(entry, target));
  };

  build.levels = build.levels.flatMap((level, levelIndex) => {
    if (incompatibleReference(level.classId)) {
      record("class", `build.levels.${levelIndex}.classId`, level.classId);
      return [];
    }
    if (incompatibleReference(level.subclassId)) {
      record("subclass", `build.levels.${levelIndex}.subclassId`, level.subclassId);
      return [{ ...level, subclassId: "" }];
    }
    return [level];
  });

  for (const [field, kind] of [["speciesId", "species"], ["backgroundId", "background"]]) {
    if (!incompatibleReference(build[field])) continue;
    record(kind, `build.${field}`, build[field]);
    build[field] = "";
  }

  build.selections = Object.fromEntries(Object.entries(build.selections).flatMap(([key, value]) => {
    const sourceId = key.split(":selection:")[0];
    if (incompatibleReference(sourceId)) {
      record("selection", `build.selections.${key}`, sourceId, `Choices from ${index.get(sourceId)?.name || sourceId}`);
      return [];
    }
    const selected = selectionValues(value);
    const kept = selected.filter((id) => {
      if (!incompatibleReference(id)) return true;
      record("selection", `build.selections.${key}`, id);
      return false;
    });
    return kept.length || !selected.length ? [[key, withSelectionValues(value, kept)]] : [];
  }));

  const removedSpells = new Set();
  for (const field of ["knownIds", "spellbookIds"]) {
    build.spells[field] = build.spells[field].filter((id) => {
      if (!incompatibleReference(id)) return true;
      record("spell", `build.spells.${field}`, id);
      removedSpells.add(id);
      return false;
    });
  }
  build.spells.assignments = Object.fromEntries(Object.entries(build.spells.assignments).flatMap(([id, assignment]) => {
    if (removedSpells.has(id)) return [];
    if (!incompatibleReference(id)) return [[id, assignment]];
    record("spell", `build.spells.assignments.${id}`, id, `${index.get(id)?.name || id} assignment`);
    return [];
  }));

  const removedInstances = new Set();
  build.inventory = build.inventory.filter((instance, instanceIndex) => {
    if (!incompatibleReference(instance.definitionId)) return true;
    record("item", `build.inventory.${instanceIndex}.definitionId`, instance.definitionId);
    removedInstances.add(instance.instanceId);
    return false;
  }).map((instance, instanceIndex) => {
    if (!removedInstances.has(instance.containerId)) return instance;
    record("container", `build.inventory.${instanceIndex}.containerId`, instance.containerId, "Container assignment");
    return { ...instance, containerId: "" };
  });

  if (target === "5.5e" && build.preferences.encumbrance === "variant") {
    record("preference", "build.preferences.encumbrance", "variant", "Variant encumbrance");
    build.preferences.encumbrance = "standard";
  }

  const targetSources = new Set((Array.isArray(entries) ? entries : [])
    .filter((entry) => entryRulesetMatches(entry, target))
    .flatMap((entry) => [entry.publication, entry.source, entry.publisher])
    .map((source) => text(source).toLocaleLowerCase())
    .filter(Boolean));
  build.preferences.enabledSources = build.preferences.enabledSources.filter((source) => {
    if (targetSources.has(source.toLocaleLowerCase())) return true;
    record("source", "build.preferences.enabledSources", source, source);
    return false;
  });

  build.ruleset = target;
  build.status = "incomplete";
  const requestedPublisher = build.preferences.contentFilters.publisher;
  const requestedAutomation = build.preferences.contentFilters.automation;
  const filters = builderCatalogFilterState(entries, next);
  if (requestedPublisher && filters.publisher !== requestedPublisher) {
    record("filter", "build.preferences.contentFilters.publisher", requestedPublisher, `${requestedPublisher} publisher filter`);
  }
  if (requestedAutomation && filters.automation !== requestedAutomation) {
    record("filter", "build.preferences.contentFilters.automation", requestedAutomation, `${requestedAutomation} automation filter`);
  }
  build.preferences.contentFilters.publisher = filters.publisher;
  build.preferences.contentFilters.automation = filters.automation;
  build.preferences.enabledSources = filters.enabledSources;

  return { changed: true, from: document.build.ruleset, to: target, incompatible, document: normalizeCharacterDocument(next) };
}
