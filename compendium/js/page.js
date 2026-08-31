// Coordinates Compendium browsing, search, entry rendering, and user events.
import { loadCompendiumCatalog, loadCompendiumCategory } from "./repository.js";
import { facetValues, filterCompendiumEntries } from "./search.js";
import {
  friendlyMetadataValue,
  spellLevelLabel,
  supportLabels,
  title,
} from "./metadata.js";
import { escapeAttribute, escapeHTML, normalizeText as normalize } from "../../shared/js/text.js";

export function initializeCompendium() {
  const PAGE_SIZE = 60;
  let manifest = null;
  let entries = [];
  let filtered = [];
  let visibleCount = PAGE_SIZE;

  const elements = {
    search: document.getElementById("compendium-search"),
    category: document.getElementById("compendium-category"),
    type: document.getElementById("compendium-type"),
    publication: document.getElementById("compendium-publication"),
    advanced: document.getElementById("compendium-advanced"),
    advancedCount: document.getElementById("compendium-advanced-count"),
    kind: document.getElementById("compendium-kind"),
    damageType: document.getElementById("compendium-damage"),
    rarity: document.getElementById("compendium-rarity"),
    attunement: document.getElementById("compendium-attunement"),
    spellLevel: document.getElementById("compendium-level"),
    school: document.getElementById("compendium-school"),
    summary: document.getElementById("compendium-summary"),
    results: document.getElementById("compendium-results"),
    more: document.getElementById("compendium-more"),
    clear: document.getElementById("compendium-clear"),
    detail: document.getElementById("compendium-detail"),
    detailTitle: document.getElementById("compendium-detail-title"),
    detailEyebrow: document.getElementById("compendium-detail-eyebrow"),
    detailSource: document.getElementById("compendium-detail-source"),
    detailBody: document.getElementById("compendium-detail-body"),
    detailGoogle: document.getElementById("compendium-detail-google"),
  };

  function googleURL(name) {
    return `https://www.google.com/search?q=${encodeURIComponent(`${name} D&D 5e`)}`;
  }

  function option(value, label) {
    return `<option value="${escapeAttribute(value)}">${escapeHTML(label)}</option>`;
  }

  function populateSelect(element, values, label = (value) => value) {
    element.insertAdjacentHTML(
      "beforeend",
      values.map((value) => option(value, label(value))).join(""),
    );
  }

  async function initialize() {
    try {
      const catalog = await loadCompendiumCatalog();
      manifest = catalog.manifest;
      entries = catalog.entries;
      elements.category.insertAdjacentHTML(
        "beforeend",
        manifest.categories
          .filter((category) => category.count > 0)
          .map((category) =>
            option(category.id, `${category.label} (${category.count.toLocaleString()})`),
          )
          .join(""),
      );
      elements.publication.insertAdjacentHTML(
        "beforeend",
        manifest.publications.map((publication) => option(publication, publication)).join(""),
      );
      populateSelect(
        elements.type,
        [...new Set(entries.map((entry) => entry.type))].sort((left, right) =>
          left.localeCompare(right),
        ),
      );
      populateSelect(elements.kind, facetValues(entries, "kinds"));
      populateSelect(elements.damageType, facetValues(entries, "damageTypes"));
      const rarityOrder = [
        "Common", "Uncommon", "Rare", "Very Rare", "Legendary", "Artifact",
        "Unique", "Varies", "Artificer Infusion", "Infusion", "Unknown",
      ];
      populateSelect(
        elements.rarity,
        facetValues(entries, "rarity").sort((left, right) => {
          const leftIndex = rarityOrder.indexOf(left);
          const rightIndex = rarityOrder.indexOf(right);
          return (leftIndex < 0 ? rarityOrder.length : leftIndex) -
            (rightIndex < 0 ? rarityOrder.length : rightIndex) ||
            left.localeCompare(right);
        }),
      );
      populateSelect(
        elements.spellLevel,
        facetValues(entries, "spellLevel"),
        spellLevelLabel,
      );
      populateSelect(elements.school, facetValues(entries, "school"));
      const requested = new URLSearchParams(location.search);
      elements.search.value = requested.get("q") || "";
      elements.category.value = requested.get("category") || "";
      elements.type.value = requested.get("type") || "";
      elements.publication.value = requested.get("publication") || "";
      elements.kind.value = requested.get("kind") || "";
      elements.damageType.value = requested.get("damage") || "";
      elements.rarity.value = requested.get("rarity") || "";
      elements.attunement.value = requested.get("attunement") || "";
      elements.spellLevel.value = requested.get("level") || "";
      elements.school.value = requested.get("school") || "";
      elements.advanced.open = advancedFilterCount() > 0;
      applyFilters();
      if (location.hash.slice(1)) openDetail(location.hash.slice(1), false);
    } catch (error) {
      console.error("Could not initialize compendium:", error);
      elements.summary.textContent = "Could not load the compendium.";
      elements.results.innerHTML =
        '<div class="rounded-2xl border border-danger-500/30 bg-danger-500/10 p-5 text-danger-600 dark:text-red-300 md:col-span-2 xl:col-span-3">The compendium data is unavailable. Run the compendium build before deploying.</div>';
    }
  }

  function applyFilters() {
    const query = normalize(elements.search.value.trim());
    const category = elements.category.value;
    const type = elements.type.value;
    const publication = elements.publication.value;
    filtered = filterCompendiumEntries(entries, {
      query,
      category,
      type,
      publication,
      kind: elements.kind.value,
      damageType: elements.damageType.value,
      rarity: elements.rarity.value,
      attunement: elements.attunement.value,
      spellLevel: elements.spellLevel.value,
      school: elements.school.value,
    });
    visibleCount = PAGE_SIZE;
    const advancedCount = advancedFilterCount();
    elements.advancedCount.textContent = String(advancedCount);
    elements.advancedCount.classList.toggle("hidden", advancedCount === 0);
    updateURL();
    renderResults();
  }

  function advancedFilterCount() {
    return [
      elements.kind,
      elements.damageType,
      elements.rarity,
      elements.attunement,
      elements.spellLevel,
      elements.school,
    ].filter((element) => element.value).length;
  }

  function updateURL() {
    const params = new URLSearchParams();
    if (elements.search.value.trim()) params.set("q", elements.search.value.trim());
    if (elements.category.value) params.set("category", elements.category.value);
    if (elements.type.value) params.set("type", elements.type.value);
    if (elements.publication.value)
      params.set("publication", elements.publication.value);
    if (elements.kind.value) params.set("kind", elements.kind.value);
    if (elements.damageType.value) params.set("damage", elements.damageType.value);
    if (elements.rarity.value) params.set("rarity", elements.rarity.value);
    if (elements.attunement.value)
      params.set("attunement", elements.attunement.value);
    if (elements.spellLevel.value) params.set("level", elements.spellLevel.value);
    if (elements.school.value) params.set("school", elements.school.value);
    const query = params.toString();
    history.replaceState(null, "", `${location.pathname}${query ? `?${query}` : ""}${location.hash}`);
  }

  function renderResults() {
    elements.summary.textContent = `${filtered.length.toLocaleString()} of ${entries.length.toLocaleString()} entries`;
    if (!filtered.length) {
      elements.results.innerHTML =
        '<div class="rounded-2xl border border-dashed border-stone-300 px-5 py-14 text-center text-stone-500 dark:border-white/15 dark:text-stone-400 md:col-span-2 xl:col-span-3"><i class="bi bi-search mb-2 block text-3xl text-blood-500"></i><strong class="block text-stone-700 dark:text-stone-200">No matching entries</strong><span class="mt-1 block text-sm">Try a broader search or clear one of the filters.</span></div>';
      elements.more.classList.add("hidden");
      return;
    }
    elements.results.innerHTML = filtered
      .slice(0, visibleCount)
      .map(renderCard)
      .join("");
    elements.more.classList.toggle("hidden", visibleCount >= filtered.length);
  }

  function renderCard(entry) {
    const facets = entry.facets || {};
    const tags = [
      facets.kinds?.[0],
      facets.rarity,
      facets.spellLevel !== "" && facets.spellLevel !== undefined
        ? spellLevelLabel(facets.spellLevel)
        : "",
      facets.school,
      ...(facets.damageTypes || []).slice(0, 2),
    ].filter(Boolean).slice(0, 4);
    return `<article class="flex h-full flex-col overflow-hidden rounded-2xl border border-stone-300/80 bg-white/75 shadow-card dark:border-white/10 dark:bg-white/[.055]">
      <header class="flex items-start justify-between gap-3 border-b border-stone-200/80 bg-stone-100/70 px-5 py-4 dark:border-white/10 dark:bg-white/[.045]">
        <div class="min-w-0"><h3 class="font-display text-lg font-bold leading-tight">${escapeHTML(entry.name)}</h3><p class="mt-1 text-xs text-stone-500 dark:text-stone-400">${escapeHTML(entry.publication)}</p></div>
        <div class="flex shrink-0 items-center gap-2"><span class="rounded-full bg-blood-500 px-2.5 py-1 text-xs font-bold text-white">${escapeHTML(entry.type)}</span><a class="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-sky-600 text-sky-600 transition hover:bg-sky-600 hover:text-white" href="${escapeAttribute(googleURL(entry.name))}" target="_blank" rel="noopener noreferrer" aria-label="Search Google for ${escapeAttribute(entry.name)}"><i class="bi bi-google"></i></a></div>
      </header>
      <div class="flex grow flex-col p-5">${tags.length ? `<div class="mb-3 flex flex-wrap gap-1.5">${tags.map((tag) => `<span class="rounded-full border border-stone-300/80 bg-stone-100 px-2 py-0.5 text-[11px] font-semibold text-stone-600 dark:border-white/10 dark:bg-white/5 dark:text-stone-300">${escapeHTML(tag)}</span>`).join("")}</div>` : ""}<p class="grow text-sm leading-relaxed text-stone-600 dark:text-stone-300">${escapeHTML(entry.summary || "No summary is available.")}</p><button type="button" data-detail-id="${escapeAttribute(entry.id)}" class="mt-4 inline-flex items-center justify-center gap-2 rounded-xl border border-blood-500 px-4 py-2 text-sm font-bold text-blood-500 transition hover:bg-blood-500 hover:text-white">View full entry <i class="bi bi-arrow-right"></i></button></div>
    </article>`;
  }

  async function loadCategory(category) {
    return { entries: await loadCompendiumCategory(category, manifest) };
  }

  async function openDetail(id, updateHash = true) {
    const indexEntry = entries.find((entry) => entry.id === id);
    if (!indexEntry) return;
    elements.detail.classList.remove("hidden");
    document.body.classList.add("overflow-hidden");
    elements.detailEyebrow.textContent = indexEntry.type;
    elements.detailTitle.textContent = indexEntry.name;
    elements.detailSource.textContent = indexEntry.publication;
    elements.detailGoogle.href = googleURL(indexEntry.name);
    elements.detailGoogle.setAttribute(
      "aria-label",
      `Search Google for ${indexEntry.name}`,
    );
    elements.detailBody.innerHTML =
      '<div class="py-16 text-center"><div class="inline-block h-8 w-8 animate-spin rounded-full border-4 border-blood-500 border-r-transparent"></div></div>';
    if (updateHash) history.replaceState(null, "", `${location.pathname}${location.search}#${id}`);
    try {
      const category = await loadCategory(indexEntry.category);
      const entry = category.entries.find((item) => item.id === id);
      if (!entry) throw new Error("This entry is missing from its category file.");
      elements.detailBody.innerHTML = renderDetail({
        ...entry,
        facets: entry.facets || indexEntry.facets,
      });
    } catch (error) {
      console.error("Could not load compendium entry:", error);
      elements.detailBody.innerHTML =
        '<p class="rounded-xl border border-danger-500/30 bg-danger-500/10 p-4 text-danger-600 dark:text-red-300">The full entry could not be loaded.</p>';
    }
  }

  function renderDetail(entry) {
    const setterRows = Object.entries(entry.setters || {})
      .filter(([, value]) => String(value).trim())
      .map(
        ([name, value]) =>
          `<div class="grid grid-cols-1 gap-1 border-t border-stone-200 py-2 first:border-0 dark:border-white/10 sm:grid-cols-3"><dt class="text-xs font-bold uppercase tracking-wide text-stone-500">${escapeHTML(title(name))}</dt><dd class="sm:col-span-2">${escapeHTML(friendlyMetadataValue(value))}</dd></div>`,
      )
      .join("");
    const supports = supportLabels(entry);
    const facetLabels = [
      ...(entry.facets?.kinds || []),
      entry.facets?.rarity,
      entry.facets?.school,
      entry.facets?.spellLevel !== "" && entry.facets?.spellLevel !== undefined
        ? spellLevelLabel(entry.facets.spellLevel)
        : "",
      ...(entry.facets?.damageTypes || []),
      entry.facets?.attunement === "required" ? "Attunement required" : "",
    ].filter(Boolean);
    const related = (entry.related || [])
      .map((item) => `<li>${escapeHTML(item.name)}</li>`)
      .join("");
    return `<div class="space-y-6">
      ${facetLabels.length ? `<div class="flex flex-wrap gap-2">${[...new Set(facetLabels)].map((facet) => `<span class="rounded-full border border-blood-500/25 bg-blood-500/10 px-3 py-1 text-xs font-bold text-blood-600 dark:text-red-300">${escapeHTML(facet)}</span>`).join("")}</div>` : ""}
      ${entry.summary ? `<section class="rounded-2xl border border-blood-500/20 bg-blood-500/10 p-4"><h3 class="mb-2 text-xs font-bold uppercase tracking-wide text-blood-500">Summary</h3><p class="leading-relaxed">${escapeHTML(entry.summary)}</p></section>` : ""}
      <section class="compendium-rich space-y-3 leading-relaxed">${entry.descriptionHtml || `<p>${escapeHTML(entry.description || "No full description is available.")}</p>`}</section>
      ${supports.length || entry.prerequisite || entry.requirements ? `<section class="rounded-2xl border border-stone-300/80 p-4 dark:border-white/10"><h3 class="mb-3 font-display text-lg font-bold">Requirements & compatibility</h3>${supports.length ? `<div><strong class="text-sm">Tags:</strong><div class="mt-2 flex flex-wrap gap-2">${supports.map((support) => `<span class="rounded-lg bg-stone-100 px-2.5 py-1 text-xs font-semibold text-stone-700 dark:bg-white/5 dark:text-stone-200">${escapeHTML(support)}</span>`).join("")}</div></div>` : ""}${entry.prerequisite ? `<p class="mt-3"><strong>Prerequisite:</strong> ${escapeHTML(friendlyMetadataValue(entry.prerequisite))}</p>` : ""}${entry.requirements ? `<p class="mt-2"><strong>Requirements:</strong> ${escapeHTML(friendlyMetadataValue(entry.requirements))}</p>` : ""}</section>` : ""}
      ${setterRows ? `<section class="rounded-2xl border border-stone-300/80 p-4 dark:border-white/10"><h3 class="mb-2 font-display text-lg font-bold">Details</h3><dl>${setterRows}</dl></section>` : ""}
      ${renderRules(entry.rules)}
      ${related ? `<section class="rounded-2xl border border-stone-300/80 p-4 dark:border-white/10"><h3 class="mb-2 font-display text-lg font-bold">Related entries</h3><ul class="list-disc space-y-1 pl-5">${related}</ul></section>` : ""}
      <details data-technical-identifiers class="rounded-xl border border-stone-200 bg-stone-50/60 text-xs text-stone-500 dark:border-white/10 dark:bg-white/[.025] dark:text-stone-400"><summary class="cursor-pointer px-3 py-2 font-bold">Technical identifiers</summary><dl class="space-y-2 border-t border-stone-200 px-3 py-3 dark:border-white/10"><div><dt class="font-bold">Compendium ID</dt><dd class="break-all font-mono">${escapeHTML(entry.id)}</dd></div><div><dt class="font-bold">Original ID</dt><dd class="break-all font-mono">${escapeHTML(entry.originalId || "—")}</dd></div></dl></details>
    </div>`;
  }

  function renderRules(rules) {
    if (!rules) return "";
    const groups = [
      ["Grants", rules.grants],
      ["Selections", rules.selections],
      ["Stat rules", rules.stats],
    ].filter(([, records]) => records?.length);
    if (!groups.length) return "";
    return `<section class="rounded-2xl border border-stone-300/80 p-4 dark:border-white/10"><h3 class="mb-3 font-display text-lg font-bold">Rule metadata</h3><div class="space-y-4">${groups
      .map(
        ([label, records]) =>
          `<div><h4 class="mb-2 text-sm font-bold text-blood-500">${label} (${records.length})</h4><div class="space-y-2">${records
            .map(
              (record) =>
                `<div class="rounded-xl bg-stone-100 p-3 text-xs dark:bg-white/5">${Object.entries(record)
                  .filter(([key]) => key !== "items")
                  .map(([key, value]) => `<span class="mr-3 inline-block"><strong>${escapeHTML(title(key))}:</strong> ${escapeHTML(friendlyMetadataValue(value))}</span>`)
                  .join("")}${record.items?.length ? `<ul class="mt-2 list-disc pl-5">${record.items.map((item) => `<li>${escapeHTML(item.label)}</li>`).join("")}</ul>` : ""}</div>`,
            )
            .join("")}</div></div>`,
      )
      .join("")}</div></section>`;
  }

  function closeDetail() {
    elements.detail.classList.add("hidden");
    document.body.classList.remove("overflow-hidden");
    history.replaceState(null, "", `${location.pathname}${location.search}`);
  }

  let searchTimer = null;
  elements.search.addEventListener("input", () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(applyFilters, 120);
  });
  [
    elements.category,
    elements.type,
    elements.publication,
    elements.kind,
    elements.damageType,
    elements.rarity,
    elements.attunement,
    elements.spellLevel,
    elements.school,
  ].forEach((element) => element.addEventListener("change", applyFilters));
  elements.clear.addEventListener("click", () => {
    elements.search.value = "";
    [
      elements.category,
      elements.type,
      elements.publication,
      elements.kind,
      elements.damageType,
      elements.rarity,
      elements.attunement,
      elements.spellLevel,
      elements.school,
    ].forEach((element) => { element.value = ""; });
    applyFilters();
    elements.search.focus();
  });
  elements.more.addEventListener("click", () => {
    visibleCount += PAGE_SIZE;
    renderResults();
  });
  elements.results.addEventListener("click", (event) => {
    const button = event.target.closest("[data-detail-id]");
    if (button) openDetail(button.dataset.detailId);
  });
  document.getElementById("compendium-detail-close").addEventListener("click", closeDetail);
  elements.detail.addEventListener("click", (event) => {
    if (event.target === elements.detail) closeDetail();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !elements.detail.classList.contains("hidden"))
      closeDetail();
  });
  initialize();
}
