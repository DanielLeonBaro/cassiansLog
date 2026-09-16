// Coordinates NPC listing, creation, player visibility, and removal.
import { createDialogController } from "../../shared/js/dialog.js";
import { mountSiteHeader } from "../../shared/js/site-header.js";
import { initializeTheme } from "../../shared/js/theme.js";
import { initializeDiceRoller } from "../../shared/js/dice/index.js";
import { campaignPagePath } from "../../shared/js/campaign-context.js";
import { characterDescription } from "../../char/js/archive/repository.js";
import { importDndBeyondPage, importDndBeyondPdf } from "../../char/js/archive/dnd-beyond-import.js";
import { escapeAttribute, escapeHTML } from "../../shared/js/text.js";
import { initializeCharacterBuilderShell } from "../../char/js/builder/index.js";
import {
  finalizeNpcBuildDraft,
  saveNpcBuildDraft,
  storedNpcBuildDrafts,
} from "./builder-draft-repository.js";
import { createNpc, listNpcs, removeNpc, setNpcPlayerVisible } from "./repository.js";

mountSiteHeader({ activePage: "npcs" });
initializeTheme();
initializeDiceRoller();

const root = document.getElementById("npcs");
const addButton = document.getElementById("add-npc");
const form = document.getElementById("npc-form");
const portraitPreview = document.getElementById("new-npc-portrait");
const importToggle = document.getElementById("dnd-beyond-import-toggle");
const importPanel = document.getElementById("dnd-beyond-import-panel");
const importURL = document.getElementById("dnd-beyond-url");
const importURLButton = document.getElementById("dnd-beyond-url-import");
const importPDFButton = document.getElementById("dnd-beyond-pdf-import");
const importPDFInput = document.getElementById("dnd-beyond-pdf-input");
const importStatus = document.getElementById("dnd-beyond-import-status");
const importSummary = document.getElementById("dnd-beyond-import-summary");
const startingContent = document.getElementById("new-npc-starting-content");
const fallbackPortrait = "shared/assets/bat.ico";
let portrait = fallbackPortrait;
let importedCharacter = null;
let importing = false;
let creating = false;
let canManage = false;
const builder = initializeCharacterBuilderShell({
  saveDraft: saveNpcBuildDraft,
  readDrafts: storedNpcBuildDrafts,
  finalizeDraft: finalizeNpcBuildDraft,
  entityKind: "npc",
  cloudDrafts: false,
});
const dialog = createDialogController(document.getElementById("npc-dialog"), {
  form,
  initialFocus: document.getElementById("new-npc-name"),
  returnFocus: addButton,
  beforeClose() {
    return !creating && !importing;
  },
  onClose() {
    portrait = fallbackPortrait;
    importedCharacter = null;
    importing = false;
    creating = false;
    portraitPreview.src = fallbackPortrait;
    importPanel.classList.add("hidden");
    importToggle.setAttribute("aria-expanded", "false");
    importStatus.textContent = "";
    importSummary.textContent = "";
    importSummary.classList.add("hidden");
    startingContent.classList.remove("hidden");
    importURLButton.disabled = false;
    importPDFButton.disabled = false;
    document.getElementById("create-npc-submit").disabled = false;
    document.getElementById("npc-form-status").textContent = "";
    builder?.reset();
  },
});

function applyImportedNpc(character) {
  importedCharacter = character;
  document.getElementById("new-npc-name").value = character.name || "";
  document.getElementById("new-npc-status").value = character.status || "Active";
  document.getElementById("new-npc-class").value = character.class || "";
  document.getElementById("new-npc-race").value = character.race || "";
  document.getElementById("new-npc-level").value = character.level || 1;
  portrait = character.portrait || fallbackPortrait;
  portraitPreview.src = portrait;
  startingContent.classList.add("hidden");
  importSummary.textContent = `Imported ${character.name}. Review the essentials, then create the hidden NPC.`;
  importSummary.classList.remove("hidden");
}

async function readImport(loadImport, progress) {
  if (importing) return;
  importing = true;
  importURLButton.disabled = true;
  importPDFButton.disabled = true;
  importStatus.textContent = progress;
  try {
    const character = await loadImport();
    applyImportedNpc(character);
    importStatus.textContent = `Ready: ${character.name}, level ${character.level}.`;
    document.getElementById("new-npc-name").focus();
  } catch (error) {
    console.error("Could not import D&D Beyond NPC:", error);
    importStatus.textContent = error instanceof Error ? error.message : "Could not read that D&D Beyond character.";
  } finally {
    importing = false;
    importURLButton.disabled = false;
    importPDFButton.disabled = false;
  }
}

function card(record) {
  const npc = record.document || {};
  const article = document.createElement("article");
  article.className = "group relative flex h-full flex-col overflow-hidden rounded-2xl border border-stone-300/80 bg-white/75 shadow-card backdrop-blur-sm dark:border-white/10 dark:bg-white/[.055]";
  const shown = record.playerVisible === true;
  article.innerHTML = `<img class="aspect-[16/10] w-full object-cover" src="${escapeAttribute(npc.portrait || "shared/assets/bat.ico")}" alt="${escapeAttribute(npc.name || "NPC")} portrait"><div class="flex grow flex-col justify-between p-5"><div><div class="flex flex-wrap gap-2"><span class="inline-flex rounded-full bg-blood-500 px-2.5 py-1 text-xs font-bold text-white">${escapeHTML(npc.status || "NPC")}</span>${canManage ? `<span class="inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${shown ? "bg-emerald-600 text-white" : "bg-stone-300 text-stone-800"}">${shown ? "Shown to players" : "Hidden from players"}</span>` : ""}</div><h3 class="mt-2 font-display text-2xl font-bold"></h3><p class="mt-2 text-stone-500 dark:text-stone-400"></p></div><div class="mt-5 flex flex-wrap gap-2"><a data-open class="inline-flex grow items-center justify-center gap-2 rounded-xl border border-blood-500 bg-blood-500 px-4 py-2 text-sm font-bold text-white">Open tracker <i class="bi bi-arrow-right"></i></a>${canManage ? '<a data-edit class="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-sky-600 text-sky-600" aria-label="Edit NPC"><i class="bi bi-pencil-fill"></i></a><button data-toggle type="button" class="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-amber-500 text-amber-600" aria-label="Toggle player visibility"><i class="bi bi-eye"></i></button><button data-remove type="button" class="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-danger-500 text-danger-500" aria-label="Remove NPC"><i class="bi bi-trash-fill"></i></button>' : ""}</div></div>`;
  article.querySelector("h3").textContent = npc.name || "Unknown NPC";
  article.querySelector("p").textContent = characterDescription(npc) || "Open NPC tracker.";
  article.querySelector("img").addEventListener("error", (event) => { event.currentTarget.src = "shared/assets/bat.ico"; }, { once: true });
  const route = `${campaignPagePath("npc")}${encodeURIComponent(record.id)}/`;
  article.querySelector("[data-open]").href = route;
  if (canManage) {
    article.querySelector("[data-edit]").href = `${route}?edit=1${record.pendingLocal ? "&new=1" : ""}`;
    article.querySelector("[data-toggle]").addEventListener("click", async () => {
      try { await setNpcPlayerVisible(record, !shown); await load(); }
      catch (error) { alert(error.message); }
    });
    article.querySelector("[data-remove]").addEventListener("click", async () => {
      if (!confirm(`Remove ${npc.name || "this NPC"}?`)) return;
      try { await removeNpc(record); await load(); }
      catch (error) { alert(error.message); }
    });
  }
  return article;
}

async function load() {
  try {
    const result = await listNpcs();
    canManage = result.canManage;
    addButton.classList.toggle("hidden", !canManage);
    addButton.classList.toggle("inline-flex", canManage);
    root.replaceChildren(...result.npcs.map(card));
    if (!result.npcs.length) root.innerHTML = `<p class="rounded-2xl border border-dashed border-stone-300 p-8 text-center text-stone-500 md:col-span-2 xl:col-span-3">${canManage ? "No NPCs yet. Create one." : "No NPCs are visible to players yet."}</p>`;
  } catch (error) {
    root.innerHTML = '<p class="rounded-2xl border border-danger-500/30 bg-danger-500/10 p-4 text-danger-600 md:col-span-2 xl:col-span-3">Could not load NPCs.</p>';
    console.error("Could not load NPCs:", error);
  }
}

addButton.addEventListener("click", dialog.open);
document.getElementById("close-npc-dialog").addEventListener("click", dialog.close);
document.getElementById("cancel-npc-dialog").addEventListener("click", dialog.close);
importToggle.addEventListener("click", () => {
  const expanded = importToggle.getAttribute("aria-expanded") === "true";
  importToggle.setAttribute("aria-expanded", String(!expanded));
  importPanel.classList.toggle("hidden", expanded);
  if (!expanded) importURL.focus();
});
importURLButton.addEventListener("click", () => readImport(
  () => importDndBeyondPage(importURL.value),
  "Reading the public character page…",
));
importPDFButton.addEventListener("click", () => importPDFInput.click());
importPDFInput.addEventListener("change", () => {
  const file = importPDFInput.files?.[0];
  if (file) readImport(() => importDndBeyondPdf(file), `Reading ${file.name}…`);
});
document.getElementById("new-npc-portrait-button").addEventListener("click", () => document.getElementById("new-npc-portrait-input").click());
document.getElementById("new-npc-portrait-input").addEventListener("change", (event) => {
  const file = event.currentTarget.files?.[0];
  if (!file?.type.startsWith("image/")) return;
  const reader = new FileReader();
  reader.addEventListener("load", () => { portrait = String(reader.result); document.getElementById("new-npc-portrait").src = portrait; });
  reader.readAsDataURL(file);
});
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submit = document.getElementById("create-npc-submit");
  creating = true;
  submit.disabled = true;
  submit.innerHTML = '<span class="h-4 w-4 animate-spin rounded-full border-2 border-white border-r-transparent" aria-hidden="true"></span> Creating…';
  document.getElementById("npc-form-status").textContent = "Creating the hidden NPC and saving it to the campaign…";
  try {
    const result = await createNpc({
      name: document.getElementById("new-npc-name").value,
      status: document.getElementById("new-npc-status").value,
      portrait,
      class: document.getElementById("new-npc-class").value,
      race: document.getElementById("new-npc-race").value,
      level: document.getElementById("new-npc-level").value,
      starterMode: form.elements.starterMode.value,
      importedCharacter,
    });
    if (!result.cloudSaved) alert("NPC saved in this browser, but cloud save failed. Save again from the editor to retry.");
    location.href = `${campaignPagePath("npc")}${encodeURIComponent(result.record.document.id)}/?new=1&edit=1`;
  } catch (error) {
    creating = false;
    document.getElementById("npc-form-status").textContent = error.message;
    submit.disabled = false;
    submit.innerHTML = '<i class="bi bi-arrow-right"></i> Create & continue';
  }
});

await load();
