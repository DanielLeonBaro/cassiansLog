// Coordinates Player and DM Screen page state, rendering, persistence, and user events.
import { currentSession } from "../../shared/js/auth-client.js";
import { createDialogController } from "../../shared/js/dialog.js";
import { createImageModalController } from "../../shared/js/image-modal.js";
import { isLocalRuntimeHost } from "../../shared/js/runtime-host.js";
import { cloneJSON, escapeAttribute, escapeHTML, normalizeText } from "../../shared/js/text.js";
import { currentCampaign, currentCampaignSlug } from "../../shared/js/campaign-context.js";
import {
  compendiumReferenceSnapshot,
  filterScreenCompendium,
  loadScreenCharacters,
  loadScreenInitiative,
  loadWikiMentions,
  refreshCharacterRuntime,
  screenCompendiumCatalog,
} from "../../integrations/screen-data/index.js";
import { calculateExpression, formatCalculatorResult } from "./calculator.js";
import { compressScreenImage, validScreenImage } from "./image.js";
import {
  createEmptyScreen,
  createWidget,
  moveWidget,
  removeWidget,
  reorderWidget,
  replaceWidget,
} from "./model.js";
import {
  addCalculatorHistory,
  clearCalculatorHistory,
  loadCalculatorHistory,
  loadScreen,
  saveScreen,
} from "./repository.js";
import {
  calculatorKeypad,
  editorFields,
  renderPartyDetail,
  renderScreenRichText,
  renderWidgetCard,
  widgetLabels,
} from "./view.js";

const TYPE_ORDER = ["character", "party", "manual", "compendium", "note", "initiative", "calculator"];

export async function initializeScreen(kind) {
  const local = isLocalRuntimeHost() && !currentCampaignSlug();
  const { user } = await currentSession();
  if (!user) return;
  const campaign = currentCampaignSlug() ? await currentCampaign() : null;
  const roles = campaign
    ? ["characters", "player-screen", "combat-loot", "public-initiative", "music", "compendium", "wiki", ...(["dm", "admin"].includes(campaign.role) ? ["dm-screen"] : [])]
    : user.roles || [];
  let documentValue = createEmptyScreen();
  let characters = [];
  let initiative = [];
  let wikiPages = [];
  let editorDraft = null;
  let editorExisting = false;
  let detailWidgetId = "";
  let draggedWidgetId = "";
  let compendiumCatalog = null;
  let historyItems = [];
  let historyCursor = null;

  const elements = {
    grid: document.getElementById("screen-grid"),
    status: document.getElementById("screen-status"),
    refresh: document.getElementById("screen-refresh"),
    editor: document.getElementById("screen-editor"),
    editorForm: document.getElementById("screen-editor-form"),
    editorTitle: document.getElementById("screen-editor-title"),
    editorType: document.getElementById("screen-widget-type"),
    editorFields: document.getElementById("screen-editor-fields"),
    editorError: document.getElementById("screen-editor-error"),
    detail: document.getElementById("screen-detail"),
    detailTitle: document.getElementById("screen-detail-title"),
    detailBody: document.getElementById("screen-detail-body"),
    compendium: document.getElementById("screen-compendium"),
    compendiumSearch: document.getElementById("screen-compendium-search"),
    compendiumCategory: document.getElementById("screen-compendium-category"),
    compendiumPublication: document.getElementById("screen-compendium-publication"),
    compendiumSummary: document.getElementById("screen-compendium-summary"),
    compendiumResults: document.getElementById("screen-compendium-results"),
    imageModal: document.getElementById("screen-image-modal"),
    imageClose: document.getElementById("screen-image-close"),
    modalImage: document.getElementById("screen-modal-image"),
  };

  const editorDialog = createDialogController(elements.editor, {
    form: elements.editorForm,
    initialFocus: () => elements.editorType,
    onClose: () => { editorDraft = null; editorExisting = false; },
  });
  const detailDialog = createDialogController(elements.detail, {
    initialFocus: () => elements.detail.querySelector("[data-close-detail]"),
    onClose: () => { detailWidgetId = ""; historyItems = []; historyCursor = null; },
  });
  const compendiumDialog = createDialogController(elements.compendium, {
    initialFocus: () => elements.compendiumSearch,
    onClose: () => {
      if (!elements.editor.classList.contains("hidden")) document.body.classList.add("overflow-hidden");
    },
  });
  const imageController = createImageModalController({
    closeButton: elements.imageClose,
    imageElement: elements.modalImage,
    modal: elements.imageModal,
  });

  function setStatus(message, tone = "neutral") {
    elements.status.textContent = message;
    elements.status.className = `mb-4 min-h-6 text-sm ${tone === "error" ? "text-danger-500" : tone === "success" ? "text-emerald-600 dark:text-emerald-300" : "text-stone-500"}`;
  }

  function pageByName(name) {
    const normalized = normalizeText(name);
    return wikiPages.find((page) => normalizeText(page.name) === normalized || (page.aliases || []).some((alias) => normalizeText(alias) === normalized)) || null;
  }

  function characterMap() {
    return new Map(characters.map((character) => [character.id, character]));
  }

  function render() {
    const context = { characterMap: characterMap(), initiative, kind, roles, pageByName };
    elements.grid.innerHTML = documentValue.widgets.map((widget, index) =>
      renderWidgetCard(widget, index, documentValue.widgets.length, context),
    ).join("") + `<button type="button" data-add-widget class="flex min-h-72 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-stone-300 bg-white/35 p-8 text-stone-500 transition hover:border-blood-500 hover:bg-blood-500/5 hover:text-blood-500 dark:border-white/15 dark:bg-white/[.025]" aria-label="Add widget"><span class="flex h-20 w-20 items-center justify-center rounded-full border-2 border-current text-4xl"><i class="bi bi-plus-lg"></i></span><strong class="mt-4 font-display text-xl">Add widget</strong></button>`;
  }

  async function persist(nextDocument, successMessage = "Screen saved.") {
    documentValue = nextDocument;
    render();
    try {
      await saveScreen({ userId: user.id, kind, document: documentValue, local });
      setStatus(local ? "Saved in this browser." : successMessage, "success");
      return true;
    } catch (error) {
      setStatus(`${error.message} Your latest layout remains saved in this browser and will retry later.`, "error");
      return false;
    }
  }

  async function refreshShared({ announce = true } = {}) {
    elements.refresh.disabled = true;
    if (announce) setStatus("Refreshing characters and initiative…");
    try {
      const [loadedCharacters, loadedInitiative, loadedWiki] = await Promise.all([
        loadScreenCharacters().then(refreshCharacterRuntime),
        roles.includes("public-initiative") ? loadScreenInitiative() : Promise.resolve([]),
        roles.includes("wiki") ? loadWikiMentions() : Promise.resolve([]),
      ]);
      characters = loadedCharacters;
      initiative = loadedInitiative;
      wikiPages = loadedWiki;
      render();
      if (announce) setStatus("Shared references refreshed.", "success");
    } catch (error) {
      console.error("Could not refresh screen references:", error);
      if (announce) setStatus("Some shared references could not be refreshed.", "error");
    } finally {
      elements.refresh.disabled = false;
    }
  }

  function availableTypes() {
    return TYPE_ORDER.filter((type) => {
      if (type === "compendium") return roles.includes("compendium") || editorDraft?.type === type;
      if (type === "initiative") return roles.includes("public-initiative") || editorDraft?.type === type;
      return true;
    });
  }

  function renderEditor() {
    elements.editorTitle.textContent = editorExisting ? `Edit ${widgetLabels[editorDraft.type]}` : "Add widget";
    elements.editorType.innerHTML = availableTypes().map((type) => `<option value="${type}"${editorDraft.type === type ? " selected" : ""}>${widgetLabels[type]}</option>`).join("");
    elements.editorFields.innerHTML = editorFields(editorDraft, characters, roles);
    elements.editorError.classList.add("hidden");
  }

  function openEditor(widget = null) {
    editorExisting = Boolean(widget);
    editorDraft = widget ? cloneJSON(widget) : createWidget("character");
    renderEditor();
    editorDialog.open();
  }

  function editorFailure(message) {
    elements.editorError.textContent = message;
    elements.editorError.classList.remove("hidden");
  }

  function formValue(formData, name) {
    return String(formData.get(name) || "").trim();
  }

  async function saveEditor(event) {
    event.preventDefault();
    const data = new FormData(elements.editorForm);
    const widget = createWidget(editorDraft.type, editorDraft.id);
    try {
      if (widget.type === "character") {
        widget.characterId = formValue(data, "characterId");
        if (!widget.characterId) throw new Error("Choose a character.");
      } else if (widget.type === "party") {
        widget.characterIds = data.getAll("characterIds").map(String);
        widget.fields = data.getAll("partyFields").map(String);
        if (!widget.characterIds.length) throw new Error("Choose at least one party member.");
        if (!widget.fields.length) throw new Error("Choose at least one Party Overview field.");
      } else if (["manual", "compendium", "note"].includes(widget.type)) {
        widget.title = formValue(data, "title");
        widget.body = formValue(data, "body");
        if (!widget.title) throw new Error("Enter a title.");
        if (widget.type === "manual") {
          widget.sourceLabel = formValue(data, "sourceLabel");
          widget.sourceUrl = formValue(data, "sourceUrl");
        }
        if (widget.type !== "note") {
          widget.image = formValue(data, "storedImage") || formValue(data, "image");
          if (!validScreenImage(widget.image)) throw new Error("Use a valid HTTP image URL or uploaded image.");
        }
        if (widget.type === "compendium") {
          widget.source = {
            id: formValue(data, "sourceId"),
            category: formValue(data, "sourceCategory"),
            name: formValue(data, "sourceName"),
            publication: formValue(data, "sourcePublication"),
          };
          if (!widget.source.id) throw new Error("Choose a Compendium entry first.");
        }
      } else if (widget.type === "calculator") {
        widget.expression = editorDraft.expression || "";
      }
      const previous = documentValue.widgets.find((item) => item.id === widget.id);
      if (!await persist(replaceWidget(documentValue, widget), "Widget saved.")) return;
      if (local && previous?.type === "calculator" && widget.type !== "calculator") {
        await clearCalculatorHistory({ userId: user.id, kind, widgetId: widget.id, local });
      }
      editorDialog.forceClose("save");
    } catch (error) {
      editorFailure(error.message);
    }
  }

  function sourceBlock(widget) {
    if (widget.type === "manual" && widget.sourceLabel) {
      const link = /^https?:\/\//i.test(widget.sourceUrl || "")
        ? `<a href="${escapeAttribute(widget.sourceUrl)}" target="_blank" rel="noopener noreferrer" class="font-bold text-blood-500">${escapeHTML(widget.sourceLabel)}</a>`
        : escapeHTML(widget.sourceLabel);
      return `<p class="mb-5 text-sm text-stone-500">Source: ${link}</p>`;
    }
    if (widget.type === "compendium" && widget.source?.publication) {
      return `<p class="mb-5 text-sm text-stone-500">Copied from ${escapeHTML(widget.source.name)} · ${escapeHTML(widget.source.publication)}</p>`;
    }
    return "";
  }

  async function openDetail(widget) {
    detailWidgetId = widget.id;
    elements.detailTitle.textContent = widget.title || widgetLabels[widget.type];
    if (["manual", "compendium", "note"].includes(widget.type)) {
      elements.detailBody.innerHTML = `${widget.image ? `<img src="${escapeAttribute(widget.image)}" alt="${escapeAttribute(widget.title)}" data-screen-image role="button" tabindex="0" class="mb-6 max-h-[30rem] w-full cursor-zoom-in rounded-2xl object-cover">` : ""}${sourceBlock(widget)}<div class="wiki-rich">${renderScreenRichText(widget.body, pageByName)}</div>`;
    } else if (widget.type === "party") {
      elements.detailBody.innerHTML = renderPartyDetail(widget, characterMap());
    } else if (widget.type === "calculator") {
      elements.detailBody.innerHTML = `<div class="grid gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]"><section>${calculatorKeypad(widget)}</section><section><div class="flex items-center justify-between gap-3"><h3 class="font-display text-xl font-bold">Calculation history</h3><button type="button" data-clear-history class="text-sm font-bold text-danger-500">Clear history</button></div><ol data-history-list class="mt-4 space-y-2"></ol><button type="button" data-load-history class="mt-4 hidden rounded-xl border border-stone-300 px-4 py-2 text-sm font-bold dark:border-white/15">Load older</button></section></div>`;
    }
    detailDialog.open();
    if (widget.type === "calculator") await loadHistory(true);
  }

  function renderHistory() {
    const list = elements.detailBody.querySelector("[data-history-list]");
    const more = elements.detailBody.querySelector("[data-load-history]");
    if (!list || !more) return;
    list.innerHTML = historyItems.map((item) => `<li class="rounded-xl border border-stone-200 p-3 dark:border-white/10"><code class="break-all text-sm">${escapeHTML(item.expression)}</code><div class="mt-1 flex items-center justify-between gap-3"><strong>= ${escapeHTML(item.result)}</strong><time class="text-xs text-stone-500">${escapeHTML(new Date(item.createdAt).toLocaleString())}</time></div></li>`).join("") || '<li class="rounded-xl border border-dashed border-stone-300 p-6 text-center text-sm text-stone-500 dark:border-white/15">No calculations yet.</li>';
    more.classList.toggle("hidden", !historyCursor);
  }

  async function loadHistory(reset = false) {
    try {
      const result = await loadCalculatorHistory({
        userId: user.id,
        kind,
        widgetId: detailWidgetId,
        before: reset ? null : historyCursor,
        local,
      });
      historyItems = reset ? result.items : [...historyItems, ...result.items];
      historyCursor = result.nextCursor;
      renderHistory();
    } catch (error) {
      setStatus(error.message, "error");
    }
  }

  async function calculate(calculatorRoot) {
    const widgetId = calculatorRoot.dataset.calculator;
    const input = calculatorRoot.querySelector("[data-calculator-expression]");
    const error = calculatorRoot.querySelector("[data-calculator-error]");
    try {
      const expression = input.value.trim();
      const result = formatCalculatorResult(calculateExpression(expression));
      const widget = documentValue.widgets.find((item) => item.id === widgetId && item.type === "calculator");
      if (!widget) return;
      const updated = { ...widget, expression: result };
      documentValue = replaceWidget(documentValue, updated);
      input.value = result;
      error.classList.add("hidden");
      await saveScreen({ userId: user.id, kind, document: documentValue, local });
      const entry = await addCalculatorHistory({ userId: user.id, kind, widgetId, expression, result, local });
      if (detailWidgetId === widgetId) {
        historyItems = [entry, ...historyItems];
        renderHistory();
        const cardInput = elements.grid.querySelector(`[data-widget-id="${CSS.escape(widgetId)}"] [data-calculator-expression]`);
        if (cardInput) cardInput.value = result;
      } else render();
      setStatus("Calculation saved.", "success");
    } catch (caught) {
      error.textContent = caught.message;
      error.classList.remove("hidden");
    }
  }

  async function handleCalculatorKey(button) {
    const root = button.closest("[data-calculator]");
    const input = root.querySelector("[data-calculator-expression]");
    const key = button.dataset.calculatorKey;
    if (key === "=") return calculate(root);
    if (key === "C") input.value = "";
    else if (key === "⌫") input.value = input.value.slice(0, -1);
    else input.value += key;
    input.focus();
  }

  async function openCompendium() {
    compendiumDialog.open();
    elements.compendiumResults.innerHTML = '<div class="py-12 text-center md:col-span-2 xl:col-span-3"><span class="inline-block h-8 w-8 animate-spin rounded-full border-4 border-blood-500 border-r-transparent"></span></div>';
    try {
      if (!compendiumCatalog) compendiumCatalog = await screenCompendiumCatalog();
      elements.compendiumCategory.innerHTML = `<option value="">All categories</option>${compendiumCatalog.manifest.categories.filter((category) => category.count).map((category) => `<option value="${escapeAttribute(category.id)}">${escapeHTML(category.label)}</option>`).join("")}`;
      elements.compendiumPublication.innerHTML = `<option value="">All publications</option>${compendiumCatalog.manifest.publications.map((publication) => `<option value="${escapeAttribute(publication)}">${escapeHTML(publication)}</option>`).join("")}`;
      renderCompendiumResults();
    } catch (error) {
      elements.compendiumResults.innerHTML = `<p class="rounded-xl border border-danger-500/30 bg-danger-500/10 p-4 text-danger-500 md:col-span-2 xl:col-span-3">${escapeHTML(error.message)}</p>`;
    }
  }

  function compendiumMatches() {
    if (!compendiumCatalog) return [];
    return filterScreenCompendium(compendiumCatalog.entries, {
      query: elements.compendiumSearch.value,
      category: elements.compendiumCategory.value,
      publication: elements.compendiumPublication.value,
    });
  }

  function renderCompendiumResults() {
    const matches = compendiumMatches();
    elements.compendiumSummary.textContent = `${matches.length.toLocaleString()} matching entries. Showing first 60.`;
    elements.compendiumResults.innerHTML = matches.slice(0, 60).map((entry) => `<article class="flex flex-col rounded-2xl border border-stone-300 bg-white/70 p-4 dark:border-white/15 dark:bg-white/5"><h3 class="font-display text-lg font-bold">${escapeHTML(entry.name)}</h3><p class="mt-1 text-xs text-stone-500">${escapeHTML(entry.type)} · ${escapeHTML(entry.publication)}</p><p class="mt-3 grow text-sm text-stone-600 dark:text-stone-300">${escapeHTML(entry.summary || "No summary available.")}</p><button type="button" data-choose-compendium="${escapeAttribute(entry.id)}" class="mt-4 rounded-xl bg-blood-500 px-4 py-2 text-sm font-bold text-white">Use this entry</button></article>`).join("") || '<p class="py-12 text-center text-stone-500 md:col-span-2 xl:col-span-3">No matching entries.</p>';
  }

  async function chooseCompendium(id, button) {
    const entry = compendiumCatalog.entries.find((candidate) => candidate.id === id);
    if (!entry) return;
    button.disabled = true;
    try {
      const snapshot = await compendiumReferenceSnapshot(entry, compendiumCatalog.manifest);
      editorDraft = { ...editorDraft, ...snapshot };
      renderEditor();
      compendiumDialog.forceClose("select");
      setStatus("Compendium entry copied into the widget draft.", "success");
    } catch (error) {
      setStatus(error.message, "error");
      button.disabled = false;
    }
  }

  elements.refresh.addEventListener("click", () => refreshShared());
  elements.editorForm.addEventListener("submit", saveEditor);
  elements.editor.querySelectorAll("[data-close-editor]").forEach((button) => button.addEventListener("click", editorDialog.close));
  elements.detail.querySelector("[data-close-detail]").addEventListener("click", detailDialog.close);
  elements.compendium.querySelector("[data-close-compendium]").addEventListener("click", compendiumDialog.close);
  elements.editorType.addEventListener("change", () => {
    const nextType = elements.editorType.value;
    if (nextType === editorDraft.type) return;
    const hasEnteredData = [...elements.editorFields.querySelectorAll("input, select, textarea")].some((control) => (
      ["checkbox", "radio"].includes(control.type) ? control.checked : control.type !== "file" && String(control.value || "").trim()
    ));
    if ((editorExisting || hasEnteredData) && !confirm("Changing widget type discards fields that do not belong to the new type. Continue?")) {
      elements.editorType.value = editorDraft.type;
      return;
    }
    editorDraft = createWidget(nextType, editorDraft.id);
    renderEditor();
  });
  elements.editorFields.addEventListener("click", (event) => {
    if (event.target.closest("[data-open-compendium]")) openCompendium();
    if (event.target.closest("[data-clear-editor-image]")) {
      elements.editorForm.elements.storedImage.value = "";
      elements.editorForm.elements.image.value = "";
      elements.editorForm.elements.imageUpload.value = "";
    }
  });
  elements.editorFields.addEventListener("change", async (event) => {
    if (event.target.name !== "imageUpload" || !event.target.files?.[0]) return;
    try {
      const image = await compressScreenImage(event.target.files[0]);
      elements.editorForm.elements.storedImage.value = image;
      elements.editorForm.elements.image.value = "";
      setStatus("Image compressed and ready. Save the widget to keep it.", "success");
    } catch (error) {
      editorFailure(error.message);
      event.target.value = "";
    }
  });
  [elements.compendiumSearch, elements.compendiumCategory, elements.compendiumPublication].forEach((control) => {
    control.addEventListener(control === elements.compendiumSearch ? "input" : "change", renderCompendiumResults);
  });
  elements.compendiumResults.addEventListener("click", (event) => {
    const button = event.target.closest("[data-choose-compendium]");
    if (button) chooseCompendium(button.dataset.chooseCompendium, button);
  });
  elements.grid.addEventListener("click", async (event) => {
    if (event.target.closest("[data-add-widget]")) return openEditor();
    const card = event.target.closest("[data-widget-id]");
    if (!card) return;
    const widget = documentValue.widgets.find((item) => item.id === card.dataset.widgetId);
    if (!widget) return;
    const move = event.target.closest("[data-move-widget]");
    if (move) return persist(moveWidget(documentValue, widget.id, Number(move.dataset.moveWidget)), "Widget order saved.");
    if (event.target.closest("[data-edit-widget]")) return openEditor(widget);
    if (event.target.closest("[data-remove-widget]")) {
      if (confirm(`Remove ${widgetLabels[widget.type]}?`)) {
        if (local && widget.type === "calculator") {
          await clearCalculatorHistory({ userId: user.id, kind, widgetId: widget.id, local });
        }
        await persist(removeWidget(documentValue, widget.id), "Widget removed.");
      }
      return;
    }
    if (event.target.closest("[data-view-widget]")) return openDetail(widget);
    const calculatorKey = event.target.closest("[data-calculator-key]");
    if (calculatorKey) return handleCalculatorKey(calculatorKey);
  });
  elements.grid.addEventListener("change", async (event) => {
    const input = event.target.closest("[data-calculator-expression]");
    if (!input) return;
    const widgetId = input.closest("[data-calculator]").dataset.calculator;
    const widget = documentValue.widgets.find((item) => item.id === widgetId && item.type === "calculator");
    if (!widget) return;
    documentValue = replaceWidget(documentValue, { ...widget, expression: input.value });
    try {
      await saveScreen({ userId: user.id, kind, document: documentValue, local });
      setStatus("Calculator input saved.", "success");
    } catch (error) {
      setStatus(`${error.message} The input remains saved in this browser.`, "error");
    }
  });
  elements.grid.addEventListener("dragstart", (event) => {
    if (!event.target.closest("[data-widget-drag]")) return;
    draggedWidgetId = event.target.closest("[data-widget-id]")?.dataset.widgetId || "";
    event.dataTransfer.effectAllowed = "move";
  });
  elements.grid.addEventListener("dragover", (event) => {
    if (draggedWidgetId && event.target.closest("[data-widget-id]")) event.preventDefault();
  });
  elements.grid.addEventListener("drop", async (event) => {
    const targetId = event.target.closest("[data-widget-id]")?.dataset.widgetId;
    if (!draggedWidgetId || !targetId) return;
    event.preventDefault();
    await persist(reorderWidget(documentValue, draggedWidgetId, targetId), "Widget order saved.");
    draggedWidgetId = "";
  });
  elements.detailBody.addEventListener("click", async (event) => {
    const calculatorKey = event.target.closest("[data-calculator-key]");
    if (calculatorKey) return handleCalculatorKey(calculatorKey);
    if (event.target.closest("[data-load-history]")) return loadHistory(false);
    if (event.target.closest("[data-clear-history]") && confirm("Clear all history for this Calculator card?")) {
      try {
        await clearCalculatorHistory({ userId: user.id, kind, widgetId: detailWidgetId, local });
        historyItems = [];
        historyCursor = null;
        renderHistory();
      } catch (error) {
        setStatus(error.message, "error");
      }
    }
  });
  elements.detailBody.addEventListener("change", async (event) => {
    const input = event.target.closest("[data-calculator-expression]");
    if (!input) return;
    const widgetId = input.closest("[data-calculator]").dataset.calculator;
    const widget = documentValue.widgets.find((item) => item.id === widgetId && item.type === "calculator");
    if (!widget) return;
    documentValue = replaceWidget(documentValue, { ...widget, expression: input.value });
    try {
      await saveScreen({ userId: user.id, kind, document: documentValue, local });
    } catch (error) {
      setStatus(error.message, "error");
    }
  });
  document.addEventListener("keydown", (event) => {
    const input = event.target.closest?.("[data-calculator-expression]");
    if (input && event.key === "Enter") {
      event.preventDefault();
      calculate(input.closest("[data-calculator]"));
    }
  });
  document.addEventListener("click", (event) => {
    const image = event.target.closest("[data-screen-image]");
    if (image) imageController.open(image);
  });
  document.addEventListener("keydown", (event) => {
    if ((event.key === "Enter" || event.key === " ") && event.target.matches("[data-screen-image]")) {
      event.preventDefault();
      imageController.open(event.target);
    } else if (event.key === "Escape" && !elements.imageModal.classList.contains("hidden")) {
      event.stopPropagation();
      closeImage();
    }
  });
  function closeImage() {
    imageController.close();
    if ([elements.editor, elements.detail, elements.compendium].some((dialog) => !dialog.classList.contains("hidden"))) {
      document.body.classList.add("overflow-hidden");
    }
  }
  elements.imageClose.addEventListener("click", closeImage);
  elements.imageModal.addEventListener("click", (event) => {
    if (event.target === elements.imageModal || event.target === elements.modalImage.parentElement) closeImage();
  });

  setStatus("Loading your screen…");
  documentValue = await loadScreen({ userId: user.id, kind, local });
  await refreshShared({ announce: false });
  render();
  setStatus(local ? "Local mode: this screen is saved in this browser." : "Your private screen is ready.", "success");
}
