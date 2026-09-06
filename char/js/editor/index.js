// Coordinates the full character editor, focused sections, validation, and saving.
import { createDialogController } from "../../../shared/js/dialog.js";
import { readJSON, removeStored, writeJSON } from "../../../shared/js/storage.js";
import { writeCloudJSON } from "../../../shared/js/cloud-store.js";
import {
  isLocalRuntimeHost,
  saveCharacterSheetStyleOverride,
} from "../../../shared/js/settings.js";
import { escapeAttribute, escapeHTML } from "../../../shared/js/text.js";
import {
  CHARACTERS_STORAGE_KEY,
  characterStateStorageKey,
} from "../storage-keys.js";
import { subscribeCharacterEditorExtensions } from "./extensions.js";
import {
  V1_SECTION_DEFINITIONS,
  moveV1SectionBefore,
  moveV1SectionBy,
  normalizeV1SectionOrder,
} from "../tracker/section-order.js";
import {
  clone,
  createBlankCollectionItem,
  draftsDiffer,
  duplicateCollectionItem,
  pathValue,
} from "./model.js";
import {
  CHARACTER_SECTION_KEYS as sectionTopLevelKeys,
  EDITOR_SECTION_DEFINITIONS as sectionDefinitions,
  fieldPathKey as pathKey,
  fieldTitle as title,
} from "./field-schema.js";
import { createCharacterFieldRenderer } from "./field-renderer.js";
import { currentCampaignSlug } from "../../../shared/js/campaign-context.js";

export function initializeCharacterEditor({ character, normalizeSpellcastingData, refreshUI }) {
  const params = new URLSearchParams(location.search);
  const mountedExtensions = new Map();
  const expandedItems = new Map();
  let editing = false;
  let draft = null;
  let baseline = null;
  let baselineStyle = "v1";
  let draftStyle = "v1";
  let draggedV1Section = null;
  let activeSection = "basics";
  let returnFocusTarget = null;
  let controller;

  const classes = {
    button: "inline-flex items-center justify-center gap-2 rounded-xl border border-blood-500 bg-blood-500 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-blood-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold",
    field: "w-full rounded-xl border border-stone-300 bg-white/80 px-3 py-2.5 text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold dark:border-white/15 dark:bg-white/5 dark:text-white",
    panel: "rounded-2xl border border-stone-300/80 bg-white/70 p-4 dark:border-white/10 dark:bg-white/[.04]",
  };
  const { renderNode, renderPrimitive } = createCharacterFieldRenderer({
    classes,
    expandedItems,
    getDraft: () => draft,
  });

  function renderFields(keys) {
    return `<div class="grid grid-cols-1 gap-4 md:grid-cols-2">${keys.map((key) => `<div>${renderPrimitive(draft[key], [key], key)}</div>`).join("")}</div>`;
  }

  function renderBasics() {
    return `<div class="space-y-6">
      <div class="${classes.panel}"><div class="flex flex-col gap-4 sm:flex-row sm:items-center"><button type="button" data-editor-portrait class="group relative h-28 w-28 shrink-0 overflow-hidden rounded-2xl border border-stone-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold dark:border-white/15"><img data-editor-portrait-preview src="${escapeAttribute(draft.portrait || "shared/assets/bat.ico")}" alt="Character portrait preview" class="h-full w-full object-cover"><span class="absolute inset-x-0 bottom-0 bg-black/70 px-2 py-1.5 text-xs font-bold text-white"><i class="bi bi-camera-fill mr-1"></i> Change</span></button><div><h3 class="font-display text-lg font-bold">Character portrait</h3><p class="mt-1 text-sm text-stone-500 dark:text-stone-400">Choose an image from this device. It is saved with the character.</p></div></div></div>
      ${renderFields(["name", "class", "subclass", "race", "level", "experience", "background", "alignment", "gender"])}
    </div>`;
  }

  function renderCombat() {
    return `<div class="space-y-6">
      <section class="${classes.panel}"><h3 class="mb-4 font-display text-lg font-bold">Combat values</h3>${renderFields(["ac", "initiative", "proficiency", "walk", "fly", "passivePerception", "darkvision"])}</section>
      <section class="${classes.panel}"><h3 class="mb-4 font-display text-lg font-bold">Hit points</h3>${renderNode(draft.hp, ["hp"], "hp")}</section>
      <section class="space-y-4"><h3 class="font-display text-lg font-bold">Abilities, saves, and skills</h3>${Object.entries(draft.stats || {}).map(([ability, value]) => `<div class="${classes.panel}"><h4 class="mb-4 font-display font-bold">${title(ability)}</h4>${renderNode(value, ["stats", ability], ability)}</div>`).join("")}</section>
    </div>`;
  }

  function renderActions() {
    return `<div class="space-y-8">${renderNode(draft.actions || [], ["actions"], "actions")}${renderNode(draft.trackers || [], ["trackers"], "trackers")}</div>`;
  }

  function renderSpellcasting() {
    const spellcasting = draft.spellcasting || (draft.spellcasting = { enabled: false, profiles: [], slots: [] });
    return `<div class="space-y-8"><div class="${classes.panel}">${renderPrimitive(Boolean(spellcasting.enabled), ["spellcasting", "enabled"], "enabled")}</div>${renderNode(spellcasting.profiles || [], ["spellcasting", "profiles"], "profiles")}${renderNode(spellcasting.slots || [], ["spellcasting", "slots"], "slots")}${renderNode(draft.spells || [], ["spells"], "spells")}</div>`;
  }

  function renderFeatures() {
    return `<div class="space-y-8">${renderNode(draft.features || [], ["features"], "features")}${renderNode(draft.resources || [], ["resources"], "resources")}</div>`;
  }

  function renderInventory() {
    return `<div class="space-y-8">${renderNode(draft.inventory || [], ["inventory"], "inventory")}<section class="${classes.panel}"><h3 class="mb-4 font-display text-lg font-bold">Currency</h3>${renderNode(draft.currency || {}, ["currency"], "currency")}</section></div>`;
  }

  function renderV1SectionOrder() {
    if (draftStyle !== "v1") {
      return '<div class="mt-4 rounded-xl border border-stone-300 bg-stone-100/70 p-4 text-sm text-stone-600 dark:border-white/15 dark:bg-white/5 dark:text-stone-300">Style v2 uses a fixed tabbed layout, so its sections cannot be rearranged.</div>';
    }
    const order = normalizeV1SectionOrder(draft.v1SectionOrder);
    const definitions = new Map(V1_SECTION_DEFINITIONS.map((definition) => [definition.id, definition]));
    return `<div class="mt-5">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div><h4 class="font-display font-bold">V1 section order</h4><p class="mt-1 text-sm text-stone-500 dark:text-stone-400">Drag sections into place or use the arrow buttons.</p></div>
        <button type="button" data-v1-section-reset class="rounded-xl border border-stone-400 px-3 py-2 text-sm font-bold transition hover:border-blood-500 hover:text-blood-500 dark:border-white/20"><i class="bi bi-arrow-counterclockwise mr-1"></i>Reset</button>
      </div>
      <div class="mt-4 space-y-2" data-v1-section-list>${order.map((id, index) => {
        const definition = definitions.get(id);
        return `<div data-v1-section-row="${escapeAttribute(id)}" class="flex items-center gap-2 rounded-xl border border-stone-300 bg-white/70 p-2 transition dark:border-white/15 dark:bg-white/5">
          <button type="button" draggable="true" data-v1-section-drag="${escapeAttribute(id)}" class="inline-flex h-10 w-10 shrink-0 cursor-grab items-center justify-center rounded-lg border border-stone-300 text-stone-500 active:cursor-grabbing dark:border-white/15" aria-label="Drag ${escapeAttribute(definition.label)}" title="Drag section"><i class="bi bi-grip-vertical"></i></button>
          <strong class="min-w-0 grow">${escapeHTML(definition.label)}</strong>
          <button type="button" data-v1-section-move="${escapeAttribute(id)}" data-delta="-1" ${index === 0 ? "disabled" : ""} class="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-stone-300 text-stone-500 transition hover:border-blood-500 hover:text-blood-500 disabled:cursor-not-allowed disabled:opacity-35 dark:border-white/15" aria-label="Move ${escapeAttribute(definition.label)} up"><i class="bi bi-arrow-up"></i></button>
          <button type="button" data-v1-section-move="${escapeAttribute(id)}" data-delta="1" ${index === order.length - 1 ? "disabled" : ""} class="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-stone-300 text-stone-500 transition hover:border-blood-500 hover:text-blood-500 disabled:cursor-not-allowed disabled:opacity-35 dark:border-white/15" aria-label="Move ${escapeAttribute(definition.label)} down"><i class="bi bi-arrow-down"></i></button>
        </div>`;
      }).join("")}</div>
    </div>`;
  }

  function renderAdvanced() {
    const canManage = document.body.dataset.characterCanManage !== "false";
    const metadataKeys = ["bundledUpdate", "bundledUpdateVersions"].filter((key) => draft[key] !== undefined);
    const customKeys = Object.keys(draft).filter((key) => !sectionTopLevelKeys.has(key));
    return `<div class="space-y-6">
      <div class="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-stone-700 dark:text-stone-200"><strong class="block">Advanced character data</strong><span class="mt-1 block">Technical IDs are read-only. Custom fields remain editable so homebrew data is never discarded.</span></div>
      ${canManage ? `<section class="${classes.panel}"><h3 class="font-display text-lg font-bold">Character tracker layout</h3><p class="mt-1 text-sm text-stone-500 dark:text-stone-400">This choice applies only to ${escapeHTML(draft.name || "this character")}.</p><label class="mt-4 block"><span class="mb-1 block text-xs font-bold text-stone-500 dark:text-stone-400">Style</span><select id="editor-character-sheet-style" class="${classes.field}"><option value="v1" ${draftStyle === "v1" ? "selected" : ""}>Style v1</option><option value="v2" ${draftStyle === "v2" ? "selected" : ""}>Style v2</option></select></label>${renderV1SectionOrder()}</section>` : ""}
      <section class="${classes.panel}"><h3 class="mb-4 font-display text-lg font-bold">Character ID</h3>${renderPrimitive(draft.id, ["id"], "id", { readOnly: !canManage })}</section>
      ${metadataKeys.length ? `<section class="${classes.panel}"><h3 class="mb-4 font-display text-lg font-bold">System metadata</h3><div class="space-y-4">${metadataKeys.map((key) => renderPrimitive(JSON.stringify(draft[key], null, 2), [key], key, { readOnly: true })).join("")}</div></section>` : ""}
      <section class="${classes.panel}"><h3 class="mb-1 font-display text-lg font-bold">Custom fields</h3><p class="mb-4 text-sm text-stone-500 dark:text-stone-400">Fields outside the standard character schema appear here.</p>${customKeys.length ? `<div class="space-y-4">${customKeys.map((key) => renderNode(draft[key], [key], key)).join("")}</div>` : '<p class="rounded-xl border border-dashed border-stone-300 px-4 py-6 text-center text-sm text-stone-500 dark:border-white/15">No custom fields on this character.</p>'}</section>
    </div>`;
  }

  const sectionRenderers = {
    basics: renderBasics,
    combat: renderCombat,
    actions: renderActions,
    spellcasting: renderSpellcasting,
    features: renderFeatures,
    inventory: renderInventory,
    advanced: renderAdvanced,
  };

  function activateSection(sectionId, { focus = false } = {}) {
    if (!sectionRenderers[sectionId]) return;
    activeSection = sectionId;
    document.querySelectorAll("[data-editor-section]").forEach((panel) => {
      panel.hidden = panel.dataset.editorSection !== activeSection;
    });
    document.querySelectorAll("[data-editor-section-button]").forEach((button) => {
      const selected = button.dataset.editorSectionButton === activeSection;
      button.setAttribute("aria-selected", String(selected));
      button.tabIndex = selected ? 0 : -1;
      button.classList.toggle("border-blood-500", selected);
      button.classList.toggle("bg-blood-500/10", selected);
      button.classList.toggle("text-blood-500", selected);
    });
    const selector = document.getElementById("editor-mobile-section");
    if (selector) selector.value = activeSection;
    if (focus) document.querySelector(`[data-editor-section-button="${activeSection}"]`)?.focus();
  }

  function renderEditorFields() {
    const fields = document.getElementById("editor-fields");
    const scrollTop = fields.scrollTop;
    fields.innerHTML = `<div data-editor-extensions></div>
      <div class="grid items-start gap-5 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <nav class="hidden space-y-2 lg:block" role="tablist" aria-orientation="vertical" aria-label="Character editor sections">${sectionDefinitions.map(({ id, label, icon }) => `<button id="editor-tab-${id}" type="button" role="tab" data-editor-section-button="${id}" aria-controls="editor-panel-${id}" class="flex w-full items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 text-left text-sm font-bold transition hover:bg-stone-200 dark:hover:bg-white/10"><i class="bi ${icon}" aria-hidden="true"></i><span>${label}</span></button>`).join("")}</nav>
        <div class="min-w-0">
          <label class="mb-5 block lg:hidden"><span class="mb-1 block text-xs font-bold uppercase tracking-wide text-stone-500">Editor section</span><select id="editor-mobile-section" class="${classes.field}">${sectionDefinitions.map(({ id, label }) => `<option value="${id}">${label}</option>`).join("")}</select></label>
          ${sectionDefinitions.map(({ id, label }) => `<section id="editor-panel-${id}" data-editor-section="${id}" role="tabpanel" aria-labelledby="editor-tab-${id}" aria-label="${label}" class="space-y-5">${sectionRenderers[id]()}</section>`).join("")}
        </div>
      </div>
      <datalist id="editor-action-options"><option value="Action"><option value="Bonus Action"><option value="Reaction"><option value="Free Action"><option value="Other"></datalist>
      <datalist id="editor-ability-options"><option value="STR"><option value="DEX"><option value="CON"><option value="INT"><option value="WIS"><option value="CHA"></datalist>
      <datalist id="editor-reset-options"><option value="short"><option value="long"><option value="dawn"><option value="none"></datalist>`;
    activateSection(activeSection);
    fields.scrollTop = scrollTop;
    const host = extensionHost();
    mountedExtensions.forEach((extension) => extension.afterRender?.(host));
  }

  function extensionHost() {
    return {
      editorRoot: document.getElementById("character-editor"),
      fieldsRoot: document.getElementById("editor-fields"),
      getDraft: () => draft,
      updateDraft(mutator, { rerender = true } = {}) {
        if (!draft || typeof mutator !== "function") return;
        mutator(draft);
        if (rerender) renderEditorFields();
      },
      rerender: renderEditorFields,
    };
  }

  function buildUI() {
    const toggle = document.createElement("button");
    toggle.id = "edit-character-toggle";
    toggle.type = "button";
    toggle.className = "inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-blood-500 bg-blood-500 px-3 text-sm font-bold text-white shadow-sm transition hover:bg-blood-600";
    toggle.innerHTML = '<i class="bi bi-pencil-square"></i><span class="hidden sm:inline">Edit sheet</span>';
    (document.getElementById("editor-toggle-slot") || document.body).appendChild(toggle);

    const overlay = document.createElement("div");
    overlay.id = "character-editor";
    overlay.className = "fixed inset-0 z-50 hidden items-center justify-center bg-ink/80 p-2 backdrop-blur-sm sm:p-6";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-labelledby", "editor-title");
    overlay.innerHTML = `<div class="flex h-full w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-stone-300 bg-parchment shadow-2xl dark:border-white/15 dark:bg-ink">
      <header class="flex items-center justify-between gap-3 border-b border-stone-300 p-3 dark:border-white/10 sm:p-4">
        <div class="flex min-w-0 items-center gap-3">
          <button id="editor-portrait-button" data-editor-portrait type="button" class="group relative shrink-0" aria-label="Upload a new character portrait">
            <img id="editor-portrait" data-editor-portrait-preview src="${escapeAttribute(window.character.portrait || "shared/assets/bat.ico")}" class="h-14 w-14 rounded-xl border border-stone-300 object-cover group-hover:ring-4 group-hover:ring-blood-500 dark:border-white/15 sm:h-16 sm:w-16" alt="">
            <span class="absolute inset-0 flex items-center justify-center rounded-xl bg-black/50 text-white opacity-0 transition group-hover:opacity-100"><i class="bi bi-camera-fill"></i></span>
          </button>
          <div class="min-w-0"><h2 id="editor-title" class="truncate font-display text-xl font-bold sm:text-2xl">Edit character sheet</h2><p id="editor-character-name" class="truncate text-sm text-stone-500">${escapeHTML(window.character.name || "Character")}</p></div>
        </div>
        <button id="editor-close" type="button" class="rounded-xl p-3 hover:bg-stone-200 dark:hover:bg-white/10" aria-label="Close editor"><i class="bi bi-x-lg"></i></button>
      </header>
      <div id="editor-fields" class="grow space-y-5 overflow-y-auto p-3 sm:p-6"></div>
      <footer class="flex flex-col gap-3 border-t border-stone-300 p-3 dark:border-white/10 sm:flex-row sm:items-center sm:justify-between sm:p-4">
        <p id="editor-validation-status" class="text-sm font-medium text-blood-500" role="alert"></p>
        <div class="flex justify-end gap-3"><button id="editor-cancel" type="button" class="rounded-xl border border-stone-400 px-4 py-2 text-sm font-bold">Cancel</button><button id="editor-save" type="button" class="${classes.button}"><i class="bi bi-check-lg"></i> Save changes</button></div>
      </footer>
    </div>`;
    document.body.appendChild(overlay);

    controller = createDialogController(overlay, {
      initialFocus: () => window.matchMedia("(min-width: 1024px)").matches
        ? document.querySelector(`[data-editor-section-button="${activeSection}"]`)
        : document.getElementById("editor-mobile-section"),
      returnFocus: () => returnFocusTarget || toggle,
      beforeClose() {
        if (!draftsDiffer(baseline, draft) && baselineStyle === draftStyle) return true;
        return confirm("Discard your unsaved character changes?");
      },
      onClose() {
        editing = false;
        overlay.dispatchEvent(new CustomEvent("character-editor:close"));
        document.getElementById("character-portrait")?.classList.remove("cursor-pointer", "ring-4", "ring-blood-500");
        draft = null;
        baseline = null;
        baselineStyle = "v1";
        draftStyle = "v1";
        draggedV1Section = null;
      },
    });

    toggle.addEventListener("click", () => open());
    document.addEventListener("click", (event) => {
      const trigger = event.target.closest("[data-character-editor-section]");
      if (!trigger) return;
      open({ section: trigger.dataset.characterEditorSection, trigger });
    });
    document.getElementById("editor-close").addEventListener("click", controller.close);
    document.getElementById("editor-cancel").addEventListener("click", controller.close);
    document.getElementById("editor-save").addEventListener("click", save);
    document.getElementById("editor-fields").addEventListener("input", updateDraft);
    document.getElementById("editor-fields").addEventListener("click", handleEditorClick);
    document.getElementById("editor-fields").addEventListener("change", (event) => {
      if (event.target.id === "editor-mobile-section") activateSection(event.target.value);
      if (event.target.id === "editor-character-sheet-style") {
        draftStyle = event.target.value === "v2" ? "v2" : "v1";
        renderEditorFields();
      }
    });
    document.getElementById("editor-fields").addEventListener("keydown", handleSectionKeydown);
    document.getElementById("editor-fields").addEventListener("dragstart", handleV1SectionDragStart);
    document.getElementById("editor-fields").addEventListener("dragover", handleV1SectionDragOver);
    document.getElementById("editor-fields").addEventListener("dragleave", handleV1SectionDragLeave);
    document.getElementById("editor-fields").addEventListener("drop", handleV1SectionDrop);
    document.getElementById("editor-fields").addEventListener("dragend", clearV1SectionDragState);
    subscribeCharacterEditorExtensions((extension) => {
      if (mountedExtensions.has(extension.id)) return;
      mountedExtensions.set(extension.id, extension);
      const host = extensionHost();
      extension.mount?.(host);
      if (draft) extension.afterRender?.(host);
    });

    const portrait = document.getElementById("character-portrait");
    portrait?.addEventListener("click", () => {
      if (editing) choosePortrait();
    });
  }

  function open({ section = "basics", trigger = null } = {}) {
    editing = true;
    baseline = clone(window.character);
    draft = clone(window.character);
    baselineStyle = document.documentElement.dataset.characterSheetStyle === "v2" ? "v2" : "v1";
    draftStyle = baselineStyle;
    activeSection = sectionRenderers[section] ? section : "basics";
    returnFocusTarget = trigger || document.activeElement || document.getElementById("edit-character-toggle");
    expandedItems.clear();
    document.getElementById("editor-title").textContent = params.get("new") === "1" ? "Finish character setup" : "Edit character sheet";
    document.getElementById("editor-character-name").textContent = draft.name || "Character";
    document.getElementById("editor-validation-status").textContent = "";
    renderEditorFields();
    document.querySelectorAll("[data-editor-portrait-preview]").forEach((image) => {
      image.src = draft.portrait || "shared/assets/bat.ico";
    });
    controller.open();
    document.getElementById("character-portrait")?.classList.add("cursor-pointer", "ring-4", "ring-blood-500");
  }

  function updateDraft(event) {
    const input = event.target.closest("[data-path]");
    if (!input || !draft) return;
    const path = input.dataset.path.split(".");
    const parent = pathValue(draft, path.slice(0, -1));
    const current = parent?.[path.at(-1)];
    if (!parent) return;
    parent[path.at(-1)] = input.type === "checkbox" ? input.checked
      : typeof current === "number" ? Number(input.value) : input.value;
    if (path.length === 1 && path[0] === "name") {
      document.getElementById("editor-character-name").textContent = input.value || "Character";
      input.removeAttribute("aria-invalid");
      document.getElementById("editor-validation-status").textContent = "";
    }
  }

  function handleEditorClick(event) {
    const sectionButton = event.target.closest("[data-editor-section-button]");
    if (sectionButton) {
      activateSection(sectionButton.dataset.editorSectionButton);
      return;
    }
    if (event.target.closest("[data-editor-portrait]")) {
      choosePortrait();
      return;
    }
    const sectionMove = event.target.closest("[data-v1-section-move]");
    if (sectionMove && draftStyle === "v1") {
      draft.v1SectionOrder = moveV1SectionBy(
        draft.v1SectionOrder,
        sectionMove.dataset.v1SectionMove,
        sectionMove.dataset.delta,
      );
      renderEditorFields();
      return;
    }
    if (event.target.closest("[data-v1-section-reset]") && draftStyle === "v1") {
      delete draft.v1SectionOrder;
      renderEditorFields();
      return;
    }
    const add = event.target.closest("[data-add]");
    const edit = event.target.closest("[data-edit]");
    const duplicate = event.target.closest("[data-duplicate]");
    const remove = event.target.closest("[data-remove]");
    const action = add || edit || duplicate || remove;
    if (!action) return;
    const collectionPath = action.dataset.add || action.dataset.edit || action.dataset.duplicate || action.dataset.remove;
    const path = collectionPath.split(".");
    let items = pathValue(draft, path);
    if (!Array.isArray(items) && add) {
      const parent = pathValue(draft, path.slice(0, -1));
      if (parent) {
        parent[path.at(-1)] = [];
        items = parent[path.at(-1)];
      }
    }
    if (!Array.isArray(items)) return;

    if (add) {
      items.push(createBlankCollectionItem(path, items, draft));
      expandedItems.set(collectionPath, items.length - 1);
    } else if (edit) {
      const index = Number(edit.dataset.index);
      expandedItems.set(collectionPath, expandedItems.get(collectionPath) === index ? null : index);
    } else if (duplicate) {
      const index = Number(duplicate.dataset.index);
      items.splice(index + 1, 0, duplicateCollectionItem(items[index], path.at(-1)));
      expandedItems.set(collectionPath, index + 1);
    } else if (remove) {
      const index = Number(remove.dataset.index);
      const name = items[index]?.name || `${title(path.at(-1))} ${index + 1}`;
      if (!confirm(`Remove ${name}?`)) return;
      items.splice(index, 1);
      expandedItems.delete(collectionPath);
    }
    renderEditorFields();
  }

  function clearV1SectionDragState() {
    draggedV1Section = null;
    document.querySelectorAll("[data-v1-section-row]").forEach((row) => {
      row.classList.remove("outline", "outline-2", "outline-blood-500");
    });
  }

  function handleV1SectionDragStart(event) {
    const handle = event.target.closest("[data-v1-section-drag]");
    if (!handle || draftStyle !== "v1") return;
    draggedV1Section = handle.dataset.v1SectionDrag;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", draggedV1Section);
  }

  function handleV1SectionDragOver(event) {
    const row = event.target.closest("[data-v1-section-row]");
    if (!row || !draggedV1Section || draftStyle !== "v1") return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    row.classList.add("outline", "outline-2", "outline-blood-500");
  }

  function handleV1SectionDragLeave(event) {
    event.target.closest("[data-v1-section-row]")?.classList.remove("outline", "outline-2", "outline-blood-500");
  }

  function handleV1SectionDrop(event) {
    const row = event.target.closest("[data-v1-section-row]");
    if (!row || !draggedV1Section || draftStyle !== "v1") return;
    event.preventDefault();
    draft.v1SectionOrder = moveV1SectionBefore(
      draft.v1SectionOrder,
      draggedV1Section,
      row.dataset.v1SectionRow,
    );
    clearV1SectionDragState();
    renderEditorFields();
  }

  function handleSectionKeydown(event) {
    const current = event.target.closest("[data-editor-section-button]");
    if (!current || !["ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return;
    const buttons = [...document.querySelectorAll("[data-editor-section-button]")];
    const index = buttons.indexOf(current);
    const next = event.key === "Home" ? 0
      : event.key === "End" ? buttons.length - 1
        : (index + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length;
    event.preventDefault();
    activateSection(buttons[next].dataset.editorSectionButton, { focus: true });
  }

  function validateDraft() {
    if (String(draft.name || "").trim()) return true;
    activateSection("basics");
    const nameInput = document.querySelector('[data-path="name"]');
    nameInput?.setAttribute("aria-invalid", "true");
    document.getElementById("editor-validation-status").textContent = "Character name is required.";
    nameInput?.focus();
    return false;
  }

  async function save() {
    if (!validateDraft()) return;
    const oldId = window.character.id;
    const selectedStyle = draftStyle;
    const styleChanged = baselineStyle !== selectedStyle;
    draft.name = draft.name.trim();
    if (typeof normalizeSpellcastingData === "function") normalizeSpellcastingData(draft);
    window.character = clone(draft);
    Object.keys(character).forEach((key) => delete character[key]);
    Object.assign(character, window.character);
    const characters = readJSON(CHARACTERS_STORAGE_KEY, {});
    if (oldId !== character.id) delete characters[oldId];
    characters[character.id] = clone(character);
    writeJSON(CHARACTERS_STORAGE_KEY, characters);
    removeStored(characterStateStorageKey(oldId));
    baseline = clone(draft);
    controller.forceClose("save");
    refreshUI();
    try {
      const bundledId = document.body.dataset.characterShell;
      if (oldId !== character.id && currentCampaignSlug()) {
        await writeCloudJSON(`api/characters/${encodeURIComponent(oldId)}/id`, { id: character.id });
      }
      await writeCloudJSON(`api/characters/${encodeURIComponent(character.id)}`, {
        document: clone(character),
        source: bundledId && bundledId !== "template" ? "bundled" : "custom",
      });
      if (oldId !== character.id && !currentCampaignSlug()) {
        await writeCloudJSON(`api/characters/${encodeURIComponent(oldId)}`, undefined, { method: "DELETE" });
      }
    } catch (error) {
      console.error("Could not save character to D1:", error);
      if (styleChanged && isLocalRuntimeHost()) {
        try {
          await saveCharacterSheetStyleOverride(character.id, selectedStyle);
          window.location.reload();
          return;
        } catch (styleError) {
          console.error("Could not save the local character sheet style:", styleError);
        }
      }
      alert("Changes remain saved in this browser, but could not be saved to the shared cloud database.");
      return;
    }
    if (styleChanged) {
      try {
        await saveCharacterSheetStyleOverride(character.id, selectedStyle);
        window.location.reload();
      } catch (error) {
        console.error("Could not save the character sheet style:", error);
        alert("Character changes were saved, but the tracker style could not be updated.");
      }
    }
  }

  function uploadPortrait(file) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      document.getElementById("editor-validation-status").textContent = "Choose an image file for the portrait.";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      draft.portrait = reader.result;
      document.querySelectorAll("[data-editor-portrait-preview]").forEach((image) => {
        image.src = reader.result;
      });
    };
    reader.readAsDataURL(file);
  }

  function choosePortrait() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = () => uploadPortrait(input.files?.[0]);
    input.click();
  }

  buildUI();
  if (params.get("edit") === "1") open();
  return { open };
}
