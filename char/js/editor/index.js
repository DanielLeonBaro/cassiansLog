import { createDialogController } from "../../../shared/js/dialog.js";
import { readJSON, removeStored, writeJSON } from "../../../shared/js/storage.js";
import { writeCloudJSON } from "../../../shared/js/cloud-store.js";
import { escapeAttribute, escapeHTML } from "../../../shared/js/text.js";
import { subscribeCharacterEditorExtensions } from "./extensions.js";
import {
  clone,
  createBlankCollectionItem,
  draftsDiffer,
  duplicateCollectionItem,
  pathValue,
} from "./model.js";

const sectionDefinitions = [
  { id: "basics", label: "Basics", icon: "bi-person-fill" },
  { id: "combat", label: "Abilities & Combat", icon: "bi-shield-fill" },
  { id: "actions", label: "Actions & Trackers", icon: "bi-lightning-charge-fill" },
  { id: "spellcasting", label: "Spellcasting", icon: "bi-magic" },
  { id: "features", label: "Features & Resources", icon: "bi-stars" },
  { id: "inventory", label: "Inventory & Currency", icon: "bi-backpack-fill" },
  { id: "advanced", label: "Advanced", icon: "bi-sliders" },
];

const sectionTopLevelKeys = new Set([
  "portrait", "name", "class", "subclass", "race", "level", "experience", "background", "alignment", "gender",
  "hp", "ac", "initiative", "proficiency", "walk", "fly", "passivePerception", "darkvision", "stats",
  "actions", "trackers", "spellcasting", "spells", "features", "resources", "inventory", "currency",
  "id", "bundledUpdate", "bundledUpdateVersions",
]);

const labels = {
  hp: "Hit points", ac: "Armor class", str: "Strength", dex: "Dexterity",
  con: "Constitution", int: "Intelligence", wis: "Wisdom", cha: "Charisma",
  saveDC: "Save DC", attackBonus: "Attack bonus", preparedLimit: "Prepared spell limit",
  passivePerception: "Passive perception", darkvision: "Darkvision range",
  walk: "Walking speed", fly: "Flying speed", profileId: "Spellcasting profile",
};

const collectionKnownFields = {
  trackers: new Set(["id", "name", "active"]),
  profiles: new Set(["id", "name", "ability", "saveDC", "attackBonus", "preparedLimit"]),
  slots: new Set(["id", "profileId", "level", "current", "max", "reset"]),
  skills: new Set(["name", "modifier", "proficiency"]),
  actions: new Set(["id", "name", "category", "action", "range", "attack", "damage", "duration", "uses", "description"]),
  spells: new Set(["id", "name", "category", "action", "level", "school", "source", "spellcasting", "slotLevel", "range", "attack", "damage", "duration", "components", "concentration", "prepared", "uses", "description"]),
  resources: new Set(["id", "name", "category", "action", "uses", "description"]),
  features: new Set(["id", "name", "category", "description"]),
  inventory: new Set(["id", "name", "quantity", "description"]),
};

export function initializeCharacterEditor({ character, normalizeSpellcastingData, refreshUI }) {
  const STORAGE_KEY = "dnd-characters";
  const params = new URLSearchParams(location.search);
  const mountedExtensions = new Map();
  const expandedItems = new Map();
  let editing = false;
  let draft = null;
  let baseline = null;
  let activeSection = "basics";
  let controller;

  const classes = {
    button: "inline-flex items-center justify-center gap-2 rounded-xl border border-blood-500 bg-blood-500 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-blood-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold",
    field: "w-full rounded-xl border border-stone-300 bg-white/80 px-3 py-2.5 text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold dark:border-white/15 dark:bg-white/5 dark:text-white",
    panel: "rounded-2xl border border-stone-300/80 bg-white/70 p-4 dark:border-white/10 dark:bg-white/[.04]",
  };

  function title(value) {
    return labels[value] || String(value)
      .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
      .replace(/[-_]/g, " ")
      .replace(/^./, (character) => character.toUpperCase());
  }

  function pathKey(path) {
    return path.join(".");
  }

  function isSystemField(path, key) {
    return key === "id" || key.startsWith("_") || (key.endsWith("Id") && key !== "profileId") || (
      path.length === 1 && ["bundledUpdate", "bundledUpdateVersions"].includes(key)
    );
  }

  function renderPrimitive(value, path, key, { readOnly = false } = {}) {
    const id = `editor-${path.join("-")}`;
    const fieldPath = escapeAttribute(pathKey(path));
    const systemField = readOnly || isSystemField(path, key);
    const profileField =
      (path[0] === "spells" && key === "source") ||
      (path[0] === "spellcasting" && path[1] === "slots" && key === "profileId");

    if (profileField) {
      const options = draft.spellcasting?.profiles || [];
      return `<label class="block"><span class="mb-1 block text-xs font-bold text-stone-500 dark:text-stone-400">${path[0] === "spells" ? "Source spellcasting profile" : "Spellcasting profile"}</span><select id="${id}" data-path="${fieldPath}" class="${classes.field}"><option value="">No profile</option>${options.map((profile) => `<option value="${escapeAttribute(profile.id)}" ${profile.id === value ? "selected" : ""}>${escapeHTML(profile.name || profile.id)}</option>`).join("")}</select></label>`;
    }
    if (path[0] === "spells" && key === "prepared") {
      return `<div><span class="mb-1 block text-xs font-bold text-stone-500 dark:text-stone-400">Prepared</span><p class="rounded-xl border border-stone-300 bg-stone-100/70 px-3 py-2.5 text-sm text-stone-500 dark:border-white/15 dark:bg-white/5 dark:text-stone-400">Managed from the Prepare Spells section.</p></div>`;
    }
    if (typeof value === "boolean") {
      return `<label class="flex min-h-11 items-center gap-3 rounded-xl border border-stone-300 bg-white/60 px-3 py-2 dark:border-white/15 dark:bg-white/5 ${systemField ? "opacity-70" : ""}"><input id="${id}" data-path="${fieldPath}" type="checkbox" ${value ? "checked" : ""} ${systemField ? "disabled" : ""} class="h-5 w-5 accent-red-700"><span class="font-medium">${title(key)}</span></label>`;
    }

    const type = typeof value === "number" ? "number" : "text";
    const multiline = typeof value === "string" && (key === "description" || value.length > 80);
    const list = key === "action" ? "editor-action-options"
      : key === "ability" ? "editor-ability-options"
        : key === "reset" ? "editor-reset-options" : "";
    const required = path.length === 1 && key === "name";
    const helper = systemField ? '<span class="mt-1 block text-xs text-stone-500">Preserved for links and saved-data compatibility.</span>' : "";
    return `<label class="block"><span class="mb-1 block text-xs font-bold text-stone-500 dark:text-stone-400">${title(key)}${required ? ' <span class="text-blood-500">*</span>' : ""}</span>${multiline
      ? `<textarea id="${id}" data-path="${fieldPath}" class="${classes.field} ${systemField ? "opacity-70" : ""}" rows="3" ${systemField ? "readonly" : ""}>${escapeHTML(value)}</textarea>`
      : `<input id="${id}" data-path="${fieldPath}" type="${type}" value="${escapeAttribute(value)}" ${list ? `list="${list}"` : ""} ${required ? "required" : ""} ${systemField ? "readonly" : ""} class="${classes.field} ${systemField ? "opacity-70" : ""}">`}${helper}</label>`;
  }

  function collectionSummary(item, key, index) {
    if (!item || typeof item !== "object") return `${title(key)} ${index + 1}`;
    const name = item.name || item.label || `${title(key)} ${index + 1}`;
    const details = [item.category, item.action, item.level !== undefined ? `Level ${item.level}` : ""]
      .filter(Boolean)
      .join(" · ");
    return `<span class="min-w-0"><strong class="block truncate text-left">${escapeHTML(name)}</strong>${details ? `<span class="mt-0.5 block truncate text-left text-xs font-normal text-stone-500 dark:text-stone-400">${escapeHTML(details)}</span>` : ""}</span>`;
  }

  function renderCollection(value, path, key) {
    const collectionPath = pathKey(path);
    const expanded = expandedItems.get(collectionPath);
    return `<section class="space-y-3" data-array="${escapeAttribute(collectionPath)}">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div><h3 class="font-display text-lg font-bold">${title(key)}</h3><p class="text-xs text-stone-500">${value.length} ${value.length === 1 ? "entry" : "entries"}</p></div>
        <div class="flex flex-wrap gap-2" data-array-actions="${escapeAttribute(collectionPath)}"><button type="button" data-add="${escapeAttribute(collectionPath)}" class="${classes.button}"><i class="bi bi-plus-lg"></i> Add manually</button></div>
      </div>
      <div class="space-y-3">${value.map((item, index) => {
        const open = expanded === index;
        return `<article class="overflow-hidden rounded-2xl border border-stone-300/80 bg-white/70 dark:border-white/10 dark:bg-white/[.04]">
          <div class="flex items-center gap-2 p-3 sm:p-4">
            <button type="button" data-edit="${escapeAttribute(collectionPath)}" data-index="${index}" class="flex min-w-0 grow items-center justify-between gap-3 rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold" aria-expanded="${open}">
              ${collectionSummary(item, key, index)}<i class="bi ${open ? "bi-chevron-up" : "bi-chevron-down"} shrink-0 text-stone-400"></i>
            </button>
            <button type="button" data-duplicate="${escapeAttribute(collectionPath)}" data-index="${index}" class="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sky-600 hover:bg-sky-600/10" aria-label="Duplicate ${escapeAttribute(item?.name || `${title(key)} ${index + 1}`)}"><i class="bi bi-copy"></i></button>
            <button type="button" data-remove="${escapeAttribute(collectionPath)}" data-index="${index}" class="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-blood-500 hover:bg-blood-500/10" aria-label="Remove ${escapeAttribute(item?.name || `${title(key)} ${index + 1}`)}"><i class="bi bi-trash"></i></button>
          </div>
          ${open ? `<div class="border-t border-stone-200 p-4 dark:border-white/10">${renderNode(item, [...path, index], `${title(key)} ${index + 1}`)}</div>` : ""}
        </article>`;
      }).join("") || '<div class="rounded-2xl border border-dashed border-stone-300 px-4 py-8 text-center text-sm text-stone-500 dark:border-white/15">No entries yet. Add one manually or use an available content picker.</div>'}</div>
    </section>`;
  }

  function renderNode(value, path = [], key = "", options = {}) {
    if (Array.isArray(value)) return renderCollection(value, path, key);
    if (value && typeof value === "object") {
      const entries = Object.entries(value);
      const collection = typeof path.at(-1) === "number" ? path.at(-2) : "";
      const knownFields = collectionKnownFields[collection];
      const primaryEntries = knownFields ? entries.filter(([childKey]) => knownFields.has(childKey)) : entries;
      const additionalEntries = knownFields ? entries.filter(([childKey]) => !knownFields.has(childKey)) : [];
      const renderEntries = (selected) => selected.map(([childKey, child]) => {
        const nested = child && typeof child === "object";
        return `<div class="${nested ? "md:col-span-2" : ""}">${renderNode(child, [...path, childKey], childKey, options)}</div>`;
      }).join("");
      return `<fieldset class="space-y-3"><legend class="${path.length > 1 ? "mb-2 font-bold" : "sr-only"}">${title(key)}</legend>
        <div class="grid grid-cols-1 gap-3 md:grid-cols-2">${renderEntries(primaryEntries)}</div>
        ${additionalEntries.length ? `<details class="rounded-xl border border-stone-300/80 p-3 dark:border-white/10"><summary class="cursor-pointer text-sm font-bold text-stone-600 dark:text-stone-300">Additional fields (${additionalEntries.length})</summary><div class="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">${renderEntries(additionalEntries)}</div></details>` : ""}
      </fieldset>`;
    }
    return renderPrimitive(value, path, key, options);
  }

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

  function renderAdvanced() {
    const metadataKeys = ["bundledUpdate", "bundledUpdateVersions"].filter((key) => draft[key] !== undefined);
    const customKeys = Object.keys(draft).filter((key) => !sectionTopLevelKeys.has(key));
    return `<div class="space-y-6">
      <div class="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-stone-700 dark:text-stone-200"><strong class="block">Advanced character data</strong><span class="mt-1 block">Technical IDs are read-only. Custom fields remain editable so homebrew data is never discarded.</span></div>
      <section class="${classes.panel}"><h3 class="mb-4 font-display text-lg font-bold">Character ID</h3>${renderPrimitive(draft.id, ["id"], "id")}</section>
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
      returnFocus: toggle,
      beforeClose() {
        if (!draftsDiffer(baseline, draft)) return true;
        return confirm("Discard your unsaved character changes?");
      },
      onClose() {
        editing = false;
        overlay.dispatchEvent(new CustomEvent("character-editor:close"));
        document.getElementById("character-portrait")?.classList.remove("cursor-pointer", "ring-4", "ring-blood-500");
        draft = null;
        baseline = null;
      },
    });

    toggle.addEventListener("click", open);
    document.getElementById("editor-close").addEventListener("click", controller.close);
    document.getElementById("editor-cancel").addEventListener("click", controller.close);
    document.getElementById("editor-save").addEventListener("click", save);
    document.getElementById("editor-fields").addEventListener("input", updateDraft);
    document.getElementById("editor-fields").addEventListener("click", handleEditorClick);
    document.getElementById("editor-fields").addEventListener("change", (event) => {
      if (event.target.id === "editor-mobile-section") activateSection(event.target.value);
    });
    document.getElementById("editor-fields").addEventListener("keydown", handleSectionKeydown);
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

  function open() {
    editing = true;
    baseline = clone(window.character);
    draft = clone(window.character);
    activeSection = "basics";
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
    parent[path.at(-1)] = typeof current === "boolean" ? input.checked
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
    draft.name = draft.name.trim();
    if (typeof normalizeSpellcastingData === "function") normalizeSpellcastingData(draft);
    window.character = clone(draft);
    Object.keys(character).forEach((key) => delete character[key]);
    Object.assign(character, window.character);
    const characters = readJSON(STORAGE_KEY, {});
    if (oldId !== character.id) delete characters[oldId];
    characters[character.id] = clone(character);
    writeJSON(STORAGE_KEY, characters);
    removeStored(`dnd-${oldId}-state`);
    baseline = clone(draft);
    controller.forceClose("save");
    refreshUI();
    try {
      const bundledId = document.body.dataset.characterShell;
      await writeCloudJSON(`api/characters/${encodeURIComponent(character.id)}`, {
        document: clone(character),
        source: bundledId && bundledId !== "template" ? "bundled" : "custom",
      });
      if (oldId !== character.id) {
        await writeCloudJSON(`api/characters/${encodeURIComponent(oldId)}`, undefined, { method: "DELETE" });
      }
    } catch (error) {
      console.error("Could not save character to D1:", error);
      alert("Changes remain saved in this browser, but could not be saved to the shared cloud database.");
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
}
