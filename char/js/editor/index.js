import { readJSON, removeStored, writeJSON } from "../../../shared/js/storage.js";
import { writeCloudJSON } from "../../../shared/js/cloud-store.js";
import { subscribeCharacterEditorExtensions } from "./extensions.js";

export function initializeCharacterEditor({ character, normalizeSpellcastingData, refreshUI }) {
  const STORAGE_KEY = "dnd-characters";
  const params = new URLSearchParams(location.search);
  let editing = false;
  let draft = null;
  const mountedExtensions = new Map();

  const classes = {
    button: "inline-flex items-center justify-center gap-2 rounded-xl border border-blood-500 bg-blood-500 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-blood-600",
    field: "w-full rounded-xl border border-stone-300 bg-white/80 px-3 py-2 text-stone-900 dark:border-white/15 dark:bg-white/5 dark:text-white",
    panel: "rounded-2xl border border-stone-300/80 bg-white/70 p-4 dark:border-white/10 dark:bg-white/[.04]",
  };

  const labels = {
    hp: "Hit points", ac: "Armor class", str: "Strength", dex: "Dexterity",
    con: "Constitution", int: "Intelligence", wis: "Wisdom", cha: "Charisma",
  };

  function title(value) {
    return labels[value] || String(value).replace(/([A-Z])/g, " $1").replace(/[-_]/g, " ").replace(/^./, c => c.toUpperCase());
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function pathValue(root, path) {
    return path.reduce((value, key) => value[key], root);
  }

  function blankFor(path, items) {
    const name = path[path.length - 1];
    if (items.length) {
      const blank = clone(items[0]);
      const idPrefixes = {
        profiles: "profile",
        slots: "slot",
        trackers: "tracker",
        actions: "action",
        spells: "spell",
        resources: "resource",
        features: "feature",
      };
      Object.keys(blank).forEach(key => {
        if (key === "id") blank[key] = `${idPrefixes[name] || "item"}-${Date.now()}`;
        else if (typeof blank[key] === "string") blank[key] = "";
        else if (typeof blank[key] === "number") blank[key] = 0;
        else if (typeof blank[key] === "boolean") blank[key] = false;
      });
      if (name === "slots") blank.profileId = draft.spellcasting?.profiles?.[0]?.id || "";
      if (name === "spells") {
        blank.source = draft.spellcasting?.profiles?.[0]?.id || "";
        blank.prepared = false;
      }
      return blank;
    }
    const defaults = {
      trackers: { id: `tracker-${Date.now()}`, name: "", active: false },
      profiles: { id: `profile-${Date.now()}`, name: "", ability: "", saveDC: 0, attackBonus: 0, preparedLimit: 0 },
      slots: { id: `slot-${Date.now()}`, profileId: draft.spellcasting?.profiles?.[0]?.id || "", level: 1, current: 0, max: 0, reset: "long" },
      skills: { name: "", modifier: 0, proficiency: false },
      actions: { id: `action-${Date.now()}`, name: "", category: "", action: "Action", description: "" },
      spells: { id: `spell-${Date.now()}`, name: "", category: "Spell", action: "Action", level: 1, source: draft.spellcasting?.profiles?.[0]?.id || "", prepared: false, description: "" },
      resources: { id: `resource-${Date.now()}`, name: "", category: "Resource", action: "Other", description: "" },
      features: { id: `feature-${Date.now()}`, name: "", category: "Feature", description: "" },
      inventory: { name: "", quantity: 1, description: "" },
    };
    return clone(defaults[name] || "");
  }

  function renderPrimitive(value, path, key) {
    const id = `editor-${path.join("-")}`;
    const profileField =
      (path[0] === "spells" && key === "source") ||
      (path[0] === "spellcasting" && path[1] === "slots" && key === "profileId");
    if (profileField) {
      const options = draft.spellcasting?.profiles || [];
      return `<label class="block"><span class="mb-1 block text-xs font-bold text-stone-500 dark:text-stone-400">${path[0] === "spells" ? "Source spellcasting profile" : "Spellcasting profile"}</span><select id="${id}" data-path="${path.join(".")}" class="${classes.field}"><option value="">No profile</option>${options.map(profile => `<option value="${escapeAttributeValue(profile.id)}" ${profile.id === value ? "selected" : ""}>${escapeHTML(profile.name || profile.id)}</option>`).join("")}</select></label>`;
    }
    if (path[0] === "spells" && key === "prepared") {
      return `<div><span class="mb-1 block text-xs font-bold text-stone-500 dark:text-stone-400">Prepared</span><p class="rounded-xl border border-stone-300 bg-stone-100/70 px-3 py-2 text-sm text-stone-500 dark:border-white/15 dark:bg-white/5 dark:text-stone-400">Managed from the Prepare Spells section.</p></div>`;
    }
    const profileIdField =
      path[0] === "spellcasting" &&
      path[1] === "profiles" &&
      key === "id";
    if (profileIdField) {
      return `<label class="block"><span class="mb-1 block text-xs font-bold text-stone-500 dark:text-stone-400">Profile ID</span><input id="${id}" data-path="${path.join(".")}" type="text" value="${escapeAttributeValue(value)}" readonly class="${classes.field} opacity-70"><span class="mt-1 block text-xs text-stone-500">Used to connect spells and slots to this profile.</span></label>`;
    }
    if (typeof value === "boolean") {
      return `<label class="flex items-center gap-3"><input id="${id}" data-path="${path.join(".")}" type="checkbox" ${value ? "checked" : ""} class="h-5 w-5 accent-red-700"><span>${title(key)}</span></label>`;
    }
    const type = typeof value === "number" ? "number" : "text";
    const multiline = typeof value === "string" && (key === "description" || value.length > 80);
    return `<label class="block"><span class="mb-1 block text-xs font-bold text-stone-500 dark:text-stone-400">${title(key)}</span>${multiline
      ? `<textarea id="${id}" data-path="${path.join(".")}" class="${classes.field}" rows="3">${escapeHTML(value)}</textarea>`
      : `<input id="${id}" data-path="${path.join(".")}" type="${type}" value="${escapeAttributeValue(value)}" class="${classes.field}">`}</label>`;
  }

  function renderNode(value, path = [], key = "") {
    if (Array.isArray(value)) {
      return `<section class="space-y-3" data-array="${path.join(".")}">
        <div class="flex flex-wrap items-center justify-between gap-2"><h3 class="font-display text-lg font-bold">${title(key)}</h3>
        <div class="flex flex-wrap gap-2" data-array-actions="${path.join(".")}"><button type="button" data-add="${path.join(".")}" class="${classes.button}"><i class="bi bi-plus-lg"></i> Add manually</button></div></div>
        <div class="space-y-3">${value.map((item, index) => `<div class="${classes.panel}">
          <div class="mb-3 flex justify-end"><button type="button" data-remove="${path.join(".")}" data-index="${index}" class="rounded-lg px-3 py-1.5 text-sm font-bold text-blood-500 hover:bg-blood-500/10"><i class="bi bi-trash"></i> Remove</button></div>
          ${renderNode(item, [...path, index], `${title(key)} ${index + 1}`)}</div>`).join("") || '<p class="text-sm text-stone-500">No entries yet.</p>'}</div>
      </section>`;
    }
    if (value && typeof value === "object") {
      return `<fieldset class="space-y-3"><legend class="${path.length > 1 ? "mb-2 font-bold" : "sr-only"}">${title(key)}</legend>
        <div class="grid grid-cols-1 gap-3 md:grid-cols-2">${Object.entries(value).filter(([childKey]) => !childKey.startsWith("_")).map(([childKey, child]) => {
          const nested = child && typeof child === "object";
          return `<div class="${nested ? "md:col-span-2" : ""}">${renderNode(child, [...path, childKey], childKey)}</div>`;
        }).join("")}</div></fieldset>`;
    }
    return renderPrimitive(value, path, key);
  }

  function renderEditorFields() {
    const fields = document.getElementById("editor-fields");
    fields.innerHTML = `<div data-editor-extensions></div>${renderNode(draft)}`;
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
    overlay.className = "fixed inset-0 z-50 hidden bg-ink/80 p-3 backdrop-blur-sm sm:p-6";
    overlay.innerHTML = `<div class="mx-auto flex h-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-stone-300 bg-parchment shadow-2xl dark:border-white/15 dark:bg-ink">
      <header class="flex items-center justify-between gap-3 border-b border-stone-300 p-4 dark:border-white/10">
        <div class="flex items-center gap-3">
          <button id="editor-portrait-button" type="button" class="group relative shrink-0" aria-label="Upload a new character portrait">
            <img id="editor-portrait" src="${escapeAttributeValue(window.character.portrait || "shared/assets/bat.ico")}" class="h-16 w-16 rounded-xl border border-stone-300 object-cover group-hover:ring-4 group-hover:ring-blood-500 dark:border-white/15" alt="">
            <span class="absolute inset-0 flex items-center justify-center rounded-xl bg-black/50 text-white opacity-0 transition group-hover:opacity-100"><i class="bi bi-camera-fill"></i></span>
          </button>
          <div><h2 class="font-display text-2xl font-bold">Edit character sheet</h2><p class="text-sm text-stone-500">Click the portrait to change it.</p></div>
        </div>
        <button id="editor-close" type="button" class="rounded-xl p-3 hover:bg-stone-200 dark:hover:bg-white/10" aria-label="Close editor"><i class="bi bi-x-lg"></i></button>
      </header>
      <div id="editor-fields" class="grow space-y-5 overflow-y-auto p-4 sm:p-6"></div>
      <footer class="flex justify-end gap-3 border-t border-stone-300 p-4 dark:border-white/10">
        <button id="editor-cancel" type="button" class="rounded-xl border border-stone-400 px-4 py-2 text-sm font-bold">Cancel</button>
        <button id="editor-save" type="button" class="${classes.button}"><i class="bi bi-check-lg"></i> Save changes</button>
      </footer></div>`;
    document.body.appendChild(overlay);

    toggle.addEventListener("click", open);
    document.getElementById("editor-close").addEventListener("click", close);
    document.getElementById("editor-cancel").addEventListener("click", close);
    document.getElementById("editor-save").addEventListener("click", save);
    document.getElementById("editor-portrait-button").addEventListener("click", choosePortrait);
    document.getElementById("editor-fields").addEventListener("input", updateDraft);
    document.getElementById("editor-fields").addEventListener("click", handleEditorClick);
    subscribeCharacterEditorExtensions((extension) => {
      if (mountedExtensions.has(extension.id)) return;
      mountedExtensions.set(extension.id, extension);
      const host = extensionHost();
      extension.mount?.(host);
      if (draft) extension.afterRender?.(host);
    });

    const portrait = document.getElementById("character-portrait");
    portrait?.addEventListener("click", () => {
      if (!editing) return;
      choosePortrait();
    });
  }

  function open() {
    editing = true;
    draft = clone(window.character);
    renderEditorFields();
    document.getElementById("editor-portrait").src = draft.portrait || "shared/assets/bat.ico";
    document.getElementById("character-editor").classList.remove("hidden");
    document.body.classList.add("overflow-hidden");
    document.getElementById("character-portrait")?.classList.add("cursor-pointer", "ring-4", "ring-blood-500");
  }

  function close() {
    editing = false;
    document.getElementById("character-editor")?.dispatchEvent(new CustomEvent("character-editor:close"));
    document.getElementById("character-editor").classList.add("hidden");
    document.body.classList.remove("overflow-hidden");
    document.getElementById("character-portrait")?.classList.remove("cursor-pointer", "ring-4", "ring-blood-500");
  }

  function updateDraft(event) {
    const input = event.target.closest("[data-path]");
    if (!input) return;
    const path = input.dataset.path.split(".");
    const parent = pathValue(draft, path.slice(0, -1));
    const current = parent[path.at(-1)];
    parent[path.at(-1)] = typeof current === "boolean" ? input.checked :
      typeof current === "number" ? Number(input.value) : input.value;
  }

  function handleEditorClick(event) {
    const add = event.target.closest("[data-add]");
    const remove = event.target.closest("[data-remove]");
    if (!add && !remove) return;
    const path = (add?.dataset.add || remove.dataset.remove).split(".");
    const items = pathValue(draft, path);
    if (add) items.push(blankFor(path, items));
    else items.splice(Number(remove.dataset.index), 1);
    renderEditorFields();
  }

  async function save() {
    const oldId = window.character.id;
    if (typeof normalizeSpellcastingData === "function")
      normalizeSpellcastingData(draft);
    window.character = clone(draft);
    Object.keys(character).forEach(key => delete character[key]);
    Object.assign(character, window.character);
    const characters = readJSON(STORAGE_KEY, {});
    if (oldId !== character.id) delete characters[oldId];
    characters[character.id] = clone(character);
    writeJSON(STORAGE_KEY, characters);
    removeStored(`dnd-${oldId}-state`);
    close();
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
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      draft.portrait = reader.result;
      document.getElementById("character-portrait").src = reader.result;
      document.getElementById("editor-portrait").src = reader.result;
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

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[c]);
  }
  function escapeAttributeValue(value) {
    return escapeHTML(value).replace(/`/g, "&#096;");
  }

  buildUI();
  if (params.get("edit") === "1") open();
}
