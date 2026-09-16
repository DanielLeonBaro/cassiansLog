// Builds reviewed manual-to-rules conversion previews without changing source sheets.
import { cloneJSON, normalizeText } from "../../shared/js/text.js";
import { normalizeCharacterDocument } from "./model.js";

const categoryByKind = Object.freeze({
  class: "classes",
  subclass: "subclasses",
  species: "races",
  background: "backgrounds",
  item: "items",
});

function text(value) {
  return String(value ?? "").trim();
}

function exactName(value) {
  return normalizeText(value).replace(/\s+/g, " ");
}

function entryAutomationStatus(entry) {
  return entry?.automation?.status || "manual";
}

function compatibleEntries(catalog, kind, value, ruleset) {
  const name = exactName(value);
  if (!name) return [];
  return (catalog?.entries || []).filter((entry) => (
    entry.category === categoryByKind[kind]
    && entry.ruleset === ruleset
    && exactName(entry.name) === name
  ));
}

function reviewedMatch(catalog, kind, value, ruleset) {
  const matches = compatibleEntries(catalog, kind, value, ruleset);
  const ready = matches.filter((entry) => entryAutomationStatus(entry) === "rules-ready");
  return {
    entry: ready.length === 1 ? ready[0] : null,
    reason: ready.length > 1
      ? "Multiple rules-ready entries have this exact name. Choose one in the builder."
      : matches.length
        ? "The exact Compendium entry is not rules-ready for this ruleset."
        : "No exact rules-ready Compendium entry exists for this ruleset.",
  };
}

function previewRecord(kind, label, sourceValue, entry) {
  return {
    kind,
    label,
    sourceValue: text(sourceValue),
    definitionId: entry.id,
    definitionName: entry.name,
    ruleset: entry.ruleset,
    automation: entryAutomationStatus(entry),
  };
}

function unresolvedRecord(kind, label, sourceValue, reason) {
  return { kind, label, sourceValue: text(sourceValue), reason };
}

function inventoryInstanceId(entryId, index) {
  return `conversion-${entryId}-${index + 1}`;
}

function catalogVersion(catalog) {
  return text(catalog?.manifest?.catalogVersion || catalog?.manifest?.version);
}

function conversionSource(character) {
  return character?.importSnapshot?.source === "dnd-beyond" ? "dnd-beyond" : "legacy";
}

export function previewCharacterAutomation(value, catalog, { ruleset = "5e" } = {}) {
  if (ruleset !== "5e" && ruleset !== "5.5e") throw new TypeError("Conversion ruleset must be 5e or 5.5e.");
  const sourceDocument = cloneJSON(value || {});
  const normalized = normalizeCharacterDocument(sourceDocument, { defaultRuleset: ruleset });
  const matched = [];
  const unresolved = [];
  const added = [];
  const removed = [];
  const changed = [{ path: "build.mode", before: normalized.build.mode, after: "rules" }];
  const levels = [];

  const classNames = text(sourceDocument.class).split(/\s*\/\s*/).filter(Boolean);
  if (classNames.length === 1) {
    const result = reviewedMatch(catalog, "class", classNames[0], ruleset);
    if (result.entry) {
      const level = Math.max(1, Math.min(20, Number(sourceDocument.level) || 1));
      levels.push({ classId: result.entry.id, subclassId: "", level, hitPointRolls: [] });
      matched.push(previewRecord("class", "Class", classNames[0], result.entry));
      added.push({ path: "build.levels[0].classId", value: result.entry.id, label: `${result.entry.name} ${level}` });
    } else {
      unresolved.push(unresolvedRecord("class", "Class", classNames[0], result.reason));
    }
  } else if (classNames.length > 1) {
    unresolved.push(unresolvedRecord("class", "Classes", sourceDocument.class, "A flat multiclass total cannot prove each class level. Rebuild the levels manually."));
  } else {
    unresolved.push(unresolvedRecord("class", "Class", "", "No class is recorded."));
  }

  const subclassName = text(sourceDocument.subclass);
  if (subclassName) {
    const result = reviewedMatch(catalog, "subclass", subclassName, ruleset);
    if (result.entry && levels.length === 1) {
      levels[0].subclassId = result.entry.id;
      matched.push(previewRecord("subclass", "Subclass", subclassName, result.entry));
      added.push({ path: "build.levels[0].subclassId", value: result.entry.id, label: result.entry.name });
    } else {
      unresolved.push(unresolvedRecord("subclass", "Subclass", subclassName, result.entry
        ? "Resolve the class levels before assigning this subclass."
        : result.reason));
    }
  }

  const origins = [
    ["species", "Species/Race", sourceDocument.race, "speciesId"],
    ["background", "Background", sourceDocument.background, "backgroundId"],
  ];
  const originIds = { speciesId: "", backgroundId: "" };
  origins.forEach(([kind, label, sourceValue, field]) => {
    if (!text(sourceValue)) {
      unresolved.push(unresolvedRecord(kind, label, "", `No ${label.toLowerCase()} is recorded.`));
      return;
    }
    const result = reviewedMatch(catalog, kind, sourceValue, ruleset);
    if (!result.entry) {
      unresolved.push(unresolvedRecord(kind, label, sourceValue, result.reason));
      return;
    }
    originIds[field] = result.entry.id;
    matched.push(previewRecord(kind, label, sourceValue, result.entry));
    added.push({ path: `build.${field}`, value: result.entry.id, label: result.entry.name });
  });

  unresolved.push(unresolvedRecord(
    "abilities",
    "Ability score bases",
    "Imported/manual totals",
    "Final sheet scores do not prove their rolled or purchased base values. Enter them in the builder.",
  ));

  const inventory = [];
  (Array.isArray(sourceDocument.inventory) ? sourceDocument.inventory : []).forEach((item, index) => {
    const name = text(item?.name);
    if (!name) return;
    const result = reviewedMatch(catalog, "item", name, ruleset);
    if (!result.entry) {
      unresolved.push(unresolvedRecord("item", "Inventory", name, result.reason));
      return;
    }
    const instance = {
      instanceId: inventoryInstanceId(result.entry.id, index),
      definitionId: result.entry.id,
      quantity: Math.max(0, Number(item.quantity) || 1),
      containerId: "",
    };
    inventory.push(instance);
    matched.push(previewRecord("item", "Inventory", name, result.entry));
    added.push({ path: `build.inventory[${inventory.length - 1}]`, value: result.entry.id, label: name });
  });

  (Array.isArray(sourceDocument.spells) ? sourceDocument.spells : []).forEach((spell) => {
    if (!text(spell?.name)) return;
    unresolved.push(unresolvedRecord(
      "spell",
      "Spell repertoire",
      spell.name,
      "A flat spell record cannot prove known, prepared, spellbook, granted, or always-prepared status.",
    ));
  });

  const build = {
    ...normalized.build,
    mode: "rules",
    status: "incomplete",
    ruleset,
    catalogVersion: catalogVersion(catalog),
    levels,
    speciesId: originIds.speciesId,
    backgroundId: originIds.backgroundId,
    abilityScores: { method: "manual", base: {} },
    selections: {},
    spells: { knownIds: [], spellbookIds: [], assignments: {} },
    inventory,
    overrides: {},
  };
  changed.push({ path: "build.status", before: normalized.build.status, after: "incomplete" });
  if (normalized.build.ruleset !== ruleset) changed.push({ path: "build.ruleset", before: normalized.build.ruleset, after: ruleset });

  return {
    version: 1,
    source: conversionSource(sourceDocument),
    ruleset,
    sourceDocument,
    build,
    matched,
    unresolved,
    added,
    removed,
    changed,
  };
}

function previewSummary(preview) {
  return Object.fromEntries(["matched", "unresolved", "added", "removed", "changed"]
    .map((key) => [key, cloneJSON(preview[key] || [])]));
}

export function applyCharacterAutomationPreview(preview, { convertedAt = new Date().toISOString() } = {}) {
  if (!preview?.sourceDocument || !preview?.build) throw new TypeError("A complete conversion preview is required.");
  const sourceDocument = cloneJSON(preview.sourceDocument);
  const converted = normalizeCharacterDocument(sourceDocument, { defaultRuleset: preview.ruleset });
  converted.build = cloneJSON(preview.build);
  converted.build.conversion = {
    version: 1,
    source: preview.source,
    ruleset: preview.ruleset,
    convertedAt,
    preview: previewSummary(preview),
    rollbackDocument: sourceDocument,
  };
  return converted;
}

export function canRollbackCharacterAutomation(character) {
  return Boolean(character?.build?.conversion?.rollbackDocument);
}

export function rollbackCharacterAutomation(character) {
  if (!canRollbackCharacterAutomation(character)) throw new TypeError("This character has no conversion rollback copy.");
  return cloneJSON(character.build.conversion.rollbackDocument);
}
