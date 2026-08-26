import { bodyJSON, error, json, safeId } from "../http.js";
import { normalizeThemeInput } from "../../shared/js/theme-catalog.js";
import { themeFromRow } from "../themes.js";

const SELECT_THEME = `SELECT id, name, background_name, background_hex, accent_name,
  accent_hex, protected, updated_at FROM themes WHERE id = ?`;

async function selectedTheme(id, env) {
  return env.DB.prepare(SELECT_THEME).bind(id).first();
}

function duplicateTheme(caught) {
  return String(caught?.message || caught).toLowerCase().includes("unique");
}

export async function adminThemeRoute(request, env, parts) {
  if (request.method === "POST" && parts.length === 1) {
    const theme = normalizeThemeInput(await bodyJSON(request));
    if (!theme) return error("Enter a valid theme name, color names, and six-digit hex colors.");
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    try {
      await env.DB.prepare(
        `INSERT INTO themes (id, name, background_name, background_hex, accent_name, accent_hex, protected, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)`,
      ).bind(
        id,
        theme.name,
        theme.backgroundName,
        theme.backgroundHex,
        theme.accentName,
        theme.accentHex,
        now,
        now,
      ).run();
    } catch (caught) {
      if (duplicateTheme(caught)) return error("A theme with that name already exists.", 409);
      throw caught;
    }
    return json({ ok: true, theme: themeFromRow(await selectedTheme(id, env)) }, 201);
  }

  const id = safeId(parts[1]);
  if (!id || parts.length !== 2) return error("Theme not found.", 404);
  const existing = await selectedTheme(id, env);
  if (!existing) return error("Theme not found.", 404);
  if (existing.protected) return error("Protected themes cannot be changed or removed.", 409);

  if (request.method === "PUT") {
    const theme = normalizeThemeInput(await bodyJSON(request));
    if (!theme) return error("Enter a valid theme name, color names, and six-digit hex colors.");
    const now = new Date().toISOString();
    try {
      await env.DB.prepare(
        `UPDATE themes SET name = ?, background_name = ?, background_hex = ?, accent_name = ?, accent_hex = ?, updated_at = ?
          WHERE id = ?`,
      ).bind(
        theme.name,
        theme.backgroundName,
        theme.backgroundHex,
        theme.accentName,
        theme.accentHex,
        now,
        id,
      ).run();
    } catch (caught) {
      if (duplicateTheme(caught)) return error("A theme with that name already exists.", 409);
      throw caught;
    }
    return json({ ok: true, theme: themeFromRow(await selectedTheme(id, env)) });
  }

  if (request.method === "DELETE") {
    const confirmed = new URL(request.url).searchParams.get("confirm") === "1";
    const usageStatement = env.DB.prepare(
      "SELECT COUNT(*) AS count FROM user_theme_preferences WHERE theme_id = ?",
    ).bind(id);
    const deleteStatement = env.DB.prepare(confirmed
      ? "DELETE FROM themes WHERE id = ?"
      : `DELETE FROM themes WHERE id = ? AND NOT EXISTS (
          SELECT 1 FROM user_theme_preferences WHERE theme_id = ?
        )`).bind(...(confirmed ? [id] : [id, id]));
    const [usageResult, deleteResult] = await env.DB.batch([usageStatement, deleteStatement]);
    const peopleUsingTheme = Number(usageResult.results?.[0]?.count) || 0;
    if (peopleUsingTheme && !confirmed) {
      return json({
        error: `People using this theme: ${peopleUsingTheme}. Removing it will return them to Cassian’s Classic.`,
        code: "THEME_IN_USE",
        peopleUsingTheme,
      }, 409);
    }
    if (!deleteResult.meta?.changes) return error("Theme not found.", 404);
    return json({ ok: true, resetUsers: peopleUsingTheme });
  }

  return error("Method not allowed.", 405);
}
