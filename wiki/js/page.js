import { escapeAttribute, escapeHTML, normalizeText as normalize } from "../../shared/js/text.js";
import { loadWikiPages, saveWikiPages } from "./repository.js";
import { wikiPageURL } from "./routing.js";
import { renderWikiMarkdown } from "./markdown.js";

export async function initializeWiki() {
  let pages = await loadPages();
  let currentPageId = null;
  let toastTimer = null;
  let hoverTimer = null;
  const filters = { search: "", type: "" };

  const elements = {
    home: document.getElementById("wiki-home"),
    page: document.getElementById("wiki-page"),
    sidebar: document.getElementById("wiki-sidebar"),
    editor: document.getElementById("wiki-editor"),
    editorTitle: document.getElementById("wiki-editor-title"),
    form: document.getElementById("wiki-form"),
    id: document.getElementById("wiki-page-id"),
    name: document.getElementById("wiki-page-name"),
    type: document.getElementById("wiki-page-type"),
    aliases: document.getElementById("wiki-page-aliases"),
    summary: document.getElementById("wiki-page-summary"),
    banner: document.getElementById("wiki-page-banner"),
    upload: document.getElementById("wiki-page-upload"),
    body: document.getElementById("wiki-page-body"),
    types: document.getElementById("wiki-types"),
    mentionTarget: document.getElementById("wiki-mention-target"),
    deletePage: document.getElementById("wiki-delete-page"),
    importFile: document.getElementById("wiki-import-file"),
    hoverCard: document.getElementById("wiki-hover-card"),
    toast: document.getElementById("wiki-toast"),
  };

  async function loadPages() {
    try {
      return await loadWikiPages();
    } catch (error) {
      console.warn("Could not read saved wiki pages:", error);
    }
    return [];
  }

  function savePages(message) {
    try {
      saveWikiPages(pages);
      if (message) showToast(message);
      return true;
    } catch (error) {
      console.error("Could not save wiki pages:", error);
      showToast("The browser could not save this change. Large uploads may exceed its storage limit.");
      return false;
    }
  }

  function sortedPages() {
    return [...pages].sort((left, right) => left.name.localeCompare(right.name));
  }

  function pageById(id) {
    return pages.find((page) => page.id === id);
  }

  function pageByName(name) {
    const target = normalize(name);
    return pages.find(
      (page) =>
        normalize(page.name) === target ||
        (page.aliases || []).some((alias) => normalize(alias) === target),
    );
  }

  function pageURL(id) {
    return wikiPageURL(id);
  }

  function iconForType(type) {
    const value = normalize(type);
    if (value.includes("city") || value.includes("town")) return "bi-buildings-fill";
    if (value.includes("location") || value.includes("region")) return "bi-geo-alt-fill";
    if (value.includes("character")) return "bi-person-fill";
    if (value.includes("house") || value.includes("faction") || value.includes("guild"))
      return "bi-shield-fill";
    if (value.includes("religion")) return "bi-sun-fill";
    if (value.includes("history") || value.includes("event")) return "bi-hourglass-split";
    if (value.includes("map")) return "bi-map-fill";
    if (value.includes("family")) return "bi-diagram-3-fill";
    return "bi-bookmark-star-fill";
  }

  function showToast(message) {
    clearTimeout(toastTimer);
    elements.toast.textContent = message;
    elements.toast.classList.remove("hidden");
    toastTimer = setTimeout(() => elements.toast.classList.add("hidden"), 3200);
  }

  function renderSidebar() {
    const active = currentPageId;
    const groups = new Map();
    sortedPages().forEach((page) => {
      const type = page.type || "Lore";
      if (!groups.has(type)) groups.set(type, []);
      groups.get(type).push(page);
    });
    elements.sidebar.innerHTML = [...groups.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(
        ([type, items]) => `<section class="mb-4 last:mb-0">
          <h2 class="mb-1 px-3 text-[.68rem] font-bold uppercase tracking-[.18em] text-stone-400">${escapeHTML(type)}</h2>
          <div class="space-y-0.5">${items
            .map(
              (page) => `<a href="${pageURL(page.id)}" class="flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition ${
                active === page.id
                  ? "bg-blood-500 font-bold text-white"
                  : "hover:bg-blood-500/10 hover:text-blood-500"
              }"><i class="bi ${iconForType(page.type)} shrink-0"></i><span class="truncate">${escapeHTML(page.name)}</span></a>`,
            )
            .join("")}</div>
        </section>`,
      )
      .join("");
  }

  function renderHomeShell() {
    const breugaire = pageByName("Breugaire") || pages[0];
    const types = [...new Set(pages.map((page) => page.type || "Lore"))].sort();
    elements.home.innerHTML = `
      <header class="relative mb-7 overflow-hidden rounded-3xl border border-stone-300/80 bg-ink shadow-card dark:border-white/10">
        ${breugaire?.banner ? `<img src="${escapeAttribute(breugaire.banner)}" alt="" class="absolute inset-0 h-full w-full object-cover opacity-45">` : ""}
        <div class="absolute inset-0 bg-gradient-to-r from-ink via-ink/90 to-ink/30"></div>
        <div class="relative max-w-3xl px-6 py-12 text-white sm:px-10 sm:py-16">
          <span class="mb-4 inline-flex items-center rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-bold backdrop-blur-sm"><i class="bi bi-stars mr-1.5 text-gold"></i> Breugaire campaign notes</span>
          <h1 id="wiki-title" class="font-display text-4xl font-bold sm:text-6xl">Campaign Wiki</h1>
          <p class="mt-4 max-w-2xl text-lg leading-relaxed text-stone-200">Read the DM's campaign notes or add your own.</p>
          <div class="mt-7 flex flex-wrap gap-3">
            <button type="button" data-action="new" class="inline-flex items-center gap-2 rounded-xl bg-blood-500 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-blood-600"><i class="bi bi-file-earmark-plus-fill"></i> New page</button>
            ${breugaire ? `<a href="${pageURL(breugaire.id)}" class="inline-flex items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-5 py-2.5 text-sm font-bold text-white backdrop-blur-sm transition hover:bg-white/20">Enter Breugaire <i class="bi bi-arrow-right"></i></a>` : ""}
          </div>
        </div>
      </header>

      <section class="mb-6 rounded-2xl border border-stone-300/80 bg-white/75 p-4 shadow-card backdrop-blur-sm dark:border-white/10 dark:bg-white/[.055]" aria-label="Wiki tools">
        <div class="grid grid-cols-1 gap-3 md:grid-cols-12">
          <label class="md:col-span-7">
            <span class="mb-1 block text-xs font-bold uppercase tracking-wide text-stone-500 dark:text-stone-400">Search pages</span>
            <span class="relative block"><i class="bi bi-search absolute left-3 top-1/2 -translate-y-1/2 text-stone-400"></i><input id="wiki-search" type="search" value="${escapeAttribute(filters.search)}" autocomplete="off" class="w-full rounded-xl border border-stone-300 bg-white/80 py-2.5 pl-10 pr-3 text-stone-900 dark:border-white/15 dark:bg-white/5 dark:text-white" placeholder="City, faction, person, phrase…"></span>
          </label>
          <label class="md:col-span-3">
            <span class="mb-1 block text-xs font-bold uppercase tracking-wide text-stone-500 dark:text-stone-400">Type</span>
            <select id="wiki-filter-type" class="w-full rounded-xl border border-stone-300 bg-white/80 px-3 py-2.5 text-stone-900 dark:border-white/15 dark:bg-stone-900 dark:text-white"><option value="">All types</option>${types.map((type) => `<option value="${escapeAttribute(type)}"${filters.type === type ? " selected" : ""}>${escapeHTML(type)}</option>`).join("")}</select>
          </label>
          <div class="flex items-end gap-2 md:col-span-2">
            <button type="button" data-action="export" class="inline-flex h-[2.875rem] grow items-center justify-center rounded-xl border border-stone-300 transition hover:border-blood-500 hover:text-blood-500 dark:border-white/15" aria-label="Export wiki backup" title="Export backup"><i class="bi bi-download"></i></button>
            <button type="button" data-action="import" class="inline-flex h-[2.875rem] grow items-center justify-center rounded-xl border border-stone-300 transition hover:border-blood-500 hover:text-blood-500 dark:border-white/15" aria-label="Import wiki backup" title="Import backup"><i class="bi bi-upload"></i></button>
          </div>
        </div>
        <p id="wiki-result-summary" class="mt-3 text-sm text-stone-500 dark:text-stone-400" aria-live="polite"></p>
      </section>

      <section aria-labelledby="archive-title">
        <div class="mb-4 flex items-end justify-between gap-4"><div><p class="text-xs font-bold uppercase tracking-[.18em] text-blood-500">Campaign notes</p><h2 id="archive-title" class="mt-1 font-display text-3xl font-bold">Pages</h2></div></div>
        <div id="wiki-grid" class="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3"></div>
      </section>`;
    renderHomeResults();
  }

  function renderHomeResults() {
    const grid = document.getElementById("wiki-grid");
    const summary = document.getElementById("wiki-result-summary");
    if (!grid || !summary) return;
    const query = normalize(filters.search);
    const filtered = sortedPages().filter((page) => {
      if (filters.type && page.type !== filters.type) return false;
      if (!query) return true;
      return normalize(
        [page.name, page.type, page.summary, page.body, ...(page.aliases || [])].join(" "),
      ).includes(query);
    });
    summary.textContent = `${filtered.length} of ${pages.length} pages`;
    if (!filtered.length) {
      grid.innerHTML = `<div class="rounded-2xl border border-dashed border-stone-300 px-5 py-14 text-center text-stone-500 dark:border-white/15 dark:text-stone-400 sm:col-span-2 lg:col-span-3"><i class="bi bi-search mb-2 block text-3xl text-blood-500"></i><strong class="block text-stone-700 dark:text-stone-200">No matching pages</strong><button type="button" data-action="clear-filters" class="mt-3 text-sm font-bold text-blood-500">Clear filters</button></div>`;
      return;
    }
    grid.innerHTML = filtered.map(renderCard).join("");
  }

  function renderCard(page) {
    return `<article class="group flex min-h-[22rem] flex-col overflow-hidden rounded-2xl border border-stone-300/80 bg-white/75 shadow-card transition hover:-translate-y-1 hover:border-blood-500/40 hover:shadow-xl dark:border-white/10 dark:bg-white/[.055]">
      <a href="${pageURL(page.id)}" class="relative block aspect-[16/9] overflow-hidden bg-stone-200 dark:bg-white/5">
        ${page.banner ? `<img src="${escapeAttribute(page.banner)}" alt="${escapeAttribute(page.name)} banner" class="h-full w-full object-cover transition duration-500 group-hover:scale-105" loading="lazy">` : `<div class="flex h-full items-center justify-center"><i class="bi ${iconForType(page.type)} text-5xl text-stone-400"></i></div>`}
        <div class="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-transparent"></div>
        <span class="absolute bottom-3 left-3 rounded-full bg-blood-500 px-2.5 py-1 text-xs font-bold text-white">${escapeHTML(page.type || "Lore")}</span>
      </a>
      <div class="flex grow flex-col p-5"><h3 class="font-display text-2xl font-bold"><a href="${pageURL(page.id)}" class="transition hover:text-blood-500">${escapeHTML(page.name)}</a></h3><p class="mt-2 grow text-sm leading-relaxed text-stone-500 dark:text-stone-400">${escapeHTML(page.summary || "No summary yet.")}</p><a href="${pageURL(page.id)}" class="mt-4 inline-flex items-center gap-2 text-sm font-bold text-blood-500">Read page <i class="bi bi-arrow-right transition group-hover:translate-x-1"></i></a></div>
    </article>`;
  }

  const renderMarkdown = (markdown) => renderWikiMarkdown(markdown, { pageByName, pageURL });

  function mentionedPages(body) {
    const result = [];
    const seen = new Set();
    for (const match of String(body || "").matchAll(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g)) {
      const page = pageByName(match[1].trim());
      if (page && !seen.has(page.id)) {
        seen.add(page.id);
        result.push(page);
      }
    }
    return result;
  }

  function relatedPages(page) {
    const result = mentionedPages(page.body).filter((related) => related.id !== page.id);
    const seen = new Set(result.map((related) => related.id));
    pages.forEach((candidate) => {
      if (candidate.id === page.id || seen.has(candidate.id)) return;
      if (mentionedPages(candidate.body).some((mentioned) => mentioned.id === page.id)) {
        result.push(candidate);
        seen.add(candidate.id);
      }
    });
    return result.slice(0, 12);
  }

  function renderPage(page) {
    currentPageId = page.id;
    document.title = `${page.name} | Campaign Wiki`;
    const related = relatedPages(page);
    elements.page.innerHTML = `
      <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
        <button type="button" data-action="home" class="inline-flex items-center gap-2 text-sm font-bold text-stone-500 transition hover:text-blood-500 dark:text-stone-400"><i class="bi bi-arrow-left"></i> Wiki home</button>
        <div class="flex gap-2"><button type="button" data-action="copy-link" class="inline-flex h-10 items-center gap-2 rounded-xl border border-stone-300 px-3 text-sm font-bold transition hover:border-blood-500 hover:text-blood-500 dark:border-white/15"><i class="bi bi-link-45deg"></i><span class="hidden sm:inline">Copy link</span></button><button type="button" data-action="edit" data-page-id="${escapeAttribute(page.id)}" class="inline-flex h-10 items-center gap-2 rounded-xl bg-blood-500 px-4 text-sm font-bold text-white transition hover:bg-blood-600"><i class="bi bi-pencil-fill"></i> Edit page</button></div>
      </div>
      <header class="relative overflow-hidden rounded-3xl border border-stone-300/80 bg-ink shadow-card dark:border-white/10">
        ${page.banner ? `<img src="${escapeAttribute(page.banner)}" alt="${escapeAttribute(page.name)} banner" class="h-[18rem] w-full object-cover sm:h-[25rem]">` : `<div class="flex h-[18rem] items-center justify-center sm:h-[25rem]"><i class="bi ${iconForType(page.type)} text-7xl text-stone-500"></i></div>`}
        <div class="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent"></div>
        <div class="absolute inset-x-0 bottom-0 p-6 text-white sm:p-10"><span class="inline-flex items-center rounded-full bg-blood-500 px-3 py-1 text-xs font-bold"><i class="bi ${iconForType(page.type)} mr-1.5"></i>${escapeHTML(page.type || "Lore")}</span><h1 class="mt-3 max-w-5xl font-display text-4xl font-bold leading-tight sm:text-6xl">${escapeHTML(page.name)}</h1>${page.aliases?.length ? `<p class="mt-2 text-sm text-stone-300">Also known as ${page.aliases.map(escapeHTML).join(" · ")}</p>` : ""}</div>
      </header>
      <div class="mx-auto max-w-5xl py-8 sm:py-12">
        ${page.summary ? `<p class="mb-8 border-l-4 border-blood-500 pl-5 font-display text-xl leading-relaxed text-stone-600 dark:text-stone-300 sm:text-2xl">${escapeHTML(page.summary)}</p>` : ""}
        <div class="wiki-rich">${page.body ? renderMarkdown(page.body) : '<div class="rounded-2xl border border-dashed border-stone-300 p-8 text-center text-stone-500 dark:border-white/15 dark:text-stone-400"><i class="bi bi-feather mb-2 block text-3xl text-blood-500"></i>This page has no written lore yet. Edit it to begin.</div>'}</div>
        ${related.length ? `<section class="mt-12 border-t border-stone-300 pt-8 dark:border-white/10"><p class="text-xs font-bold uppercase tracking-[.18em] text-blood-500">More from the wiki</p><h2 class="mt-1 font-display text-2xl font-bold">Related pages</h2><div class="mt-4 flex flex-wrap gap-2">${related.map((item) => `<a href="${pageURL(item.id)}" class="inline-flex items-center gap-2 rounded-xl border border-stone-300 bg-white/60 px-3 py-2 text-sm font-bold transition hover:border-blood-500 hover:text-blood-500 dark:border-white/15 dark:bg-white/5"><i class="bi ${iconForType(item.type)}"></i>${escapeHTML(item.name)}</a>`).join("")}</div></section>` : ""}
        ${page.source ? `<p class="mt-10 text-xs text-stone-400">Originally imported from the <a class="font-bold text-blood-500 hover:underline" href="${escapeAttribute(page.source)}" target="_blank" rel="noopener noreferrer">DM's published campaign site <i class="bi bi-box-arrow-up-right"></i></a>.</p>` : ""}
      </div>`;
    elements.home.classList.add("hidden");
    elements.page.classList.remove("hidden");
    renderSidebar();
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  function renderRoute() {
    hideHoverCard();
    const match = location.hash.match(/^#page=(.+)$/);
    const page = match ? pageById(decodeURIComponent(match[1])) : null;
    if (page) {
      renderPage(page);
      return;
    }
    currentPageId = null;
    document.title = "Wiki | Cassian's Log";
    elements.page.classList.add("hidden");
    elements.home.classList.remove("hidden");
    renderHomeShell();
    renderSidebar();
  }

  function navigateHome() {
    history.pushState(null, "", `${location.pathname}${location.search}`);
    renderRoute();
  }

  function populateEditorOptions() {
    const types = [...new Set(pages.map((page) => page.type).filter(Boolean))].sort();
    elements.types.innerHTML = types.map((type) => `<option value="${escapeAttribute(type)}"></option>`).join("");
    elements.mentionTarget.innerHTML = sortedPages()
      .map((page) => `<option value="${escapeAttribute(page.name)}">${escapeHTML(page.name)} · ${escapeHTML(page.type)}</option>`)
      .join("");
  }

  function openEditor(page) {
    populateEditorOptions();
    elements.form.reset();
    elements.id.value = page?.id || "";
    elements.name.value = page?.name || "";
    elements.type.value = page?.type || "Lore";
    elements.aliases.value = (page?.aliases || []).join(", ");
    elements.summary.value = page?.summary || "";
    elements.banner.value = page?.banner?.startsWith("data:") ? "" : page?.banner || "";
    elements.banner.dataset.upload = page?.banner?.startsWith("data:") ? page.banner : "";
    elements.body.value = page?.body || "";
    elements.editorTitle.textContent = page ? `Edit ${page.name}` : "Create a wiki page";
    elements.deletePage.classList.toggle("hidden", !page);
    elements.deletePage.classList.toggle("inline-flex", Boolean(page));
    elements.editor.classList.remove("hidden");
    document.body.classList.add("overflow-hidden");
    setTimeout(() => elements.name.focus(), 0);
  }

  function closeEditor() {
    elements.editor.classList.add("hidden");
    document.body.classList.remove("overflow-hidden");
    elements.form.reset();
    elements.banner.dataset.upload = "";
  }

  function uniqueId() {
    return crypto.randomUUID ? crypto.randomUUID() : `wiki-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  function saveEditor(event) {
    event.preventDefault();
    const id = elements.id.value || uniqueId();
    const name = elements.name.value.trim();
    const duplicate = pages.find((page) => page.id !== id && normalize(page.name) === normalize(name));
    if (duplicate) {
      showToast(`A page named ${duplicate.name} already exists.`);
      elements.name.focus();
      return;
    }
    const existingIndex = pages.findIndex((page) => page.id === id);
    const previous = existingIndex >= 0 ? pages[existingIndex] : {};
    const updated = {
      ...previous,
      id,
      name,
      type: elements.type.value.trim() || "Lore",
      aliases: elements.aliases.value.split(",").map((alias) => alias.trim()).filter(Boolean),
      summary: elements.summary.value.trim(),
      banner: elements.banner.dataset.upload || elements.banner.value.trim(),
      body: elements.body.value.trim(),
      imported: previous.imported || false,
      modifiedAt: new Date().toISOString(),
    };
    if (existingIndex >= 0) pages.splice(existingIndex, 1, updated);
    else pages.push(updated);
    if (!savePages("Wiki page saved.")) return;
    closeEditor();
    location.hash = `page=${encodeURIComponent(id)}`;
    renderRoute();
  }

  function deleteCurrentEditorPage() {
    const page = pageById(elements.id.value);
    if (!page || !confirm(`Delete ${page.name}? This removes the page from this browser.`)) return;
    pages = pages.filter((item) => item.id !== page.id);
    if (!savePages(`${page.name} was deleted.`)) return;
    closeEditor();
    navigateHome();
  }

  function insertMention() {
    const target = elements.mentionTarget.value;
    if (!target) return;
    const insertion = `[[${target}]]`;
    const start = elements.body.selectionStart;
    const end = elements.body.selectionEnd;
    elements.body.setRangeText(insertion, start, end, "end");
    elements.body.focus();
  }

  function readBannerUpload() {
    const file = elements.upload.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showToast("Choose an image file for the banner.");
      return;
    }
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      elements.banner.dataset.upload = String(reader.result || "");
      elements.banner.value = "";
      showToast("Banner ready. Save the page to keep it.");
    });
    reader.readAsDataURL(file);
  }

  function clearBanner() {
    elements.banner.value = "";
    elements.banner.dataset.upload = "";
    elements.upload.value = "";
    showToast("Banner removed. Save the page to keep this change.");
  }

  function exportWiki() {
    const backup = { version: 1, exportedAt: new Date().toISOString(), pages };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `breugaire-wiki-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    showToast("Wiki backup exported.");
  }

  function importWiki(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      try {
        const value = JSON.parse(String(reader.result || ""));
        const importedPages = Array.isArray(value) ? value : value.pages;
        if (!Array.isArray(importedPages) || !importedPages.every((page) => page?.id && page?.name)) {
          throw new Error("This file does not contain wiki pages.");
        }
        if (!confirm(`Replace this browser's wiki with ${importedPages.length} pages from the backup?`)) return;
        pages = importedPages;
        if (savePages("Wiki backup imported.")) navigateHome();
      } catch (error) {
        console.error("Could not import wiki:", error);
        showToast("That file is not a valid wiki backup.");
      } finally {
        elements.importFile.value = "";
      }
    });
    reader.readAsText(file);
  }

  async function copyPageLink() {
    try {
      await navigator.clipboard.writeText(location.href);
      showToast("Page link copied.");
    } catch {
      showToast("Copying is unavailable in this browser.");
    }
  }

  function showHoverCard(target) {
    clearTimeout(hoverTimer);
    const page = pageById(target.dataset.pageId);
    if (!page) return;
    elements.hoverCard.innerHTML = `${page.banner ? `<img src="${escapeAttribute(page.banner)}" alt="" class="h-32 w-full object-cover">` : ""}<div class="p-4"><p class="text-[.65rem] font-bold uppercase tracking-[.18em] text-red-300">${escapeHTML(page.type)}</p><p class="mt-1 font-display text-xl font-bold">${escapeHTML(page.name)}</p>${page.summary ? `<p class="mt-2 line-clamp-3 text-xs leading-relaxed text-stone-300">${escapeHTML(page.summary)}</p>` : ""}</div>`;
    elements.hoverCard.classList.remove("hidden");
    const rect = target.getBoundingClientRect();
    const cardRect = elements.hoverCard.getBoundingClientRect();
    let left = rect.left + rect.width / 2 - cardRect.width / 2;
    left = Math.max(12, Math.min(window.innerWidth - cardRect.width - 12, left));
    let top = rect.top - cardRect.height - 10;
    if (top < 12) top = rect.bottom + 10;
    elements.hoverCard.style.left = `${left}px`;
    elements.hoverCard.style.top = `${Math.min(top, window.innerHeight - cardRect.height - 12)}px`;
  }

  function hideHoverCard(delay = 0) {
    clearTimeout(hoverTimer);
    hoverTimer = setTimeout(() => elements.hoverCard.classList.add("hidden"), delay);
  }

  function handleClick(event) {
    const action = event.target.closest("[data-action]")?.dataset.action;
    if (action === "new") openEditor(null);
    else if (action === "edit") openEditor(pageById(event.target.closest("[data-page-id]").dataset.pageId));
    else if (action === "home") navigateHome();
    else if (action === "export") exportWiki();
    else if (action === "import") elements.importFile.click();
    else if (action === "copy-link") copyPageLink();
    else if (action === "clear-filters") {
      filters.search = "";
      filters.type = "";
      renderHomeShell();
    }
  }

  function setupEvents() {
    document.getElementById("sidebar-home").addEventListener("click", navigateHome);
    document.addEventListener("click", handleClick);
    document.addEventListener("input", (event) => {
      if (event.target.id === "wiki-search") {
        filters.search = event.target.value;
        renderHomeResults();
      }
    });
    document.addEventListener("change", (event) => {
      if (event.target.id === "wiki-filter-type") {
        filters.type = event.target.value;
        renderHomeResults();
      }
    });
    document.addEventListener("mouseover", (event) => {
      const mention = event.target.closest(".wiki-mention[data-page-id]");
      if (mention && !mention.contains(event.relatedTarget)) showHoverCard(mention);
    });
    document.addEventListener("mouseout", (event) => {
      const mention = event.target.closest(".wiki-mention[data-page-id]");
      if (mention && !mention.contains(event.relatedTarget)) hideHoverCard(80);
    });
    document.addEventListener("focusin", (event) => {
      const mention = event.target.closest(".wiki-mention[data-page-id]");
      if (mention) showHoverCard(mention);
    });
    document.addEventListener("focusout", (event) => {
      if (event.target.closest(".wiki-mention[data-page-id]")) hideHoverCard();
    });
    window.addEventListener("scroll", () => hideHoverCard(), { passive: true });
    window.addEventListener("resize", () => hideHoverCard());
    window.addEventListener("hashchange", renderRoute);
    window.addEventListener("popstate", renderRoute);
    elements.form.addEventListener("submit", saveEditor);
    elements.upload.addEventListener("change", readBannerUpload);
    elements.banner.addEventListener("input", () => {
      if (elements.banner.value) elements.banner.dataset.upload = "";
    });
    elements.importFile.addEventListener("change", () => importWiki(elements.importFile.files?.[0]));
    document.getElementById("wiki-insert-mention").addEventListener("click", insertMention);
    document.getElementById("wiki-clear-banner").addEventListener("click", clearBanner);
    document.getElementById("wiki-editor-close").addEventListener("click", closeEditor);
    document.getElementById("wiki-editor-cancel").addEventListener("click", closeEditor);
    elements.deletePage.addEventListener("click", deleteCurrentEditorPage);
    elements.editor.addEventListener("click", (event) => {
      if (event.target === elements.editor) closeEditor();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !elements.editor.classList.contains("hidden")) closeEditor();
    });
  }

  setupEvents();
  renderRoute();
}
