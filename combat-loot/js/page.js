import { cloneJSON } from "../../shared/js/text.js";
import { writeCloudJSON } from "../../shared/js/cloud-store.js";
import {
  addCustomTracker,
  bringPartyMembersToInitiative,
  calculateCurrentHP,
  createCombatLootDocument,
  evaluateArithmeticFormula,
  initializeDefaultTrackers,
  initializeCombatHealthColumns,
  mergeInitiativeIntoCombat,
  moveTrackerRow,
  normalizeCharacterName,
  renameTracker,
  renameTrackerColumn,
  sortInitiativeRows,
  updateTrackerCell,
} from "./model.js";
import { createCombatActionDispatcher } from "./action-dispatcher.js";
import { createCombatCloudSync } from "./cloud-sync.js";
import { createCombatDialogController } from "./dialog-controller.js";
import {
  loadPartyLibrary,
  membersForPartyIds,
  normalizePartyLibrary,
  partyCandidatesForCharacters,
  resolvePartyCandidates,
  savePartyLibrary,
  upsertParty,
} from "./party-library.js";
import {
  createDownload,
  createPreset,
  isDocumentDirty,
  loadDraft,
  loadPresetCollection,
  overwritePreset,
  parsePresetUpload,
  saveDraft,
  savePresetCollection,
  setPresetActive,
} from "./repository.js";
import { renderWorkspace } from "./view.js";

const MAX_PRESET_UPLOAD_BYTES = 5 * 1024 * 1024;
const VALID_HEALTH_INPUT_CLASSES = [
  "border-transparent",
  "hover:border-stone-300",
  "focus:border-blood-500",
  "dark:hover:border-white/15",
];
const INVALID_HEALTH_INPUT_CLASSES = [
  "border-red-500/80",
  "hover:border-red-500",
  "focus:border-red-500",
  "dark:border-red-400/80",
];

function healthColumnIdFactory(document) {
  const usedIds = new Set([document.id]);
  document.tables.forEach((table) => {
    usedIds.add(table.id);
    table.columns.forEach((column) => usedIds.add(column.id));
    table.rows.forEach((row) => usedIds.add(row.id));
  });
  let sequence = 0;
  return (kind) => {
    let id;
    do {
      sequence += 1;
      id = `${kind}-${document.id}-combat-health-${sequence}`;
    } while (usedIds.has(id));
    usedIds.add(id);
    return id;
  };
}

function prepareWorkspaceDocument(document) {
  let prepared = initializeCombatHealthColumns(document, {
    idFactory: healthColumnIdFactory(document),
  });
  prepared = initializeDefaultTrackers(prepared, {
    idFactory: healthColumnIdFactory(prepared),
  });
  const combat = prepared.tables.find((table) => table.type === "combat");
  const derivedColumns = combat?.columns.filter((column) => column.role === "currentHp") || [];
  combat?.rows.forEach((row) => {
    derivedColumns.forEach((column) => {
      row.cells[column.id] = "";
    });
  });
  return prepared;
}

function migrateLegacyPartyLibrary(parties, sources) {
  let migrated = parties;
  let changed = false;
  sources.forEach(({ document: sourceDocument, name }) => {
    const members = Array.isArray(sourceDocument?.party) ? sourceDocument.party : [];
    if (!members.length || !sourceDocument?.id) return;
    const id = `legacy-${sourceDocument.id}`;
    if (migrated.some((party) => party.id === id)) return;
    const baseName = String(name || "Imported Party").trim() || "Imported Party";
    let partyName = baseName;
    let suffix = 2;
    while (migrated.some((party) => party.name.toLocaleLowerCase() === partyName.toLocaleLowerCase())) {
      partyName = `${baseName} ${suffix}`;
      suffix += 1;
    }
    try {
      migrated = upsertParty(migrated, { id, name: partyName, members });
      changed = true;
    } catch (error) {
      console.warn("Could not migrate a legacy party:", error);
    }
  });
  return { changed, parties: migrated };
}

export function initializeCombatLoot() {
  const elements = {
    trackers: document.getElementById("tracker-list"),
    workspaceName: document.getElementById("workspace-name"),
    workspaceStatus: document.getElementById("workspace-status"),
    presetSelect: document.getElementById("preset-select"),
    loadPreset: document.getElementById("load-preset"),
    removePreset: document.getElementById("remove-preset"),
    uploadPreset: document.getElementById("upload-preset"),
    uploadPresetFile: document.getElementById("upload-preset-file"),
    editorDialog: document.getElementById("editor-dialog"),
    editorForm: document.getElementById("editor-form"),
    editorTitle: document.getElementById("editor-dialog-title"),
    editorContext: document.getElementById("editor-dialog-context"),
    editorLabel: document.getElementById("editor-field-label"),
    editorValue: document.getElementById("editor-value"),
    editorHelp: document.getElementById("editor-help"),
    editorError: document.getElementById("editor-error"),
    partyDialog: document.getElementById("party-dialog"),
    partyForm: document.getElementById("party-form"),
    partyMembers: document.getElementById("party-members"),
    addPartyMember: document.getElementById("add-party-member"),
    partySelect: document.getElementById("party-select"),
    partyName: document.getElementById("party-name"),
    bringPartyDialog: document.getElementById("bring-party-dialog"),
    bringPartyForm: document.getElementById("bring-party-form"),
    bringPartyList: document.getElementById("bring-party-list"),
    partyConflictDialog: document.getElementById("party-conflict-dialog"),
    partyConflictForm: document.getElementById("party-conflict-form"),
    partyConflictList: document.getElementById("party-conflict-list"),
    sendCombatDialog: document.getElementById("send-combat-dialog"),
    sortSendCombat: document.getElementById("sort-send-combat"),
    sendCombatAsIs: document.getElementById("send-combat-as-is"),
    cancelSendCombat: document.getElementById("cancel-send-combat"),
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
  let partyLibrary = loadPartyLibrary();
  const migratedParties = migrateLegacyPartyLibrary(partyLibrary, [
    ...presets.map((preset) => ({
      document: preset.document,
      name: `${preset.baseName || "Imported"} Party`,
    })),
    { document: recoveredDraft?.currentDocument, name: "Imported Party" },
  ]);
  partyLibrary = migratedParties.parties;
  if (migratedParties.changed) savePartyLibrary(partyLibrary);
  const recoveredWasDirty = recoveredDraft
    ? isDocumentDirty(recoveredDraft.currentDocument, recoveredDraft.baselineDocument)
    : false;
  let workspace = prepareWorkspaceDocument(
    recoveredDraft?.currentDocument?.tables
      ? recoveredDraft.currentDocument
      : createCombatLootDocument(),
  );
  let activePresetId = presets.some(
    (preset) => preset.active && preset.id === recoveredDraft?.activePresetId,
  )
    ? recoveredDraft.activePresetId
    : null;
  let baselineDocument = recoveredDraft
    ? recoveredDraft.baselineDocument?.tables
      ? recoveredWasDirty
        ? prepareWorkspaceDocument(recoveredDraft.baselineDocument)
        : cloneJSON(workspace)
      : null
    : cloneJSON(workspace);
  let editorTarget = null;
  let confirmationAction = null;
  let pendingCombatSend = null;
  let draggedRow = null;
  let toastTimer = null;
  let draftFailureShown = false;
  const tableViews = {};
  const { close: closeDialog, open: openDialog } = createCombatDialogController({
    dialogs: [
      elements.editorDialog,
      elements.partyDialog,
      elements.bringPartyDialog,
      elements.partyConflictDialog,
      elements.nameDialog,
      elements.sendCombatDialog,
      elements.confirmDialog,
    ],
  });

  function activePreset() {
    return presets.find((preset) => preset.active && preset.id === activePresetId) || null;
  }

  function selectedPreset() {
    return presets.find(
      (preset) => preset.active && preset.id === elements.presetSelect.value,
    ) || null;
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

  function persistDraft({ cloud = true } = {}) {
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
    if (result.ok) {
      draftFailureShown = false;
      if (cloud) {
        writeCloudJSON("api/combat-loot/draft", result.draft)
          .catch((error) => {
            console.error("Could not save Combat & Loot draft to D1:", error);
            showToast("Draft remains in this browser, but the cloud save failed.");
          });
      }
    }
    return result.ok;
  }

  function renderPresetOptions(selectedId = activePresetId || "") {
    elements.presetSelect.innerHTML = `<option value="">Choose a saved preset</option>${presets
      .filter((preset) => preset.active)
      .map(
        (preset) =>
          `<option value="${escapeOptionValue(preset.id)}">${escapeOptionText(preset.label)}</option>`,
      )
      .join("")}`;
    elements.presetSelect.value = selectedId || "";
    const hasSelection = Boolean(selectedPreset());
    elements.loadPreset.disabled = !hasSelection;
    elements.removePreset.disabled = !hasSelection;
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
    const hasSelection = Boolean(selectedPreset());
    elements.loadPreset.disabled = !hasSelection;
    elements.removePreset.disabled = !hasSelection;
  }

  function render() {
    elements.trackers.innerHTML = renderWorkspace(workspace, tableViews);
    updateChrome();
  }

  function toggleTableView(tableId, key) {
    tableViews[tableId] = {
      ...(tableViews[tableId] || {}),
      [key]: !tableViews[tableId]?.[key],
    };
    render();
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
      return true;
    } catch (error) {
      console.error("Could not update text:", error);
      showToast(error.message || "That text could not be saved.");
      return false;
    }
  }

  function setHealthInputValidity(input, valid) {
    input.classList.remove(...(valid ? INVALID_HEALTH_INPUT_CLASSES : VALID_HEALTH_INPUT_CLASSES));
    input.classList.add(...(valid ? VALID_HEALTH_INPUT_CLASSES : INVALID_HEALTH_INPUT_CLASSES));
    if (valid) {
      input.removeAttribute("aria-invalid");
      input.removeAttribute("title");
    } else {
      input.setAttribute("aria-invalid", "true");
      input.setAttribute("title", "Enter a number");
    }
  }

  function updateCurrentHPOutput(container, health) {
    container.dataset.valid = String(health.valid);
    container.replaceChildren();
    if (!health.hasCharacter && health.hpPlaceholder && health.damagePlaceholder) {
      const placeholder = document.createElement("span");
      placeholder.className = "italic text-stone-400";
      placeholder.setAttribute("aria-label", "Current HP placeholder");
      placeholder.textContent = "0";
      container.append(placeholder);
      return;
    }
    if (health.valid) {
      const output = document.createElement("output");
      output.className = "font-semibold tabular-nums";
      output.setAttribute("aria-label", `Current HP: ${health.value}`);
      output.textContent = String(health.value);
      container.append(output);
      return;
    }

    const unavailable = document.createElement("span");
    unavailable.className = "inline-flex items-center gap-2 font-semibold text-red-600 dark:text-red-400";
    unavailable.setAttribute("role", "img");
    unavailable.setAttribute("aria-label", "Current HP unavailable. Enter numbers for HP and Damage.");
    const icon = document.createElement("i");
    icon.className = "bi bi-x-circle-fill text-lg";
    icon.setAttribute("aria-hidden", "true");
    unavailable.append(icon);
    container.append(unavailable);
  }

  function refreshCombatHealthRow(rowElement, tableId, rowId) {
    const table = tableById(tableId);
    const row = rowById(table, rowId);
    if (!rowElement || table?.type !== "combat" || !row) return;
    const hpColumn = table.columns.find((column) => column.role === "hp");
    const damageColumn = table.columns.find((column) => column.role === "damage");
    const hp = hpColumn ? row.cells?.[hpColumn.id] : "";
    const damage = damageColumn ? row.cells?.[damageColumn.id] : "";
    const characterColumn = table.columns.find((column) => column.role === "character");
    const hasCharacter = Boolean(String(
      characterColumn ? row.cells?.[characterColumn.id] : "",
    ).trim());
    const hpPlaceholder = !String(hp ?? "").trim() || String(hp).trim() === "0";
    const damagePlaceholder = !String(damage ?? "").trim() || String(damage).trim() === "0";
    const calculated = calculateCurrentHP(hp, damage);
    const health = {
      ...calculated,
      hasCharacter,
      hpPlaceholder,
      damagePlaceholder,
      hpValid: hpPlaceholder ? !hasCharacter : calculated.hpValid,
      damageValid: damagePlaceholder ? true : calculated.damageValid,
      valid: calculated.valid && !(hasCharacter && hpPlaceholder),
    };

    rowElement.querySelectorAll("[data-inline-cell]").forEach((input) => {
      const role = columnById(table, input.dataset.columnId)?.role;
      if (role === "hp") setHealthInputValidity(input, health.hpValid);
      if (role === "ac") {
        const acPlaceholder = !input.value.trim();
        const acNumeric = calculateCurrentHP(input.value || "0", "0").hpValid;
        setHealthInputValidity(input, (!hasCharacter || !acPlaceholder) && acNumeric);
      }
    });
    const damageCell = rowElement.querySelector("[data-damage-cell]");
    if (damageCell) {
      damageCell.classList.toggle("border-red-500/80", !health.damageValid);
      damageCell.classList.toggle("dark:border-red-400/80", !health.damageValid);
      damageCell.classList.toggle("border-transparent", health.damageValid);
      if (health.damageValid) {
        damageCell.removeAttribute("aria-invalid");
        damageCell.removeAttribute("title");
      } else {
        damageCell.setAttribute("aria-invalid", "true");
        damageCell.setAttribute("title", "Enter a formula using numbers, +, -, and parentheses");
      }
    }
    const currentHP = rowElement.querySelector("[data-current-hp]");
    if (currentHP) updateCurrentHPOutput(currentHP, health);
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
    const isDamage = table.type === "combat" && column.role === "damage";
    const storedValue = String(row.cells?.[column.id] || "");
    elements.editorValue.value = isDamage && storedValue.trim() === "0" ? "" : storedValue;
    elements.editorValue.rows = isDamage ? 3 : 7;
    elements.editorValue.placeholder = isDamage ? "5+10-2" : "";
    if (isDamage) elements.editorValue.setAttribute("inputmode", "decimal");
    else elements.editorValue.removeAttribute("inputmode");
    elements.editorHelp.textContent = isDamage
      ? "Use numbers, +, -, and parentheses. Healing can be entered as subtraction."
      : "";
    elements.editorHelp.classList.toggle("hidden", !isDamage);
    elements.editorError.textContent = "";
    elements.editorError.classList.add("hidden");
    openDialog(elements.editorDialog, elements.editorValue);
  }

  function partyMemberMarkup(member = {}) {
    return `<div data-party-member class="grid gap-2 rounded-xl border border-stone-300 p-3 dark:border-white/10 sm:grid-cols-[minmax(0,1fr)_7rem_7rem_auto] sm:items-end">
      <label><span class="mb-1 block text-xs font-bold">Character</span><input data-party-character maxlength="100" value="${escapeOptionValue(member.character || "")}" placeholder="Cassian" class="w-full rounded-lg border border-stone-300 bg-white/80 px-3 py-2 text-stone-900 outline-none focus:border-blood-500 dark:border-white/15 dark:bg-white/5 dark:text-white"></label>
      <label><span class="mb-1 block text-xs font-bold">Max HP</span><input data-party-hp inputmode="decimal" value="${escapeOptionValue(member.maxHp || "")}" placeholder="40" class="w-full rounded-lg border border-stone-300 bg-white/80 px-3 py-2 text-stone-900 outline-none focus:border-blood-500 dark:border-white/15 dark:bg-white/5 dark:text-white"></label>
      <label><span class="mb-1 block text-xs font-bold">AC</span><input data-party-ac inputmode="decimal" value="${escapeOptionValue(member.ac || "")}" placeholder="16" class="w-full rounded-lg border border-stone-300 bg-white/80 px-3 py-2 text-stone-900 outline-none focus:border-blood-500 dark:border-white/15 dark:bg-white/5 dark:text-white"></label>
      <button type="button" data-remove-party-member class="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-red-400 text-red-600 transition hover:border-red-500 hover:text-red-700 dark:text-red-300" aria-label="Remove party member" title="Remove party member"><i class="bi bi-trash-fill"></i></button>
    </div>`;
  }

  function addPartyMemberRow(member = {}) {
    elements.partyMembers.insertAdjacentHTML("beforeend", partyMemberMarkup(member));
  }

  function persistParties(nextParties, message = "") {
    const result = savePartyLibrary(nextParties);
    if (!result.ok) {
      console.error("Could not save party library:", result.error);
      showToast(result.error.message || "The party library could not be saved.");
      return false;
    }
    partyLibrary = result.parties;
    writeCloudJSON("api/combat-loot/party-library", result.envelope)
      .catch((error) => {
        console.error("Could not save party library to D1:", error);
        showToast("Parties remain in this browser, but the cloud save failed.");
      });
    if (message) showToast(message);
    return true;
  }

  function renderPartyEditorOptions(selectedId = "") {
    elements.partySelect.innerHTML = `<option value="">Create a new party</option>${partyLibrary
      .map((party) => `<option value="${escapeOptionValue(party.id)}">${escapeOptionText(party.name)}</option>`)
      .join("")}`;
    elements.partySelect.value = selectedId;
  }

  function loadPartyIntoEditor(partyId) {
    const party = partyLibrary.find((candidate) => candidate.id === partyId);
    elements.partyName.value = party?.name || "";
    elements.partyMembers.replaceChildren();
    (party?.members?.length ? party.members : [{}]).forEach(addPartyMemberRow);
  }

  function openPartyEditor() {
    renderPartyEditorOptions();
    loadPartyIntoEditor("");
    openDialog(elements.partyDialog, elements.partyName);
  }

  function partyBadges(party) {
    return party.members.map((member) => `<span class="inline-flex items-center rounded-full border border-yellow-300/70 bg-yellow-200 px-2.5 py-1 text-xs font-bold text-yellow-950">${escapeOptionText(member.character)} · HP ${escapeOptionText(member.maxHp)} · AC ${escapeOptionText(member.ac)}</span>`).join("");
  }

  function openBringParty() {
    elements.bringPartyList.innerHTML = partyLibrary.length
      ? partyLibrary.map((party) => `<label class="block cursor-pointer rounded-xl border border-stone-300 bg-white/50 p-4 transition hover:border-yellow-300 dark:border-white/10 dark:bg-white/[.025]"><span class="flex items-center gap-3"><input type="checkbox" name="party" value="${escapeOptionValue(party.id)}" class="h-5 w-5 accent-yellow-500"><strong>${escapeOptionText(party.name)}</strong></span><span class="mt-3 flex flex-wrap gap-2">${partyBadges(party)}</span></label>`).join("")
      : '<p class="rounded-xl border border-dashed border-stone-400 p-6 text-center text-sm text-stone-500 dark:text-stone-400">No parties saved yet. Use Set a Party first.</p>';
    openDialog(elements.bringPartyDialog, elements.bringPartyList.querySelector("input"));
  }

  function initiativeCharacters(source = workspace) {
    const initiative = source.tables.find((table) => table.type === "initiative");
    const characterColumn = initiative?.columns.find((column) => column.role === "character");
    return characterColumn
      ? initiative.rows.map((row) => row.cells[characterColumn.id]).filter((name) => String(name || "").trim())
      : [];
  }

  function renderPartyConflicts(conflicts) {
    elements.partyConflictList.innerHTML = conflicts.map((conflict, conflictIndex) => `<fieldset data-conflict-key="${escapeOptionValue(conflict.key)}" class="rounded-xl border border-stone-300 p-4 dark:border-white/10"><legend class="px-2 font-display text-lg font-bold">${escapeOptionText(conflict.character)}</legend><div class="mt-2 grid gap-2 sm:grid-cols-2">${conflict.options.map((option, optionIndex) => `<label class="cursor-pointer rounded-xl border border-stone-300 bg-white/50 p-3 transition hover:border-violet-300 has-[:checked]:border-violet-300 has-[:checked]:bg-violet-300/10 dark:border-white/10 dark:bg-white/[.025]"><span class="flex items-center gap-2"><input type="radio" name="party-conflict-${conflictIndex}" value="${escapeOptionValue(option.partyId)}" ${optionIndex === 0 ? "required" : ""}><strong>${escapeOptionText(option.partyName)}</strong></span><span class="mt-2 block text-sm">HP ${escapeOptionText(option.maxHp)} · AC ${escapeOptionText(option.ac)}</span></label>`).join("")}</div></fieldset>`).join("");
  }

  function completeCombatSend({ sort, candidates, selections = {} }) {
    closeDialog(elements.partyConflictDialog);
    pendingCombatSend = null;
    const partyMembers = resolvePartyCandidates(candidates, selections);
    applyMutation(
      (current) => mergeInitiativeIntoCombat(
        sort ? sortInitiativeRows(current) : current,
        { partyMembers },
      ),
      sort
        ? "Initiative sorted and sent to Combat."
        : "Initiative order sent to Combat as shown.",
    );
  }

  function requestCombatSend({ sort = false } = {}) {
    closeDialog(elements.sendCombatDialog);
    const candidates = partyCandidatesForCharacters(partyLibrary, initiativeCharacters());
    const conflicts = candidates.filter((candidate) => candidate.options.length > 1);
    if (!conflicts.length) {
      completeCombatSend({ sort, candidates });
      return;
    }
    pendingCombatSend = { sort, candidates, conflicts };
    renderPartyConflicts(conflicts);
    openDialog(elements.partyConflictDialog, elements.partyConflictList.querySelector("input"));
  }

  function openSendToCombat() {
    openDialog(elements.sendCombatDialog, elements.sortSendCombat);
  }


  function startNewPreset() {
    workspace = createCombatLootDocument();
    activePresetId = null;
    baselineDocument = cloneJSON(workspace);
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
    const preset = selectedPreset();
    if (!preset) return showToast("Choose a saved preset first.");
    workspace = prepareWorkspaceDocument(preset.document);
    activePresetId = preset.id;
    baselineDocument = cloneJSON(workspace);
    const draftSaved = persistDraft();
    renderPresetOptions(preset.id);
    render();
    if (draftSaved) showToast(`${preset.label} loaded.`);
  }

  function requestLoadPreset() {
    if (!selectedPreset()) return showToast("Choose a saved preset first.");
    if (!dirty()) return loadSelectedPreset();
    askConfirmation({
      title: "Load another preset?",
      message: "Unsaved changes in the current workspace will be lost when the selected preset loads.",
      acceptLabel: "Load preset",
      action: loadSelectedPreset,
    });
  }

  function removeSelectedPreset() {
    const preset = selectedPreset();
    if (!preset) return showToast("Choose a saved preset first.");
    const wasCurrentPreset = preset.id === activePresetId;
    const result = setPresetActive({ id: preset.id, active: false });
    if (!result.ok) {
      console.error("Could not remove preset:", result.error);
      showToast("The browser could not remove this preset. It remains available.");
      return;
    }

    presets = result.presets;
    writeCloudJSON(`api/combat-loot/presets/${encodeURIComponent(result.preset.id)}`, result.preset)
      .catch((error) => {
        console.error("Could not update preset in D1:", error);
        showToast("Preset remains in this browser, but the cloud update failed.");
      });
    let draftSaved = true;
    if (wasCurrentPreset) {
      activePresetId = null;
      baselineDocument = null;
      draftSaved = persistDraft();
    }
    renderPresetOptions(wasCurrentPreset ? "" : activePresetId || "");
    render();
    if (draftSaved) {
      showToast(wasCurrentPreset
        ? `${preset.label} was removed from the list. Your open work is now an unsaved draft.`
        : `${preset.label} was removed from the preset list.`);
    }
  }

  function requestRemovePreset() {
    const preset = selectedPreset();
    if (!preset) return showToast("Choose a saved preset first.");
    askConfirmation({
      title: "Remove this preset?",
      message: `${preset.label} will be hidden from this browser's preset list. Its saved record will remain inactive.`,
      acceptLabel: "Remove preset",
      action: removeSelectedPreset,
    });
  }

  function finishSave(result, message) {
    if (!result.ok) {
      console.error("Could not save preset:", result.error);
      showToast("The browser could not save this preset. Your current work remains open.");
      return;
    }
    presets = result.presets;
    writeCloudJSON(`api/combat-loot/presets/${encodeURIComponent(result.preset.id)}`, result.preset)
      .catch((error) => {
        console.error("Could not save preset to D1:", error);
        showToast("Preset remains in this browser, but the cloud save failed.");
      });
    activePresetId = result.preset.id;
    baselineDocument = cloneJSON(workspace);
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

  function loadUploadedPreset(upload) {
    workspace = upload.document;
    activePresetId = null;
    baselineDocument = null;
    elements.presetSelect.value = "";
    const draftSaved = persistDraft();
    renderPresetOptions("");
    render();
    if (draftSaved) {
      showToast(`${upload.label} loaded as unsaved work. Use Save preset to keep it in this browser.`);
    }
  }

  async function uploadPresetFile(file) {
    if (!file) return;
    try {
      if (file.size > MAX_PRESET_UPLOAD_BYTES) {
        throw new Error("Preset files must be 5 MiB or smaller.");
      }
      const parsed = parsePresetUpload(await file.text());
      const migratedUploadParties = migrateLegacyPartyLibrary(partyLibrary, [{
        document: parsed.document,
        name: `${parsed.label || "Imported"} Party`,
      }]);
      if (migratedUploadParties.changed) {
        persistParties(migratedUploadParties.parties, "The uploaded preset's party was added globally.");
      }
      const upload = {
        ...parsed,
        document: prepareWorkspaceDocument(parsed.document),
      };
      if (!dirty()) {
        loadUploadedPreset(upload);
        return;
      }
      askConfirmation({
        title: "Upload another preset?",
        message: "Unsaved changes in the current workspace will be replaced by the uploaded preset.",
        acceptLabel: "Upload preset",
        action: () => loadUploadedPreset(upload),
      });
    } catch (error) {
      console.error("Could not upload preset:", error);
      showToast(error.message || "That file is not a valid Combat & Loot preset.");
    } finally {
      elements.uploadPresetFile.value = "";
    }
  }

  function requestDeletion({ title, message, containsData, action }) {
    if (!containsData) return action();
    askConfirmation({ title, message, acceptLabel: "Delete", action });
  }

  const handleAction = createCombatActionDispatcher({
    applyMutation,
    columnById,
    openBringParty,
    openCellEditor,
    openPartyEditor,
    openSendToCombat,
    requestDeletion,
    rowById,
    tableById,
    toggleTableView,
  });

  elements.trackers.addEventListener("click", (event) => {
    const button = event.target.closest("[data-action]");
    if (button) handleAction(button);
  });

  elements.trackers.addEventListener("input", (event) => {
    const input = event.target;
    if (input.matches("[data-inline-cell]")) {
      const role = columnById(
        tableById(input.dataset.tableId),
        input.dataset.columnId,
      )?.role;
      const updated = applyTextMutation((current) => updateTrackerCell(
        current,
        input.dataset.tableId,
        input.dataset.rowId,
        input.dataset.columnId,
        input.value,
      ));
      if (updated && ["character", "hp", "damage", "ac"].includes(role)) {
        refreshCombatHealthRow(
          input.closest("[data-table-row]"),
          input.dataset.tableId,
          input.dataset.rowId,
        );
      }
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

  elements.trackers.addEventListener("focusout", (event) => {
    const input = event.target;
    if (!input.matches("[data-inline-cell]")) return;
    const table = tableById(input.dataset.tableId);
    const column = columnById(table, input.dataset.columnId);
    if (column?.role !== "character") return;
    const normalized = normalizeCharacterName(input.value);
    if (normalized === input.value) return;
    input.value = normalized;
    const updated = applyTextMutation((current) => updateTrackerCell(
      current,
      input.dataset.tableId,
      input.dataset.rowId,
      input.dataset.columnId,
      normalized,
    ));
    if (updated && table.type === "combat") {
      refreshCombatHealthRow(
        input.closest("[data-table-row]"),
        input.dataset.tableId,
        input.dataset.rowId,
      );
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
    const targetTable = tableById(target.tableId);
    const targetColumn = columnById(targetTable, target.columnId);
    const isDamage = targetTable?.type === "combat" && targetColumn?.role === "damage";
    const formula = elements.editorValue.value.trim();
    if (isDamage && formula && formula !== "0" && !evaluateArithmeticFormula(formula).valid) {
      elements.editorError.textContent = "Enter a valid formula using numbers, +, -, and parentheses.";
      elements.editorError.classList.remove("hidden");
      elements.editorValue.focus();
      return;
    }
    closeDialog(elements.editorDialog);
    editorTarget = null;
    applyMutation((current) => updateTrackerCell(
      current,
      target.tableId,
      target.rowId,
      target.columnId,
      isDamage ? formula : elements.editorValue.value,
    ));
  });

  elements.addPartyMember.addEventListener("click", () => {
    addPartyMemberRow();
    elements.partyMembers.lastElementChild?.querySelector("[data-party-character]")?.focus();
  });

  elements.partySelect.addEventListener("change", () => {
    loadPartyIntoEditor(elements.partySelect.value);
  });

  elements.partyMembers.addEventListener("click", (event) => {
    const remove = event.target.closest("[data-remove-party-member]");
    if (!remove) return;
    remove.closest("[data-party-member]")?.remove();
    if (!elements.partyMembers.children.length) addPartyMemberRow();
  });

  elements.partyForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const members = [...elements.partyMembers.querySelectorAll("[data-party-member]")]
      .map((row) => ({
        character: row.querySelector("[data-party-character]").value,
        maxHp: row.querySelector("[data-party-hp]").value,
        ac: row.querySelector("[data-party-ac]").value,
      }));
    try {
      const nextParties = upsertParty(partyLibrary, {
        id: elements.partySelect.value,
        name: elements.partyName.value,
        members,
      });
      if (persistParties(nextParties, `${elements.partyName.value.trim()} saved.`)) {
        closeDialog(elements.partyDialog);
      }
    } catch (error) {
      showToast(error.message || "That party could not be saved.");
    }
  });

  elements.bringPartyForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const selectedIds = [...elements.bringPartyList.querySelectorAll('input[name="party"]:checked')]
      .map((input) => input.value);
    if (!selectedIds.length) {
      showToast("Select at least one party to bring.");
      return;
    }
    const members = membersForPartyIds(partyLibrary, selectedIds);
    if (applyMutation(
      (current) => bringPartyMembersToInitiative(current, members),
      `${selectedIds.length === 1 ? "Party" : "Parties"} added to Initiative.`,
    )) {
      closeDialog(elements.bringPartyDialog);
    }
  });

  elements.partyConflictForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!pendingCombatSend) return;
    const selections = {};
    elements.partyConflictList.querySelectorAll("[data-conflict-key]").forEach((field) => {
      const selected = field.querySelector('input[type="radio"]:checked');
      if (selected) selections[field.dataset.conflictKey] = selected.value;
    });
    if (Object.keys(selections).length !== pendingCombatSend.conflicts.length) {
      showToast("Choose a party for every conflicting character.");
      return;
    }
    completeCombatSend({
      sort: pendingCombatSend.sort,
      candidates: pendingCombatSend.candidates,
      selections,
    });
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

  elements.sortSendCombat.addEventListener("click", () => {
    requestCombatSend({ sort: true });
  });
  elements.sendCombatAsIs.addEventListener("click", () => {
    requestCombatSend();
  });
  elements.cancelSendCombat.addEventListener("click", () => {
    closeDialog(elements.sendCombatDialog);
  });

  document.getElementById("cancel-confirm").addEventListener("click", () => {
    confirmationAction = null;
    closeDialog(elements.confirmDialog);
  });
  document.querySelectorAll("[data-close-dialog]").forEach((button) =>
    button.addEventListener("click", () => {
      if (button.dataset.closeDialog === "editor-dialog") editorTarget = null;
      if (button.dataset.closeDialog === "party-conflict-dialog") pendingCombatSend = null;
      closeDialog(document.getElementById(button.dataset.closeDialog));
    }),
  );
  [
    elements.editorDialog,
    elements.partyDialog,
    elements.bringPartyDialog,
    elements.partyConflictDialog,
    elements.nameDialog,
  ].forEach((dialog) =>
    dialog.addEventListener("click", (event) => {
      if (event.target !== dialog) return;
      if (dialog === elements.partyConflictDialog) pendingCombatSend = null;
      closeDialog(dialog);
    }),
  );
  elements.sendCombatDialog.addEventListener("click", (event) => {
    if (event.target === elements.sendCombatDialog) closeDialog(elements.sendCombatDialog);
  });
  elements.confirmDialog.addEventListener("click", (event) => {
    if (event.target !== elements.confirmDialog) return;
    confirmationAction = null;
    closeDialog(elements.confirmDialog);
  });

  document.getElementById("new-preset").addEventListener("click", requestNewPreset);
  document.getElementById("save-preset").addEventListener("click", requestSavePreset);
  document.getElementById("download-preset").addEventListener("click", downloadCurrentWorkspace);
  elements.uploadPreset.addEventListener("click", () => elements.uploadPresetFile.click());
  elements.uploadPresetFile.addEventListener("change", () =>
    uploadPresetFile(elements.uploadPresetFile.files?.[0]));
  document.getElementById("new-tracker").addEventListener("click", () => {
    if (applyMutation(addCustomTracker, "A blank tracker was added."))
      elements.trackers.lastElementChild?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  elements.loadPreset.addEventListener("click", requestLoadPreset);
  elements.removePreset.addEventListener("click", requestRemovePreset);
  elements.presetSelect.addEventListener("change", updateChrome);

  document.addEventListener("keydown", (event) => {
    const openDialogElement = [
      elements.confirmDialog,
      elements.partyConflictDialog,
      elements.sendCombatDialog,
      elements.bringPartyDialog,
      elements.nameDialog,
      elements.partyDialog,
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
    } else if (!elements.partyConflictDialog.classList.contains("hidden")) {
      pendingCombatSend = null;
      closeDialog(elements.partyConflictDialog);
    } else if (!elements.sendCombatDialog.classList.contains("hidden")) {
      closeDialog(elements.sendCombatDialog);
    } else if (!elements.bringPartyDialog.classList.contains("hidden")) {
      closeDialog(elements.bringPartyDialog);
    } else if (!elements.nameDialog.classList.contains("hidden")) {
      closeDialog(elements.nameDialog);
    } else if (!elements.partyDialog.classList.contains("hidden")) {
      closeDialog(elements.partyDialog);
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

  const restoreCloudWorkspace = createCombatCloudSync({
    applyCloudWorkspace(cloud) {
      presets = cloud.presets;
      savePresetCollection(presets);
      const cloudParties = cloud.partyLibrary
        ? normalizePartyLibrary(cloud.partyLibrary)
        : partyLibrary;
      const migratedCloudParties = migrateLegacyPartyLibrary(cloudParties, [
        ...presets.map((preset) => ({
          document: preset.document,
          name: `${preset.baseName || "Imported"} Party`,
        })),
        { document: cloud.draft?.currentDocument, name: "Imported Party" },
      ]);
      partyLibrary = migratedCloudParties.parties;
      savePartyLibrary(partyLibrary);
      if (migratedCloudParties.changed || (!cloud.partyLibrary && partyLibrary.length)) {
        writeCloudJSON("api/combat-loot/party-library", {
          version: 1,
          parties: partyLibrary,
        }).catch((error) => console.error("Could not save migrated parties to D1:", error));
      }
      if (cloud.draft?.currentDocument?.tables) {
        workspace = prepareWorkspaceDocument(cloud.draft.currentDocument);
        activePresetId = presets.some((preset) => preset.active && preset.id === cloud.draft.activePresetId)
          ? cloud.draft.activePresetId
          : null;
        baselineDocument = cloud.draft.baselineDocument?.tables
          ? prepareWorkspaceDocument(cloud.draft.baselineDocument)
          : null;
        saveDraft({ activePresetId, baselineDocument, currentDocument: workspace });
      }
      renderPresetOptions(activePresetId || "");
      render();
    },
    getLocalDraft: () => recoveredDraft,
    getLocalPartyLibrary: () => partyLibrary,
    getLocalPresets: () => presets,
    showToast,
  });

  renderPresetOptions(activePresetId || "");
  render();
  persistDraft({ cloud: false });
  restoreCloudWorkspace().catch((error) => {
    console.error("Could not restore Combat & Loot data from D1:", error);
    showToast("Using this browser's Combat & Loot data because cloud restore failed.");
  });
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
