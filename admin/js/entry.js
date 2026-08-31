// Coordinates Admin settings, users, themes, and local or D1 persistence.
import { initializeTheme } from "../../shared/js/theme.js";
import { escapeHTML } from "../../shared/js/text.js";
import {
  isLocalRuntimeHost,
  persistLocalRuntimeSettings,
  runtimeSettingsReady,
} from "../../shared/js/settings.js";
import { logout } from "../../shared/js/auth-client.js";
import { createDialogController } from "../../shared/js/dialog.js";
import { DEFAULT_BACKGROUND_ID } from "../../shared/js/background-catalog.js";
import {
  BASE_THEME_ID,
  normalizeHex,
  readableForeground,
  sortThemes,
} from "../../shared/js/theme-catalog.js";

const localMode = isLocalRuntimeHost();
const accountRoleLabels = {
  characters: "Characters",
  "player-screen": "Player Screen",
  "dm-screen": "DM Screen",
  wiki: "Wiki",
  compendium: "Compendium",
  "combat-loot": "Combat & Loot",
  "public-initiative": "Public Initiative",
  music: "Music",
};
const sectionLabels = {
  characters: "Characters navigation",
  "player-screen": "Player Screen navigation",
  "dm-screen": "DM Screen navigation",
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
const themeRoot = document.getElementById("theme-settings");
const themeUnavailable = document.getElementById("theme-admin-unavailable");
const addThemeButton = document.getElementById("add-theme");
const themeEditorRoot = document.getElementById("theme-editor-dialog");
const themeEditorForm = document.getElementById("theme-editor-form");
let themeEditorReturnFocus = addThemeButton;
const themeEditor = createDialogController(themeEditorRoot, {
  initialFocus: () => document.getElementById("theme-editor-name"),
  returnFocus: () => themeEditorReturnFocus,
});
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
    ? "border-danger-500/40 bg-danger-500/10 text-danger-600 dark:text-red-300"
    : kind === "success"
      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
      : "border-stone-300 bg-white/70 dark:border-white/10 dark:bg-white/[.05]"}`;
}

async function adminRequest(path = "", options = {}) {
  if (localMode) {
    const method = options.method || "GET";
    if (!path && method === "GET") {
      const [settings, characters] = await Promise.all([runtimeSettingsReady, localCharacters()]);
      return { settings, characters, users: [], themes: [], themeStorageAvailable: false };
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
            <input type="checkbox" data-user-role="${role}" class="accent-red-700"${user.roles.includes(role) ? " checked" : ""}${["characters", "player-screen"].includes(role) ? " disabled" : ""}> ${label}
          </label>`).join("")}
      </fieldset>
      ${snapshot?.themeStorageAvailable === false
        ? '<p class="mt-4 border-t border-stone-300 pt-4 text-sm text-stone-500 dark:border-white/10 dark:text-stone-400">Theme assignment requires migration 0008 and is currently unavailable.</p>'
        : `<label class="mt-4 block border-t border-stone-300 pt-4 dark:border-white/10"><span class="mb-1 block text-sm font-bold">Theme</span>
        <select data-user-theme class="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm font-bold dark:border-white/15 dark:bg-stone-900">
          ${(snapshot?.themes || []).map((theme) => `<option value="${escapeHTML(theme.id)}"${(user.themePreference?.themeId || BASE_THEME_ID) === theme.id ? " selected" : ""}>${escapeHTML(theme.name)}</option>`).join("")}
        </select>
        <small class="mt-1 block text-stone-500 dark:text-stone-400">Keeps this user's Standard/Reversed and font choices. Latest save wins.</small>
      </label>`}
      <div class="mt-4 flex flex-col gap-3 border-t border-stone-300 pt-4 dark:border-white/10 sm:flex-row sm:items-end">
        <label class="grow"><span class="mb-1 block text-sm font-bold">New password</span><input type="password" data-user-password minlength="10" autocomplete="new-password" class="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 dark:border-white/15 dark:bg-white/5" placeholder="10+ characters, number, special character"></label>
        <button type="button" data-reset-password class="rounded-xl border border-blood-500 px-4 py-2 text-sm font-bold text-blood-500">Reset password</button>
      </div>
    </article>`).join("") || '<p class="text-sm text-stone-500">No user accounts found.</p>';
}

function themeSwatch(label, name, hex) {
  return `<div class="grid grid-cols-[2rem_minmax(0,1fr)] items-center gap-2"><span class="h-8 w-8 rounded-lg border border-black/15" style="background:${escapeHTML(hex)}"></span><span class="min-w-0"><strong class="block truncate text-xs">${label}: ${escapeHTML(name)}</strong><code class="text-xs text-stone-500 dark:text-stone-400">${escapeHTML(hex)}</code></span></div>`;
}

function renderThemes(themes = []) {
  const available = !localMode && snapshot?.themeStorageAvailable !== false;
  themeUnavailable.classList.toggle("hidden", available);
  addThemeButton.disabled = !available;
  addThemeButton.classList.toggle("opacity-50", !available);
  if (!available) {
    themeRoot.replaceChildren();
    return;
  }
  themeRoot.innerHTML = themes.map((theme) => `
    <article data-admin-theme="${escapeHTML(theme.id)}" class="rounded-2xl border border-stone-300 p-4 dark:border-white/15">
      <div class="flex items-start justify-between gap-3"><h3 class="font-display text-lg font-bold">${escapeHTML(theme.name)}</h3>${theme.protected
        ? '<span class="rounded-full bg-theme-surface-strong px-2 py-1 text-xs font-bold">Protected</span>'
        : `<span class="flex gap-1"><button type="button" data-edit-theme class="rounded-lg border border-stone-300 px-2 py-1 text-xs font-bold hover:border-blood-500 hover:text-blood-500 dark:border-white/15"><i class="bi bi-pencil mr-1"></i>Edit</button><button type="button" data-remove-theme class="rounded-lg border border-danger-500 px-2 py-1 text-xs font-bold text-danger-500 hover:bg-danger-500 hover:text-white"><i class="bi bi-trash mr-1"></i>Remove</button></span>`}</div>
      <div class="mt-3 grid gap-2 sm:grid-cols-2">${themeSwatch("Background", theme.backgroundName, theme.backgroundHex)}${themeSwatch("Accent", theme.accentName, theme.accentHex)}</div>
      <p class="mt-3 text-xs text-stone-500 dark:text-stone-400">People using this theme: ${Number(theme.peopleUsingTheme) || 0}</p>
    </article>`).join("");
}

function themeFormValue() {
  return {
    name: document.getElementById("theme-editor-name").value,
    backgroundName: document.getElementById("theme-editor-background-name").value,
    backgroundHex: document.getElementById("theme-editor-background-hex").value,
    accentName: document.getElementById("theme-editor-accent-name").value,
    accentHex: document.getElementById("theme-editor-accent-hex").value,
  };
}

function updateThemePreview() {
  const backgroundHex = normalizeHex(document.getElementById("theme-editor-background-hex").value) || "#18181B";
  const accentHex = normalizeHex(document.getElementById("theme-editor-accent-hex").value) || "#B83B35";
  const preview = document.getElementById("theme-editor-preview");
  preview.style.backgroundColor = backgroundHex;
  preview.style.color = readableForeground(backgroundHex);
  preview.style.borderColor = accentHex;
  preview.innerHTML = `<span><span class="block">Live preview</span><span class="mt-2 inline-block rounded-lg px-3 py-1 text-sm" style="background:${accentHex};color:${readableForeground(accentHex)}">Accent</span></span>`;
}

function openThemeEditor(theme = null, trigger = addThemeButton) {
  themeEditorReturnFocus = trigger;
  document.getElementById("theme-editor-title").textContent = theme ? "Edit Theme" : "Add Theme";
  document.getElementById("theme-editor-id").value = theme?.id || "";
  document.getElementById("theme-editor-name").value = theme?.name || "";
  document.getElementById("theme-editor-background-name").value = theme?.backgroundName || "";
  document.getElementById("theme-editor-background-hex").value = theme?.backgroundHex || "#18181B";
  document.getElementById("theme-editor-background-color").value = (theme?.backgroundHex || "#18181B").toLowerCase();
  document.getElementById("theme-editor-accent-name").value = theme?.accentName || "";
  document.getElementById("theme-editor-accent-hex").value = theme?.accentHex || "#B83B35";
  document.getElementById("theme-editor-accent-color").value = (theme?.accentHex || "#B83B35").toLowerCase();
  document.getElementById("theme-editor-status").textContent = "";
  updateThemePreview();
  themeEditor.open();
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
    renderThemes(snapshot.themes);
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
  const themeSelect = event.target.closest("[data-user-theme]");
  if (themeSelect) {
    const card = themeSelect.closest("[data-user]");
    const previousPreference = snapshot.users.find((item) => item.id === card.dataset.user)?.themePreference;
    const previous = previousPreference?.themeId || BASE_THEME_ID;
    themeSelect.disabled = true;
    try {
      const result = await adminRequest(`/users/${encodeURIComponent(card.dataset.user)}/theme`, {
        method: "PUT",
        body: JSON.stringify({ themeId: themeSelect.value }),
      });
      const user = snapshot.users.find((item) => item.id === card.dataset.user);
      if (user) user.themePreference = result.themePreference;
      snapshot.themes.forEach((theme) => {
        if (previousPreference && theme.id === previous) theme.peopleUsingTheme = Math.max(0, (Number(theme.peopleUsingTheme) || 0) - 1);
        if (theme.id === themeSelect.value) theme.peopleUsingTheme = (Number(theme.peopleUsingTheme) || 0) + 1;
      });
      renderThemes(snapshot.themes);
      setStatus("User theme saved. Their reverse and font choices were preserved.", "success");
    } catch (error) {
      themeSelect.value = previous;
      setStatus(error.message, "error");
    } finally {
      themeSelect.disabled = false;
    }
    return;
  }
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

addThemeButton.addEventListener("click", () => openThemeEditor());
themeEditorRoot.querySelectorAll("[data-close-theme-editor]").forEach((button) => {
  button.addEventListener("click", themeEditor.close);
});

themeEditorForm.addEventListener("input", (event) => {
  const pairs = {
    "theme-editor-background-color": "theme-editor-background-hex",
    "theme-editor-accent-color": "theme-editor-accent-hex",
    "theme-editor-background-hex": "theme-editor-background-color",
    "theme-editor-accent-hex": "theme-editor-accent-color",
  };
  const pairedId = pairs[event.target.id];
  if (pairedId) {
    const normalized = normalizeHex(event.target.value);
    if (event.target.type === "color") document.getElementById(pairedId).value = normalized;
    else if (normalized) document.getElementById(pairedId).value = normalized.toLowerCase();
  }
  updateThemePreview();
});

themeEditorForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const id = document.getElementById("theme-editor-id").value;
  const saveButton = document.getElementById("save-theme");
  const editorStatus = document.getElementById("theme-editor-status");
  saveButton.disabled = true;
  editorStatus.textContent = "Saving theme...";
  try {
    const result = await adminRequest(id ? `/themes/${encodeURIComponent(id)}` : "/themes", {
      method: id ? "PUT" : "POST",
      body: JSON.stringify(themeFormValue()),
    });
    const existing = snapshot.themes.find((theme) => theme.id === result.theme.id);
    result.theme.peopleUsingTheme = existing?.peopleUsingTheme || 0;
    snapshot.themes = sortThemes([
      ...snapshot.themes.filter((theme) => theme.id !== result.theme.id),
      result.theme,
    ]);
    renderThemes(snapshot.themes);
    renderUsers(snapshot.users);
    themeEditor.forceClose("saved");
    setStatus(`${result.theme.name} ${id ? "updated" : "added"}.`, "success");
  } catch (error) {
    editorStatus.textContent = error.message;
  } finally {
    saveButton.disabled = false;
  }
});

themeRoot.addEventListener("click", async (event) => {
  const card = event.target.closest("[data-admin-theme]");
  if (!card) return;
  const theme = snapshot.themes.find((item) => item.id === card.dataset.adminTheme);
  if (!theme || theme.protected) return;
  const edit = event.target.closest("[data-edit-theme]");
  if (edit) {
    openThemeEditor(theme, edit);
    return;
  }
  const remove = event.target.closest("[data-remove-theme]");
  if (!remove) return;
  const people = Number(theme.peopleUsingTheme) || 0;
  const warning = `People using this theme: ${people}. Removing it will return them to Cassian’s Classic.`;
  if (!globalThis.confirm(`${warning}\n\nRemove ${theme.name}?`)) return;
  remove.disabled = true;
  try {
    const result = await adminRequest(`/themes/${encodeURIComponent(theme.id)}${people ? "?confirm=1" : ""}`, {
      method: "DELETE",
    });
    snapshot.themes = snapshot.themes.filter((item) => item.id !== theme.id);
    snapshot.users.forEach((user) => {
      if (user.themePreference?.themeId === theme.id) {
        user.themePreference = {
          themeId: BASE_THEME_ID,
          reversed: false,
          fontMode: "auto",
          backgroundId: DEFAULT_BACKGROUND_ID,
          updatedAt: null,
        };
      }
    });
    renderThemes(snapshot.themes);
    renderUsers(snapshot.users);
    setStatus(`${theme.name} removed. ${result.resetUsers || 0} user${result.resetUsers === 1 ? "" : "s"} returned to Cassian’s Classic.`, "success");
  } catch (error) {
    remove.disabled = false;
    setStatus(error.message, "error");
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
