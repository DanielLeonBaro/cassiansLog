// Registers optional Compendium lookup controls with the character editor.
import { registerCharacterEditorExtension } from "../../char/js/editor/extensions.js";
import { filterCompendiumEntries, loadCompendiumCatalog } from "../../compendium/js/api.js";
import { applySectionVisibility } from "../../shared/js/sections.js";
import { escapeAttribute, escapeHTML } from "../../shared/js/text.js";
import { addCompendiumEntry, hasCompendiumEntry } from "./mapping.js";

const categoryLabels = {
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

const targets = {
  class: { label: "class", categories: ["classes"] },
  subclass: { label: "subclass", categories: ["subclasses"] },
  race: { label: "race or lineage", categories: ["races"] },
  background: { label: "background", categories: ["backgrounds"] },
  spells: { label: "spell", categories: ["spells"] },
  inventory: { label: "item", categories: ["items"] },
  features: {
    label: "feature, feat, or reference",
    categories: ["feats", "features", "companions", "languages", "deities", "proficiencies", "rules"],
  },
};

let host;
let modal;
let entries;
let context;
let visibleCount = 40;
let catalogPromise;

function pickerButton(target, label, compact = false) {
  const classes = compact
    ? "inline-flex items-center gap-2 rounded-lg border border-sky-600 px-3 py-1.5 text-xs font-bold text-sky-600 transition hover:bg-sky-600 hover:text-white"
    : "inline-flex items-center justify-center gap-2 rounded-xl border border-sky-600 px-4 py-2 text-sm font-bold text-sky-600 shadow-sm transition hover:bg-sky-600 hover:text-white";
  return `<button type="button" data-compendium-target="${escapeAttribute(target)}" data-section-link="compendium" class="${classes}"><i class="bi bi-journals"></i>${escapeHTML(label)}</button>`;
}

function afterRender(extensionHost) {
  host = extensionHost;
  const extensionSlot = host.fieldsRoot.querySelector("[data-editor-extensions]");
  extensionSlot.innerHTML = `<section class="rounded-2xl border border-sky-600/30 bg-sky-600/10 p-4" data-section-link="compendium">
    <div class="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
      <div><h3 class="font-display text-lg font-bold"><i class="bi bi-journals mr-2 text-sky-600"></i>Add from the compendium</h3><p class="mt-1 text-sm text-stone-600 dark:text-stone-300">Pick an entry, then edit the copy on this sheet.</p></div>
      ${pickerButton("all", "Browse compendium")}
    </div>
  </section>`;

  for (const target of ["class", "subclass", "race", "background"]) {
    const field = host.fieldsRoot.querySelector(`[data-path="${target}"]`);
    if (!field) continue;
    field.closest("label")?.insertAdjacentHTML("afterend", pickerButton(target, `Choose ${targets[target].label} from compendium`, true));
  }
  for (const target of ["spells", "inventory", "features"]) {
    const actions = host.fieldsRoot.querySelector(`[data-array-actions="${target}"]`);
    actions?.insertAdjacentHTML("afterbegin", pickerButton(target, "Add from compendium"));
  }
  applySectionVisibility(host.fieldsRoot);
}

function mount(extensionHost) {
  host = extensionHost;
  modal = document.createElement("div");
  modal.id = "editor-compendium";
  modal.className = "fixed inset-0 z-[60] hidden bg-ink/85 p-3 backdrop-blur-sm sm:p-6";
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.setAttribute("aria-labelledby", "editor-compendium-title");
  modal.innerHTML = `<div class="mx-auto flex h-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-stone-300 bg-parchment shadow-2xl dark:border-white/15 dark:bg-ink">
    <header class="flex items-start justify-between gap-3 border-b border-stone-300 p-4 dark:border-white/10">
      <div><h2 id="editor-compendium-title" class="font-display text-2xl font-bold">Add from compendium</h2><p id="editor-compendium-context" class="mt-1 text-sm text-stone-500 dark:text-stone-400">Choose an entry to add to this character.</p></div>
      <button data-compendium-close type="button" class="rounded-xl p-3 hover:bg-stone-200 dark:hover:bg-white/10" aria-label="Close compendium"><i class="bi bi-x-lg"></i></button>
    </header>
    <div class="border-b border-stone-300 p-4 dark:border-white/10">
      <div class="grid grid-cols-1 gap-3 md:grid-cols-12">
        <label class="md:col-span-5"><span class="mb-1 block text-xs font-bold uppercase tracking-wide text-stone-500">Search</span><input data-compendium-search type="search" autocomplete="off" class="w-full rounded-xl border border-stone-300 bg-white/80 px-3 py-2 pl-4 text-stone-900 dark:border-white/15 dark:bg-white/5 dark:text-white" placeholder="Search names, descriptions, or publications"></label>
        <label class="md:col-span-3"><span class="mb-1 block text-xs font-bold uppercase tracking-wide text-stone-500">Category</span><select data-compendium-category class="w-full rounded-xl border border-stone-300 bg-white/80 px-3 py-2 text-stone-900 dark:border-white/15 dark:bg-white/5 dark:text-white"></select></label>
        <label class="md:col-span-4"><span class="mb-1 block text-xs font-bold uppercase tracking-wide text-stone-500">Publication</span><select data-compendium-publication class="w-full rounded-xl border border-stone-300 bg-white/80 px-3 py-2 text-stone-900 dark:border-white/15 dark:bg-white/5 dark:text-white"></select></label>
      </div>
      <div class="mt-3 flex flex-wrap items-center justify-between gap-3"><p data-compendium-summary class="text-sm text-stone-500" aria-live="polite"></p><a href="compendium/" target="_blank" class="text-sm font-bold text-sky-600 hover:underline" data-section-link="compendium"><i class="bi bi-box-arrow-up-right mr-1"></i>Open full compendium</a></div>
    </div>
    <div data-compendium-results class="grid grow grid-cols-1 content-start gap-4 overflow-y-auto p-4 md:grid-cols-2 lg:grid-cols-3"></div>
    <footer class="flex justify-center border-t border-stone-300 p-3 dark:border-white/10"><button data-compendium-more type="button" class="hidden rounded-xl border border-sky-600 px-5 py-2 text-sm font-bold text-sky-600 hover:bg-sky-600 hover:text-white">Show more</button></footer>
  </div>`;
  document.body.appendChild(modal);
  applySectionVisibility(modal);

  host.fieldsRoot.addEventListener("click", (event) => {
    const button = event.target.closest("[data-compendium-target]");
    if (button) open(button.dataset.compendiumTarget);
  });
  modal.querySelector("[data-compendium-close]").addEventListener("click", close);
  modal.querySelector("[data-compendium-search]").addEventListener("input", filter);
  modal.querySelector("[data-compendium-category]").addEventListener("change", filter);
  modal.querySelector("[data-compendium-publication]").addEventListener("change", filter);
  modal.querySelector("[data-compendium-results]").addEventListener("click", addEntry);
  modal.querySelector("[data-compendium-more]").addEventListener("click", () => {
    visibleCount += 40;
    renderResults();
  });
  modal.addEventListener("click", (event) => { if (event.target === modal) close(); });
  host.editorRoot.addEventListener("character-editor:close", close);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !modal.classList.contains("hidden")) close();
  });
}

function loadCatalog() {
  if (!catalogPromise) {
    catalogPromise = loadCompendiumCatalog().then((catalog) => {
      entries = catalog.entries;
      return catalog;
    });
  }
  return catalogPromise;
}

async function open(target) {
  context = target === "all"
    ? { target: "all", label: "anything from the compendium", categories: Object.keys(categoryLabels) }
    : { target, ...(targets[target] || targets.features) };
  visibleCount = 40;
  modal.classList.remove("hidden");
  modal.querySelector("#editor-compendium-context").textContent = `Choose ${context.label}. You can edit the copy afterward.`;
  modal.querySelector("[data-compendium-results]").innerHTML = '<div class="py-16 text-center md:col-span-2 lg:col-span-3"><div class="inline-block h-8 w-8 animate-spin rounded-full border-4 border-sky-600 border-r-transparent"></div><p class="mt-3 text-sm text-stone-500">Loading compendium…</p></div>';
  try {
    await loadCatalog();
    populateFilters();
    filter();
    modal.querySelector("[data-compendium-search]").focus();
  } catch (error) {
    console.error("Could not open compendium:", error);
    modal.querySelector("[data-compendium-results]").innerHTML = '<div class="rounded-xl border border-blood-500/30 bg-blood-500/10 p-4 text-blood-600 dark:text-red-300 md:col-span-2 lg:col-span-3">The optional Compendium integration is unavailable. The character editor remains usable without it.</div>';
  }
}

function close() {
  modal?.classList.add("hidden");
  context = null;
}

function matchingEntries() {
  if (!entries || !context) return [];
  const scoped = entries.filter((entry) =>
    context.categories.includes(entry.category) &&
    (context.target === "all" || entry.add?.target === context.target),
  );
  return filterCompendiumEntries(scoped, {
    query: modal.querySelector("[data-compendium-search]").value,
    category: modal.querySelector("[data-compendium-category]").value,
    publication: modal.querySelector("[data-compendium-publication]").value,
  });
}

function populateFilters() {
  const available = entries.filter((entry) =>
    context.categories.includes(entry.category) &&
    (context.target === "all" || entry.add?.target === context.target),
  );
  const categorySelect = modal.querySelector("[data-compendium-category]");
  categorySelect.innerHTML = `<option value="">All matching categories</option>${context.categories
    .filter((category) => available.some((entry) => entry.category === category))
    .map((category) => `<option value="${escapeAttribute(category)}">${escapeHTML(categoryLabels[category])}</option>`)
    .join("")}`;
  const publications = [...new Set(available.map((entry) => entry.publication))].sort((a, b) => a.localeCompare(b));
  modal.querySelector("[data-compendium-publication]").innerHTML = `<option value="">All publications</option>${publications.map((publication) => `<option value="${escapeAttribute(publication)}">${escapeHTML(publication)}</option>`).join("")}`;
  modal.querySelector("[data-compendium-search]").value = "";
}

function filter() {
  visibleCount = 40;
  renderResults();
}

function renderResults() {
  const matches = matchingEntries();
  const results = modal.querySelector("[data-compendium-results]");
  modal.querySelector("[data-compendium-summary]").textContent = `${matches.length.toLocaleString()} matching entries`;
  if (!matches.length) {
    results.innerHTML = '<div class="py-14 text-center text-stone-500 md:col-span-2 lg:col-span-3"><strong class="block">No matching entries</strong><span class="mt-1 block text-sm">Try a broader search or remove a filter.</span></div>';
    modal.querySelector("[data-compendium-more]").classList.add("hidden");
    return;
  }
  results.innerHTML = matches.slice(0, visibleCount).map(renderCard).join("");
  modal.querySelector("[data-compendium-more]").classList.toggle("hidden", visibleCount >= matches.length);
}

function renderCard(entry) {
  const added = hasCompendiumEntry(host.getDraft(), entry);
  const incrementable = entry.add?.target === "inventory";
  const disabled = added && !incrementable;
  const buttonLabel = added
    ? incrementable ? "Add another" : "Added"
    : "Add to character";
  return `<article class="flex h-full flex-col overflow-hidden rounded-2xl border border-stone-300/80 bg-white/75 dark:border-white/10 dark:bg-white/[.055]">
    <header class="border-b border-stone-200/80 bg-stone-100/70 px-4 py-3 dark:border-white/10 dark:bg-white/[.045]"><h3 class="font-display font-bold leading-tight">${escapeHTML(entry.name)}</h3><p class="mt-1 text-xs text-stone-500">${escapeHTML(entry.publication)}</p></header>
    <div class="flex grow flex-col p-4"><p class="grow text-sm leading-relaxed text-stone-600 dark:text-stone-300">${escapeHTML(entry.summary)}</p><button type="button" data-compendium-add="${escapeAttribute(entry.id)}" ${disabled ? "disabled" : ""} class="mt-4 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition ${disabled ? "cursor-default bg-emerald-600/15 text-emerald-700 dark:text-emerald-300" : "bg-sky-700 text-white hover:bg-sky-800"}">${buttonLabel}</button></div>
  </article>`;
}

function addEntry(event) {
  const button = event.target.closest("[data-compendium-add]");
  if (!button || button.disabled) return;
  const entry = entries.find((item) => item.id === button.dataset.compendiumAdd);
  if (!entry?.add) return;
  host.updateDraft((draft) => addCompendiumEntry(draft, entry));
  renderResults();
}

registerCharacterEditorExtension({ id: "compendium", mount, afterRender });
