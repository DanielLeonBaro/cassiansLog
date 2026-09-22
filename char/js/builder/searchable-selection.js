// Reusable searchable add/remove control for builder Compendium choices.
import { campaignPagePath } from "../../../shared/js/campaign-context.js";

function text(value) {
  return String(value ?? "").trim();
}

function list(value) {
  return Array.isArray(value) ? value : [];
}

function prerequisite(entry) {
  const value = entry.prerequisite ?? entry.rules?.prerequisite ?? entry.rules?.requirements;
  if (!value) return "";
  return typeof value === "string" ? value : JSON.stringify(value);
}

export function searchableSelectionEntry(entry = {}) {
  const publication = text(entry.publication || entry.source) || "Unknown source";
  const automation = text(entry.automation?.status || entry.automationStatus) || "manual";
  const minimumLevel = Number(entry.minimumLevel || entry.levelRequirement || 0);
  return {
    ...entry,
    id: text(entry.id),
    name: text(entry.name || entry.id) || "Unnamed option",
    summary: text(entry.summary || entry.description) || "No summary available.",
    ruleset: text(entry.ruleset) || "Unspecified ruleset",
    publication,
    automation,
    prerequisite: prerequisite(entry),
    levelLabel: text(entry.levelLabel),
    minimumLevel: Number.isFinite(minimumLevel) && minimumLevel > 0 ? minimumLevel : 0,
    unavailableReason: text(entry.unavailableReason || entry.availability?.reason),
  };
}

export function searchableSelectionState({ entries = [], selectedIds = [], query = "", limit = 50 } = {}) {
  const selected = new Set(list(selectedIds).map(text));
  const normalized = entries.map(searchableSelectionEntry).filter(({ id }) => id);
  const words = text(query).toLowerCase().split(/\s+/).filter(Boolean);
  const matching = normalized.filter((entry) => {
    if (selected.has(entry.id)) return false;
    const haystack = [entry.name, entry.summary, entry.publication, entry.ruleset, entry.automation, entry.prerequisite, entry.levelLabel].join(" ").toLowerCase();
    return words.every((word) => haystack.includes(word));
  });
  return {
    selected: list(selectedIds).map((id) => normalized.find((entry) => entry.id === id)).filter(Boolean),
    results: matching.slice(0, Math.max(1, Number(limit) || 50)),
    matchingCount: matching.length,
  };
}

export function updateSearchableSelection(selectedIds, entryId, {
  entries = [], remove = false, multiple = true, maxSelected = Infinity,
} = {}) {
  const current = [...new Set(list(selectedIds).map(text).filter(Boolean))];
  const id = text(entryId);
  if (!id) return current;
  if (remove) return current.filter((candidate) => candidate !== id);
  const entry = entries.map(searchableSelectionEntry).find((candidate) => candidate.id === id);
  if (!entry || entry.unavailableReason || current.includes(id)) return current;
  if (!multiple) return [id];
  if (current.length >= maxSelected) return current;
  return [...current, id];
}

function node(doc, tag, className = "", content = "") {
  const item = doc.createElement(tag);
  if (className) item.className = className;
  if (content !== "") item.textContent = String(content);
  return item;
}

function metadata(entry) {
  return [
    entry.ruleset,
    entry.publication,
    entry.automation,
    entry.minimumLevel ? `Level ${entry.minimumLevel}+` : "",
    entry.levelLabel,
    entry.prerequisite ? `Prerequisite: ${entry.prerequisite}` : "",
    entry.unavailableReason ? `Unavailable: ${entry.unavailableReason}` : "",
  ].filter(Boolean);
}

export function mountSearchableSelection(host, options = {}) {
  if (!host) return null;
  const doc = host.ownerDocument;
  const id = text(options.id) || "builder-searchable-selection";
  let entries = list(options.entries);
  let selectedIds = list(options.selectedIds);
  let query = "";
  let open = false;
  let activeIndex = -1;
  let detailReturnFocus = null;

  host.replaceChildren();
  host.dataset.searchableSelection = id;
  const label = node(doc, "label", "block text-sm font-bold", options.label || "Choose options");
  label.htmlFor = `${id}-search`;
  const input = node(doc, "input", "mt-1 w-full rounded-xl border border-stone-300 bg-white/80 px-3 py-2.5 text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold dark:border-white/15 dark:bg-ink dark:text-white");
  input.id = `${id}-search`;
  input.type = "search";
  input.autocomplete = "off";
  input.placeholder = options.placeholder || "Search options…";
  input.setAttribute("role", "combobox");
  input.setAttribute("aria-autocomplete", "list");
  input.setAttribute("aria-controls", `${id}-results`);
  input.disabled = Boolean(options.disabled);
  const summary = node(doc, "p", "mt-2 min-h-5 text-xs text-stone-600 dark:text-stone-300");
  summary.dataset.selectionSummary = "";
  const selectedList = node(doc, "ul", "mt-3 flex flex-wrap gap-2");
  selectedList.dataset.selectionChips = "";
  const results = node(doc, "div", "mt-2 max-h-80 space-y-2 overflow-y-auto rounded-xl border border-stone-300 bg-parchment p-2 shadow-lg dark:border-white/15 dark:bg-ink");
  results.id = `${id}-results`;
  results.setAttribute("role", "listbox");
  results.hidden = true;
  const count = node(doc, "p", "mt-2 text-xs text-stone-500 dark:text-stone-400");
  count.setAttribute("role", "status");
  count.setAttribute("aria-live", "polite");

  const dialog = node(doc, "dialog", "w-[min(34rem,calc(100%-2rem))] rounded-2xl border border-stone-300 bg-parchment p-0 text-stone-900 shadow-2xl backdrop:bg-ink/80 dark:border-white/15 dark:bg-ink dark:text-white");
  dialog.setAttribute("aria-labelledby", `${id}-detail-title`);
  const dialogBody = node(doc, "div", "p-5");
  const dialogTitle = node(doc, "h3", "font-display text-xl font-bold");
  dialogTitle.id = `${id}-detail-title`;
  const dialogMeta = node(doc, "p", "mt-2 text-xs text-stone-500 dark:text-stone-400");
  const dialogSummary = node(doc, "p", "mt-4 text-sm leading-relaxed text-stone-600 dark:text-stone-300");
  const dialogActions = node(doc, "div", "mt-5 flex flex-wrap justify-end gap-2");
  const compendium = node(doc, "a", "rounded-xl border border-sky-600 px-3 py-2 text-sm font-bold text-sky-700 dark:text-sky-300", "Open in Compendium");
  compendium.target = "_blank";
  const google = node(doc, "a", "rounded-xl border border-stone-400 px-3 py-2 text-sm font-bold", "Search Google");
  google.target = "_blank";
  google.rel = "noopener noreferrer";
  const close = node(doc, "button", "rounded-xl bg-blood-500 px-3 py-2 text-sm font-bold text-on-accent", "Close");
  close.type = "button";
  dialogActions.append(compendium, google, close);
  dialogBody.append(dialogTitle, dialogMeta, dialogSummary, dialogActions);
  dialog.append(dialogBody);
  host.append(label, input, selectedList, summary, results, count, dialog);

  function showDetails(entry, returnFocus) {
    detailReturnFocus = returnFocus;
    dialogTitle.textContent = entry.name;
    dialogMeta.textContent = metadata(entry).join(" · ");
    dialogSummary.textContent = entry.summary;
    compendium.href = `${campaignPagePath("compendium")}#${encodeURIComponent(entry.id)}`;
    google.href = `https://www.google.com/search?q=${encodeURIComponent(entry.name)}`;
    dialog.showModal?.();
    if (!dialog.open) dialog.setAttribute("open", "");
    close.focus();
  }

  function closeDetails() {
    dialog.close?.();
    if (dialog.open) dialog.removeAttribute("open");
    detailReturnFocus?.focus();
  }

  function commit(next, action, entryId) {
    if (next.join("|") === selectedIds.join("|")) return;
    selectedIds = next;
    options.onChange?.([...selectedIds], { action, entryId });
    render();
    if (action === "add") input.focus();
  }

  function renderChips(state) {
    selectedList.replaceChildren();
    selectedList.hidden = state.selected.length === 0;
    state.selected.forEach((entry) => {
      const item = node(doc, "li", "flex max-w-full items-center gap-1 rounded-full border border-blood-500/40 bg-blood-500/10 pl-3 text-sm");
      const name = node(doc, "span", "truncate py-1.5 font-bold", entry.name);
      const remove = node(doc, "button", "shrink-0 rounded-full px-2 py-1.5 font-bold hover:bg-blood-500/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold", "×");
      const detail = node(doc, "button", "shrink-0 rounded-full px-2 py-1.5 text-xs font-bold hover:bg-sky-500/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold", "Details");
      detail.type = "button";
      detail.disabled = Boolean(options.disabled);
      detail.setAttribute("aria-label", `View details for ${entry.name}`);
      remove.type = "button";
      remove.disabled = Boolean(options.disabled);
      remove.title = entry.summary;
      remove.setAttribute("aria-label", `Remove ${entry.name}`);
      const describe = () => { summary.textContent = entry.summary; };
      const clear = () => { summary.textContent = ""; };
      item.addEventListener("mouseenter", describe);
      item.addEventListener("mouseleave", clear);
      remove.addEventListener("focus", describe);
      remove.addEventListener("blur", clear);
      detail.addEventListener("focus", describe);
      detail.addEventListener("blur", clear);
      detail.addEventListener("click", () => showDetails(entry, detail));
      remove.addEventListener("click", () => {
        commit(updateSearchableSelection(selectedIds, entry.id, { entries, remove: true }), "remove", entry.id);
        input.focus();
      });
      item.append(name, detail, remove);
      selectedList.append(item);
    });
  }

  function renderResults(state) {
    results.replaceChildren();
    results.hidden = !open;
    input.setAttribute("aria-expanded", String(open));
    const selectable = [];
    state.results.forEach((entry, index) => {
      const row = node(doc, "div", "rounded-lg border border-stone-300/80 bg-white/70 p-3 dark:border-white/10 dark:bg-white/5");
      row.setAttribute("role", "option");
      row.id = `${id}-option-${index}`;
      row.setAttribute("aria-selected", "false");
      if (entry.unavailableReason) row.setAttribute("aria-disabled", "true");
      const heading = node(doc, "div", "flex items-start justify-between gap-2");
      const copy = node(doc, "div", "min-w-0");
      copy.append(node(doc, "strong", "block truncate text-sm", entry.name), node(doc, "span", "mt-1 block text-xs text-stone-500 dark:text-stone-400", metadata(entry).join(" · ")));
      const actions = node(doc, "div", "flex shrink-0 gap-1");
      const add = node(doc, "button", "rounded-lg bg-blood-500 px-2.5 py-1.5 text-xs font-bold text-on-accent disabled:cursor-not-allowed disabled:opacity-50", options.multiple === false ? "Select" : "Add");
      add.type = "button";
      add.disabled = Boolean(options.disabled) || Boolean(entry.unavailableReason) || (options.multiple !== false && selectedIds.length >= (options.maxSelected ?? Infinity));
      add.dataset.selectionAdd = entry.id;
      add.addEventListener("click", () => commit(updateSearchableSelection(selectedIds, entry.id, { entries, multiple: options.multiple !== false, maxSelected: options.maxSelected ?? Infinity }), "add", entry.id));
      const detail = node(doc, "button", "rounded-lg border border-stone-400 px-2.5 py-1.5 text-xs font-bold", "Details");
      detail.type = "button";
      detail.disabled = Boolean(options.disabled);
      detail.dataset.selectionDetails = entry.id;
      detail.addEventListener("click", () => showDetails(entry, detail));
      actions.append(add, detail);
      heading.append(copy, actions);
      row.append(heading, node(doc, "p", "mt-2 line-clamp-2 text-xs text-stone-600 dark:text-stone-300", entry.summary));
      results.append(row);
      if (!add.disabled) selectable.push(add);
    });
    activeIndex = selectable.length ? Math.min(Math.max(activeIndex, 0), selectable.length - 1) : -1;
    input.setAttribute("aria-activedescendant", activeIndex >= 0 ? selectable[activeIndex].closest('[role="option"]').id : "");
    count.textContent = `${state.matchingCount.toLocaleString()} matching option${state.matchingCount === 1 ? "" : "s"}; ${state.selected.length.toLocaleString()} selected.`;
  }

  function render() {
    const state = searchableSelectionState({ entries, selectedIds, query, limit: options.limit });
    renderChips(state);
    renderResults(state);
  }

  input.addEventListener("focus", () => { open = true; render(); });
  input.addEventListener("input", () => { query = input.value; open = true; activeIndex = 0; render(); });
  input.addEventListener("keydown", (event) => {
    const buttons = [...results.querySelectorAll("[data-selection-add]:not(:disabled)")];
    if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      open = true;
      if (event.key === "Home") activeIndex = 0;
      else if (event.key === "End") activeIndex = buttons.length - 1;
      else activeIndex = Math.min(Math.max(activeIndex + (event.key === "ArrowDown" ? 1 : -1), 0), buttons.length - 1);
      render();
    } else if (event.key === "Enter" && open && activeIndex >= 0) {
      event.preventDefault();
      buttons[activeIndex]?.click();
    } else if (event.key === "Escape") {
      open = false;
      render();
    }
  });
  close.addEventListener("click", closeDetails);
  dialog.addEventListener("cancel", (event) => { event.preventDefault(); closeDetails(); });
  render();

  return {
    focus: () => input.focus(),
    getSelectedIds: () => [...selectedIds],
    update(next = {}) {
      entries = next.entries ? list(next.entries) : entries;
      selectedIds = next.selectedIds ? list(next.selectedIds) : selectedIds;
      render();
    },
    destroy: () => host.replaceChildren(),
  };
}
