import { normalizeUiPreferences, validUiPreferences } from "../shared/gc/preferences-model.js";
import { bodyJSON, error, json } from "./http.js";
import { userFromRequest } from "./user-auth.js";

export async function uiPreferencesRoute(request, env) {
  const user = await userFromRequest(request, env);
  if (!user) return error("Sign in required.", 401);
  if (!["GET", "PUT"].includes(request.method)) return error("Method not allowed.", 405);
  let preferences;
  if (request.method === "PUT") {
    preferences = await bodyJSON(request);
    if (!validUiPreferences(preferences)) return error("Invalid UI preferences.");
    preferences = normalizeUiPreferences(preferences);
  }
  try {
    if (request.method === "GET") {
      const row = await env.DB.prepare("SELECT preferences_json, updated_at FROM user_ui_preferences WHERE user_id = ?").bind(user.id).first();
      return json({ preferences: normalizeUiPreferences(row ? JSON.parse(row.preferences_json) : null), updatedAt: row?.updated_at || null });
    }
    const updatedAt = new Date().toISOString();
    await env.DB.prepare(`INSERT INTO user_ui_preferences (user_id, preferences_json, updated_at) VALUES (?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET preferences_json = excluded.preferences_json, updated_at = excluded.updated_at`)
      .bind(user.id, JSON.stringify(preferences), updatedAt).run();
    return json({ ok: true, preferences, updatedAt });
  } catch {
    return error("UI preference storage unavailable. Apply the user_ui_preferences migration.", 503);
  }
}
