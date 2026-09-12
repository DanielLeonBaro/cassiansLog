// Coordinates NPC listing, creation, player visibility, and removal.
import { createDialogController } from "../../shared/js/dialog.js";
import { mountSiteHeader } from "../../shared/js/site-header.js";
import { initializeTheme } from "../../shared/js/theme.js";
import { initializeDiceRoller } from "../../shared/js/dice/index.js";
import { campaignPagePath } from "../../shared/js/campaign-context.js";
import { characterDescription } from "../../char/js/archive/repository.js";
import { escapeAttribute, escapeHTML } from "../../shared/js/text.js";
import { createNpc, listNpcs, removeNpc, setNpcPlayerVisible } from "./repository.js";

mountSiteHeader({ activePage: "npcs" });
initializeTheme();
initializeDiceRoller();

const root = document.getElementById("npcs");
const addButton = document.getElementById("add-npc");
const form = document.getElementById("npc-form");
const dialog = createDialogController(document.getElementById("npc-dialog"), {
  form,
  initialFocus: document.getElementById("new-npc-name"),
  returnFocus: addButton,
});
let portrait = "shared/assets/bat.ico";
let canManage = false;

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
  submit.disabled = true;
  try {
    const result = await createNpc({
      name: document.getElementById("new-npc-name").value,
      status: document.getElementById("new-npc-status").value,
      portrait,
      class: document.getElementById("new-npc-class").value,
      race: document.getElementById("new-npc-race").value,
      level: document.getElementById("new-npc-level").value,
      starterMode: form.elements.starterMode.value,
    });
    if (!result.cloudSaved) alert("NPC saved in this browser, but cloud save failed. Save again from the editor to retry.");
    location.href = `${campaignPagePath("npc")}${encodeURIComponent(result.record.document.id)}/?new=1&edit=1`;
  } catch (error) {
    document.getElementById("npc-form-status").textContent = error.message;
    submit.disabled = false;
  }
});

await load();
