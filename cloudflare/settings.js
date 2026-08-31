// Loads, normalizes, publishes, and updates D1-backed runtime settings.
import { bodyJSON, error, json, parseStored, safeId } from "./http.js";

export const CHARACTER_SHEET_STYLES = new Set(["v1", "v2"]);
const DEFAULT_SECTIONS = {
  characters: true, "player-screen": true, "dm-screen": true,
  "combat-loot": true, "public-initiative": true,
  compendium: true, music: true, wiki: false,
  "character-overview": true, "character-stats": true, "hit-points": true,
  combat: true, spellcasting: true, "prepared-spells": true,
  "all-possibilities": true, inventory: true, notes: true,
};

function storedCharacterSheetStyleOverrides(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([id, style]) => (
    safeId(id) && CHARACTER_SHEET_STYLES.has(style)
  )));
}

export async function loadSettings(env) {
  let row = null;
  try {
    row = await env.DB.prepare(
      "SELECT settings_json, updated_at FROM app_settings WHERE id = 'default'",
    ).first();
  } catch (caught) {
    console.warn("D1 runtime settings are unavailable; using deployment defaults.", caught);
  }
  const stored = parseStored(row?.settings_json, {});
  return {
    sections: { ...DEFAULT_SECTIONS, ...(stored.sections || {}) },
    openWrites: typeof stored.openWrites === "boolean" ? stored.openWrites : env.OPEN_WRITES === "true",
    characterSheetStyle: CHARACTER_SHEET_STYLES.has(stored.characterSheetStyle)
      ? stored.characterSheetStyle
      : "v1",
    characterSheetStyleOverrides: storedCharacterSheetStyleOverrides(stored.characterSheetStyleOverrides),
    updatedAt: row?.updated_at || null,
  };
}

export function normalizeSettings(body) {
  if (!body || typeof body !== "object" || typeof body.openWrites !== "boolean") return null;
  if (!body.sections || typeof body.sections !== "object" || Array.isArray(body.sections)) return null;
  if (!CHARACTER_SHEET_STYLES.has(body.characterSheetStyle)) return null;
  const styleOverrides = body.characterSheetStyleOverrides ?? {};
  if (!styleOverrides || typeof styleOverrides !== "object" || Array.isArray(styleOverrides)) return null;
  if (!Object.entries(styleOverrides).every(([id, style]) => safeId(id) && CHARACTER_SHEET_STYLES.has(style))) return null;
  const sections = {};
  for (const key of Object.keys(DEFAULT_SECTIONS)) {
    if (["public-initiative", "player-screen", "dm-screen"].includes(key) && body.sections[key] === undefined) sections[key] = DEFAULT_SECTIONS[key];
    else {
      if (typeof body.sections[key] !== "boolean") return null;
      sections[key] = body.sections[key];
    }
  }
  return {
    sections,
    openWrites: body.openWrites,
    characterSheetStyle: body.characterSheetStyle,
    characterSheetStyleOverrides: { ...styleOverrides },
  };
}

export async function saveSettings(env, settings) {
  const stored = {
    sections: settings.sections,
    openWrites: settings.openWrites,
    characterSheetStyle: settings.characterSheetStyle,
    characterSheetStyleOverrides: settings.characterSheetStyleOverrides,
  };
  const now = new Date().toISOString();
  await env.DB.prepare(
    "INSERT INTO app_settings (id, settings_json, updated_at) VALUES ('default', ?, ?) ON CONFLICT(id) DO UPDATE SET settings_json = excluded.settings_json, updated_at = excluded.updated_at",
  ).bind(JSON.stringify(stored), now).run();
  return { ...stored, updatedAt: now };
}

export async function publicSettings(env) {
  const settings = await loadSettings(env);
  return json({
    sections: settings.sections,
    characterSheetStyle: settings.characterSheetStyle,
    characterSheetStyleOverrides: settings.characterSheetStyleOverrides,
    writeProtectionEnabled: !settings.openWrites,
    updatedAt: settings.updatedAt,
  });
}

export async function updateSettings(request, env) {
  const settings = normalizeSettings(await bodyJSON(request));
  if (!settings) return error("Invalid application settings.");
  return json({ ok: true, settings: await saveSettings(env, settings) });
}
