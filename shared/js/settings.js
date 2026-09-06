// Loads normalized runtime settings with localhost and deployment fallbacks.
import { writeCloudJSON } from "./cloud-store.js";
import { isLocalRuntimeHost } from "./runtime-host.js";
import { campaignApiPath, campaignStorageKey, currentCampaignSlug } from "./campaign-context.js";

export { isLocalRuntimeHost } from "./runtime-host.js";

export const DEFAULT_CHARACTER_SHEET_STYLE = "v1";
export const LOCAL_RUNTIME_SETTINGS_KEY = "cassianslog-runtime-settings";

export function normalizeCharacterSheetStyle(value) {
  return value === "v2" ? "v2" : DEFAULT_CHARACTER_SHEET_STYLE;
}

export function normalizeCharacterSheetStyleOverrides(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([id, style]) => (
    /^[a-z0-9][a-z0-9-]{0,127}$/i.test(id) && ["v1", "v2"].includes(style)
  )));
}

export function resolveCharacterSheetStyle(settings = {}, characterId = "") {
  const overrides = normalizeCharacterSheetStyleOverrides(settings.characterSheetStyleOverrides);
  const override = Object.prototype.hasOwnProperty.call(overrides, characterId)
    ? overrides[characterId]
    : null;
  return override || normalizeCharacterSheetStyle(settings.characterSheetStyle);
}

export function normalizeRuntimeSettings(config) {
  const openWrites = typeof config?.openWrites === "boolean"
    ? config.openWrites
    : typeof config?.writeProtectionEnabled === "boolean"
      ? !config.writeProtectionEnabled
      : true;
  return {
    sections: config?.sections && typeof config.sections === "object"
      ? config.sections
      : {},
    characterSheetStyle: normalizeCharacterSheetStyle(config?.characterSheetStyle),
    characterSheetStyleOverrides: normalizeCharacterSheetStyleOverrides(
      config?.characterSheetStyleOverrides,
    ),
    openWrites,
    writeProtectionEnabled: !openWrites,
    updatedAt: config?.updatedAt || null,
  };
}

function localSettings(storage = globalThis.localStorage) {
  try {
    const stored = JSON.parse(storage?.getItem(campaignStorageKey(LOCAL_RUNTIME_SETTINGS_KEY, storage)) || "null");
    return stored && typeof stored === "object" && !Array.isArray(stored) ? stored : null;
  } catch (error) {
    console.warn("Local runtime settings could not be read; using bundled settings.", error);
    return null;
  }
}

export function persistLocalRuntimeSettings(config, storage = globalThis.localStorage) {
  if (!storage) throw new Error("localStorage is unavailable in this browser.");
  const settings = normalizeRuntimeSettings({
    ...config,
    updatedAt: new Date().toISOString(),
  });
  storage.setItem(campaignStorageKey(LOCAL_RUNTIME_SETTINGS_KEY, storage), JSON.stringify({
    sections: settings.sections,
    characterSheetStyle: settings.characterSheetStyle,
    characterSheetStyleOverrides: settings.characterSheetStyleOverrides,
    openWrites: settings.openWrites,
    updatedAt: settings.updatedAt,
  }));
  return settings;
}

async function bundledSettings() {
  const response = await fetch(new URL("../config/sections.json", import.meta.url));
  return response.ok ? normalizeRuntimeSettings(await response.json()) : normalizeRuntimeSettings({});
}

async function localRuntimeSettings() {
  const bundled = await bundledSettings();
  const stored = localSettings();
  if (!stored) return bundled;
  return normalizeRuntimeSettings({
    ...bundled,
    ...stored,
    sections: { ...bundled.sections, ...(stored.sections || {}) },
  });
}

async function remoteRuntimeSettings() {
  try {
    const response = await fetch(campaignApiPath("api/settings"), { headers: { accept: "application/json" } });
    if (!response.ok) throw new Error(`Could not load dynamic settings (${response.status}).`);
    const body = await response.json();
    return normalizeRuntimeSettings(body.settings || body);
  } catch (error) {
    console.warn("Dynamic settings are unavailable; loading bundled settings.", error);
    try {
      return await bundledSettings();
    } catch (fallbackError) {
      console.warn("Bundled settings are also unavailable; using safe defaults.", fallbackError);
      return normalizeRuntimeSettings({});
    }
  }
}

export const runtimeSettingsReady = isLocalRuntimeHost() && !currentCampaignSlug()
  ? localRuntimeSettings()
  : remoteRuntimeSettings();

export async function saveCharacterSheetStyleOverride(characterId, style) {
  if (!/^[a-z0-9][a-z0-9-]{0,127}$/i.test(characterId || "")) {
    throw new TypeError("Character ID is invalid.");
  }
  if (!["v1", "v2"].includes(style)) {
    throw new TypeError("Character sheet style must be v1 or v2.");
  }
  if (!isLocalRuntimeHost()) {
    return writeCloudJSON(`api/characters/${encodeURIComponent(characterId)}/style`, { style });
  }
  const settings = await runtimeSettingsReady;
  const latest = localSettings() || {};
  const saved = persistLocalRuntimeSettings({
    ...settings,
    ...latest,
    sections: { ...settings.sections, ...(latest.sections || {}) },
    characterSheetStyleOverrides: {
      ...settings.characterSheetStyleOverrides,
      ...(latest.characterSheetStyleOverrides || {}),
      [characterId]: style,
    },
  });
  return { ok: true, style, updatedAt: saved.updatedAt };
}
