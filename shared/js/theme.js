// Loads available themes, applies palette variables, and wires the theme toggle.
import { currentSession } from "./auth-client.js";
import { createDialogController } from "./dialog.js";
import {
  BASE_THEME_ID,
  BUILT_IN_THEMES,
  contrastRatio,
  hexToRGB,
  normalizeThemeInput,
  normalizeThemePreference,
  readableForeground,
  sortThemes,
  themeById,
} from "./theme-catalog.js";

export const THEME_KEY = "dnd-theme";
export const THEME_REVERSED_KEY = "dnd-theme-reversed";
export const THEME_FONT_KEY = "dnd-theme-font";
export const THEME_CATALOG_KEY = "dnd-theme-catalog";

let catalog = cachedCatalog();
let preference = localPreference();
let dialogController = null;
let currentUser = null;
let cloudQueue = Promise.resolve();
let saveVersion = 0;

function storage() {
  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

function localPreference() {
  const local = storage();
  return normalizeThemePreference({
    themeId: local?.getItem(THEME_KEY) || BASE_THEME_ID,
    reversed: local?.getItem(THEME_REVERSED_KEY) === "true",
    fontMode: local?.getItem(THEME_FONT_KEY) || "auto",
  });
}

function cachedCatalog() {
  const local = storage();
  try {
    const parsed = JSON.parse(local?.getItem(THEME_CATALOG_KEY) || "null");
    if (!Array.isArray(parsed)) return BUILT_IN_THEMES.map((theme) => ({ ...theme }));
    const themes = parsed.flatMap((candidate) => {
      const normalized = normalizeThemeInput(candidate);
      return normalized && /^[a-z0-9][a-z0-9-]{0,127}$/i.test(candidate.id || "")
        ? [{
          id: candidate.id,
          ...normalized,
          protected: candidate.protected === true,
          updatedAt: typeof candidate.updatedAt === "string" ? candidate.updatedAt : null,
        }]
        : [];
    });
    return themes.some((theme) => theme.id === BASE_THEME_ID)
      ? sortThemes(themes)
      : BUILT_IN_THEMES.map((theme) => ({ ...theme }));
  } catch {
    return BUILT_IN_THEMES.map((theme) => ({ ...theme }));
  }
}

function persistCatalog(themes) {
  try {
    storage()?.setItem(THEME_CATALOG_KEY, JSON.stringify(themes));
  } catch (error) {
    console.warn("Theme catalog could not be cached locally.", error);
  }
}

function persistPreference(value) {
  const local = storage();
  if (!local) return;
  local.setItem(THEME_KEY, value.themeId);
  local.setItem(THEME_REVERSED_KEY, String(value.reversed));
  local.setItem(THEME_FONT_KEY, value.fontMode);
}

function rgbValue(hex) {
  return hexToRGB(hex).join(" ");
}

function mixHex(left, right, rightWeight) {
  const start = hexToRGB(left);
  const end = hexToRGB(right);
  const mixed = start.map((channel, index) => Math.round(channel * (1 - rightWeight) + end[index] * rightWeight));
  return `#${mixed.map((channel) => channel.toString(16).padStart(2, "0")).join("").toUpperCase()}`;
}

function readableMuted(text, background) {
  let result = text;
  for (let amount = 0.05; amount <= 0.65; amount += 0.05) {
    const candidate = mixHex(text, background, amount);
    if (contrastRatio(candidate, background) < 4.5) break;
    result = candidate;
  }
  return result;
}

export function resolveThemeAppearance(themeId, {
  reversed = false,
  fontMode = "auto",
  themes = catalog,
} = {}) {
  const theme = themeById(themes, themeId === "dark"
    ? BASE_THEME_ID
    : themeId === "light"
      ? "evil-cassian"
      : themeId);
  const backgroundHex = reversed ? theme.accentHex : theme.backgroundHex;
  const accentHex = reversed ? theme.backgroundHex : theme.accentHex;
  const textHex = fontMode === "black"
    ? "#09090B"
    : fontMode === "white"
      ? "#FFFFFF"
      : readableForeground(backgroundHex);
  const onAccentHex = readableForeground(accentHex);
  const accentHoverHex = mixHex(accentHex, onAccentHex === "#FFFFFF" ? "#000000" : "#FFFFFF", 0.12);
  return {
    theme,
    backgroundHex,
    accentHex,
    textHex,
    mutedHex: readableMuted(textHex, backgroundHex),
    onAccentHex,
    accentHoverHex,
    surfaceHex: mixHex(backgroundHex, textHex, 0.07),
    surfaceStrongHex: mixHex(backgroundHex, textHex, 0.14),
    borderHex: mixHex(backgroundHex, textHex, 0.24),
    contrast: contrastRatio(textHex, backgroundHex),
  };
}

export function applyTheme(themeId, {
  persist = true,
  reversed = preference.reversed,
  fontMode = preference.fontMode,
  themes = catalog,
} = {}) {
  const appearance = resolveThemeAppearance(themeId, { reversed, fontMode, themes });
  preference = normalizeThemePreference({
    themeId: appearance.theme.id,
    reversed,
    fontMode,
    updatedAt: preference.updatedAt,
  });
  const root = document.documentElement;
  root.dataset.theme = appearance.textHex === "#FFFFFF" ? "dark" : "light";
  root.dataset.themePalette = appearance.theme.id;
  root.dataset.themeReversed = String(preference.reversed);
  root.style.setProperty("--theme-background", rgbValue(appearance.backgroundHex));
  root.style.setProperty("--theme-surface", rgbValue(appearance.surfaceHex));
  root.style.setProperty("--theme-surface-strong", rgbValue(appearance.surfaceStrongHex));
  root.style.setProperty("--theme-border", rgbValue(appearance.borderHex));
  root.style.setProperty("--theme-text", rgbValue(appearance.textHex));
  root.style.setProperty("--theme-muted", rgbValue(appearance.mutedHex));
  root.style.setProperty("--theme-accent", rgbValue(appearance.accentHex));
  root.style.setProperty("--theme-accent-hover", rgbValue(appearance.accentHoverHex));
  root.style.setProperty("--theme-on-accent", rgbValue(appearance.onAccentHex));
  if (persist) persistPreference(preference);
  const icon = document.getElementById("theme-icon");
  const button = document.getElementById("theme-toggle");
  if (icon) icon.className = "bi bi-palette-fill";
  button?.setAttribute("aria-label", "Choose theme");
  refreshPicker();
  return appearance.theme.id;
}

function pickerStatus(message = "", kind = "neutral") {
  const status = document.querySelector("[data-theme-save-status]");
  if (!status) return;
  status.textContent = message;
  status.className = `min-h-5 text-sm ${kind === "error" ? "text-red-600 dark:text-red-300" : "text-theme-muted"}`;
}

function updateContrastWarning() {
  const warning = document.querySelector("[data-theme-contrast-warning]");
  if (!warning) return;
  const appearance = resolveThemeAppearance(preference.themeId, preference);
  const unsafe = preference.fontMode !== "auto" && appearance.contrast < 4.5;
  warning.textContent = unsafe
    ? `This manual font choice has ${appearance.contrast.toFixed(2)}:1 contrast. Auto is recommended for readable text.`
    : "";
  warning.classList.toggle("hidden", !unsafe);
}

function controlState() {
  document.querySelectorAll("[data-theme-reverse]").forEach((button) => {
    const active = (button.dataset.themeReverse === "true") === preference.reversed;
    button.setAttribute("aria-pressed", String(active));
    button.classList.toggle("bg-blood-500", active);
    button.classList.toggle("text-white", active);
  });
  document.querySelectorAll("[data-theme-font]").forEach((button) => {
    const active = button.dataset.themeFont === preference.fontMode;
    button.setAttribute("aria-pressed", String(active));
    button.classList.toggle("bg-blood-500", active);
    button.classList.toggle("text-white", active);
  });
  updateContrastWarning();
}

function colorRow(role, name, hex) {
  const row = document.createElement("div");
  row.className = "grid grid-cols-[1.75rem_minmax(0,1fr)] items-center gap-2 text-left";
  const swatch = document.createElement("span");
  swatch.className = "h-7 w-7 rounded-lg border border-black/15 shadow-sm";
  swatch.style.backgroundColor = hex;
  const details = document.createElement("span");
  const label = document.createElement("span");
  label.className = "block truncate text-xs font-bold";
  label.textContent = `${role}: ${name}`;
  const code = document.createElement("code");
  code.className = "block text-[.68rem] text-theme-muted";
  code.textContent = hex;
  details.append(label, code);
  row.append(swatch, details);
  return row;
}

function renderCards() {
  const grid = document.querySelector("[data-theme-grid]");
  if (!grid) return;
  const cards = catalog.map((theme) => {
    const selected = theme.id === preference.themeId;
    const card = document.createElement("button");
    card.type = "button";
    card.dataset.themeCard = theme.id;
    card.setAttribute("aria-pressed", String(selected));
    card.className = `rounded-2xl border p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blood-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold ${selected
      ? "border-blood-500 bg-blood-500/10 ring-2 ring-blood-500/30"
      : "border-theme-border bg-theme-surface"}`;
    const title = document.createElement("span");
    title.className = "mb-3 flex items-center justify-between gap-2 font-display text-lg font-bold";
    title.append(document.createTextNode(theme.name));
    if (selected) {
      const check = document.createElement("i");
      check.className = "bi bi-check-circle-fill text-blood-500";
      check.setAttribute("aria-hidden", "true");
      title.append(check);
    }
    const colors = document.createElement("span");
    colors.className = "grid gap-2";
    colors.append(
      colorRow(
        "Background",
        preference.reversed ? theme.accentName : theme.backgroundName,
        preference.reversed ? theme.accentHex : theme.backgroundHex,
      ),
      colorRow(
        "Accent",
        preference.reversed ? theme.backgroundName : theme.accentName,
        preference.reversed ? theme.backgroundHex : theme.accentHex,
      ),
    );
    card.append(title, colors);
    return card;
  });
  grid.replaceChildren(...cards);
}

function refreshPicker() {
  const focused = document.activeElement;
  const focusSelector = focused?.dataset.themeCard
    ? `[data-theme-card="${focused.dataset.themeCard}"]`
    : focused?.dataset.themeReverse
      ? `[data-theme-reverse="${focused.dataset.themeReverse}"]`
      : focused?.dataset.themeFont
        ? `[data-theme-font="${focused.dataset.themeFont}"]`
        : null;
  renderCards();
  controlState();
  if (focusSelector) queueMicrotask(() => document.querySelector(focusSelector)?.focus());
}

async function saveCloudPreference(nextPreference) {
  if (!currentUser || currentUser.localBypass) return;
  const version = ++saveVersion;
  cloudQueue = cloudQueue.catch(() => undefined).then(async () => {
    const response = await fetch("api/auth/theme", {
      method: "PUT",
      headers: { accept: "application/json", "content-type": "application/json" },
      body: JSON.stringify(nextPreference),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || `Theme could not be saved (${response.status}).`);
    if (version === saveVersion) {
      preference.updatedAt = body.themePreference?.updatedAt || preference.updatedAt;
      pickerStatus("Theme saved to your account.");
    }
  }).catch((error) => {
    if (version === saveVersion) pickerStatus(`${error.message} This browser will keep the selection locally.`, "error");
  });
  return cloudQueue;
}

function choosePreference(changes) {
  const next = normalizeThemePreference({ ...preference, ...changes });
  applyTheme(next.themeId, { reversed: next.reversed, fontMode: next.fontMode });
  pickerStatus("Saving theme...");
  void saveCloudPreference({
    themeId: preference.themeId,
    reversed: preference.reversed,
    fontMode: preference.fontMode,
  });
}

function mountPicker(button) {
  if (!button || document.querySelector("[data-theme-dialog]")) return;
  const root = document.createElement("div");
  root.id = "theme-dialog";
  root.dataset.themeDialog = "";
  root.className = "fixed inset-0 z-[90] hidden items-center justify-center bg-black/70 p-3 backdrop-blur-sm sm:p-6";
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-modal", "true");
  root.setAttribute("aria-labelledby", "theme-dialog-title");
  root.innerHTML = `<div class="flex max-h-full w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-theme-border bg-theme-surface text-theme-text shadow-2xl">
    <div class="flex items-start justify-between gap-4 border-b border-theme-border p-5 sm:p-6">
      <div><p class="text-xs font-bold uppercase tracking-[.18em] text-blood-500">Appearance</p><h2 id="theme-dialog-title" class="mt-1 font-display text-3xl font-bold">Choose a theme</h2><p class="mt-1 text-sm text-theme-muted">Colors apply immediately and follow your account.</p></div>
      <button type="button" data-close-theme class="rounded-xl p-2 hover:bg-theme-surface-strong" aria-label="Close theme picker"><i class="bi bi-x-lg"></i></button>
    </div>
    <div class="border-b border-theme-border bg-theme-surface px-5 py-4 sm:px-6">
      <div class="flex flex-wrap gap-5">
        <fieldset><legend class="mb-2 text-xs font-bold uppercase tracking-wider text-theme-muted">Color order</legend><div class="inline-flex rounded-xl border border-theme-border p-1"><button type="button" data-theme-reverse="false" class="rounded-lg px-3 py-1.5 text-sm font-bold" aria-pressed="true">Standard</button><button type="button" data-theme-reverse="true" class="rounded-lg px-3 py-1.5 text-sm font-bold" aria-pressed="false">Reversed</button></div></fieldset>
        <fieldset><legend class="mb-2 text-xs font-bold uppercase tracking-wider text-theme-muted">Font color</legend><div class="inline-flex rounded-xl border border-theme-border p-1"><button type="button" data-theme-font="auto" class="rounded-lg px-3 py-1.5 text-sm font-bold" aria-pressed="true">Auto</button><button type="button" data-theme-font="black" class="rounded-lg px-3 py-1.5 text-sm font-bold" aria-pressed="false">Black</button><button type="button" data-theme-font="white" class="rounded-lg px-3 py-1.5 text-sm font-bold" aria-pressed="false">White</button></div></fieldset>
      </div>
      <p data-theme-contrast-warning class="mt-3 hidden rounded-xl border border-amber-500/40 bg-amber-500/10 p-2 text-sm font-semibold"></p>
      <p data-theme-save-status class="mt-2 min-h-5 text-sm text-theme-muted" aria-live="polite"></p>
    </div>
    <div class="overflow-y-auto p-5 sm:p-6"><div data-theme-grid class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"></div></div>
  </div>`;
  document.body.append(root);
  dialogController = createDialogController(root, {
    initialFocus: () => root.querySelector('[data-theme-card][aria-pressed="true"]') || root.querySelector("[data-close-theme]"),
    returnFocus: button,
  });
  button.setAttribute("aria-haspopup", "dialog");
  button.setAttribute("aria-controls", "theme-dialog");
  button.addEventListener("click", () => {
    refreshPicker();
    dialogController.open();
    void refreshCatalog();
  });
  root.querySelector("[data-close-theme]").addEventListener("click", dialogController.close);
  root.addEventListener("click", (event) => {
    const card = event.target.closest("[data-theme-card]");
    if (card) choosePreference({ themeId: card.dataset.themeCard });
    const reverse = event.target.closest("[data-theme-reverse]");
    if (reverse) choosePreference({ reversed: reverse.dataset.themeReverse === "true" });
    const font = event.target.closest("[data-theme-font]");
    if (font) choosePreference({ fontMode: font.dataset.themeFont });
  });
  refreshPicker();
}

async function fetchCatalog() {
  const response = await fetch("api/themes", { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(`Theme catalog could not be loaded (${response.status}).`);
  const body = await response.json();
  if (!Array.isArray(body.themes) || !body.themes.length) throw new Error("Theme catalog is empty.");
  catalog = sortThemes(body.themes);
  persistCatalog(catalog);
  return body;
}

async function refreshCatalog() {
  if (!currentUser || currentUser.localBypass) return;
  try {
    await fetchCatalog();
    applyTheme(preference.themeId, { persist: false });
  } catch (error) {
    pickerStatus(error.message, "error");
  }
}

async function hydrateTheme() {
  try {
    const session = await currentSession();
    currentUser = session.user;
    if (!currentUser || currentUser.localBypass) return;
    const catalogResponse = await fetchCatalog();
    if (currentUser.themePreference) {
      const remote = normalizeThemePreference(currentUser.themePreference);
      const validTheme = catalog.some((theme) => theme.id === remote.themeId) ? remote.themeId : BASE_THEME_ID;
      applyTheme(validTheme, { reversed: remote.reversed, fontMode: remote.fontMode });
      return;
    }
    const local = localPreference();
    const validTheme = catalog.some((theme) => theme.id === local.themeId) ? local.themeId : BASE_THEME_ID;
    applyTheme(validTheme, { reversed: local.reversed, fontMode: local.fontMode });
    if (catalogResponse.storageAvailable !== false) {
      await saveCloudPreference({ themeId: validTheme, reversed: local.reversed, fontMode: local.fontMode });
    }
  } catch (error) {
    console.warn("Account theme could not be loaded; using the browser fallback.", error);
    pickerStatus("Account theme is unavailable. Using this browser's saved theme.", "error");
  }
}

export function initializeTheme() {
  const button = document.getElementById("theme-toggle");
  applyTheme(preference.themeId, { persist: false });
  if (button && button.dataset.themeReady !== "true") {
    button.dataset.themeReady = "true";
    mountPicker(button);
  }
  void hydrateTheme();
}
