import { readJSON, removeStored, writeJSON } from "./shared/storage.js";
import { addCompendiumEntry, hasCompendiumEntry } from "./features/compendium/character-mapping.js";

export function initializeCharacterEditor({ character, normalizeSpellcastingData, refreshUI }) {
  const STORAGE_KEY = "dnd-characters";
  const params = new URLSearchParams(location.search);
  let editing = false;
  let draft = null;
  let compendiumEntries = null;
  let compendiumContext = null;
  let compendiumVisibleCount = 40;
  let compendiumLoadPromise = null;

  const classes = {
    button: "inline-flex items-center justify-center gap-2 rounded-xl border border-blood-500 bg-blood-500 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-blood-600",
    field: "w-full rounded-xl border border-stone-300 bg-white/80 px-3 py-2 text-stone-900 dark:border-white/15 dark:bg-white/5 dark:text-white",
    panel: "rounded-2xl border border-stone-300/80 bg-white/70 p-4 dark:border-white/10 dark:bg-white/[.04]",
  };

  const compendiumCategoryLabels = {
    classes: "Classes",
    subclasses: "Subclasses",
    races: "Races & Lineages",
    backgrounds: "Backgrounds",
    feats: "Feats",
    spells: "Spells",
    items: "Items",
    features: "Features & Traits",
    companions: "Companions",
    languages: "Languages",
    deities: "Deities",
    proficiencies: "Proficiencies",
    rules: "Rules & Options",
  };

  const compendiumTargets = {
    class: { label: "class", categories: ["classes"] },
    subclass: { label: "subclass", categories: ["subclasses"] },
    race: { label: "race or lineage", categories: ["races"] },
    background: { label: "background", categories: ["backgrounds"] },
    spells: { label: "spell", categories: ["spells"] },
    inventory: { label: "item", categories: ["items"] },
    features: {
      label: "feature, feat, or reference",
      categories: [
        "feats",
        "features",
        "companions",
        "languages",
        "deities",
        "proficiencies",
        "rules",
      ],
    },
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
    const field = `<label class="block"><span class="mb-1 block text-xs font-bold text-stone-500 dark:text-stone-400">${title(key)}</span>${multiline
      ? `<textarea id="${id}" data-path="${path.join(".")}" class="${classes.field}" rows="3">${escapeHTML(value)}</textarea>`
      : `<input id="${id}" data-path="${path.join(".")}" type="${type}" value="${escapeAttributeValue(value)}" class="${classes.field}">`}</label>`;
    if (path.length === 1 && compendiumTargets[key]) {
      return `<div class="space-y-2">${field}<button type="button" data-compendium-target="${escapeAttributeValue(key)}" class="inline-flex items-center gap-2 rounded-lg border border-sky-600 px-3 py-1.5 text-xs font-bold text-sky-600 transition hover:bg-sky-600 hover:text-white"><i class="bi bi-journals"></i> Choose ${escapeHTML(compendiumTargets[key].label)} from compendium</button></div>`;
    }
    return field;
  }

  function renderNode(value, path = [], key = "") {
    if (Array.isArray(value)) {
      const target = path.length === 1 ? path[0] : "";
      const compendiumButton = compendiumTargets[target]
        ? `<button type="button" data-compendium-target="${escapeAttributeValue(target)}" class="inline-flex items-center justify-center gap-2 rounded-xl border border-sky-600 px-4 py-2 text-sm font-bold text-sky-600 shadow-sm transition hover:bg-sky-600 hover:text-white"><i class="bi bi-journals"></i> Add from compendium</button>`
        : "";
      return `<section class="space-y-3" data-array="${path.join(".")}">
        <div class="flex flex-wrap items-center justify-between gap-2"><h3 class="font-display text-lg font-bold">${title(key)}</h3>
        <div class="flex flex-wrap gap-2">${compendiumButton}<button type="button" data-add="${path.join(".")}" class="${classes.button}"><i class="bi bi-plus-lg"></i> Add manually</button></div></div>
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
    document.getElementById("editor-fields").innerHTML = `
      <section class="rounded-2xl border border-sky-600/30 bg-sky-600/10 p-4">
        <div class="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div><h3 class="font-display text-lg font-bold"><i class="bi bi-journals mr-2 text-sky-600"></i>Add from the compendium</h3><p class="mt-1 text-sm text-stone-600 dark:text-stone-300">Pick an entry, then edit the copy on this sheet.</p></div>
          <button type="button" data-compendium-target="all" class="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-sky-700 px-4 py-2 text-sm font-bold text-white transition hover:bg-sky-800"><i class="bi bi-search"></i> Browse compendium</button>
        </div>
      </section>
      ${renderNode(draft)}`;
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
            <img id="editor-portrait" src="${escapeAttributeValue(window.character.portrait || "bat.ico")}" class="h-16 w-16 rounded-xl border border-stone-300 object-cover group-hover:ring-4 group-hover:ring-blood-500 dark:border-white/15" alt="">
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

    const compendium = document.createElement("div");
    compendium.id = "editor-compendium";
    compendium.className = "fixed inset-0 z-[60] hidden bg-ink/85 p-3 backdrop-blur-sm sm:p-6";
    compendium.setAttribute("role", "dialog");
    compendium.setAttribute("aria-modal", "true");
    compendium.setAttribute("aria-labelledby", "editor-compendium-title");
    compendium.innerHTML = `<div class="mx-auto flex h-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-stone-300 bg-parchment shadow-2xl dark:border-white/15 dark:bg-ink">
      <header class="flex items-start justify-between gap-3 border-b border-stone-300 p-4 dark:border-white/10">
        <div><h2 id="editor-compendium-title" class="font-display text-2xl font-bold">Add from compendium</h2><p id="editor-compendium-context" class="mt-1 text-sm text-stone-500 dark:text-stone-400">Choose an entry to add to this character.</p></div>
        <button id="editor-compendium-close" type="button" class="rounded-xl p-3 hover:bg-stone-200 dark:hover:bg-white/10" aria-label="Close compendium"><i class="bi bi-x-lg"></i></button>
      </header>
      <div class="border-b border-stone-300 p-4 dark:border-white/10">
        <div class="grid grid-cols-1 gap-3 md:grid-cols-12">
          <label class="md:col-span-5"><span class="mb-1 block text-xs font-bold uppercase tracking-wide text-stone-500">Search</span><div class="relative"><i class="bi bi-search absolute left-3 top-1/2 -translate-y-1/2 text-stone-400"></i><input id="editor-compendium-search" type="search" autocomplete="off" class="${classes.field} pl-10" placeholder="Search names, descriptions, or publications"></div></label>
          <label class="md:col-span-3"><span class="mb-1 block text-xs font-bold uppercase tracking-wide text-stone-500">Category</span><select id="editor-compendium-category" class="${classes.field}"></select></label>
          <label class="md:col-span-4"><span class="mb-1 block text-xs font-bold uppercase tracking-wide text-stone-500">Publication</span><select id="editor-compendium-publication" class="${classes.field}"></select></label>
        </div>
        <div class="mt-3 flex flex-wrap items-center justify-between gap-3"><p id="editor-compendium-summary" class="text-sm text-stone-500" aria-live="polite"></p><a href="compendium/" target="_blank" class="text-sm font-bold text-sky-600 hover:underline"><i class="bi bi-box-arrow-up-right mr-1"></i>Open full compendium</a></div>
      </div>
      <div id="editor-compendium-results" class="grid grow grid-cols-1 content-start gap-4 overflow-y-auto p-4 md:grid-cols-2 lg:grid-cols-3"></div>
      <footer class="flex justify-center border-t border-stone-300 p-3 dark:border-white/10"><button id="editor-compendium-more" type="button" class="hidden rounded-xl border border-sky-600 px-5 py-2 text-sm font-bold text-sky-600 hover:bg-sky-600 hover:text-white">Show more</button></footer>
    </div>`;
    document.body.appendChild(compendium);

    toggle.addEventListener("click", open);
    document.getElementById("editor-close").addEventListener("click", close);
    document.getElementById("editor-cancel").addEventListener("click", close);
    document.getElementById("editor-save").addEventListener("click", save);
    document.getElementById("editor-portrait-button").addEventListener("click", choosePortrait);
    document.getElementById("editor-fields").addEventListener("input", updateDraft);
    document.getElementById("editor-fields").addEventListener("click", handleEditorClick);
    document.getElementById("editor-compendium-close").addEventListener("click", closeCompendium);
    document.getElementById("editor-compendium-search").addEventListener("input", filterCompendium);
    document.getElementById("editor-compendium-category").addEventListener("change", filterCompendium);
    document.getElementById("editor-compendium-publication").addEventListener("change", filterCompendium);
    document.getElementById("editor-compendium-results").addEventListener("click", addFromCompendium);
    document.getElementById("editor-compendium-more").addEventListener("click", () => {
      compendiumVisibleCount += 40;
      renderCompendiumResults();
    });
    compendium.addEventListener("click", event => {
      if (event.target === compendium) closeCompendium();
    });
    document.addEventListener("keydown", event => {
      if (event.key === "Escape" && !compendium.classList.contains("hidden"))
        closeCompendium();
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
    document.getElementById("editor-portrait").src = draft.portrait || "bat.ico";
    document.getElementById("character-editor").classList.remove("hidden");
    document.body.classList.add("overflow-hidden");
    document.getElementById("character-portrait")?.classList.add("cursor-pointer", "ring-4", "ring-blood-500");
  }

  function close() {
    editing = false;
    closeCompendium();
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
    const compendiumButton = event.target.closest("[data-compendium-target]");
    if (compendiumButton) {
      openCompendium(compendiumButton.dataset.compendiumTarget);
      return;
    }
    const add = event.target.closest("[data-add]");
    const remove = event.target.closest("[data-remove]");
    if (!add && !remove) return;
    const path = (add?.dataset.add || remove.dataset.remove).split(".");
    const items = pathValue(draft, path);
    if (add) items.push(blankFor(path, items));
    else items.splice(Number(remove.dataset.index), 1);
    renderEditorFields();
  }

  function loadCompendium() {
    if (compendiumLoadPromise) return compendiumLoadPromise;
    compendiumLoadPromise = import("./features/compendium/repository.js")
      .then(({ loadCompendiumCatalog }) => loadCompendiumCatalog())
      .then((catalog) => { compendiumEntries = catalog.entries; });
    return compendiumLoadPromise;
  }

  async function openCompendium(target) {
    const context = target === "all"
      ? { target: "all", label: "anything from the compendium", categories: Object.keys(compendiumCategoryLabels) }
      : { target, ...(compendiumTargets[target] || compendiumTargets.features) };
    compendiumContext = context;
    compendiumVisibleCount = 40;
    const modal = document.getElementById("editor-compendium");
    modal.classList.remove("hidden");
    document.getElementById("editor-compendium-context").textContent =
      `Choose ${context.label}. You can edit the copy afterward.`;
    document.getElementById("editor-compendium-results").innerHTML =
      '<div class="py-16 text-center md:col-span-2 lg:col-span-3"><div class="inline-block h-8 w-8 animate-spin rounded-full border-4 border-sky-600 border-r-transparent"></div><p class="mt-3 text-sm text-stone-500">Loading compendium…</p></div>';
    try {
      await loadCompendium();
      populateCompendiumFilters();
      filterCompendium();
      document.getElementById("editor-compendium-search").focus();
    } catch (error) {
      console.error("Could not open compendium:", error);
      document.getElementById("editor-compendium-results").innerHTML =
        '<div class="rounded-xl border border-blood-500/30 bg-blood-500/10 p-4 text-blood-600 dark:text-red-300 md:col-span-2 lg:col-span-3">The compendium data is unavailable. Run the compendium build before using this picker.</div>';
    }
  }

  function closeCompendium() {
    const modal = document.getElementById("editor-compendium");
    if (!modal) return;
    modal.classList.add("hidden");
    compendiumContext = null;
  }

  function populateCompendiumFilters() {
    const categorySelect = document.getElementById("editor-compendium-category");
    const publicationSelect = document.getElementById("editor-compendium-publication");
    const availableEntries = compendiumEntries.filter(entry =>
      compendiumContext.categories.includes(entry.category) &&
      (compendiumContext.target === "all" || entry.add?.target === compendiumContext.target)
    );
    categorySelect.innerHTML = `<option value="">All matching categories</option>${compendiumContext.categories
      .filter(category => availableEntries.some(entry => entry.category === category))
      .map(category => `<option value="${escapeAttributeValue(category)}">${escapeHTML(compendiumCategoryLabels[category])}</option>`)
      .join("")}`;
    const publications = [...new Set(availableEntries.map(entry => entry.publication))].sort((left, right) => left.localeCompare(right));
    publicationSelect.innerHTML = `<option value="">All publications</option>${publications.map(publication => `<option value="${escapeAttributeValue(publication)}">${escapeHTML(publication)}</option>`).join("")}`;
    document.getElementById("editor-compendium-search").value = "";
  }

  function matchingCompendiumEntries() {
    if (!compendiumEntries || !compendiumContext) return [];
    const query = normalizeSearch(document.getElementById("editor-compendium-search").value);
    const category = document.getElementById("editor-compendium-category").value;
    const publication = document.getElementById("editor-compendium-publication").value;
    return compendiumEntries
      .filter(entry => {
        if (!compendiumContext.categories.includes(entry.category)) return false;
        if (compendiumContext.target !== "all" && entry.add?.target !== compendiumContext.target) return false;
        if (category && entry.category !== category) return false;
        if (publication && entry.publication !== publication) return false;
        if (!query) return true;
        return normalizeSearch([entry.name, entry.type, entry.publication, entry.summary, entry.supports].join(" ")).includes(query);
      })
      .sort((left, right) => {
        if (query) {
          const leftName = normalizeSearch(left.name);
          const rightName = normalizeSearch(right.name);
          const leftRank = leftName === query ? 0 : leftName.startsWith(query) ? 1 : 2;
          const rightRank = rightName === query ? 0 : rightName.startsWith(query) ? 1 : 2;
          if (leftRank !== rightRank) return leftRank - rightRank;
        }
        return left.name.localeCompare(right.name) || left.publication.localeCompare(right.publication);
      });
  }

  function filterCompendium() {
    compendiumVisibleCount = 40;
    renderCompendiumResults();
  }

  function renderCompendiumResults() {
    const matches = matchingCompendiumEntries();
    const results = document.getElementById("editor-compendium-results");
    const summary = document.getElementById("editor-compendium-summary");
    const more = document.getElementById("editor-compendium-more");
    summary.textContent = `${matches.length.toLocaleString()} matching entries`;
    if (!matches.length) {
      results.innerHTML = '<div class="py-14 text-center text-stone-500 md:col-span-2 lg:col-span-3"><i class="bi bi-search mb-2 block text-3xl text-sky-600"></i><strong class="block">No matching entries</strong><span class="mt-1 block text-sm">Try a broader search or remove a filter.</span></div>';
      more.classList.add("hidden");
      return;
    }
    results.innerHTML = matches.slice(0, compendiumVisibleCount).map(renderCompendiumCard).join("");
    more.classList.toggle("hidden", compendiumVisibleCount >= matches.length);
  }

  function renderCompendiumCard(entry) {
    const added = isCompendiumEntryAdded(entry);
    const googleURL = `https://www.google.com/search?q=${encodeURIComponent(`${entry.name} D&D 5e`)}`;
    return `<article class="flex h-full flex-col overflow-hidden rounded-2xl border border-stone-300/80 bg-white/75 dark:border-white/10 dark:bg-white/[.055]">
      <header class="flex items-start justify-between gap-3 border-b border-stone-200/80 bg-stone-100/70 px-4 py-3 dark:border-white/10 dark:bg-white/[.045]"><div class="min-w-0"><h3 class="font-display font-bold leading-tight">${escapeHTML(entry.name)}</h3><p class="mt-1 text-xs text-stone-500">${escapeHTML(entry.publication)}</p></div><div class="flex shrink-0 items-center gap-2"><span class="rounded-full bg-blood-500 px-2 py-1 text-[11px] font-bold text-white">${escapeHTML(entry.type)}</span><a href="${escapeAttributeValue(googleURL)}" target="_blank" rel="noopener noreferrer" class="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-sky-600 text-sky-600 hover:bg-sky-600 hover:text-white" aria-label="Search Google for ${escapeAttributeValue(entry.name)}"><i class="bi bi-google"></i></a></div></header>
      <div class="flex grow flex-col p-4"><p class="grow text-sm leading-relaxed text-stone-600 dark:text-stone-300">${escapeHTML(entry.summary)}</p><button type="button" data-compendium-add="${escapeAttributeValue(entry.id)}" ${added ? "disabled" : ""} class="mt-4 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition ${added ? "cursor-default bg-emerald-600/15 text-emerald-700 dark:text-emerald-300" : "bg-sky-700 text-white hover:bg-sky-800"}">${added ? '<i class="bi bi-check-lg"></i> Added' : '<i class="bi bi-plus-lg"></i> Add to character'}</button></div>
    </article>`;
  }

  function addFromCompendium(event) {
    const button = event.target.closest("[data-compendium-add]");
    if (!button || button.disabled) return;
    const entry = compendiumEntries.find(item => item.id === button.dataset.compendiumAdd);
    if (!entry?.add) return;
    addCompendiumEntry(draft, entry);
    renderEditorFields();
    renderCompendiumResults();
  }

  function isCompendiumEntryAdded(entry) {
    return hasCompendiumEntry(draft, entry);
  }

  function normalizeSearch(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  }

  function save() {
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
