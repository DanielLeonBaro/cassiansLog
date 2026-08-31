// Maps delegated UI actions to focused combat mutations and dialog workflows.
import {
  addCombatRound,
  deleteCustomTracker,
  deleteTrackerColumn,
  deleteTrackerRow,
  insertTrackerColumn,
  insertTrackerRow,
  moveTrackerColumn,
  moveTrackerRow,
  sortInitiativeRows,
} from "./model.js";

export function rowHasData(row) {
  return Object.values(row?.cells || {}).some((value) => String(value || "").trim());
}

export function columnHasData(table, column) {
  return Boolean(column.title.trim()) || table.rows.some((row) =>
    Boolean(String(row.cells?.[column.id] || "").trim()),
  );
}

export function tableHasData(table) {
  return Boolean(table.title.trim()) || table.columns.some((column) => columnHasData(table, column));
}

export function createCombatActionDispatcher({
  applyMutation,
  columnById,
  openCellEditor,
  openBringParty = () => {},
  openPartyEditor = () => {},
  openSendToCombat = () => {},
  requestDeletion,
  rowById,
  tableById,
  toggleTableView = () => {},
}) {
  return function handleAction(button) {
    const action = button.dataset.action;
    const table = tableById(button.dataset.tableId);
    const row = rowById(table, button.dataset.rowId);
    const column = columnById(table, button.dataset.columnId);

    if (action === "sort-initiative")
      return applyMutation(sortInitiativeRows, "Initiative sorted from highest to lowest.");
    if (action === "send-to-combat") return openSendToCombat();
    if (action === "set-party") return openPartyEditor();
    if (action === "bring-party") return openBringParty();
    if (action === "toggle-row-tools") return toggleTableView(table.id, "hideRowTools");
    if (action === "toggle-character-info") return toggleTableView(table.id, "hideCharacterInfo");
    if (action === "toggle-rounds") return toggleTableView(table.id, "hideRounds");
    if (action === "add-round")
      return applyMutation(addCombatRound, "A new round was added.");
    if (action === "add-row-end")
      return applyMutation((current) => insertTrackerRow(current, table.id, table.rows.length));
    if (action === "add-column-end")
      return applyMutation((current) => insertTrackerColumn(current, table.id, table.columns.length));
    if (action === "insert-row-before" || action === "insert-row-after") {
      const index = table.rows.indexOf(row) + (action.endsWith("after") ? 1 : 0);
      return applyMutation((current) => insertTrackerRow(current, table.id, index));
    }
    if (action === "move-row") {
      const index = table.rows.indexOf(row) + Number(button.dataset.delta);
      return applyMutation((current) => moveTrackerRow(current, table.id, row.id, index));
    }
    if (action === "delete-row") {
      return requestDeletion({
        title: "Delete this row?",
        message: "The text entered in this row will be removed.",
        containsData: rowHasData(row),
        action: () => applyMutation((current) => deleteTrackerRow(current, table.id, row.id)),
      });
    }
    if (action === "insert-column-before" || action === "insert-column-after") {
      const index = table.columns.indexOf(column) + (action.endsWith("after") ? 1 : 0);
      return applyMutation((current) => insertTrackerColumn(current, table.id, index));
    }
    if (action === "move-column") {
      const index = table.columns.indexOf(column) + Number(button.dataset.delta);
      return applyMutation((current) => moveTrackerColumn(current, table.id, column.id, index));
    }
    if (action === "delete-column") {
      return requestDeletion({
        title: "Delete this column?",
        message: `${column.title || "This column"} and its cell values will be removed.`,
        containsData: columnHasData(table, column),
        action: () => applyMutation((current) => deleteTrackerColumn(current, table.id, column.id)),
      });
    }
    if (action === "delete-table") {
      return requestDeletion({
        title: "Delete this tracker?",
        message: `${table.title} and all of its rows and columns will be removed.`,
        containsData: tableHasData(table),
        action: () => applyMutation((current) => deleteCustomTracker(current, table.id)),
      });
    }
    if (action === "open-cell-editor") return openCellEditor(table.id, row.id, column.id);
    return undefined;
  };
}
