// Verifies Combat and Loot repository behavior.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const storageCode = fs.readFileSync("shared/js/storage.js", "utf8")
  .replace(/^import[\s\S]*?;\r?\n/gm, "")
  .replace(/export /g, "");
const textCode = fs.readFileSync("shared/js/text.js", "utf8").replace(/export /g, "");
const repositoryCode = fs.readFileSync("combat-loot/js/repository.js", "utf8")
  .replace(/^import .*\r?\n/gm, "")
  .replace(/export /g, "");

function createStorage(entries = {}) {
  const values = new Map(Object.entries(entries));
  return {
    values,
    writes: 0,
    removals: 0,
    failWrites: false,
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      if (this.failWrites) throw new Error("Storage full");
      this.writes += 1;
      values.set(key, value);
    },
    removeItem(key) {
      if (this.failWrites) throw new Error("Storage unavailable");
      this.removals += 1;
      values.delete(key);
    },
  };
}

const defaultStorage = createStorage();
const context = {
  console,
  localStorage: defaultStorage,
  campaignStorageKey: (key) => key,
};
vm.createContext(context);
vm.runInContext(`
  ${storageCode}
  ${textCode}
  ${repositoryCode}
  globalThis.api = {
    STORAGE_VERSION,
    PRESETS_STORAGE_KEY,
    DRAFT_STORAGE_KEY,
    formatPresetLabel,
    loadPresetCollection,
    savePresetCollection,
    createPreset,
    overwritePreset,
    setPresetActive,
    loadDraft,
    saveDraft,
    removeDraft,
    documentFingerprint,
    isDocumentDirty,
    createDownload,
    parsePresetUpload,
  };
`, context);

const api = context.api;
const plain = (value) => JSON.parse(JSON.stringify(value));
const PRESETS_KEY = "dnd-combat-loot-presets-v1";
const DRAFT_KEY = "dnd-combat-loot-draft-v1";

function validDocument({ id = "document-1", value = "Goblin", includeRow = true } = {}) {
  const initiativeTableId = `${id}-initiative`;
  const characterColumnId = `${id}-character`;
  const initiativeColumnId = `${id}-initiative-value`;
  const combatTableId = `${id}-combat`;
  const combatCharacterColumnId = `${id}-combat-character`;
  return {
    version: 1,
    id,
    nextTrackerNumber: 1,
    tables: [
      {
        id: initiativeTableId,
        type: "initiative",
        title: "Initiative",
        columns: [
          { id: characterColumnId, title: "Character", role: "character" },
          { id: initiativeColumnId, title: "Initiative", role: "initiative" },
        ],
        rows: includeRow ? [{
          id: `${id}-row`,
          cells: { [characterColumnId]: value, [initiativeColumnId]: "12" },
        }] : [],
      },
      {
        id: combatTableId,
        type: "combat",
        title: "Combat",
        nextRoundNumber: 2,
        columns: [{ id: combatCharacterColumnId, title: "Character", role: "character" }],
        rows: [],
      },
    ],
  };
}

function firstCell(document) {
  const table = document.tables[0];
  return table.rows[0].cells[table.columns[0].id];
}

function setFirstCell(document, value) {
  const table = document.tables[0];
  table.rows[0].cells[table.columns[0].id] = value;
}

function storedPreset(document) {
  return {
    id: "stored-preset",
    baseName: "Stored",
    label: "Stored - Aug 12 2026 15:32",
    createdAt: "2026-08-12T22:32:00.000Z",
    updatedAt: "2026-08-12T22:32:00.000Z",
    document,
  };
}

assert.equal(api.STORAGE_VERSION, 1);
assert.equal(api.PRESETS_STORAGE_KEY, PRESETS_KEY);
assert.equal(api.DRAFT_STORAGE_KEY, DRAFT_KEY);

// Missing, malformed, and incompatible data recover safely.
{
  const storage = createStorage();
  assert.deepEqual(plain(api.loadPresetCollection(storage)), []);
  storage.values.set(PRESETS_KEY, "not json");
  assert.deepEqual(plain(api.loadPresetCollection(storage)), []);
  storage.values.set(PRESETS_KEY, JSON.stringify({ version: 2, presets: [] }));
  assert.deepEqual(plain(api.loadPresetCollection(storage)), []);
  storage.values.set(PRESETS_KEY, JSON.stringify({ version: 1, presets: [{ id: "broken" }] }));
  assert.deepEqual(plain(api.loadPresetCollection(storage)), []);

  storage.values.set(DRAFT_KEY, "{");
  assert.equal(api.loadDraft(storage), null);
  storage.values.set(DRAFT_KEY, JSON.stringify({ version: 4, currentDocument: {} }));
  assert.equal(api.loadDraft(storage), null);
}

// Nested tracker data must match the supported document version and model shape.
{
  const wrongVersion = validDocument();
  wrongVersion.version = 2;
  const missingRows = validDocument();
  delete missingRows.tables[0].rows;
  const badRole = validDocument();
  badRole.tables[0].columns[0].role = "mystery";
  const numericCell = validDocument();
  setFirstCell(numericCell, 12);
  const badSourceId = validDocument();
  badSourceId.tables[0].rows[0].sourceInitiativeRowId = 4;
  const badCounter = validDocument();
  badCounter.nextTrackerNumber = 0;
  const duplicateId = validDocument();
  duplicateId.tables[0].id = duplicateId.id;
  const noCoreTables = validDocument();
  noCoreTables.tables = [];
  const missingInitiative = validDocument();
  missingInitiative.tables = missingInitiative.tables.filter((table) => table.type !== "initiative");
  const missingCombat = validDocument();
  missingCombat.tables = missingCombat.tables.filter((table) => table.type !== "combat");
  const duplicateInitiative = validDocument();
  const secondInitiative = plain(duplicateInitiative.tables[0]);
  secondInitiative.id = "second-initiative";
  secondInitiative.columns[0].id = "second-initiative-character";
  secondInitiative.columns[1].id = "second-initiative-value";
  secondInitiative.rows[0].id = "second-initiative-row";
  secondInitiative.rows[0].cells = {
    "second-initiative-character": "Orc",
    "second-initiative-value": "8",
  };
  duplicateInitiative.tables.push(secondInitiative);
  const malformedInitiative = validDocument();
  malformedInitiative.tables[0].columns.push({
    id: "initiative-extra-column",
    title: "Extra",
    role: "custom",
  });
  const missingCombatCounter = validDocument();
  delete missingCombatCounter.tables[1].nextRoundNumber;
  const nonPositiveCombatCounter = validDocument();
  nonPositiveCombatCounter.tables[1].nextRoundNumber = 0;
  const duplicateCombatCharacter = validDocument();
  duplicateCombatCharacter.tables[1].columns.push({
    id: "second-combat-character",
    title: "Another Character",
    role: "character",
  });
  const badHealthColumnsVersion = validDocument();
  badHealthColumnsVersion.tables[1].healthColumnsVersion = 0;
  const duplicateCombatHP = validDocument();
  duplicateCombatHP.tables[1].columns.push(
    { id: "first-hp", title: "HP", role: "hp" },
    { id: "duplicate-hp", title: "Other HP", role: "hp" },
  );

  for (const malformedDocument of [
    wrongVersion,
    missingRows,
    badRole,
    numericCell,
    badSourceId,
    badCounter,
    duplicateId,
    noCoreTables,
    missingInitiative,
    missingCombat,
    duplicateInitiative,
    malformedInitiative,
    missingCombatCounter,
    nonPositiveCombatCounter,
    duplicateCombatCharacter,
    duplicateCombatHP,
    badHealthColumnsVersion,
  ]) {
    const storage = createStorage({
      [PRESETS_KEY]: JSON.stringify({ version: 1, presets: [storedPreset(malformedDocument)] }),
      [DRAFT_KEY]: JSON.stringify({
        version: 1,
        activePresetId: null,
        baselineDocument: null,
        currentDocument: malformedDocument,
        updatedAt: "2026-08-12T22:32:00.000Z",
      }),
    });
    assert.deepEqual(plain(api.loadPresetCollection(storage)), []);
    assert.equal(api.loadDraft(storage), null);
  }

  const combatWithoutCharacter = validDocument();
  combatWithoutCharacter.tables[1].columns = [];
  const storage = createStorage({
    [PRESETS_KEY]: JSON.stringify({ version: 1, presets: [storedPreset(combatWithoutCharacter)] }),
  });
  assert.equal(api.loadPresetCollection(storage).length, 1);

  const flexibleTrackers = validDocument();
  const combat = flexibleTrackers.tables[1];
  const combatCharacter = combat.columns[0];
  combat.columns = [
    { id: "round-column", title: "Bonus Round", role: "round" },
    combatCharacter,
    { id: "damage-column", title: "Damage", role: "damage" },
    { id: "current-hp-column", title: "Current HP", role: "currentHp" },
    { id: "combat-notes", title: "Notes", role: "custom" },
  ];
  combat.healthColumnsVersion = 1;
  combat.rows = [{
    id: "combat-row",
    cells: {
      "round-column": "Attacked",
      [combatCharacter.id]: "Goblin",
      "damage-column": "4",
      "current-hp-column": "6",
      "combat-notes": "Fled",
    },
  }];
  flexibleTrackers.tables.push({
    id: "loot-table",
    type: "custom",
    title: "Loot",
    columns: [{ id: "loot-column", title: "Item", role: "custom" }],
    rows: [{ id: "loot-row", cells: { "loot-column": "Potion" } }],
  });
  storage.values.set(PRESETS_KEY, JSON.stringify({
    version: 1,
    presets: [storedPreset(flexibleTrackers)],
  }));
  assert.equal(api.loadPresetCollection(storage).length, 1);
}

// A first save creates the exact label and stores a versioned, cloned snapshot.
let createdPreset;
{
  const storage = createStorage();
  const document = validDocument();
  const result = api.createPreset({
    baseName: "  Goblin Combat  ",
    document,
    now: () => "2026-08-12T15:32:00",
    idFactory: () => "preset-1",
    storage,
  });

  assert.equal(result.ok, true);
  assert.equal(result.preset.id, "preset-1");
  assert.equal(result.preset.baseName, "Goblin Combat");
  assert.equal(result.preset.label, "Goblin Combat - Aug 12 2026 15:32");
  assert.equal(result.preset.createdAt, result.preset.updatedAt);
  assert.equal(result.preset.active, true);
  assert.deepEqual(plain(result.preset.document), document);

  setFirstCell(document, "Mutated caller");
  setFirstCell(result.preset.document, "Mutated result");
  const stored = JSON.parse(storage.values.get(PRESETS_KEY));
  assert.equal(stored.version, 1);
  assert.equal(firstCell(stored.presets[0].document), "Goblin");
  createdPreset = stored.presets[0];
}

// Overwriting updates only the mutable snapshot fields and keeps collection order.
{
  const inactiveCreatedPreset = { ...createdPreset, active: false };
  const second = {
    id: "preset-2",
    baseName: "Dragons",
    label: "Dragons - Aug 12 2026 14:00",
    createdAt: "2026-08-12T21:00:00.000Z",
    updatedAt: "2026-08-12T21:00:00.000Z",
    document: validDocument({ id: "document-2", value: "Dragon" }),
  };
  const storage = createStorage({
    [PRESETS_KEY]: JSON.stringify({ version: 1, presets: [inactiveCreatedPreset, second] }),
  });
  const overwrittenDocument = validDocument({ id: "document-1", value: "Orc" });
  const result = api.overwritePreset({
    id: "preset-1",
    document: overwrittenDocument,
    now: () => "2026-08-13T10:15:00Z",
    storage,
  });

  assert.equal(result.ok, true);
  assert.equal(result.preset.label, createdPreset.label);
  assert.equal(result.preset.baseName, createdPreset.baseName);
  assert.equal(result.preset.createdAt, createdPreset.createdAt);
  assert.equal(result.preset.updatedAt, "2026-08-13T10:15:00.000Z");
  assert.equal(result.preset.active, false);
  assert.deepEqual(plain(result.preset.document), overwrittenDocument);
  assert.deepEqual(plain(result.presets.map((preset) => preset.id)), ["preset-1", "preset-2"]);

  const missing = api.overwritePreset({ id: "missing", document: validDocument(), storage });
  assert.equal(missing.ok, false);
  assert.match(missing.error.message, /no longer exists/i);
}

// Older collections without an active flag remain visible and migrate on write.
{
  const legacy = storedPreset(validDocument());
  const storage = createStorage({
    [PRESETS_KEY]: JSON.stringify({ version: 1, presets: [legacy] }),
  });
  const loaded = api.loadPresetCollection(storage);
  assert.equal(loaded[0].active, true);

  const saved = api.savePresetCollection(loaded, storage);
  assert.equal(saved.ok, true);
  assert.equal(JSON.parse(storage.values.get(PRESETS_KEY)).presets[0].active, true);

  legacy.active = "yes";
  storage.values.set(PRESETS_KEY, JSON.stringify({ version: 1, presets: [legacy] }));
  assert.deepEqual(plain(api.loadPresetCollection(storage)), []);
}

// Soft deletion retains the snapshot and supports later recovery.
{
  const original = { ...storedPreset(validDocument()), active: true };
  const storage = createStorage({
    [PRESETS_KEY]: JSON.stringify({ version: 1, presets: [original] }),
  });
  const deactivated = api.setPresetActive({ id: original.id, active: false, storage });
  assert.equal(deactivated.ok, true);
  assert.equal(deactivated.preset.active, false);
  assert.deepEqual(plain(deactivated.preset.document), plain(original.document));
  assert.equal(deactivated.preset.updatedAt, original.updatedAt);

  const storedInactive = JSON.parse(storage.values.get(PRESETS_KEY)).presets[0];
  assert.equal(storedInactive.active, false);
  assert.deepEqual(storedInactive.document, original.document);

  const reactivated = api.setPresetActive({ id: original.id, active: true, storage });
  assert.equal(reactivated.ok, true);
  assert.equal(api.loadPresetCollection(storage)[0].active, true);

  assert.equal(api.setPresetActive({ id: "missing", active: false, storage }).ok, false);
  assert.equal(api.setPresetActive({ id: original.id, active: "false", storage }).ok, false);

  storage.failWrites = true;
  const failed = api.setPresetActive({ id: original.id, active: false, storage });
  assert.equal(failed.ok, false);
  assert.match(failed.error.message, /storage full/i);
  assert.equal(api.loadPresetCollection(storage)[0].active, true);
}

// Failed writes are explicit and never mutate the caller's working document.
{
  const storage = createStorage();
  storage.failWrites = true;
  const document = validDocument({ value: "Still here" });
  const result = api.createPreset({
    baseName: "Failure",
    document,
    idFactory: () => "failure",
    storage,
  });
  assert.equal(result.ok, false);
  assert.match(result.error.message, /storage full/i);
  assert.equal(firstCell(document), "Still here");
  assert.equal(storage.values.has(PRESETS_KEY), false);
}

// Drafts recover the current and baseline documents without sharing references.
{
  const storage = createStorage();
  const baselineDocument = validDocument({ includeRow: false });
  const currentDocument = validDocument({ value: "Orc" });
  const saved = api.saveDraft({
    activePresetId: "preset-1",
    baselineDocument,
    currentDocument,
    storage,
  });
  assert.equal(saved.ok, true);
  assert.equal(saved.draft.version, 1);
  assert.equal(saved.draft.activePresetId, "preset-1");
  assert.match(saved.draft.updatedAt, /^\d{4}-\d{2}-\d{2}T/);

  baselineDocument.tables[0].title = "Caller mutation";
  setFirstCell(currentDocument, "Caller mutation");
  setFirstCell(saved.draft.currentDocument, "Result mutation");
  const recovered = api.loadDraft(storage);
  assert.equal(recovered.baselineDocument.tables[0].title, "Initiative");
  assert.equal(firstCell(recovered.currentDocument), "Orc");
  assert.equal(api.isDocumentDirty(recovered.currentDocument, recovered.baselineDocument), true);

  assert.equal(api.removeDraft(storage).ok, true);
  assert.equal(api.loadDraft(storage), null);
  assert.equal(storage.removals, 1);
}

// Draft storage failures report the error and leave the working object untouched.
{
  const storage = createStorage();
  storage.failWrites = true;
  const currentDocument = validDocument({ value: "Unsaved" });
  const saved = api.saveDraft({ currentDocument, storage });
  assert.equal(saved.ok, false);
  assert.match(saved.error.message, /storage full/i);
  assert.equal(firstCell(currentDocument), "Unsaved");
  assert.equal(storage.values.has(DRAFT_KEY), false);
  const removed = api.removeDraft(storage);
  assert.equal(removed.ok, false);
  assert.match(removed.error.message, /storage unavailable/i);
}

// Fingerprints ignore object key insertion order but detect data and array-order changes.
{
  const first = { z: 1, nested: { b: 2, a: 1 }, rows: ["a", "b"] };
  const same = { rows: ["a", "b"], nested: { a: 1, b: 2 }, z: 1 };
  const changed = { rows: ["b", "a"], nested: { a: 1, b: 2 }, z: 1 };
  assert.equal(api.documentFingerprint(first), api.documentFingerprint(same));
  assert.equal(api.isDocumentDirty(first, same), false);
  assert.equal(api.isDocumentDirty(changed, same), true);
  assert.equal(api.isDocumentDirty(first, null), true);
}

// Download creation is pure, filename-safe, and exports unsaved visible state.
{
  const storage = createStorage({ untouched: "yes" });
  const before = [...storage.values.entries()];
  const document = validDocument({ value: "new" });
  const download = api.createDownload({
    document,
    activePresetId: "preset-1",
    label: "Goblin Combat: Night #1",
    now: () => "2026-08-14T01:02:03Z",
  });

  assert.equal(download.filename, "goblin-combat-night-1.json");
  assert.equal(download.envelope.version, 1);
  assert.equal(download.envelope.exportedAt, "2026-08-14T01:02:03.000Z");
  assert.equal(download.envelope.activePresetId, "preset-1");
  assert.deepEqual(plain(JSON.parse(download.json)), plain(download.envelope));
  setFirstCell(document, "later mutation");
  assert.equal(firstCell(download.envelope.document), "new");
  assert.deepEqual([...storage.values.entries()], before);
  assert.equal(storage.writes, 0);
}

// Uploaded downloads and raw documents are validated and cloned before use.
{
  const document = validDocument({ value: "Uploaded Goblin" });
  const download = api.createDownload({
    document,
    label: "  Goblin\nNight\u0000  ",
    now: () => "2026-08-14T01:02:03Z",
  });
  const envelopeUpload = api.parsePresetUpload(download.json);
  assert.equal(envelopeUpload.label, "Goblin Night");
  assert.deepEqual(plain(envelopeUpload.document), plain(document));
  setFirstCell(envelopeUpload.document, "mutated result");
  assert.equal(firstCell(document), "Uploaded Goblin");

  const rawUpload = api.parsePresetUpload(JSON.stringify(document));
  assert.equal(rawUpload.label, "Uploaded Preset");
  assert.deepEqual(plain(rawUpload.document), plain(document));

  const objectUpload = api.parsePresetUpload({
    version: 1,
    label: " ",
    document,
  });
  assert.equal(objectUpload.label, "Uploaded Preset");

  for (const malformed of [
    "not json",
    "null",
    JSON.stringify({ version: 2, label: "Old", document }),
    JSON.stringify({ version: 1, label: "Broken", document: {} }),
    JSON.stringify({ ...document, version: 99 }),
  ]) {
    assert.throws(() => api.parsePresetUpload(malformed), /not valid JSON|incompatible|malformed/i);
  }
}

console.log("Combat and Loot repository tests passed.");
