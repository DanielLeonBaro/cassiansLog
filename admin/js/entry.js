import { initializeTheme } from "../../shared/js/theme.js";

const TOKEN_KEY = "cassianslog-admin-token";
const sectionLabels = {
  characters: "Characters navigation",
  "combat-loot": "Combat & Loot navigation",
  compendium: "Compendium navigation",
  wiki: "Wiki navigation",
  "character-overview": "Character overview",
  "character-stats": "Character stats",
  "hit-points": "Hit points",
  combat: "Character combat controls",
  spellcasting: "Spellcasting",
  "prepared-spells": "Prepared spells",
  "all-possibilities": "All possibilities",
  inventory: "Inventory",
  notes: "Notes",
};

initializeTheme();

const status = document.getElementById("admin-status");
const content = document.getElementById("admin-content");
const sectionRoot = document.getElementById("section-settings");
const characterRoot = document.getElementById("character-settings");
const openWrites = document.getElementById("open-writes");
let token = sessionStorage.getItem(TOKEN_KEY) || "";
let snapshot = null;

function setStatus(message, kind = "neutral") {
  status.textContent = message;
  status.className = `mb-6 rounded-2xl border p-4 text-sm ${kind === "error"
    ? "border-blood-500/40 bg-blood-500/10 text-blood-600 dark:text-red-300"
    : kind === "success"
      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
      : "border-stone-300 bg-white/70 dark:border-white/10 dark:bg-white/[.05]"}`;
}

async function adminRequest(path = "", options = {}) {
  const response = await fetch(`api/admin${path}`, {
    ...options,
    headers: {
      accept: "application/json",
      authorization: `Bearer ${token}`,
      ...(options.body ? { "content-type": "application/json" } : {}),
      ...options.headers,
    },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const error = new Error(body.error || `Admin request failed (${response.status}).`);
    error.status = response.status;
    throw error;
  }
  return response.json();
}

function renderSections(sections) {
  sectionRoot.innerHTML = Object.entries(sectionLabels).map(([id, label]) => `
    <label class="flex cursor-pointer items-center gap-3 rounded-xl border border-stone-300 px-4 py-3 dark:border-white/15">
      <input type="checkbox" data-section="${id}" class="h-5 w-5 accent-red-700"${sections[id] !== false ? " checked" : ""}>
      <span class="font-bold">${label}</span>
    </label>`).join("");
}

function renderCharacters(characters) {
  characterRoot.innerHTML = characters.map((character) => `
    <label class="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-stone-300 px-4 py-3 dark:border-white/15">
      <span><strong class="block">${escapeHTML(character.name)}</strong><small class="text-stone-500 dark:text-stone-400">${escapeHTML(character.id)} · ${escapeHTML(character.source)}</small></span>
      <input type="checkbox" data-character="${escapeHTML(character.id)}" class="h-5 w-5 accent-red-700"${character.active ? " checked" : ""}>
    </label>`).join("") || '<p class="text-sm text-stone-500">No characters are stored in D1.</p>';
}

async function unlock() {
  if (!token) token = prompt("Enter the Cassian's Log admin password:")?.trim() || "";
  if (!token) return setStatus("Admin access was cancelled.", "error");
  try {
    snapshot = await adminRequest();
    sessionStorage.setItem(TOKEN_KEY, token);
    openWrites.checked = snapshot.settings.openWrites;
    renderSections(snapshot.settings.sections);
    renderCharacters(snapshot.characters);
    content.classList.remove("hidden");
    setStatus("Connected to the shared D1 configuration.", "success");
  } catch (error) {
    token = "";
    sessionStorage.removeItem(TOKEN_KEY);
    content.classList.add("hidden");
    setStatus(error.status === 401 ? "That admin password was rejected. Refresh to try again." : error.message, "error");
  }
}

document.getElementById("save-settings").addEventListener("click", async () => {
  const sections = Object.fromEntries([...sectionRoot.querySelectorAll("[data-section]")]
    .map((input) => [input.dataset.section, input.checked]));
  try {
    const result = await adminRequest("/settings", {
      method: "PUT",
      body: JSON.stringify({ sections, openWrites: openWrites.checked }),
    });
    snapshot.settings = result.settings;
    setStatus("Settings saved to D1. Other pages will use them on their next load.", "success");
  } catch (error) {
    setStatus(error.message, "error");
  }
});

characterRoot.addEventListener("change", async (event) => {
  const input = event.target.closest("[data-character]");
  if (!input) return;
  input.disabled = true;
  try {
    await adminRequest(`/characters/${encodeURIComponent(input.dataset.character)}`, {
      method: "PUT",
      body: JSON.stringify({ active: input.checked }),
    });
    setStatus(`${input.dataset.character} is now ${input.checked ? "available" : "hidden"}.`, "success");
  } catch (error) {
    input.checked = !input.checked;
    setStatus(error.message, "error");
  } finally {
    input.disabled = false;
  }
});

document.getElementById("admin-lock").addEventListener("click", () => {
  token = "";
  sessionStorage.removeItem(TOKEN_KEY);
  content.classList.add("hidden");
  setStatus("Admin panel locked. Refresh to sign in again.");
});

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
  })[character]);
}

unlock();
