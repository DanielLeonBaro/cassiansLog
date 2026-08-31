// Defines Combat and Loot normalization and state transformations without DOM side effects.
export const COMBAT_LOOT_DOCUMENT_VERSION = 1;
export const COMBAT_HEALTH_COLUMNS_VERSION = 1;
export const DEFAULT_TRACKERS_VERSION = 1;

let fallbackIdSequence = 0;

function defaultIdFactory(kind) {
  if (globalThis.crypto?.randomUUID) return `${kind}-${globalThis.crypto.randomUUID()}`;
  fallbackIdSequence += 1;
  return `${kind}-${Date.now().toString(36)}-${fallbackIdSequence.toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function resolveIdFactory(options = {}) {
  const idFactory = typeof options === "function" ? options : options.idFactory;
  if (idFactory !== undefined && typeof idFactory !== "function") {
    throw new TypeError("idFactory must be a function.");
  }
  return idFactory || defaultIdFactory;
}

function collectIds(document) {
  const ids = new Set();
  if (!document) return ids;
  if (document.id) ids.add(document.id);
  (document.tables || []).forEach((table) => {
    if (table.id) ids.add(table.id);
    (table.columns || []).forEach((column) => {
      if (column.id) ids.add(column.id);
    });
    (table.rows || []).forEach((row) => {
      if (row.id) ids.add(row.id);
    });
  });
  return ids;
}

function createIdAllocator(idFactory, document = null) {
  const usedIds = collectIds(document);
  return (kind) => {
    const id = String(idFactory(kind) ?? "").trim();
    if (!id) throw new Error(`idFactory returned an empty ID for ${kind}.`);
    if (usedIds.has(id)) throw new Error(`idFactory returned duplicate ID "${id}".`);
    usedIds.add(id);
    return id;
  };
}

function normalizeText(value) {
  return value === null || value === undefined ? "" : String(value);
}

function assertDocument(document) {
  if (!document || typeof document !== "object" || !Array.isArray(document.tables)) {
    throw new TypeError("A Combat and Loot document is required.");
  }
}

function cloneDocument(document) {
  assertDocument(document);
  return {
    ...document,
    tables: document.tables.map((table) => ({
      ...table,
      columns: table.columns.map((column) => ({ ...column })),
      rows: table.rows.map((row) => ({
        ...row,
        cells: { ...row.cells },
      })),
    })),
  };
}

function findTracker(document, tableId) {
  const tracker = document.tables.find((table) => table.id === tableId);
  if (!tracker) throw new Error(`Tracker "${tableId}" was not found.`);
  return tracker;
}

function findTrackerByType(document, type) {
  const tracker = document.tables.find((table) => table.type === type);
  if (!tracker) throw new Error(`${type} tracker was not found.`);
  return tracker;
}

function findRow(tracker, rowId) {
  const row = tracker.rows.find((candidate) => candidate.id === rowId);
  if (!row) throw new Error(`Row "${rowId}" was not found.`);
  return row;
}

function findColumn(tracker, columnId) {
  const column = tracker.columns.find((candidate) => candidate.id === columnId);
  if (!column) throw new Error(`Column "${columnId}" was not found.`);
  return column;
}

function assertInsertionIndex(index, length, label) {
  if (!Number.isInteger(index) || index < 0 || index > length) {
    throw new RangeError(`${label} insertion index must be between 0 and ${length}.`);
  }
}

function assertMoveIndex(index, length, label) {
  if (!Number.isInteger(index) || index < 0 || index >= length) {
    throw new RangeError(`${label} move index must be between 0 and ${Math.max(0, length - 1)}.`);
  }
}

function assertInitiativeStructureIsEditable(tracker) {
  if (tracker.type === "initiative") {
    throw new Error("Initiative tracker columns are locked.");
  }
}

function blankCells(columns) {
  return Object.fromEntries(columns.map((column) => [column.id, ""]));
}

function makeColumn(id, title, role) {
  return { id, title, role };
}

function makeRow(id, columns) {
  return { id, cells: blankCells(columns) };
}

function makeTrackerRow(id, tracker) {
  const row = makeRow(id, tracker.columns);
  if (tracker.type === "combat") {
    tracker.columns.forEach((column) => {
      if (["damage", "hp", "ac"].includes(column.role)) {
        row.cells[column.id] = "0";
      }
    });
  }
  return row;
}

function isDefaultBlankCombatRow(row, columns) {
  return !row.sourceInitiativeRowId
    && columns.every((column) => {
      const value = normalizeText(row.cells?.[column.id]).trim();
      return value === "" || (["damage", "hp", "currentHp", "ac"].includes(column.role) && value === "0");
    });
}

function healthNumber(value) {
  const text = normalizeText(value).trim();
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(text)) return null;
  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}

export function evaluateArithmeticFormula(value) {
  const formula = normalizeText(value).trim();
  if (!formula) return { valid: false, value: null };

  let index = 0;
  const skipWhitespace = () => {
    while (/\s/.test(formula[index] || "")) index += 1;
  };
  const parseNumber = () => {
    skipWhitespace();
    const match = formula.slice(index).match(/^(?:\d+(?:\.\d*)?|\.\d+)/);
    if (!match) return null;
    index += match[0].length;
    return Number(match[0]);
  };
  const parseValue = () => {
    skipWhitespace();
    let sign = 1;
    while (formula[index] === "+" || formula[index] === "-") {
      if (formula[index] === "-") sign *= -1;
      index += 1;
      skipWhitespace();
    }
    let number;
    if (formula[index] === "(") {
      index += 1;
      number = parseExpression();
      skipWhitespace();
      if (number === null || formula[index] !== ")") return null;
      index += 1;
    } else {
      number = parseNumber();
    }
    return number === null ? null : sign * number;
  };
  const parseExpression = () => {
    let total = parseValue();
    if (total === null) return null;
    while (true) {
      skipWhitespace();
      const operator = formula[index];
      if (operator !== "+" && operator !== "-") break;
      index += 1;
      const right = parseValue();
      if (right === null) return null;
      total = operator === "+" ? total + right : total - right;
    }
    return total;
  };

  const result = parseExpression();
  skipWhitespace();
  return result !== null && Number.isFinite(result) && index === formula.length
    ? { valid: true, value: result }
    : { valid: false, value: null };
}

export function calculateCurrentHP(hitPoints, damage) {
  const hpNumber = healthNumber(hitPoints);
  const damageText = normalizeText(damage).trim();
  const damageResult = damageText
    ? evaluateArithmeticFormula(damageText)
    : { valid: true, value: 0 };
  const damageNumber = damageResult.value;
  const hpValid = hpNumber !== null;
  const damageValid = damageResult.valid;
  return {
    valid: hpValid && damageValid,
    hpValid,
    damageValid,
    value: hpValid && damageValid ? hpNumber - damageNumber : null,
  };
}

export function normalizeCharacterName(value) {
  const name = normalizeText(value).trim();
  return name ? `${name[0].toLocaleUpperCase()}${name.slice(1)}` : "";
}

export function createCombatLootDocument(options = {}) {
  const allocateId = createIdAllocator(resolveIdFactory(options));

  const initiativeColumns = [
    makeColumn(allocateId("column"), "Character", "character"),
    makeColumn(allocateId("column"), "Initiative", "initiative"),
  ];
  const combatColumns = [
    makeColumn(allocateId("column"), "Character", "character"),
    makeColumn(allocateId("column"), "Damage", "damage"),
    makeColumn(allocateId("column"), "HP", "hp"),
    makeColumn(allocateId("column"), "Current HP", "currentHp"),
    makeColumn(allocateId("column"), "AC", "ac"),
    makeColumn(allocateId("column"), "Condition", "condition"),
    makeColumn(allocateId("column"), "Round 1", "round"),
  ];
  const lootColumns = [
    makeColumn(allocateId("column"), "Item", "custom"),
    makeColumn(allocateId("column"), "Quantity", "custom"),
    makeColumn(allocateId("column"), "Description/Source", "custom"),
  ];
  const xpColumns = [
    makeColumn(allocateId("column"), "Source", "custom"),
    makeColumn(allocateId("column"), "Points", "custom"),
  ];

  return {
    version: COMBAT_LOOT_DOCUMENT_VERSION,
    id: allocateId("document"),
    nextTrackerNumber: 1,
    defaultTrackersVersion: DEFAULT_TRACKERS_VERSION,
    tables: [
      {
        id: allocateId("table"),
        type: "initiative",
        title: "Initiative",
        columns: initiativeColumns,
        rows: [makeRow(allocateId("row"), initiativeColumns)],
      },
      {
        id: allocateId("table"),
        type: "combat",
        title: "Combat",
        nextRoundNumber: 2,
        healthColumnsVersion: COMBAT_HEALTH_COLUMNS_VERSION,
        columns: combatColumns,
        rows: [makeTrackerRow(allocateId("row"), { type: "combat", columns: combatColumns })],
      },
      {
        id: allocateId("table"),
        type: "custom",
        title: "Loot",
        defaultTrackerKey: "loot",
        columns: lootColumns,
        rows: [makeRow(allocateId("row"), lootColumns)],
      },
      {
        id: allocateId("table"),
        type: "custom",
        title: "XP",
        defaultTrackerKey: "xp",
        columns: xpColumns,
        rows: [makeRow(allocateId("row"), xpColumns)],
      },
    ],
  };
}

export function initializeDefaultTrackers(document, options = {}) {
  const copy = cloneDocument(document);
  delete copy.party;
  if (copy.defaultTrackersVersion >= DEFAULT_TRACKERS_VERSION) return copy;

  const allocateId = createIdAllocator(resolveIdFactory(options), copy);
  const loot = copy.tables.find((table) => table.defaultTrackerKey === "loot")
    || copy.tables.find((table) => table.type === "custom" && table.title === "Loot");
  if (loot) {
    loot.defaultTrackerKey = "loot";
    if (loot.columns[0]?.title === "Column 1") loot.columns[0].title = "Item";
    ["Quantity", "Description/Source"].forEach((title) => {
      if (loot.columns.some((column) => column.title === title)) return;
      const column = makeColumn(allocateId("column"), title, "custom");
      loot.columns.push(column);
      loot.rows.forEach((row) => { row.cells[column.id] = ""; });
    });
  }

  let xp = copy.tables.find((table) => table.defaultTrackerKey === "xp")
    || copy.tables.find((table) => table.type === "custom" && table.title === "XP");
  if (!xp) {
    const columns = [
      makeColumn(allocateId("column"), "Source", "custom"),
      makeColumn(allocateId("column"), "Points", "custom"),
    ];
    xp = {
      id: allocateId("table"),
      type: "custom",
      title: "XP",
      defaultTrackerKey: "xp",
      columns,
      rows: [makeRow(allocateId("row"), columns)],
    };
    const lootIndex = loot ? copy.tables.indexOf(loot) : copy.tables.length - 1;
    copy.tables.splice(lootIndex + 1, 0, xp);
  } else {
    xp.defaultTrackerKey = "xp";
  }

  copy.defaultTrackersVersion = DEFAULT_TRACKERS_VERSION;
  return copy;
}

export function initializeCombatHealthColumns(document, options = {}) {
  const copy = cloneDocument(document);
  const combat = findTrackerByType(copy, "combat");
  if (combat.healthColumnsVersion >= COMBAT_HEALTH_COLUMNS_VERSION) return copy;

  const allocateId = createIdAllocator(resolveIdFactory(options), copy);
  let damageColumn = combat.columns.find((column) => column.role === "damage");
  if (!damageColumn) {
    damageColumn = makeColumn(allocateId("column"), "Damage", "damage");
    const hpIndex = combat.columns.findIndex((column) => column.role === "hp");
    const characterIndex = combat.columns.findIndex((column) => column.role === "character");
    const insertionIndex = hpIndex >= 0 ? hpIndex : characterIndex >= 0 ? characterIndex + 1 : 0;
    combat.columns.splice(insertionIndex, 0, damageColumn);
    combat.rows.forEach((row) => {
      row.cells[damageColumn.id] = "";
    });
  }

  let currentHPColumn = combat.columns.find((column) => column.role === "currentHp");
  if (!currentHPColumn) {
    currentHPColumn = makeColumn(allocateId("column"), "Current HP", "currentHp");
    const hpIndex = combat.columns.findIndex((column) => column.role === "hp");
    const damageIndex = combat.columns.indexOf(damageColumn);
    const insertionIndex = hpIndex >= 0 ? hpIndex + 1 : damageIndex >= 0 ? damageIndex + 1 : 0;
    combat.columns.splice(insertionIndex, 0, currentHPColumn);
    combat.rows.forEach((row) => {
      row.cells[currentHPColumn.id] = "";
    });
  }

  combat.healthColumnsVersion = COMBAT_HEALTH_COLUMNS_VERSION;
  return copy;
}

export function addCustomTracker(document, options = {}) {
  const copy = cloneDocument(document);
  const allocateId = createIdAllocator(resolveIdFactory(options), copy);
  const trackerNumber = Number.isInteger(copy.nextTrackerNumber) && copy.nextTrackerNumber > 0
    ? copy.nextTrackerNumber
    : 1;
  const column = makeColumn(allocateId("column"), "Column 1", "custom");
  copy.tables.push({
    id: allocateId("table"),
    type: "custom",
    title: Object.prototype.hasOwnProperty.call(options, "title")
      ? normalizeText(options.title)
      : `Tracker ${trackerNumber}`,
    columns: [column],
    rows: [makeRow(allocateId("row"), [column])],
  });
  copy.nextTrackerNumber = trackerNumber + 1;
  return copy;
}

export function renameTracker(document, tableId, title) {
  const copy = cloneDocument(document);
  const tracker = findTracker(copy, tableId);
  if (tracker.type !== "custom") throw new Error("Only custom trackers can be renamed.");
  tracker.title = normalizeText(title);
  return copy;
}

export function deleteCustomTracker(document, tableId) {
  const copy = cloneDocument(document);
  const tracker = findTracker(copy, tableId);
  if (tracker.type !== "custom") throw new Error("Only custom trackers can be deleted.");
  copy.tables.splice(copy.tables.indexOf(tracker), 1);
  return copy;
}

export function insertTrackerRow(document, tableId, index, options = {}) {
  const copy = cloneDocument(document);
  const tracker = findTracker(copy, tableId);
  assertInsertionIndex(index, tracker.rows.length, "Row");
  const allocateId = createIdAllocator(resolveIdFactory(options), copy);
  tracker.rows.splice(index, 0, makeTrackerRow(allocateId("row"), tracker));
  return copy;
}

export function deleteTrackerRow(document, tableId, rowId) {
  const copy = cloneDocument(document);
  const tracker = findTracker(copy, tableId);
  const row = findRow(tracker, rowId);
  tracker.rows.splice(tracker.rows.indexOf(row), 1);
  return copy;
}

export function moveTrackerRow(document, tableId, rowId, toIndex) {
  const copy = cloneDocument(document);
  const tracker = findTracker(copy, tableId);
  assertMoveIndex(toIndex, tracker.rows.length, "Row");
  const row = findRow(tracker, rowId);
  const fromIndex = tracker.rows.indexOf(row);
  tracker.rows.splice(fromIndex, 1);
  tracker.rows.splice(toIndex, 0, row);
  return copy;
}

export function insertTrackerColumn(document, tableId, index, options = {}) {
  const copy = cloneDocument(document);
  const tracker = findTracker(copy, tableId);
  assertInitiativeStructureIsEditable(tracker);
  assertInsertionIndex(index, tracker.columns.length, "Column");
  const allocateId = createIdAllocator(resolveIdFactory(options), copy);
  const title = Object.prototype.hasOwnProperty.call(options, "title")
    ? normalizeText(options.title)
    : `Column ${tracker.columns.length + 1}`;
  const column = makeColumn(allocateId("column"), title, "custom");
  tracker.columns.splice(index, 0, column);
  tracker.rows.forEach((row) => {
    row.cells[column.id] = "";
  });
  return copy;
}

export function deleteTrackerColumn(document, tableId, columnId) {
  const copy = cloneDocument(document);
  const tracker = findTracker(copy, tableId);
  assertInitiativeStructureIsEditable(tracker);
  const column = findColumn(tracker, columnId);
  tracker.columns.splice(tracker.columns.indexOf(column), 1);
  tracker.rows.forEach((row) => {
    delete row.cells[column.id];
  });
  return copy;
}

export function moveTrackerColumn(document, tableId, columnId, toIndex) {
  const copy = cloneDocument(document);
  const tracker = findTracker(copy, tableId);
  assertInitiativeStructureIsEditable(tracker);
  assertMoveIndex(toIndex, tracker.columns.length, "Column");
  const column = findColumn(tracker, columnId);
  const fromIndex = tracker.columns.indexOf(column);
  tracker.columns.splice(fromIndex, 1);
  tracker.columns.splice(toIndex, 0, column);
  return copy;
}

export function renameTrackerColumn(document, tableId, columnId, title) {
  const copy = cloneDocument(document);
  const tracker = findTracker(copy, tableId);
  assertInitiativeStructureIsEditable(tracker);
  findColumn(tracker, columnId).title = normalizeText(title);
  return copy;
}

export function updateTrackerCell(document, tableId, rowId, columnId, value) {
  const copy = cloneDocument(document);
  const tracker = findTracker(copy, tableId);
  findColumn(tracker, columnId);
  findRow(tracker, rowId).cells[columnId] = normalizeText(value);
  return copy;
}

export function addCombatRound(document, options = {}) {
  const copy = cloneDocument(document);
  const combat = findTrackerByType(copy, "combat");
  const allocateId = createIdAllocator(resolveIdFactory(options), copy);
  const nextRoundNumber = Number.isInteger(combat.nextRoundNumber) && combat.nextRoundNumber > 0
    ? combat.nextRoundNumber
    : 1;
  const column = makeColumn(allocateId("column"), `Round ${nextRoundNumber}`, "round");
  combat.columns.push(column);
  combat.rows.forEach((row) => {
    row.cells[column.id] = "";
  });
  combat.nextRoundNumber = nextRoundNumber + 1;
  return copy;
}

function initiativeNumber(value) {
  const text = normalizeText(value).trim();
  if (!text) return null;
  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}

export function sortInitiativeRows(document) {
  const copy = cloneDocument(document);
  const initiative = findTrackerByType(copy, "initiative");
  const initiativeColumn = initiative.columns.find((column) => column.role === "initiative");
  if (!initiativeColumn) throw new Error("Initiative column was not found.");

  initiative.rows = initiative.rows
    .map((row, originalIndex) => ({
      row,
      originalIndex,
      initiative: initiativeNumber(row.cells[initiativeColumn.id]),
    }))
    .sort((left, right) => {
      if (left.initiative === null && right.initiative === null) {
        return left.originalIndex - right.originalIndex;
      }
      if (left.initiative === null) return 1;
      if (right.initiative === null) return -1;
      return right.initiative - left.initiative || left.originalIndex - right.originalIndex;
    })
    .map(({ row }) => row);
  return copy;
}

function comparableName(value) {
  return normalizeText(value).trim().toLowerCase();
}

export function bringPartyMembersToInitiative(document, members, options = {}) {
  const copy = cloneDocument(document);
  const initiative = findTrackerByType(copy, "initiative");
  const characterColumn = initiative.columns.find((column) => column.role === "character");
  if (!characterColumn) throw new Error("Initiative character column was not found.");
  const initiativeColumn = initiative.columns.find((column) => column.role === "initiative");
  const party = Array.isArray(members) ? members : [];
  const existingNames = new Set(initiative.rows
    .map((row) => comparableName(row.cells[characterColumn.id]))
    .filter(Boolean));
  const incoming = party.filter((member) => {
    const name = comparableName(member.character);
    if (!name || existingNames.has(name)) return false;
    existingNames.add(name);
    return true;
  });
  if (!incoming.length) return copy;

  const allocateId = createIdAllocator(resolveIdFactory(options), copy);
  const blankRows = initiative.rows.filter((row) =>
    initiative.columns.every((column) => !normalizeText(row.cells[column.id]).trim()));
  incoming.forEach((member, index) => {
    const row = blankRows[index] || makeRow(allocateId("row"), initiative.columns);
    row.cells[characterColumn.id] = normalizeCharacterName(member.character);
    if (initiativeColumn) row.cells[initiativeColumn.id] = "";
    if (!blankRows[index]) initiative.rows.push(row);
  });
  return copy;
}

export function mergeInitiativeIntoCombat(document, options = {}) {
  const copy = cloneDocument(document);
  const initiative = findTrackerByType(copy, "initiative");
  const combat = findTrackerByType(copy, "combat");
  const initiativeCharacterColumn = initiative.columns.find((column) => column.role === "character");
  if (!initiativeCharacterColumn) throw new Error("Initiative character column was not found.");

  const allocateId = createIdAllocator(resolveIdFactory(options), copy);
  let combatCharacterColumn = combat.columns.find((column) => column.role === "character");
  if (!combatCharacterColumn) {
    combatCharacterColumn = makeColumn(allocateId("column"), "Character", "character");
    combat.columns.unshift(combatCharacterColumn);
    combat.rows.forEach((row) => {
      row.cells[combatCharacterColumn.id] = "";
    });
  }

  const incoming = initiative.rows
    .map((row) => ({
      row,
      name: normalizeText(row.cells[initiativeCharacterColumn.id]).trim(),
    }))
    .filter(({ name }) => name.length > 0);
  if (
    incoming.length > 0
    && combat.rows.length === 1
    && isDefaultBlankCombatRow(combat.rows[0], combat.columns)
  ) {
    combat.rows = [];
  }
  const availableRows = new Set(combat.rows);
  const matchedRows = new Map();

  // Reserve source-ID matches before falling back to names so a renamed
  // initiative entry cannot lose its established combat row to a namesake.
  incoming.forEach(({ row: initiativeRow }) => {
    const match = combat.rows.find((combatRow) =>
      availableRows.has(combatRow)
      && combatRow.sourceInitiativeRowId === initiativeRow.id);
    if (!match) return;
    matchedRows.set(initiativeRow.id, match);
    availableRows.delete(match);
  });

  incoming.forEach(({ row: initiativeRow, name }) => {
    if (matchedRows.has(initiativeRow.id)) return;
    const normalizedName = comparableName(name);
    const match = combat.rows.find((combatRow) =>
      availableRows.has(combatRow)
      && comparableName(combatRow.cells[combatCharacterColumn.id]) === normalizedName);
    if (!match) return;
    match.sourceInitiativeRowId = initiativeRow.id;
    matchedRows.set(initiativeRow.id, match);
    availableRows.delete(match);
  });

  const orderedRows = incoming.map(({ row: initiativeRow, name }) => {
    const match = matchedRows.get(initiativeRow.id);
    if (match) {
      match.cells[combatCharacterColumn.id] = name;
      return match;
    }
    const row = makeTrackerRow(allocateId("row"), combat);
    row.sourceInitiativeRowId = initiativeRow.id;
    row.cells[combatCharacterColumn.id] = name;
    return row;
  });

  combat.rows = [
    ...orderedRows,
    ...combat.rows.filter((row) => availableRows.has(row)),
  ];

  const hpColumn = combat.columns.find((column) => column.role === "hp");
  const acColumn = combat.columns.find((column) => column.role === "ac");
  const suppliedPartyMembers = typeof options === "object" && Array.isArray(options.partyMembers)
    ? options.partyMembers
    : [];
  const partyByName = new Map(suppliedPartyMembers
    .map((member) => [comparableName(member.character), member])
    .filter(([name]) => name));
  combat.rows.forEach((row) => {
    const member = partyByName.get(comparableName(row.cells[combatCharacterColumn.id]));
    if (!member) return;
    if (hpColumn) row.cells[hpColumn.id] = normalizeText(member.maxHp);
    if (acColumn) row.cells[acColumn.id] = normalizeText(member.ac);
  });
  return copy;
}
