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
  characterStateStorageKey,
  entityDocumentsStorageKey,
} from "../storage-keys.js";
import { isNpcTracker, trackerApiPath, trackerEntityLabel } from "../entity-context.js";
import { defaultNpcVisibility, normalizeNpcVisibility, npcFieldVisible } from "../../../shared/js/npc-visibility.js";
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
import { DEFAULT_ENTITY_STATUS, normalizeEntityStatus } from "../../../shared/js/status.js";
import { currentSession } from "../../../shared/js/auth-client.js";
import {
  DEFAULT_V3_LAYOUT,
  V3_SECTION_DEFINITIONS,
  moveV3SectionBefore,
  moveV3SectionBy,
  normalizeV3Layout,
  setV3Columns,
  setV3SectionSpan,
} from "../../../shared/js/v3-layout.js";
import { saveV3Layout } from "../tracker/v3-layout-repository.js";
import { currentV3CharacterSheetLayout, updateV3CharacterSheetLayout } from "../tracker/layout.js";
import { downloadCharacterJson, downloadCharacterPdf } from "./character-export.js";

export function initializeCharacterEditor({ character, normalizeSpellcastingData, refreshUI }) {
  const params = new URLSearchParams(location.search);
  const npcMode = isNpcTracker();
  const entityLabel = trackerEntityLabel();
  const mountedExtensions = new Map();
  const expandedItems = new Map();
  let editing = false;
  let draft = null;
  let baseline = null;
  let baselineVisibility = {};
  let draftVisibility = {};
  let baselinePlayerVisible = false;
  let draftPlayerVisible = false;
  let baselineStyle = "v1";
  let draftStyle = "v1";
  let draggedV1Section = null;
  let baselineV3Layout = normalizeV3Layout(DEFAULT_V3_LAYOUT);
  let draftV3Layout = normalizeV3Layout(DEFAULT_V3_LAYOUT);
  let draggedV3Section = null;
  let activeSection = "basics";
  let returnFocusTarget = null;
  let controller;

  const classes = {
    button: "inline-flex items-center justify-center gap-2 rounded-xl border border-blood-500 bg-blood-500 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-blood-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold",
    field: "w-full rounded-xl border border-stone-300 bg-white/80 px-3 py-2.5 text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold dark:border-white/15 dark:bg-white/5 dark:text-white",
    panel: "rounded-2xl border border-stone-300/80 bg-white/70 p-4 dark:border-white/10 dark:bg-white/[.04]",
  };
  const { renderNode, renderPrimitive, renderVisibilityControl } = createCharacterFieldRenderer({
    classes,
    expandedItems,
    getDraft: () => draft,
    getVisibility: () => draftVisibility,
    showVisibilityControls: npcMode,
  });

  function renderFields(keys) {
    return `<div class="grid grid-cols-1 gap-4 md:grid-cols-2">${keys.map((key) => `<div>${renderPrimitive(draft[key], [key], key)}</div>`).join("")}</div>`;
  }

  function renderBasics() {
    return `<div class="space-y-6">
      ${npcMode ? `<label class="${classes.panel} flex items-center justify-between gap-4"><span><strong class="block">Show NPC in player archive</strong><span class="mt-1 block text-sm text-stone-500 dark:text-stone-400">Turning this off hides the NPC from players without removing it for Admins or DMs.</span></span><input type="checkbox" data-npc-player-visible class="h-6 w-6 shrink-0 accent-red-700" ${draftPlayerVisible ? "checked" : ""}></label>` : ""}
      ${npcMode ? `<div class="${classes.panel} flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><strong class="block">Player field visibility</strong><span class="mt-1 block text-sm text-stone-500 dark:text-stone-400">${draftVisibility.$default === true ? "Fields are shown unless you hide them." : "Only fields marked Shown are visible. Use Show all to switch to hide-only mode."}</span></div><div class="flex shrink-0 gap-2"><button type="button" data-npc-visibility-preset="hide-all" class="rounded-xl border border-stone-400 px-3 py-2 text-sm font-bold">Hide all</button><button type="button" data-npc-visibility-preset="show-all" class="rounded-xl border border-emerald-600 px-3 py-2 text-sm font-bold text-emerald-700 dark:text-emerald-300">Show all</button></div></div>` : ""}
      <div class="${classes.panel}"><div class="flex flex-col gap-4 sm:flex-row sm:items-center"><button type="button" data-editor-portrait class="group relative h-28 w-28 shrink-0 overflow-hidden rounded-2xl border border-stone-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold dark:border-white/15"><img data-editor-portrait-preview src="${escapeAttribute(draft.portrait || "shared/assets/bat.ico")}" alt="${entityLabel} portrait preview" class="h-full w-full object-cover"><span class="absolute inset-x-0 bottom-0 bg-black/70 px-2 py-1.5 text-xs font-bold text-white"><i class="bi bi-camera-fill mr-1"></i> Change</span></button><div class="grow"><div class="flex items-center justify-between gap-3"><h3 class="font-display text-lg font-bold">${entityLabel} portrait</h3>${renderVisibilityControl(["portrait"], `${entityLabel} portrait`)}</div><p class="mt-1 text-sm text-stone-500 dark:text-stone-400">Choose an image from this device. It is saved with the ${entityLabel.toLowerCase()}.</p></div></div></div>
      ${renderFields(["name", "status", "class", "subclass", "race", "level", "experience", "background", "alignment", "gender"])}
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
    return `<div class="space-y-8">${renderNode(draft.features || [], ["features"], "features")}${renderNode(draft.resources || [], ["resources"], "resources")}${renderNode(draft.extras || [], ["extras"], "extras")}</div>`;
  }

  function renderInventory() {
    return `<div class="space-y-8">${renderNode(draft.inventory || [], ["inventory"], "inventory")}<section class="${classes.panel}"><h3 class="mb-4 font-display text-lg font-bold">Currency</h3>${renderNode(draft.currency || {}, ["currency"], "currency")}</section></div>`;
  }

  function renderV1SectionOrder() {
    if (draftStyle === "v2") {
      return '<div class="mt-4 rounded-xl border border-stone-300 bg-stone-100/70 p-4 text-sm text-stone-600 dark:border-white/15 dark:bg-white/5 dark:text-stone-300">Style v2 uses a fixed tabbed layout, so its sections cannot be rearranged.</div>';
    }
    if (draftStyle !== "v1") return "";
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

  function renderV3LayoutBuilder() {
    if (draftStyle !== "v3") return "";
    const definitions = new Map(V3_SECTION_DEFINITIONS.map((definition) => [definition.id, definition]));
    return `<div class="mt-5 border-t border-stone-300 pt-5 dark:border-white/10">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div><h4 class="font-display font-bold">Personal V3 grid</h4><p class="mt-1 text-sm text-stone-500 dark:text-stone-400">Drag tiles or use Earlier/Later. Phones always use this reading order in one column.</p></div>
        <button type="button" data-v3-layout-reset class="rounded-xl border border-stone-400 px-3 py-2 text-sm font-bold transition hover:border-blood-500 hover:text-blood-500 dark:border-white/20"><i class="bi bi-arrow-counterclockwise mr-1"></i>Reset</button>
      </div>
      <label class="mt-4 block max-w-xs"><span class="mb-1 block text-xs font-bold text-stone-500 dark:text-stone-400">Desktop columns</span><select id="editor-v3-columns" class="${classes.field}"><option value="2"${draftV3Layout.columns === 2 ? " selected" : ""}>2 columns</option><option value="3"${draftV3Layout.columns === 3 ? " selected" : ""}>3 columns</option></select></label>
      <div data-v3-section-list class="mt-4 grid items-start gap-2" style="grid-template-columns:repeat(${draftV3Layout.columns},minmax(0,1fr))">${draftV3Layout.sections.map((section, index) => {
        const definition = definitions.get(section.id);
        return `<div data-v3-section-row="${escapeAttribute(section.id)}" class="flex min-w-0 flex-wrap items-center gap-2 rounded-xl border border-stone-300 bg-white/70 p-2 transition dark:border-white/15 dark:bg-white/5" style="grid-column:span ${section.span} / span ${section.span}">
          <button type="button" draggable="true" data-v3-section-drag="${escapeAttribute(section.id)}" class="inline-flex h-10 w-10 shrink-0 cursor-grab items-center justify-center rounded-lg border border-stone-300 text-stone-500 active:cursor-grabbing dark:border-white/15" aria-label="Drag ${escapeAttribute(definition.label)}" title="Drag tile"><i class="bi bi-grip-vertical"></i></button>
          <strong class="min-w-32 grow break-words">${escapeHTML(definition.label)}</strong>
          <label class="shrink-0 text-xs font-bold text-stone-500 dark:text-stone-400">Span <select data-v3-section-span="${escapeAttribute(section.id)}" class="ml-1 rounded-lg border border-stone-300 bg-white px-2 py-1.5 text-stone-900 dark:border-white/15 dark:bg-stone-900 dark:text-white">${Array.from({ length: draftV3Layout.columns }, (_, optionIndex) => `<option value="${optionIndex + 1}"${section.span === optionIndex + 1 ? " selected" : ""}>${optionIndex + 1}</option>`).join("")}</select></label>
          <div class="flex shrink-0 gap-1"><button type="button" data-v3-section-move="${escapeAttribute(section.id)}" data-delta="-1"${index === 0 ? " disabled" : ""} class="rounded-lg border border-stone-300 px-2 py-1.5 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-35 dark:border-white/15" aria-label="Move ${escapeAttribute(definition.label)} earlier">Earlier</button><button type="button" data-v3-section-move="${escapeAttribute(section.id)}" data-delta="1"${index === draftV3Layout.sections.length - 1 ? " disabled" : ""} class="rounded-lg border border-stone-300 px-2 py-1.5 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-35 dark:border-white/15" aria-label="Move ${escapeAttribute(definition.label)} later">Later</button></div>
        </div>`;
      }).join("")}</div>
    </div>`;
  }

  function renderAdvanced() {
    const canManage = document.body.dataset.characterCanManage !== "false";
    const metadataKeys = ["bundledUpdate", "bundledUpdateVersions"].filter((key) => draft[key] !== undefined);
    const customKeys = Object.keys(draft).filter((key) => !sectionTopLevelKeys.has(key));
    return `<div class="space-y-6">
      <div class="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-stone-700 dark:text-stone-200"><strong class="block">Advanced ${npcMode ? "NPC" : "character"} data</strong><span class="mt-1 block">Technical IDs are read-only. Custom fields remain editable so homebrew data is never discarded.</span></div>
      ${(canManage || draftStyle === "v3") ? `<section class="${classes.panel}"><h3 class="font-display text-lg font-bold">${npcMode ? "NPC" : "Character"} tracker layout</h3><p class="mt-1 text-sm text-stone-500 dark:text-stone-400">${canManage ? `The style choice applies to ${escapeHTML(draft.name || `this ${entityLabel.toLowerCase()}`)}.` : "The campaign DM controls the style; this grid is personal to you."}</p>${canManage ? `<label class="mt-4 block"><span class="mb-1 block text-xs font-bold text-stone-500 dark:text-stone-400">Style</span><select id="editor-character-sheet-style" class="${classes.field}"><option value="v1" ${draftStyle === "v1" ? "selected" : ""}>Style v1</option><option value="v2" ${draftStyle === "v2" ? "selected" : ""}>Style v2</option><option value="v3" ${draftStyle === "v3" ? "selected" : ""}>Style v3</option><option value="v4" ${draftStyle === "v4" ? "selected" : ""}>Style v4</option></select></label>${renderV1SectionOrder()}` : ""}${renderV3LayoutBuilder()}</section>` : ""}
      <section class="${classes.panel}"><h3 class="mb-4 font-display text-lg font-bold">${npcMode ? "NPC" : "Character"} ID</h3>${renderPrimitive(draft.id, ["id"], "id", { readOnly: !canManage })}</section>
      ${metadataKeys.length ? `<section class="${classes.panel}"><h3 class="mb-4 font-display text-lg font-bold">System metadata</h3><div class="space-y-4">${metadataKeys.map((key) => renderPrimitive(JSON.stringify(draft[key], null, 2), [key], key, { readOnly: true })).join("")}</div></section>` : ""}
      <section class="${classes.panel}"><h3 class="mb-1 font-display text-lg font-bold">Custom fields</h3><p class="mb-4 text-sm text-stone-500 dark:text-stone-400">Fields outside the standard ${npcMode ? "NPC" : "character"} schema appear here.</p>${customKeys.length ? `<div class="space-y-4">${customKeys.map((key) => renderNode(draft[key], [key], key)).join("")}</div>` : `<p class="rounded-xl border border-dashed border-stone-300 px-4 py-6 text-center text-sm text-stone-500 dark:border-white/15">No custom fields on this ${entityLabel.toLowerCase()}.</p>`}</section>
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
        <nav class="hidden space-y-2 lg:block" role="tablist" aria-orientation="vertical" aria-label="${npcMode ? "NPC" : "Character"} editor sections">${sectionDefinitions.map(({ id, label, icon }) => `<button id="editor-tab-${id}" type="button" role="tab" data-editor-section-button="${id}" aria-controls="editor-panel-${id}" class="flex w-full items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 text-left text-sm font-bold transition hover:bg-stone-200 dark:hover:bg-white/10"><i class="bi ${icon}" aria-hidden="true"></i><span>${label}</span></button>`).join("")}</nav>
        <div class="min-w-0">
          <label class="mb-5 block lg:hidden"><span class="mb-1 block text-xs font-bold uppercase tracking-wide text-stone-500">Editor section</span><select id="editor-mobile-section" class="${classes.field}">${sectionDefinitions.map(({ id, label }) => `<option value="${id}">${label}</option>`).join("")}</select></label>
          ${sectionDefinitions.map(({ id, label }) => `<section id="editor-panel-${id}" data-editor-section="${id}" role="tabpanel" aria-labelledby="editor-tab-${id}" aria-label="${label}" class="space-y-5">${sectionRenderers[id]()}</section>`).join("")}
        </div>
      </div>
      <datalist id="editor-action-options"><option value="Action"><option value="Bonus Action"><option value="Reaction"><option value="Free Action"><option value="Other"></datalist>
      <datalist id="editor-ability-options"><option value="STR"><option value="DEX"><option value="CON"><option value="INT"><option value="WIS"><option value="CHA"></datalist>
      <datalist id="editor-reset-options"><option value="short"><option value="long"><option value="dawn"><option value="none"></datalist>
      <datalist id="editor-status-options"><option value="Active"><option value="Paused"><option value="Hiatus"><option value="Draft"><option value="Ended"></datalist>`;
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
          <button id="editor-portrait-button" data-editor-portrait type="button" class="group relative shrink-0" aria-label="Upload a new ${entityLabel} portrait">
            <img id="editor-portrait" data-editor-portrait-preview src="${escapeAttribute(window.character.portrait || "shared/assets/bat.ico")}" class="h-14 w-14 rounded-xl border border-stone-300 object-cover group-hover:ring-4 group-hover:ring-blood-500 dark:border-white/15 sm:h-16 sm:w-16" alt="">
            <span class="absolute inset-0 flex items-center justify-center rounded-xl bg-black/50 text-white opacity-0 transition group-hover:opacity-100"><i class="bi bi-camera-fill"></i></span>
          </button>
          <div class="min-w-0"><h2 id="editor-title" class="truncate font-display text-xl font-bold sm:text-2xl">${npcMode ? "Edit NPC tracker" : "Edit character sheet"}</h2><p id="editor-character-name" class="truncate text-sm text-stone-500">${escapeHTML(window.character.name || (npcMode ? "NPC" : "Character"))}</p></div>
        </div>
        <button id="editor-close" type="button" class="rounded-xl p-3 hover:bg-stone-200 dark:hover:bg-white/10" aria-label="Close editor"><i class="bi bi-x-lg"></i></button>
      </header>
      <div id="editor-fields" class="grow space-y-5 overflow-y-auto p-3 sm:p-6"></div>
      <footer class="flex flex-col gap-3 border-t border-stone-300 p-3 dark:border-white/10 sm:flex-row sm:items-center sm:justify-between sm:p-4">
        <p id="editor-validation-status" class="text-sm font-medium text-blood-500" role="alert"></p>
        <div class="flex flex-wrap justify-end gap-3">${npcMode ? "" : `<details id="editor-export-menu" class="relative">
          <summary class="inline-flex cursor-pointer list-none items-center justify-center gap-2 rounded-xl border border-stone-400 px-4 py-2 text-sm font-bold [&::-webkit-details-marker]:hidden"><i class="bi bi-download"></i> Export character</summary>
          <div class="absolute bottom-full right-0 z-10 mb-2 w-52 overflow-hidden rounded-xl border border-stone-300 bg-parchment p-1 shadow-xl dark:border-white/15 dark:bg-ink">
            <button id="editor-export-json" type="button" class="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-bold hover:bg-stone-200 disabled:cursor-wait disabled:opacity-50 dark:hover:bg-white/10"><i class="bi bi-filetype-json"></i> Download JSON</button>
            <button id="editor-export-pdf" type="button" class="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-bold hover:bg-stone-200 disabled:cursor-wait disabled:opacity-50 dark:hover:bg-white/10"><i class="bi bi-file-earmark-pdf"></i> Download filled PDF</button>
          </div>
        </details>`}<button id="editor-cancel" type="button" class="rounded-xl border border-stone-400 px-4 py-2 text-sm font-bold">Cancel</button><button id="editor-save" type="button" class="${classes.button}"><i class="bi bi-check-lg"></i> Save changes</button></div>
      </footer>
    </div>`;
    document.body.appendChild(overlay);

    controller = createDialogController(overlay, {
      initialFocus: () => window.matchMedia("(min-width: 1024px)").matches
        ? document.querySelector(`[data-editor-section-button="${activeSection}"]`)
        : document.getElementById("editor-mobile-section"),
      returnFocus: () => returnFocusTarget || toggle,
      beforeClose() {
        if (!draftsDiffer(baseline, draft) && baselineStyle === draftStyle && !draftsDiffer(baselineV3Layout, draftV3Layout)
          && !draftsDiffer(baselineVisibility, draftVisibility) && baselinePlayerVisible === draftPlayerVisible) return true;
        return confirm(npcMode
          ? "Discard your unsaved NPC changes?"
          : "Discard your unsaved character changes?");
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
        draggedV3Section = null;
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
    document.getElementById("editor-export-json")?.addEventListener("click", () => exportDraft("json"));
    document.getElementById("editor-export-pdf")?.addEventListener("click", () => exportDraft("pdf"));
    document.getElementById("editor-fields").addEventListener("input", updateDraft);
    document.getElementById("editor-fields").addEventListener("click", handleEditorClick);
    document.getElementById("editor-fields").addEventListener("change", (event) => {
      if (event.target.matches("[data-npc-player-visible]")) draftPlayerVisible = event.target.checked;
      if (event.target.id === "editor-mobile-section") activateSection(event.target.value);
      if (event.target.id === "editor-character-sheet-style") {
        draftStyle = ["v1", "v2", "v3", "v4"].includes(event.target.value) ? event.target.value : "v1";
        renderEditorFields();
      }
      if (event.target.id === "editor-v3-columns") {
        draftV3Layout = setV3Columns(draftV3Layout, Number(event.target.value));
        renderEditorFields();
      }
      if (event.target.matches("[data-v3-section-span]")) {
        draftV3Layout = setV3SectionSpan(draftV3Layout, event.target.dataset.v3SectionSpan, Number(event.target.value));
        renderEditorFields();
      }
    });
    document.getElementById("editor-fields").addEventListener("keydown", handleSectionKeydown);
    document.getElementById("editor-fields").addEventListener("dragstart", handleV1SectionDragStart);
    document.getElementById("editor-fields").addEventListener("dragstart", handleV3SectionDragStart);
    document.getElementById("editor-fields").addEventListener("dragover", handleV1SectionDragOver);
    document.getElementById("editor-fields").addEventListener("dragover", handleV3SectionDragOver);
    document.getElementById("editor-fields").addEventListener("dragleave", handleV1SectionDragLeave);
    document.getElementById("editor-fields").addEventListener("dragleave", handleV3SectionDragLeave);
    document.getElementById("editor-fields").addEventListener("drop", handleV1SectionDrop);
    document.getElementById("editor-fields").addEventListener("drop", handleV3SectionDrop);
    document.getElementById("editor-fields").addEventListener("dragend", clearV1SectionDragState);
    document.getElementById("editor-fields").addEventListener("dragend", clearV3SectionDragState);
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
    baselineVisibility = normalizeNpcVisibility(window.npcVisibility);
    draftVisibility = { ...baselineVisibility };
    baselinePlayerVisible = document.body.dataset.npcPlayerVisible === "true";
    draftPlayerVisible = baselinePlayerVisible;
    baselineStyle = ["v1", "v2", "v3", "v4"].includes(document.documentElement.dataset.characterSheetStyle) ? document.documentElement.dataset.characterSheetStyle : "v1";
    draftStyle = baselineStyle;
    baselineV3Layout = currentV3CharacterSheetLayout();
    draftV3Layout = normalizeV3Layout(baselineV3Layout);
    activeSection = sectionRenderers[section] ? section : "basics";
    returnFocusTarget = trigger || document.activeElement || document.getElementById("edit-character-toggle");
    expandedItems.clear();
    document.getElementById("editor-title").textContent = params.get("new") === "1" ? `Finish ${entityLabel} setup` : `Edit ${entityLabel} tracker`;
    document.getElementById("editor-character-name").textContent = draft.name || entityLabel;
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
      document.getElementById("editor-character-name").textContent = input.value || entityLabel;
      input.removeAttribute("aria-invalid");
      document.getElementById("editor-validation-status").textContent = "";
    }
  }

  function handleEditorClick(event) {
    const visibilityPreset = event.target.closest("[data-npc-visibility-preset]");
    if (visibilityPreset && npcMode) {
      draftVisibility = visibilityPreset.dataset.npcVisibilityPreset === "show-all"
        ? defaultNpcVisibility()
        : {};
      renderEditorFields();
      return;
    }
    const visibilityToggle = event.target.closest("[data-npc-field-visibility]");
    if (visibilityToggle && npcMode) {
      const path = visibilityToggle.dataset.npcFieldVisibility;
      const visible = npcFieldVisible(draftVisibility, path);
      if (draftVisibility.$default === true) {
        if (visible) draftVisibility[path] = false;
        else delete draftVisibility[path];
      } else if (visible) delete draftVisibility[path];
      else draftVisibility[path] = true;
      renderEditorFields();
      return;
    }
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
    const v3Move = event.target.closest("[data-v3-section-move]");
    if (v3Move && draftStyle === "v3") {
      draftV3Layout = moveV3SectionBy(draftV3Layout, v3Move.dataset.v3SectionMove, v3Move.dataset.delta);
      renderEditorFields();
      return;
    }
    if (event.target.closest("[data-v3-layout-reset]") && draftStyle === "v3") {
      draftV3Layout = normalizeV3Layout(DEFAULT_V3_LAYOUT);
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

    function reindexVisibility(startIndex, delta, removedIndex = null) {
      if (!npcMode) return;
      const prefix = `${collectionPath}.`;
      const next = {};
      Object.entries(draftVisibility).forEach(([fieldPath, visible]) => {
        if (!fieldPath.startsWith(prefix)) {
          next[fieldPath] = visible;
          return;
        }
        const remainder = fieldPath.slice(prefix.length);
        const [indexText, ...tail] = remainder.split(".");
        const currentIndex = Number(indexText);
        if (!Number.isInteger(currentIndex) || currentIndex === removedIndex) return;
        const mappedIndex = currentIndex >= startIndex ? currentIndex + delta : currentIndex;
        next[`${prefix}${mappedIndex}${tail.length ? `.${tail.join(".")}` : ""}`] = visible;
      });
      draftVisibility = next;
    }

    if (add) {
      items.push(createBlankCollectionItem(path, items, draft));
      expandedItems.set(collectionPath, items.length - 1);
    } else if (edit) {
      const index = Number(edit.dataset.index);
      expandedItems.set(collectionPath, expandedItems.get(collectionPath) === index ? null : index);
    } else if (duplicate) {
      const index = Number(duplicate.dataset.index);
      const originalPrefix = `${collectionPath}.${index}.`;
      const copied = Object.entries(draftVisibility).filter(([fieldPath]) => fieldPath.startsWith(originalPrefix));
      reindexVisibility(index + 1, 1);
      items.splice(index + 1, 0, duplicateCollectionItem(items[index], path.at(-1)));
      copied.forEach(([fieldPath, visible]) => {
        draftVisibility[`${collectionPath}.${index + 1}.${fieldPath.slice(originalPrefix.length)}`] = visible;
      });
      expandedItems.set(collectionPath, index + 1);
    } else if (remove) {
      const index = Number(remove.dataset.index);
      const name = items[index]?.name || `${title(path.at(-1))} ${index + 1}`;
      if (!confirm(`Remove ${name}?`)) return;
      items.splice(index, 1);
      reindexVisibility(index + 1, -1, index);
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

  function clearV3SectionDragState() {
    draggedV3Section = null;
    document.querySelectorAll("[data-v3-section-row]").forEach((row) => {
      row.classList.remove("outline", "outline-2", "outline-blood-500");
    });
  }

  function handleV3SectionDragStart(event) {
    const handle = event.target.closest("[data-v3-section-drag]");
    if (!handle || draftStyle !== "v3") return;
    draggedV3Section = handle.dataset.v3SectionDrag;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", draggedV3Section);
  }

  function handleV3SectionDragOver(event) {
    const row = event.target.closest("[data-v3-section-row]");
    if (!row || !draggedV3Section || draftStyle !== "v3") return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    row.classList.add("outline", "outline-2", "outline-blood-500");
  }

  function handleV3SectionDragLeave(event) {
    event.target.closest("[data-v3-section-row]")?.classList.remove("outline", "outline-2", "outline-blood-500");
  }

  function handleV3SectionDrop(event) {
    const row = event.target.closest("[data-v3-section-row]");
    if (!row || !draggedV3Section || draftStyle !== "v3") return;
    event.preventDefault();
    draftV3Layout = moveV3SectionBefore(draftV3Layout, draggedV3Section, row.dataset.v3SectionRow);
    clearV3SectionDragState();
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
    const nameInput = document.querySelector('[data-path="name"]');
    const statusInput = document.querySelector('[data-path="status"]');
    if (!String(draft.name || "").trim()) {
      activateSection("basics");
      nameInput?.setAttribute("aria-invalid", "true");
      document.getElementById("editor-validation-status").textContent = npcMode ? "NPC name is required." : "Character name is required.";
      nameInput?.focus();
      return false;
    }
    if (!normalizeEntityStatus(draft.status)) {
      activateSection("basics");
      statusInput?.setAttribute("aria-invalid", "true");
      document.getElementById("editor-validation-status").textContent = npcMode ? "NPC status cannot exceed 32 characters." : "Character status cannot exceed 32 characters.";
      statusInput?.focus();
      return false;
    }
    return true;
  }

  async function exportDraft(format) {
    if (!draft) return;
    const button = document.getElementById(`editor-export-${format}`);
    const status = document.getElementById("editor-validation-status");
    button.disabled = true;
    status.textContent = format === "pdf" ? "Preparing filled PDF…" : "Preparing JSON…";
    try {
      if (format === "pdf") await downloadCharacterPdf(clone(draft));
      else downloadCharacterJson(clone(draft));
      status.textContent = "";
      document.getElementById("editor-export-menu")?.removeAttribute("open");
    } catch (error) {
      console.error(`Could not export character ${format.toUpperCase()}:`, error);
      status.textContent = `Could not export ${format.toUpperCase()}. Try again.`;
    } finally {
      button.disabled = false;
    }
  }

  async function save() {
    if (!validateDraft()) return;
    const oldId = window.character.id;
    const selectedStyle = draftStyle;
    const styleChanged = baselineStyle !== selectedStyle;
    const layoutChanged = draftsDiffer(baselineV3Layout, draftV3Layout);
    draft.name = draft.name.trim();
    draft.status = normalizeEntityStatus(draft.status) || DEFAULT_ENTITY_STATUS;
    if (typeof normalizeSpellcastingData === "function") normalizeSpellcastingData(draft);
    window.character = clone(draft);
    Object.keys(character).forEach((key) => delete character[key]);
    Object.assign(character, window.character);
    const characters = readJSON(entityDocumentsStorageKey(), {});
    if (oldId !== character.id) delete characters[oldId];
    characters[character.id] = npcMode
      ? { document: clone(character), visibility: { ...draftVisibility }, playerVisible: draftPlayerVisible }
      : clone(character);
    writeJSON(entityDocumentsStorageKey(), characters);
    removeStored(characterStateStorageKey(oldId));
    baseline = clone(draft);
    if (document.documentElement.dataset.characterSheetStyle === "v3" && layoutChanged) {
      updateV3CharacterSheetLayout(draftV3Layout);
    }
    controller.forceClose("save");
    refreshUI();
    let characterCloudError = null;
    try {
      const bundledId = document.body.dataset.characterShell;
      if (oldId !== character.id) {
        await writeCloudJSON(trackerApiPath(oldId, "id"), { id: character.id });
      }
      await writeCloudJSON(trackerApiPath(character.id), {
        document: clone(character),
        ...(npcMode ? { visibility: draftVisibility, playerVisible: draftPlayerVisible } : {
          source: bundledId && bundledId !== "template" ? "bundled" : "custom",
        }),
      });
    } catch (error) {
      console.error(`Could not save ${entityLabel} to D1:`, error);
      characterCloudError = error;
    }
    if (layoutChanged || oldId !== character.id) {
      try {
        const session = await currentSession();
        await saveV3Layout({
          userId: session.user?.id,
          characterId: character.id,
          layout: draftV3Layout,
        });
      } catch (error) {
        console.error("Could not sync the personal V3 layout:", error);
        if (!characterCloudError) alert("Character changes were saved, but the personal layout is pending cloud sync.");
      }
    }
    if (characterCloudError) {
      if (styleChanged && isLocalRuntimeHost()) {
        try {
          await saveCharacterSheetStyleOverride(character.id, selectedStyle, { kind: npcMode ? "npc" : "character" });
          window.location.reload();
          return;
        } catch (styleError) {
          console.error("Could not save the local character sheet style:", styleError);
        }
      }
      alert("Changes remain saved in this browser, but could not be saved to the shared cloud database.");
      return;
    }
    if (npcMode) {
      window.npcVisibility = { ...draftVisibility };
      document.body.dataset.npcPlayerVisible = String(draftPlayerVisible);
    }
    if (styleChanged) {
      try {
        await saveCharacterSheetStyleOverride(character.id, selectedStyle, { kind: npcMode ? "npc" : "character" });
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
