// Loads and normalizes the D1 theme catalog with bundled fallback behavior.
import {
  BASE_THEME_ID,
  BUILT_IN_THEMES,
  normalizeThemePreference,
  sortThemes,
} from "../shared/js/theme-catalog.js";

export function themeFromRow(row) {
  return {
    id: row.id,
    name: row.name,
    backgroundName: row.background_name,
    backgroundHex: row.background_hex,
    accentName: row.accent_name,
    accentHex: row.accent_hex,
    protected: Boolean(row.protected),
    updatedAt: row.updated_at,
    ...(row.people_using_theme === undefined
      ? {}
      : { peopleUsingTheme: Number(row.people_using_theme) || 0 }),
  };
}

export function preferenceFromRow(row) {
  if (!row?.theme_id) return null;
  return normalizeThemePreference({
    themeId: row.theme_id,
    reversed: Boolean(row.reversed),
    fontMode: row.font_mode,
    updatedAt: row.updated_at,
  });
}

export async function loadThemeCatalog(env, { includeUsage = false } = {}) {
  try {
    const query = includeUsage
      ? `SELECT themes.id, themes.name, themes.background_name, themes.background_hex,
          themes.accent_name, themes.accent_hex, themes.protected, themes.updated_at,
          COUNT(user_theme_preferences.user_id) AS people_using_theme
        FROM themes
        LEFT JOIN user_theme_preferences ON user_theme_preferences.theme_id = themes.id
        GROUP BY themes.id
        ORDER BY themes.name COLLATE NOCASE`
      : `SELECT id, name, background_name, background_hex, accent_name, accent_hex, protected, updated_at
        FROM themes ORDER BY name COLLATE NOCASE`;
    const rows = await env.DB.prepare(query).all();
    return { themes: sortThemes(rows.results.map(themeFromRow)), storageAvailable: true };
  } catch (caught) {
    console.warn("D1 themes are unavailable; using the bundled catalog. Apply migration 0008.", caught);
    return {
      themes: BUILT_IN_THEMES.map((theme) => ({ ...theme, ...(includeUsage ? { peopleUsingTheme: 0 } : {}) })),
      storageAvailable: false,
    };
  }
}

export async function loadUserThemePreference(userId, env) {
  if (!userId || userId === "localhost") return null;
  try {
    const row = await env.DB.prepare(
      "SELECT theme_id, reversed, font_mode, updated_at FROM user_theme_preferences WHERE user_id = ?",
    ).bind(userId).first();
    return preferenceFromRow(row);
  } catch (caught) {
    console.warn("D1 theme preferences are unavailable; using the browser fallback. Apply migration 0008.", caught);
    return null;
  }
}

export async function saveUserThemePreference(userId, preference, env) {
  const theme = await env.DB.prepare("SELECT id FROM themes WHERE id = ?")
    .bind(preference.themeId).first();
  if (!theme) return null;
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO user_theme_preferences (user_id, theme_id, reversed, font_mode, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        theme_id = excluded.theme_id,
        reversed = excluded.reversed,
        font_mode = excluded.font_mode,
        updated_at = excluded.updated_at`,
  ).bind(
    userId,
    preference.themeId,
    preference.reversed ? 1 : 0,
    preference.fontMode,
    now,
  ).run();
  return { ...preference, updatedAt: now };
}

export async function assignUserTheme(userId, themeId, env) {
  const [user, theme] = await Promise.all([
    env.DB.prepare("SELECT id FROM users WHERE id = ?").bind(userId).first(),
    env.DB.prepare("SELECT id FROM themes WHERE id = ?").bind(themeId).first(),
  ]);
  if (!user) return { problem: "user" };
  if (!theme) return { problem: "theme" };
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO user_theme_preferences (user_id, theme_id, reversed, font_mode, updated_at)
      VALUES (?, ?, 0, 'auto', ?)
      ON CONFLICT(user_id) DO UPDATE SET theme_id = excluded.theme_id, updated_at = excluded.updated_at`,
  ).bind(userId, themeId, now).run();
  const row = await env.DB.prepare(
    "SELECT theme_id, reversed, font_mode, updated_at FROM user_theme_preferences WHERE user_id = ?",
  ).bind(userId).first();
  return { preference: preferenceFromRow(row) };
}

export function defaultThemePreference() {
  return normalizeThemePreference({ themeId: BASE_THEME_ID });
}
