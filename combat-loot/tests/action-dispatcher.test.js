import assert from "node:assert/strict";
import {
  columnHasData,
  createCombatActionDispatcher,
  rowHasData,
  tableHasData,
} from "../js/action-dispatcher.js";
import { createCombatLootDocument } from "../js/model.js";

assert.equal(rowHasData({ cells: { name: "", note: "  " } }), false);
assert.equal(rowHasData({ cells: { name: "Goblin" } }), true);
assert.equal(columnHasData({ rows: [{ cells: { hp: "2" } }] }, { id: "hp", title: "" }), true);
assert.equal(tableHasData({ title: "", columns: [], rows: [] }), false);

let document = createCombatLootDocument();
const initiative = () => document.tables.find((table) => table.type === "initiative");
const initialRows = initiative().rows.length;
let appliedMessage = "";
let opened = null;
const handleAction = createCombatActionDispatcher({
  applyMutation(operation, message = "") {
    document = operation(document);
    appliedMessage = message;
  },
  tableById: (id) => document.tables.find((table) => table.id === id),
  rowById: (table, id) => table?.rows.find((row) => row.id === id),
  columnById: (table, id) => table?.columns.find((column) => column.id === id),
  requestDeletion: ({ action }) => action(),
  openCellEditor: (...ids) => { opened = ids; },
});

handleAction({ dataset: { action: "add-row-end", tableId: initiative().id } });
assert.equal(initiative().rows.length, initialRows + 1);
handleAction({ dataset: { action: "sort-initiative" } });
assert.equal(appliedMessage, "Initiative sorted from highest to lowest.");
const row = initiative().rows[0];
const column = initiative().columns[0];
handleAction({
  dataset: {
    action: "open-cell-editor",
    tableId: initiative().id,
    rowId: row.id,
    columnId: column.id,
  },
});
assert.deepEqual(opened, [initiative().id, row.id, column.id]);

console.log("Combat action dispatcher tests passed.");
