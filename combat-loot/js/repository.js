import { readJSON, removeStored, writeJSON } from "../../shared/js/storage.js";
import { clone, normalizeText } from "../../shared/js/text.js";

export const STORAGE_VERSION = 1;
export const PRESETS_STORAGE_KEY = "dnd-combat-loot-presets-v1";
export const DRAFT_STORAGE_KEY = "dnd-combat-loot-draft-v1";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
const TABLE_TYPES = new Set(["initiative", "combat", "custom"]);
const COLUMN_ROLES = new Set([
  "character", "initiative", "damage", "hp", "currentHp", "ac", "condition", "round", "custom",
]);

function asError(error, fallbackMessage) {
  if (error instanceof Error) return error;
  const message = typeof error?.message === "string" ? error.message : fallbackMessage;
  return new Error(message);
}

function readStoredJSON(key, fallback, storage) {
  if (!storage) return readJSON(key, fallback);
  try {
    const value = storage.getItem(key);
    return value === null ? fallback : JSON.parse(value);
  } catch {
    return fallback;
  }
}

function writeStoredJSON(key, value, storage) {
  if (storage) {
    storage.setItem(key, JSON.stringify(value));
    return;
  }
  writeJSON(key, value);
}

function removeStoredValue(key, storage) {
  if (storage) {
    storage.removeItem(key);
    return;
  }
  removeStored(key);
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isDocument(value) {
  if (!isRecord(value)
    || value.version !== STORAGE_VERSION
    || !requiredText(value.id)
    || !Array.isArray(value.tables)
    || !isSaneCounter(value.nextTrackerNumber)) return false;

  const ids = new Set([requiredText(value.id)]);
  let initiativeCount = 0;
  let combatCount = 0;
  const tablesAreValid = value.tables.every((table) => {
    if (!isRecord(table)
      || !hasUniqueId(table, ids)
      || !TABLE_TYPES.has(table.type)
      || typeof table.title !== "string"
      || !Array.isArray(table.columns)
      || !Array.isArray(table.rows)
      || !isSaneCounter(table.nextRoundNumber)) return false;

    if (table.type === "initiative") {
      initiativeCount += 1;
      if (table.title !== "Initiative"
        || table.columns.length !== 2
        || table.columns[0]?.title !== "Character"
        || table.columns[0]?.role !== "character"
        || table.columns[1]?.title !== "Initiative"
        || table.columns[1]?.role !== "initiative") return false;
    } else if (table.type === "combat") {
      combatCount += 1;
      const uniqueRoles = ["character", "damage", "hp", "currentHp"];
      if (!isPositiveCounter(table.nextRoundNumber)
        || !isSaneCounter(table.healthColumnsVersion)
        || uniqueRoles.some(
          (role) => table.columns.filter((column) => column?.role === role).length > 1,
        )) return false;
    }

    const columnIds = [];
    const columnsAreValid = table.columns.every((column) => {
      if (!isRecord(column)
        || !hasUniqueId(column, ids)
        || typeof column.title !== "string"
        || !COLUMN_ROLES.has(column.role)) return false;
      columnIds.push(column.id);
      return true;
    });
    if (!columnsAreValid) return false;

    return table.rows.every((row) => isRecord(row)
      && hasUniqueId(row, ids)
      && isRecord(row.cells)
      && (row.sourceInitiativeRowId === undefined || typeof row.sourceInitiativeRowId === "string")
      && columnIds.every((columnId) => typeof row.cells[columnId] === "string"));
  });
  return tablesAreValid && initiativeCount === 1 && combatCount === 1;
}

function requiredText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function hasUniqueId(value, ids) {
  const id = requiredText(value.id);
  if (!id || ids.has(id)) return false;
  ids.add(id);
  return true;
}

function isSaneCounter(value) {
  return value === undefined || isPositiveCounter(value);
}

function isPositiveCounter(value) {
  return Number.isSafeInteger(value) && value > 0;
}

function normalizePreset(value) {
  if (!isRecord(value) || !isDocument(value.document)) return null;
  const id = requiredText(value.id);
  const baseName = requiredText(value.baseName);
  const label = requiredText(value.label);
  const createdAt = requiredText(value.createdAt);
  const updatedAt = requiredText(value.updatedAt);
  if (!id || !baseName || !label || !createdAt || !updatedAt
    || (value.active !== undefined && typeof value.active !== "boolean")) return null;
  return {
    id,
    baseName,
    label,
    createdAt,
    updatedAt,
    active: value.active !== false,
    document: clone(value.document),
  };
}

function normalizePresetCollection(value) {
  if (!isRecord(value) || value.version !== STORAGE_VERSION || !Array.isArray(value.presets)) return [];
  const seenIds = new Set();
  return value.presets.reduce((presets, candidate) => {
    const preset = normalizePreset(candidate);
    if (preset && !seenIds.has(preset.id)) {
      seenIds.add(preset.id);
      presets.push(preset);
    }
    return presets;
  }, []);
}

function validatedPresetList(presets) {
  if (!Array.isArray(presets)) throw new TypeError("Presets must be an array.");
  const normalized = presets.map(normalizePreset);
  if (normalized.some((preset) => !preset)) throw new TypeError("Every preset must be valid.");
  if (new Set(normalized.map((preset) => preset.id)).size !== normalized.length) {
    throw new TypeError("Preset IDs must be unique.");
  }
  return normalized;
}

function resolveDate(now) {
  const supplied = typeof now === "function" ? now() : now;
  const date = supplied === undefined ? new Date() : new Date(supplied);
  if (Number.isNaN(date.getTime())) throw new TypeError("A valid date is required.");
  return date;
}

function defaultIdFactory() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `preset-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeForFingerprint(value) {
  if (Array.isArray(value)) return value.map(normalizeForFingerprint);
  if (!isRecord(value)) return value;
  return Object.keys(value).sort().reduce((normalized, key) => {
    normalized[key] = normalizeForFingerprint(value[key]);
    return normalized;
  }, {});
}

export function formatPresetLabel(baseName, now = () => new Date()) {
  const name = requiredText(baseName);
  if (!name) throw new TypeError("A preset name is required.");
  const date = resolveDate(now);
  const day = date.getDate();
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${name} - ${MONTHS[date.getMonth()]} ${day} ${year} ${hours}:${minutes}`;
}

export function loadPresetCollection(storage) {
  const stored = readStoredJSON(PRESETS_STORAGE_KEY, null, storage);
  return clone(normalizePresetCollection(stored));
}

export function savePresetCollection(presets, storage) {
  try {
    const normalized = validatedPresetList(presets);
    writeStoredJSON(PRESETS_STORAGE_KEY, { version: STORAGE_VERSION, presets: normalized }, storage);
    return { ok: true, presets: clone(normalized) };
  } catch (error) {
    return { ok: false, error: asError(error, "Could not save presets.") };
  }
}

export function createPreset({
  baseName,
  document,
  now = () => new Date(),
  idFactory = defaultIdFactory,
  storage,
} = {}) {
  try {
    const name = requiredText(baseName);
    if (!name) throw new TypeError("A preset name is required.");
    if (!isDocument(document)) throw new TypeError("A valid tracker document is required.");
    if (typeof idFactory !== "function") throw new TypeError("A valid ID factory is required.");

    const presets = loadPresetCollection(storage);
    const id = requiredText(idFactory());
    if (!id) throw new TypeError("The preset ID cannot be empty.");
    if (presets.some((preset) => preset.id === id)) throw new Error("That preset ID already exists.");

    const date = resolveDate(now);
    const timestamp = date.toISOString();
    const preset = {
      id,
      baseName: name,
      label: formatPresetLabel(name, date),
      createdAt: timestamp,
      updatedAt: timestamp,
      active: true,
      document: clone(document),
    };
    const result = savePresetCollection([...presets, preset], storage);
    if (!result.ok) return result;
    return { ok: true, preset: clone(preset), presets: result.presets };
  } catch (error) {
    return { ok: false, error: asError(error, "Could not create the preset.") };
  }
}

export function overwritePreset({ id, document, now = () => new Date(), storage } = {}) {
  try {
    const presetId = requiredText(id);
    if (!presetId) throw new TypeError("A preset ID is required.");
    if (!isDocument(document)) throw new TypeError("A valid tracker document is required.");

    const presets = loadPresetCollection(storage);
    const index = presets.findIndex((preset) => preset.id === presetId);
    if (index < 0) throw new Error("The selected preset no longer exists.");

    const preset = {
      ...presets[index],
      updatedAt: resolveDate(now).toISOString(),
      document: clone(document),
    };
    const updatedPresets = presets.slice();
    updatedPresets[index] = preset;
    const result = savePresetCollection(updatedPresets, storage);
    if (!result.ok) return result;
    return { ok: true, preset: clone(preset), presets: result.presets };
  } catch (error) {
    return { ok: false, error: asError(error, "Could not overwrite the preset.") };
  }
}

export function setPresetActive({ id, active, storage } = {}) {
  try {
    const presetId = requiredText(id);
    if (!presetId) throw new TypeError("A preset ID is required.");
    if (typeof active !== "boolean") throw new TypeError("Preset active state must be true or false.");

    const presets = loadPresetCollection(storage);
    const index = presets.findIndex((preset) => preset.id === presetId);
    if (index < 0) throw new Error("The selected preset no longer exists.");

    const preset = { ...presets[index], active };
    const updatedPresets = presets.slice();
    updatedPresets[index] = preset;
    const result = savePresetCollection(updatedPresets, storage);
    if (!result.ok) return result;
    return { ok: true, preset: clone(preset), presets: result.presets };
  } catch (error) {
    return { ok: false, error: asError(error, "Could not update the preset.") };
  }
}

function normalizeDraft(value) {
  if (!isRecord(value) || value.version !== STORAGE_VERSION || !isDocument(value.currentDocument)) return null;
  if (value.baselineDocument !== null && !isDocument(value.baselineDocument)) return null;
  if (value.activePresetId !== null && typeof value.activePresetId !== "string") return null;
  const updatedAt = requiredText(value.updatedAt);
  if (!updatedAt) return null;
  return {
    version: STORAGE_VERSION,
    activePresetId: value.activePresetId === null ? null : requiredText(value.activePresetId) || null,
    baselineDocument: value.baselineDocument === null ? null : clone(value.baselineDocument),
    currentDocument: clone(value.currentDocument),
    updatedAt,
  };
}

export function loadDraft(storage) {
  const stored = readStoredJSON(DRAFT_STORAGE_KEY, null, storage);
  const draft = normalizeDraft(stored);
  return draft ? clone(draft) : null;
}

export function saveDraft({ activePresetId = null, baselineDocument = null, currentDocument, storage } = {}) {
  try {
    if (activePresetId !== null && typeof activePresetId !== "string") {
      throw new TypeError("The active preset ID must be text or null.");
    }
    if (baselineDocument !== null && !isDocument(baselineDocument)) {
      throw new TypeError("The baseline document must be a tracker document or null.");
    }
    if (!isDocument(currentDocument)) throw new TypeError("A valid tracker document is required.");
    const draft = {
      version: STORAGE_VERSION,
      activePresetId: activePresetId === null ? null : requiredText(activePresetId) || null,
      baselineDocument: baselineDocument === null ? null : clone(baselineDocument),
      currentDocument: clone(currentDocument),
      updatedAt: new Date().toISOString(),
    };
    writeStoredJSON(DRAFT_STORAGE_KEY, draft, storage);
    return { ok: true, draft: clone(draft) };
  } catch (error) {
    return { ok: false, error: asError(error, "Could not save the working draft.") };
  }
}

export function removeDraft(storage) {
  try {
    removeStoredValue(DRAFT_STORAGE_KEY, storage);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: asError(error, "Could not remove the working draft.") };
  }
}

export function documentFingerprint(document) {
  const persisted = JSON.parse(JSON.stringify(document));
  return JSON.stringify(normalizeForFingerprint(persisted));
}

export function isDocumentDirty(currentDocument, baselineDocument) {
  if (baselineDocument === null || baselineDocument === undefined) return true;
  try {
    return documentFingerprint(currentDocument) !== documentFingerprint(baselineDocument);
  } catch {
    return true;
  }
}

function safeFilename(label) {
  const stem = normalizeText(label)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
  return `${stem || "combat-and-loot"}.json`;
}

function safeUploadLabel(value) {
  if (typeof value !== "string") return "Uploaded Preset";
  const label = value
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160)
    .trim();
  return label || "Uploaded Preset";
}

export function parsePresetUpload(source) {
  let value = source;
  if (typeof source === "string") {
    try {
      value = JSON.parse(source);
    } catch {
      throw new TypeError("The uploaded preset is not valid JSON.");
    }
  }

  if (isDocument(value)) {
    return {
      document: clone(value),
      label: "Uploaded Preset",
    };
  }

  if (!isRecord(value)
    || value.version !== STORAGE_VERSION
    || !isDocument(value.document)) {
    throw new TypeError("The uploaded preset is incompatible or malformed.");
  }

  return {
    document: clone(value.document),
    label: safeUploadLabel(value.label),
  };
}

export function createDownload({
  document,
  activePresetId = null,
  label = "Combat and Loot",
  now = () => new Date(),
} = {}) {
  if (!isDocument(document)) throw new TypeError("A valid tracker document is required.");
  const exportLabel = requiredText(label) || "Combat and Loot";
  const envelope = {
    version: STORAGE_VERSION,
    exportedAt: resolveDate(now).toISOString(),
    activePresetId: activePresetId === null ? null : requiredText(activePresetId) || null,
    label: exportLabel,
    document: clone(document),
  };
  return {
    filename: safeFilename(exportLabel),
    json: `${JSON.stringify(envelope, null, 2)}\n`,
    envelope: clone(envelope),
  };
}
