import { initializeTheme } from "../../shared/js/theme.js";
import { escapeHTML } from "../../shared/js/text.js";
import {
  isLocalRuntimeHost,
  persistLocalRuntimeSettings,
  runtimeSettingsReady,
} from "../../shared/js/settings.js";
import { logout } from "../../shared/js/auth-client.js";

const localMode = isLocalRuntimeHost();
const accountRoleLabels = {
  characters: "Characters",
  wiki: "Wiki",
  compendium: "Compendium",
  "combat-loot": "Combat & Loot",
  "public-initiative": "Public Initiative",
  music: "Music",
};
const sectionLabels = {
  characters: "Characters navigation",
  "combat-loot": "Combat & Loot navigation",
  "public-initiative": "Public Initiative navigation",
  compendium: "Compendium navigation",
  music: "Music navigation",
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
const characterStyleRoot = document.getElementById("character-style-settings");
const userRoot = document.getElementById("user-settings");
const openWrites = document.getElementById("open-writes");
const characterStyleInputs = [...document.querySelectorAll('[name="character-sheet-style"]')];
let snapshot = null;

async function localCharacters() {
  let stored = {};
  try {
    const parsed = JSON.parse(localStorage.getItem("dnd-characters") || "{}");
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) stored = parsed;
  } catch (error) {
    console.warn("Local characters could not be read for Admin style settings.", error);
  }

  let bundled = [];
  try {
    const catalogResponse = await fetch("char/catalog.json");
    if (catalogResponse.ok) {
      const catalog = await catalogResponse.json();
      bundled = await Promise.all((catalog.characters || []).map(async (id) => {
        const response = await fetch(`char/${encodeURIComponent(id)}/character.json`);
        const character = response.ok ? await response.json() : {};
        return { id, name: character.name || id, source: "bundled", active: true };
      }));
    }
  } catch (error) {
    console.warn("Bundled characters could not be listed for Admin style settings.", error);
  }

  const characters = new Map(bundled.map((character) => [character.id, character]));
  Object.entries(stored).forEach(([id, character]) => {
    if (!/^[a-z0-9][a-z0-9-]{0,127}$/i.test(id)) return;
    characters.set(id, {
      id,
      name: character?.name || characters.get(id)?.name || id,
      source: characters.has(id) ? "bundled/local" : "local",
      active: true,
    });
  });
  return [...characters.values()].sort((left, right) => left.name.localeCompare(right.name));
}

function setStatus(message, kind = "neutral") {
  status.textContent = message;
  status.className = `mb-6 rounded-2xl border p-4 text-sm ${kind === "error"
    ? "border-blood-500/40 bg-blood-500/10 text-blood-600 dark:text-red-300"
    : kind === "success"
      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
      : "border-stone-300 bg-white/70 dark:border-white/10 dark:bg-white/[.05]"}`;
}

async function adminRequest(path = "", options = {}) {
  if (localMode) {
    const method = options.method || "GET";
    if (!path && method === "GET") {
      const [settings, characters] = await Promise.all([runtimeSettingsReady, localCharacters()]);
      return { settings, characters };
    }
    if (path === "/settings" && method === "PUT") {
      return { ok: true, settings: persistLocalRuntimeSettings(JSON.parse(options.body)) };
    }
    throw new Error("Character availability requires D1 and cannot be changed in local mode.");
  }
  const response = await fetch(`api/admin${path}`, {
    ...options,
    headers: {
      accept: "application/json",
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

function renderUsers(users = []) {
  if (localMode) {
    userRoot.innerHTML = '<p class="text-sm text-stone-500">User accounts require D1 and are not available in local static mode.</p>';
    return;
  }
  userRoot.innerHTML = users.map((user) => `
    <article class="rounded-2xl border border-stone-300 p-4 dark:border-white/15" data-user="${escapeHTML(user.id)}">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div><strong>${escapeHTML(user.email)}</strong>${user.isPrimaryAdmin ? '<span class="ml-2 rounded-full bg-blood-500 px-2 py-0.5 text-xs font-bold text-white">Primary admin</span>' : ""}</div>
        <small class="text-stone-500 dark:text-stone-400">Created ${escapeHTML(new Date(user.createdAt).toLocaleDateString())}</small>
      </div>
      <fieldset class="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3"${user.isPrimaryAdmin ? " disabled" : ""}>
        <legend class="mb-2 text-sm font-bold">Visible pages / roles</legend>
        ${Object.entries(accountRoleLabels).map(([role, label]) => `
          <label class="flex items-center gap-2 rounded-lg border border-stone-300 px-3 py-2 text-sm dark:border-white/10">
            <input type="checkbox" data-user-role="${role}" class="accent-red-700"${user.roles.includes(role) ? " checked" : ""}${role === "characters" ? " disabled" : ""}> ${label}
          </label>`).join("")}
      </fieldset>
      <div class="mt-4 flex flex-col gap-3 border-t border-stone-300 pt-4 dark:border-white/10 sm:flex-row sm:items-end">
        <label class="grow"><span class="mb-1 block text-sm font-bold">New password</span><input type="password" data-user-password minlength="10" autocomplete="new-password" class="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 dark:border-white/15 dark:bg-white/5" placeholder="10+ characters, number, special character"></label>
        <button type="button" data-reset-password class="rounded-xl border border-blood-500 px-4 py-2 text-sm font-bold text-blood-500">Reset password</button>
      </div>
    </article>`).join("") || '<p class="text-sm text-stone-500">No user accounts found.</p>';
}

function renderSections(sections) {
  sectionRoot.innerHTML = Object.entries(sectionLabels).map(([id, label]) => `
    <label class="flex cursor-pointer items-center gap-3 rounded-xl border border-stone-300 px-4 py-3 dark:border-white/15">
      <input type="checkbox" data-section="${id}" class="h-5 w-5 accent-red-700"${sections[id] !== false ? " checked" : ""}>
      <span class="font-bold">${label}</span>
    </label>`).join("");
}

function renderCharacters(characters) {
  if (localMode) {
    characterRoot.innerHTML = '<p class="text-sm text-stone-500">Character availability requires D1 and is not changed in local mode.</p>';
    return;
  }
  characterRoot.innerHTML = characters.map((character) => `
    <label class="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-stone-300 px-4 py-3 dark:border-white/15">
      <span><strong class="block">${escapeHTML(character.name)}</strong><small class="text-stone-500 dark:text-stone-400">${escapeHTML(character.id)} · ${escapeHTML(character.source)}</small></span>
      <input type="checkbox" data-character="${escapeHTML(character.id)}" class="h-5 w-5 accent-red-700"${character.active ? " checked" : ""}>
    </label>`).join("") || '<p class="text-sm text-stone-500">No characters are stored in D1.</p>';
}

function renderCharacterStyles(characters, overrides = {}) {
  characterStyleRoot.innerHTML = characters.map((character) => {
    const selected = overrides[character.id] || "default";
    return `
      <label class="flex items-center justify-between gap-4 rounded-xl border border-stone-300 px-4 py-3 dark:border-white/15">
        <span class="min-w-0"><strong class="block truncate">${escapeHTML(character.name)}</strong><small class="text-stone-500 dark:text-stone-400">${escapeHTML(character.id)}</small></span>
        <select data-character-style="${escapeHTML(character.id)}" class="min-w-32 rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm font-bold dark:border-white/15 dark:bg-stone-900">
          <option value="default"${selected === "default" ? " selected" : ""}>Use default</option>
          <option value="v1"${selected === "v1" ? " selected" : ""}>Style v1</option>
          <option value="v2"${selected === "v2" ? " selected" : ""}>Style v2</option>
        </select>
      </label>`;
  }).join("") || '<p class="text-sm text-stone-500">No characters are currently available for individual overrides.</p>';
}

async function unlock() {
  try {
    snapshot = await adminRequest();
    openWrites.checked = snapshot.settings.openWrites;
    const selectedStyle = characterStyleInputs.find(
      (input) => input.value === snapshot.settings.characterSheetStyle,
    ) || characterStyleInputs[0];
    selectedStyle.checked = true;
    renderSections(snapshot.settings.sections);
    renderCharacterStyles(snapshot.characters, snapshot.settings.characterSheetStyleOverrides);
    renderCharacters(snapshot.characters);
    renderUsers(snapshot.users);
    content.classList.remove("hidden");
    setStatus(localMode
      ? "Local mode: settings are stored in this browser's localStorage. No password or D1 connection is used."
      : "Connected to the shared D1 configuration.", "success");
  } catch (error) {
    content.classList.add("hidden");
    if (error.status === 401) location.replace("login/?error=Primary%20administrator%20access%20required.");
    else setStatus(error.message, "error");
  }
}

document.getElementById("save-settings").addEventListener("click", async () => {
  const sections = Object.fromEntries([...sectionRoot.querySelectorAll("[data-section]")]
    .map((input) => [input.dataset.section, input.checked]));
  const characterSheetStyle = characterStyleInputs.find((input) => input.checked)?.value || "v1";
  const characterSheetStyleOverrides = { ...(snapshot.settings.characterSheetStyleOverrides || {}) };
  characterStyleRoot.querySelectorAll("[data-character-style]").forEach((select) => {
    if (select.value === "default") delete characterSheetStyleOverrides[select.dataset.characterStyle];
    else characterSheetStyleOverrides[select.dataset.characterStyle] = select.value;
  });
  try {
    const result = await adminRequest("/settings", {
      method: "PUT",
      body: JSON.stringify({
        sections,
        openWrites: openWrites.checked,
        characterSheetStyle,
        characterSheetStyleOverrides,
      }),
    });
    snapshot.settings = result.settings;
    setStatus(localMode
      ? "Settings saved to localStorage. Other local pages will use them on their next load."
      : "Settings saved to D1. Other pages will use them on their next load.", "success");
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
  logout();
});

userRoot.addEventListener("change", async (event) => {
  const input = event.target.closest("[data-user-role]");
  if (!input) return;
  const card = input.closest("[data-user]");
  const roles = [...card.querySelectorAll("[data-user-role]:checked")].map((item) => item.dataset.userRole);
  card.querySelectorAll("input, button").forEach((control) => { control.disabled = true; });
  try {
    const result = await adminRequest(`/users/${encodeURIComponent(card.dataset.user)}/roles`, {
      method: "PUT",
      body: JSON.stringify({ roles }),
    });
    const user = snapshot.users.find((item) => item.id === card.dataset.user);
    if (user) user.roles = result.roles;
    setStatus("User roles saved.", "success");
  } catch (error) {
    input.checked = !input.checked;
    setStatus(error.message, "error");
  } finally {
    card.querySelectorAll("input, button").forEach((control) => { control.disabled = false; });
    card.querySelector('[data-user-role="characters"]').disabled = true;
  }
});

userRoot.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-reset-password]");
  if (!button) return;
  const card = button.closest("[data-user]");
  const passwordInput = card.querySelector("[data-user-password]");
  if (!passwordInput.value) return setStatus("Enter a new password first.", "error");
  button.disabled = true;
  try {
    await adminRequest(`/users/${encodeURIComponent(card.dataset.user)}/password`, {
      method: "PUT",
      body: JSON.stringify({ password: passwordInput.value }),
    });
    passwordInput.value = "";
    setStatus("Password reset. That account has been signed out on every device.", "success");
  } catch (error) {
    setStatus(error.message, "error");
  } finally {
    button.disabled = false;
  }
});

if (localMode) {
  document.getElementById("admin-lock").hidden = true;
  document.getElementById("admin-description").textContent = "Runtime settings are saved to this browser's localStorage on localhost; D1 is not required.";
}

unlock();
