import { clone } from "../../shared/js/text.js";
import {
  addCombatRound,
  addCustomTracker,
  createCombatLootDocument,
  deleteCustomTracker,
  deleteTrackerColumn,
  deleteTrackerRow,
  insertTrackerColumn,
  insertTrackerRow,
  mergeInitiativeIntoCombat,
  moveTrackerColumn,
  moveTrackerRow,
  renameTracker,
  renameTrackerColumn,
  sortInitiativeRows,
  updateTrackerCell,
} from "./model.js";
import {
  createDownload,
  createPreset,
  isDocumentDirty,
  loadDraft,
  loadPresetCollection,
  overwritePreset,
  saveDraft,
} from "./repository.js";
import { renderWorkspace } from "./view.js";

export function initializeCombatLoot() {
  const elements = {
    trackers: document.getElementById("tracker-list"),
    workspaceName: document.getElementById("workspace-name"),
    workspaceStatus: document.getElementById("workspace-status"),
    presetSelect: document.getElementById("preset-select"),
    loadPreset: document.getElementById("load-preset"),
    editorDialog: document.getElementById("editor-dialog"),
    editorForm: document.getElementById("editor-form"),
    editorTitle: document.getElementById("editor-dialog-title"),
    editorContext: document.getElementById("editor-dialog-context"),
    editorLabel: document.getElementById("editor-field-label"),
    editorValue: document.getElementById("editor-value"),
    nameDialog: document.getElementById("name-dialog"),
    nameForm: document.getElementById("name-form"),
    presetName: document.getElementById("preset-name"),
    confirmDialog: document.getElementById("confirm-dialog"),
    confirmTitle: document.getElementById("confirm-dialog-title"),
    confirmMessage: document.getElementById("confirm-dialog-message"),
    confirmAccept: document.getElementById("accept-confirm"),
    toast: document.getElementById("combat-loot-toast"),
  };

  let presets = loadPresetCollection();
  const recoveredDraft = loadDraft();
  let workspace = recoveredDraft?.currentDocument?.tables
    ? clone(recoveredDraft.currentDocument)
    : createCombatLootDocument();
  let activePresetId = presets.some((preset) => preset.id === recoveredDraft?.activePresetId)
    ? recoveredDraft.activePresetId
    : null;
  let baselineDocument = recoveredDraft?.baselineDocument?.tables
    ? clone(recoveredDraft.baselineDocument)
    : clone(activePreset()?.document || workspace);
  let editorTarget = null;
  let confirmationAction = null;
  let draggedRow = null;
  let toastTimer = null;
  let draftFailureShown = false;
  const previousFocus = new WeakMap();
  const previouslyInert = new Map();

  function activePreset() {
    return presets.find((preset) => preset.id === activePresetId) || null;
  }

  function tableById(tableId) {
    return workspace.tables.find((table) => table.id === tableId);
  }

  function rowById(table, rowId) {
    return table?.rows.find((row) => row.id === rowId);
  }

  function columnById(table, columnId) {
    return table?.columns.find((column) => column.id === columnId);
  }

  function dirty() {
    return isDocumentDirty(workspace, baselineDocument);
  }

  function showToast(message) {
    clearTimeout(toastTimer);
    elements.toast.textContent = message;
    elements.toast.classList.remove("hidden");
    toastTimer = setTimeout(() => elements.toast.classList.add("hidden"), 4000);
  }

  function persistDraft() {
    const result = saveDraft({
      activePresetId,
      baselineDocument,
      currentDocument: workspace,
    });
    if (!result.ok && !draftFailureShown) {
      draftFailureShown = true;
      console.error("Could not save Combat & Loot draft:", result.error);
      showToast("The browser could not save this draft. Your current work remains open.");
    }
    if (result.ok) draftFailureShown = false;
    return result.ok;
  }

  function renderPresetOptions(selectedId = activePresetId || "") {
    elements.presetSelect.innerHTML = `<option value="">Choose a saved preset</option>${presets
      .map(
        (preset) =>
          `<option value="${escapeOptionValue(preset.id)}">${escapeOptionText(preset.label)}</option>`,
      )
      .join("")}`;
    elements.presetSelect.value = selectedId || "";
    elements.loadPreset.disabled = !elements.presetSelect.value;
  }

  function updateChrome() {
    const preset = activePreset();
    const changed = dirty();
    elements.workspaceName.textContent = preset?.label || "New preset";
    elements.workspaceStatus.textContent = changed
      ? "Unsaved changes"
      : preset
        ? "Saved"
        : "Draft";
    elements.workspaceStatus.className = `rounded-full px-2.5 py-1 text-xs font-bold ${
      changed
        ? "bg-amber-200 text-amber-950"
        : preset
          ? "bg-emerald-200 text-emerald-950"
          : "bg-stone-200 text-stone-700 dark:bg-white/10 dark:text-stone-200"
    }`;
    elements.loadPreset.disabled = !elements.presetSelect.value;
  }

  function render() {
    elements.trackers.innerHTML = renderWorkspace(workspace);
    updateChrome();
  }

  function applyMutation(createNext, message = "") {
    try {
      workspace = createNext(workspace);
      const draftSaved = persistDraft();
      render();
      if (message && draftSaved) showToast(message);
      return true;
    } catch (error) {
      console.error("Could not update Combat & Loot:", error);
      showToast(error.message || "That change could not be applied.");
      return false;
    }
  }

  function applyTextMutation(createNext) {
    try {
      workspace = createNext(workspace);
      persistDraft();
      updateChrome();
    } catch (error) {
      console.error("Could not update text:", error);
      showToast(error.message || "That text could not be saved.");
    }
  }

  function openDialog(dialog, initialFocus) {
    previousFocus.set(dialog, document.activeElement);
    [...document.body.children].forEach((element) => {
      if (element === dialog || element.tagName === "SCRIPT") return;
      previouslyInert.set(element, element.hasAttribute("inert"));
      element.setAttribute("inert", "");
    });
    dialog.classList.remove("hidden");
    dialog.classList.add("flex");
    document.body.classList.add("overflow-hidden");
    setTimeout(() => initialFocus?.focus(), 0);
  }

  function closeDialog(dialog) {
    dialog.classList.add("hidden");
    dialog.classList.remove("flex");
    if (![elements.editorDialog, elements.nameDialog, elements.confirmDialog].some(
      (item) => !item.classList.contains("hidden"),
    )) {
      document.body.classList.remove("overflow-hidden");
      previouslyInert.forEach((wasInert, element) => {
        if (!wasInert) element.removeAttribute("inert");
      });
      previouslyInert.clear();
    }
    const returnFocus = previousFocus.get(dialog);
    if (returnFocus?.isConnected) returnFocus.focus();
    previousFocus.delete(dialog);
  }

  function askConfirmation({ title, message, acceptLabel = "Accept", action }) {
    confirmationAction = action;
    elements.confirmTitle.textContent = title;
    elements.confirmMessage.textContent = message;
    elements.confirmAccept.textContent = acceptLabel;
    openDialog(elements.confirmDialog, elements.confirmAccept);
  }

  function openCellEditor(tableId, rowId, columnId) {
    const table = tableById(tableId);
    const row = rowById(table, rowId);
    const column = columnById(table, columnId);
    if (!table || !row || !column) return;
    editorTarget = { tableId, rowId, columnId };
    const rowNumber = table.rows.indexOf(row) + 1;
    elements.editorTitle.textContent = `Edit ${column.title || "cell"}`;
    elements.editorContext.textContent = `${table.title} · Row ${rowNumber}`;
    elements.editorLabel.textContent = column.title || "Text";
    elements.editorValue.value = row.cells?.[column.id] || "";
    openDialog(elements.editorDialog, elements.editorValue);
  }

  function startNewPreset() {
    workspace = createCombatLootDocument();
    activePresetId = null;
    baselineDocument = clone(workspace);
    elements.presetSelect.value = "";
    const draftSaved = persistDraft();
    render();
    if (draftSaved) showToast("New Initiative, Combat, and Loot trackers created.");
  }

  function requestNewPreset() {
    if (!dirty()) return startNewPreset();
    askConfirmation({
      title: "Start a new preset?",
      message: "Unsaved changes in the current workspace will be replaced by blank trackers.",
      acceptLabel: "New preset",
      action: startNewPreset,
    });
  }

  function loadSelectedPreset() {
    const preset = presets.find((item) => item.id === elements.presetSelect.value);
    if (!preset) return showToast("Choose a saved preset first.");
    workspace = clone(preset.document);
    activePresetId = preset.id;
    baselineDocument = clone(preset.document);
    const draftSaved = persistDraft();
    renderPresetOptions(preset.id);
    render();
    if (draftSaved) showToast(`${preset.label} loaded.`);
  }

  function requestLoadPreset() {
    if (!elements.presetSelect.value) return showToast("Choose a saved preset first.");
    if (!dirty()) return loadSelectedPreset();
    askConfirmation({
      title: "Load another preset?",
      message: "Unsaved changes in the current workspace will be lost when the selected preset loads.",
      acceptLabel: "Load preset",
      action: loadSelectedPreset,
    });
  }

  function finishSave(result, message) {
    if (!result.ok) {
      console.error("Could not save preset:", result.error);
      showToast("The browser could not save this preset. Your current work remains open.");
      return;
    }
    presets = result.presets;
    activePresetId = result.preset.id;
    baselineDocument = clone(workspace);
    const draftSaved = persistDraft();
    renderPresetOptions(activePresetId);
    render();
    showToast(
      draftSaved
        ? message
        : "The preset was saved, but draft recovery could not be updated.",
    );
  }

  function saveNewPreset(baseName) {
    const result = createPreset({ baseName, document: workspace });
    finishSave(result, result.ok ? `${result.preset.label} saved.` : "");
  }

  function overwriteActivePreset() {
    const result = overwritePreset({ id: activePresetId, document: workspace });
    finishSave(result, result.ok ? `${result.preset.label} updated.` : "");
  }

  function requestSavePreset() {
    if (!activePreset()) {
      elements.nameForm.reset();
      openDialog(elements.nameDialog, elements.presetName);
      return;
    }
    askConfirmation({
      title: "Overwrite saved preset?",
      message: `${activePreset().label} will be replaced with the current workspace.`,
      acceptLabel: "Overwrite preset",
      action: overwriteActivePreset,
    });
  }

  function downloadCurrentWorkspace() {
    try {
      const download = createDownload({
        document: workspace,
        activePresetId,
        label: activePreset()?.label || "Combat and Loot",
      });
      const blob = new Blob([download.json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = download.filename;
      link.hidden = true;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 0);
      showToast("Current workspace downloaded. The saved preset was not changed.");
    } catch (error) {
      console.error("Could not download preset:", error);
      showToast("This browser could not download the preset.");
    }
  }

  function rowHasData(row) {
    return Object.values(row?.cells || {}).some((value) => String(value || "").trim());
  }

  function columnHasData(table, column) {
    return Boolean(column.title.trim()) || table.rows.some((row) =>
      Boolean(String(row.cells?.[column.id] || "").trim()),
    );
  }

  function tableHasData(table) {
    return Boolean(table.title.trim()) || table.columns.some((column) => columnHasData(table, column));
  }

  function requestDeletion({ title, message, containsData, action }) {
    if (!containsData) return action();
    askConfirmation({ title, message, acceptLabel: "Delete", action });
  }

  function handleAction(button) {
    const action = button.dataset.action;
    const table = tableById(button.dataset.tableId);
    const row = rowById(table, button.dataset.rowId);
    const column = columnById(table, button.dataset.columnId);

    if (action === "sort-initiative")
      return applyMutation(sortInitiativeRows, "Initiative sorted from highest to lowest.");
    if (action === "send-to-combat")
      return applyMutation(mergeInitiativeIntoCombat, "Initiative order sent to Combat.");
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
    if (action === "open-cell-editor")
      return openCellEditor(table.id, row.id, column.id);
  }

  elements.trackers.addEventListener("click", (event) => {
    const button = event.target.closest("[data-action]");
    if (button) handleAction(button);
  });

  elements.trackers.addEventListener("input", (event) => {
    const input = event.target;
    if (input.matches("[data-inline-cell]")) {
      applyTextMutation((current) => updateTrackerCell(
        current,
        input.dataset.tableId,
        input.dataset.rowId,
        input.dataset.columnId,
        input.value,
      ));
    } else if (input.matches("[data-column-title]")) {
      applyTextMutation((current) => renameTrackerColumn(
        current,
        input.dataset.tableId,
        input.dataset.columnId,
        input.value,
      ));
    } else if (input.matches("[data-tracker-title]")) {
      applyTextMutation((current) => renameTracker(current, input.dataset.tableId, input.value));
    }
  });

  elements.trackers.addEventListener("dragstart", (event) => {
    const handle = event.target.closest("[data-row-drag]");
    if (!handle) return;
    draggedRow = { tableId: handle.dataset.tableId, rowId: handle.dataset.rowId };
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", handle.dataset.rowId);
  });

  elements.trackers.addEventListener("dragover", (event) => {
    const target = event.target.closest("[data-table-row]");
    if (!target || target.dataset.tableId !== draggedRow?.tableId) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    target.classList.add("outline", "outline-2", "outline-blood-500");
  });

  elements.trackers.addEventListener("dragleave", (event) => {
    event.target.closest("[data-table-row]")?.classList.remove("outline", "outline-2", "outline-blood-500");
  });

  elements.trackers.addEventListener("drop", (event) => {
    const target = event.target.closest("[data-table-row]");
    if (!target || target.dataset.tableId !== draggedRow?.tableId) return;
    event.preventDefault();
    const table = tableById(draggedRow.tableId);
    const targetIndex = table.rows.findIndex((row) => row.id === target.dataset.rowId);
    target.classList.remove("outline", "outline-2", "outline-blood-500");
    if (targetIndex >= 0 && target.dataset.rowId !== draggedRow.rowId)
      applyMutation((current) => moveTrackerRow(
        current,
        draggedRow.tableId,
        draggedRow.rowId,
        targetIndex,
      ));
    draggedRow = null;
  });

  elements.trackers.addEventListener("dragend", () => {
    draggedRow = null;
    elements.trackers.querySelectorAll("[data-table-row]").forEach((row) =>
      row.classList.remove("outline", "outline-2", "outline-blood-500"),
    );
  });

  elements.editorForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!editorTarget) return;
    const target = editorTarget;
    closeDialog(elements.editorDialog);
    editorTarget = null;
    applyMutation((current) => updateTrackerCell(
      current,
      target.tableId,
      target.rowId,
      target.columnId,
      elements.editorValue.value,
    ));
  });

  elements.nameForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const name = elements.presetName.value.trim();
    if (!name) return elements.presetName.focus();
    closeDialog(elements.nameDialog);
    saveNewPreset(name);
  });

  elements.confirmAccept.addEventListener("click", () => {
    const action = confirmationAction;
    confirmationAction = null;
    closeDialog(elements.confirmDialog);
    action?.();
  });

  document.getElementById("cancel-confirm").addEventListener("click", () => {
    confirmationAction = null;
    closeDialog(elements.confirmDialog);
  });
  document.querySelectorAll("[data-close-dialog]").forEach((button) =>
    button.addEventListener("click", () => {
      if (button.dataset.closeDialog === "editor-dialog") editorTarget = null;
      closeDialog(document.getElementById(button.dataset.closeDialog));
    }),
  );
  [elements.editorDialog, elements.nameDialog].forEach((dialog) =>
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) closeDialog(dialog);
    }),
  );
  elements.confirmDialog.addEventListener("click", (event) => {
    if (event.target !== elements.confirmDialog) return;
    confirmationAction = null;
    closeDialog(elements.confirmDialog);
  });

  document.getElementById("new-preset").addEventListener("click", requestNewPreset);
  document.getElementById("save-preset").addEventListener("click", requestSavePreset);
  document.getElementById("download-preset").addEventListener("click", downloadCurrentWorkspace);
  document.getElementById("new-tracker").addEventListener("click", () => {
    if (applyMutation(addCustomTracker, "A blank tracker was added."))
      elements.trackers.lastElementChild?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  elements.loadPreset.addEventListener("click", requestLoadPreset);
  elements.presetSelect.addEventListener("change", updateChrome);

  document.addEventListener("keydown", (event) => {
    const openDialogElement = [
      elements.confirmDialog,
      elements.nameDialog,
      elements.editorDialog,
    ].find((dialog) => !dialog.classList.contains("hidden"));
    if (event.key === "Tab" && openDialogElement) {
      const focusable = [...openDialogElement.querySelectorAll(
        'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      )].filter((element) => !element.hidden);
      if (focusable.length) {
        const first = focusable[0];
        const last = focusable.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
      return;
    }
    if (event.key !== "Escape") return;
    if (!elements.confirmDialog.classList.contains("hidden")) {
      confirmationAction = null;
      closeDialog(elements.confirmDialog);
    } else if (!elements.nameDialog.classList.contains("hidden")) {
      closeDialog(elements.nameDialog);
    } else if (!elements.editorDialog.classList.contains("hidden")) {
      editorTarget = null;
      closeDialog(elements.editorDialog);
    }
  });

  window.addEventListener("beforeunload", (event) => {
    if (!dirty()) return;
    event.preventDefault();
    event.returnValue = "";
  });

  renderPresetOptions(activePresetId || "");
  render();
  if (!recoveredDraft) persistDraft();
}

function escapeOptionText(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeOptionValue(value) {
  return escapeOptionText(value).replace(/"/g, "&quot;");
}
