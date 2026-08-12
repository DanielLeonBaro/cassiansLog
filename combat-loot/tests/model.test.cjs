const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const source = fs.readFileSync("combat-loot/js/model.js", "utf8").replace(/export /g, "");
const context = {};
vm.createContext(context);
vm.runInContext(`${source}
globalThis.model = {
  COMBAT_LOOT_DOCUMENT_VERSION,
  COMBAT_HEALTH_COLUMNS_VERSION,
  calculateCurrentHP,
  createCombatLootDocument,
  initializeCombatHealthColumns,
  addCustomTracker,
  renameTracker,
  deleteCustomTracker,
  insertTrackerRow,
  deleteTrackerRow,
  moveTrackerRow,
  insertTrackerColumn,
  deleteTrackerColumn,
  moveTrackerColumn,
  renameTrackerColumn,
  updateTrackerCell,
  addCombatRound,
  sortInitiativeRows,
  mergeInitiativeIntoCombat,
};`, context);

const model = context.model;

function sequentialIds() {
  let sequence = 0;
  return (kind) => `${kind}-${++sequence}`;
}

function makeDocument() {
  const idFactory = sequentialIds();
  return { document: model.createCombatLootDocument({ idFactory }), idFactory };
}

function tracker(document, type) {
  return document.tables.find((table) => table.type === type);
}

function column(table, role) {
  return table.columns.find((candidate) => candidate.role === role);
}

function roleNames(table) {
  return Array.from(table.columns, (candidate) => candidate.role);
}

function cellValues(table, role) {
  const targetColumn = column(table, role);
  return Array.from(table.rows, (row) => row.cells[targetColumn.id]);
}

function setCell(document, tableType, rowId, role, value) {
  const table = tracker(document, tableType);
  return model.updateTrackerCell(document, table.id, rowId, column(table, role).id, value);
}

{
  const { document } = makeDocument();
  assert.equal(document.version, 1);
  assert.equal(document.tables.length, 3);
  assert.equal(document.nextTrackerNumber, 1);

  const initiative = tracker(document, "initiative");
  assert.equal(initiative.title, "Initiative");
  assert.deepEqual(roleNames(initiative), ["character", "initiative"]);
  assert.equal(initiative.rows.length, 1);
  assert.equal(Object.prototype.hasOwnProperty.call(initiative.rows[0], "number"), false);

  const combat = tracker(document, "combat");
  assert.deepEqual(roleNames(combat), [
    "character", "damage", "hp", "currentHp", "ac", "condition", "round",
  ]);
  assert.deepEqual(Array.from(combat.columns, (item) => item.title), [
    "Character", "Damage", "HP", "Current HP", "AC", "Condition", "Round 1",
  ]);
  assert.equal(combat.healthColumnsVersion, 1);
  assert.equal(combat.nextRoundNumber, 2);
  assert.equal(combat.rows.length, 1);

  const loot = document.tables.find((table) => table.title === "Loot");
  assert.equal(loot.type, "custom");
  assert.equal(loot.columns.length, 1);
  assert.equal(loot.columns[0].title, "Column 1");
  assert.equal(loot.rows.length, 1);
  assert.equal(loot.rows[0].cells[loot.columns[0].id], "");

  const ids = [document.id];
  document.tables.forEach((table) => {
    ids.push(table.id, ...table.columns.map((item) => item.id), ...table.rows.map((item) => item.id));
  });
  assert.equal(new Set(ids).size, ids.length);
}

{
  let result = model.calculateCurrentHP("50", "55");
  assert.equal(result.valid, true);
  assert.equal(result.hpValid, true);
  assert.equal(result.damageValid, true);
  assert.equal(result.value, -5, "current HP may be negative");

  result = model.calculateCurrentHP(" 20.5 ", "+2.5");
  assert.equal(result.valid, true);
  assert.equal(result.value, 18);

  result = model.calculateCurrentHP("50 HP", "3");
  assert.equal(result.valid, false);
  assert.equal(result.hpValid, false);
  assert.equal(result.damageValid, true);
  assert.equal(result.value, null);

  result = model.calculateCurrentHP("50", "");
  assert.equal(result.valid, false);
  assert.equal(result.hpValid, true);
  assert.equal(result.damageValid, false);
  assert.equal(result.value, null);

  assert.equal(model.calculateCurrentHP("Infinity", "1").valid, false);
  assert.equal(model.calculateCurrentHP("0x10", "1").valid, false);
}

{
  const { document: current, idFactory } = makeDocument();
  const older = JSON.parse(JSON.stringify(current));
  const olderCombat = tracker(older, "combat");
  delete olderCombat.healthColumnsVersion;
  const removedColumnIds = olderCombat.columns
    .filter((item) => ["damage", "currentHp"].includes(item.role))
    .map((item) => item.id);
  olderCombat.columns = olderCombat.columns.filter(
    (item) => !["damage", "currentHp"].includes(item.role),
  );
  olderCombat.rows.forEach((row) => removedColumnIds.forEach((id) => delete row.cells[id]));

  let migrated = model.initializeCombatHealthColumns(older, { idFactory });
  const migratedCombat = tracker(migrated, "combat");
  assert.deepEqual(roleNames(migratedCombat), [
    "character", "damage", "hp", "currentHp", "ac", "condition", "round",
  ]);
  assert.equal(migratedCombat.healthColumnsVersion, 1);
  assert.equal(cellValues(migratedCombat, "damage")[0], "");
  assert.equal(cellValues(migratedCombat, "currentHp")[0], "");
  assert.equal(olderCombat.healthColumnsVersion, undefined, "migration must not mutate input");

  const damageId = column(migratedCombat, "damage").id;
  const currentHPId = column(migratedCombat, "currentHp").id;
  migrated = model.deleteTrackerColumn(migrated, migratedCombat.id, damageId);
  migrated = model.deleteTrackerColumn(migrated, migratedCombat.id, currentHPId);
  migrated = model.initializeCombatHealthColumns(migrated, { idFactory });
  assert.equal(column(tracker(migrated, "combat"), "damage"), undefined);
  assert.equal(column(tracker(migrated, "combat"), "currentHp"), undefined);
}

{
  const { document, idFactory } = makeDocument();
  const originalJSON = JSON.stringify(document);
  let changed = model.addCustomTracker(document, { idFactory });
  assert.equal(JSON.stringify(document), originalJSON, "operations must not mutate their input");
  assert.equal(changed.tables.at(-1).title, "Tracker 1");
  assert.equal(changed.tables.at(-1).columns.length, 1);
  assert.equal(changed.tables.at(-1).rows.length, 1);
  assert.equal(changed.nextTrackerNumber, 2);

  changed = model.addCustomTracker(changed, { idFactory, title: "Treasure" });
  assert.equal(changed.tables.at(-1).title, "Treasure");
  assert.equal(changed.nextTrackerNumber, 3);
  const treasureId = changed.tables.at(-1).id;
  changed = model.renameTracker(changed, treasureId, null);
  assert.equal(changed.tables.at(-1).title, "");
  changed = model.deleteCustomTracker(changed, treasureId);
  assert.equal(changed.tables.some((table) => table.id === treasureId), false);
}

{
  const { document: initial, idFactory } = makeDocument();
  const initiativeId = tracker(initial, "initiative").id;
  const firstRowId = tracker(initial, "initiative").rows[0].id;
  let document = setCell(initial, "initiative", firstRowId, "character", "Second");
  document = model.insertTrackerRow(document, initiativeId, 0, { idFactory });
  let initiative = tracker(document, "initiative");
  const insertedRowId = initiative.rows[0].id;
  document = setCell(document, "initiative", insertedRowId, "character", 12);
  initiative = tracker(document, "initiative");
  assert.equal(initiative.rows[0].cells[column(initiative, "character").id], "12");
  assert.equal(tracker(initial, "initiative").rows[0].cells[column(tracker(initial, "initiative"), "character").id], "");

  document = model.moveTrackerRow(document, initiativeId, firstRowId, 0);
  assert.deepEqual(cellValues(tracker(document, "initiative"), "character"), ["Second", "12"]);
  document = model.deleteTrackerRow(document, initiativeId, firstRowId);
  assert.deepEqual(cellValues(tracker(document, "initiative"), "character"), ["12"]);
  document = model.updateTrackerCell(
    document,
    initiativeId,
    insertedRowId,
    column(tracker(document, "initiative"), "character").id,
    undefined,
  );
  assert.equal(cellValues(tracker(document, "initiative"), "character")[0], "");
}

{
  const { document } = makeDocument();
  const initiative = tracker(document, "initiative");
  const combat = tracker(document, "combat");
  assert.throws(
    () => model.insertTrackerColumn(document, initiative.id, 0),
    /columns are locked/,
  );
  assert.throws(
    () => model.deleteTrackerColumn(document, initiative.id, initiative.columns[0].id),
    /columns are locked/,
  );
  assert.throws(
    () => model.moveTrackerColumn(document, initiative.id, initiative.columns[0].id, 1),
    /columns are locked/,
  );
  assert.throws(
    () => model.renameTrackerColumn(document, initiative.id, initiative.columns[0].id, "Actor"),
    /columns are locked/,
  );
  assert.throws(() => model.renameTracker(document, combat.id, "Battle"), /Only custom/);
  assert.throws(() => model.deleteCustomTracker(document, initiative.id), /Only custom/);
}

{
  const { document: initial, idFactory } = makeDocument();
  const combatId = tracker(initial, "combat").id;
  let document = model.insertTrackerColumn(initial, combatId, 1, {
    idFactory,
    title: "Notes",
  });
  let combat = tracker(document, "combat");
  const notes = combat.columns[1];
  assert.equal(notes.role, "custom");
  assert.equal(combat.rows[0].cells[notes.id], "");

  document = model.renameTrackerColumn(document, combatId, notes.id, "Tactics");
  const characterId = column(tracker(document, "combat"), "character").id;
  document = model.renameTrackerColumn(document, combatId, characterId, "Actor");
  document = model.moveTrackerColumn(document, combatId, characterId, 2);
  combat = tracker(document, "combat");
  assert.equal(column(combat, "character").title, "Actor");
  assert.equal(combat.columns[2].role, "character");

  const damageId = column(combat, "damage").id;
  document = model.renameTrackerColumn(document, combatId, damageId, "Wounds");
  document = model.moveTrackerColumn(document, combatId, damageId, combat.columns.length - 1);
  combat = tracker(document, "combat");
  assert.equal(column(combat, "damage").title, "Wounds");
  assert.equal(combat.columns.at(-1).role, "damage");

  document = model.deleteTrackerColumn(document, combatId, notes.id);
  combat = tracker(document, "combat");
  assert.equal(combat.columns.some((item) => item.id === notes.id), false);
  assert.equal(Object.prototype.hasOwnProperty.call(combat.rows[0].cells, notes.id), false);

  document = model.addCombatRound(document, { idFactory });
  combat = tracker(document, "combat");
  const round2 = combat.columns.find((item) => item.title === "Round 2");
  assert.ok(round2);
  document = model.renameTrackerColumn(document, combatId, round2.id, "Bonus round");
  document = model.deleteTrackerColumn(document, combatId, round2.id);
  document = model.addCombatRound(document, { idFactory });
  combat = tracker(document, "combat");
  assert.ok(combat.columns.some((item) => item.title === "Round 3"));
  assert.equal(combat.nextRoundNumber, 4);
}

{
  const { document: initial, idFactory } = makeDocument();
  const initiativeId = tracker(initial, "initiative").id;
  let document = initial;
  const entries = [
    ["Tie A", "18"],
    ["Invalid", "12 or so"],
    ["Tie B", 18],
    ["Negative", -2],
    ["Blank", ""],
  ];
  for (let index = 1; index < entries.length; index += 1) {
    document = model.insertTrackerRow(document, initiativeId, index, { idFactory });
  }
  entries.forEach(([name, initiativeValue], index) => {
    const rowId = tracker(document, "initiative").rows[index].id;
    document = setCell(document, "initiative", rowId, "character", name);
    document = setCell(document, "initiative", rowId, "initiative", initiativeValue);
  });

  const originalOrder = cellValues(tracker(document, "initiative"), "character");
  const sorted = model.sortInitiativeRows(document);
  assert.deepEqual(cellValues(tracker(sorted, "initiative"), "character"), [
    "Tie A", "Tie B", "Negative", "Invalid", "Blank",
  ]);
  assert.deepEqual(cellValues(tracker(document, "initiative"), "character"), originalOrder);
}

{
  const { document: initial, idFactory } = makeDocument();
  let document = initial;
  const initiativeId = tracker(document, "initiative").id;
  const combatId = tracker(document, "combat").id;
  const incomingNames = ["Goblin", "Renamed", "goblin", "New foe", "   "];
  for (let index = 1; index < incomingNames.length; index += 1) {
    document = model.insertTrackerRow(document, initiativeId, index, { idFactory });
  }
  incomingNames.forEach((name, index) => {
    document = setCell(
      document,
      "initiative",
      tracker(document, "initiative").rows[index].id,
      "character",
      name,
    );
  });
  for (let index = 1; index < 3; index += 1) {
    document = model.insertTrackerRow(document, combatId, index, { idFactory });
  }
  const combatNames = ["Goblin", "GOBLIN", "Unmatched"];
  const hitPoints = ["8", "4", "9"];
  combatNames.forEach((name, index) => {
    const rowId = tracker(document, "combat").rows[index].id;
    document = setCell(document, "combat", rowId, "character", name);
    document = setCell(document, "combat", rowId, "hp", hitPoints[index]);
  });

  // Build the source-link fixture explicitly: it is persisted model data rather
  // than a cell value exposed by the editor.
  document = JSON.parse(JSON.stringify(document));
  const sourceInitiativeRow = tracker(document, "initiative").rows[1];
  tracker(document, "combat").rows[0].sourceInitiativeRowId = sourceInitiativeRow.id;
  const originalJSON = JSON.stringify(document);
  const merged = model.mergeInitiativeIntoCombat(document, { idFactory });
  assert.equal(JSON.stringify(document), originalJSON);

  const mergedCombat = tracker(merged, "combat");
  assert.deepEqual(cellValues(mergedCombat, "hp"), ["4", "8", "", "", "9"]);
  assert.deepEqual(cellValues(mergedCombat, "character"), [
    "Goblin", "Renamed", "goblin", "New foe", "Unmatched",
  ]);
  assert.equal(mergedCombat.rows[0].sourceInitiativeRowId, tracker(merged, "initiative").rows[0].id);
  assert.equal(mergedCombat.rows[1].sourceInitiativeRowId, sourceInitiativeRow.id);
  assert.equal(mergedCombat.rows[2].sourceInitiativeRowId, tracker(merged, "initiative").rows[2].id);
}

{
  const { document: initial, idFactory } = makeDocument();
  let document = initial;
  const initiative = tracker(document, "initiative");
  const initiativeRowId = initiative.rows[0].id;
  document = setCell(document, "initiative", initiativeRowId, "character", "Alice");
  let combat = tracker(document, "combat");
  const combatRowId = combat.rows[0].id;
  document = setCell(document, "combat", combatRowId, "hp", "10");
  document = JSON.parse(JSON.stringify(document));
  tracker(document, "combat").rows[0].sourceInitiativeRowId = initiativeRowId;
  combat = tracker(document, "combat");
  const oldCharacterColumnId = column(combat, "character").id;
  document = model.deleteTrackerColumn(document, combat.id, oldCharacterColumnId);
  document = model.mergeInitiativeIntoCombat(document, { idFactory });

  combat = tracker(document, "combat");
  assert.equal(combat.columns[0].role, "character");
  assert.equal(combat.rows[0].id, combatRowId);
  assert.equal(combat.rows[0].cells[column(combat, "character").id], "Alice");
  assert.equal(combat.rows[0].cells[column(combat, "hp").id], "10");
}

{
  const { document } = makeDocument();
  const initiative = tracker(document, "initiative");
  assert.throws(
    () => model.updateTrackerCell(document, initiative.id, "missing", initiative.columns[0].id, "x"),
    /Row .* was not found/,
  );
  assert.throws(
    () => model.insertTrackerRow(document, initiative.id, 2),
    /insertion index/,
  );
  assert.throws(
    () => model.moveTrackerRow(document, initiative.id, initiative.rows[0].id, 1),
    /move index/,
  );
}

console.log("Combat and Loot model tests passed.");
