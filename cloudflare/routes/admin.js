import { adminAuthorized } from "../auth.js";
import { bodyJSON, error, json, parseStored, safeId } from "../http.js";
import { loadSettings, updateSettings } from "../settings.js";

export async function adminRoute(request, env, parts) {
  if (!adminAuthorized(request, env)) return error("Admin password required.", 401);
  if (request.method === "GET" && parts.length === 0) {
    const [settings, characters] = await Promise.all([
      loadSettings(env),
      env.DB.prepare("SELECT id, document_json, source, active, updated_at FROM characters ORDER BY id").all(),
    ]);
    return json({
      settings,
      characters: characters.results.map((row) => ({
        id: row.id,
        name: parseStored(row.document_json, {})?.name || row.id,
        source: row.source,
        active: Boolean(row.active),
        updatedAt: row.updated_at,
      })),
    });
  }
  if (request.method === "PUT" && parts[0] === "settings" && parts.length === 1) {
    return updateSettings(request, env);
  }
  if (request.method === "PUT" && parts[0] === "characters" && safeId(parts[1]) && parts.length === 2) {
    const body = await bodyJSON(request);
    if (typeof body?.active !== "boolean") return error("Character availability must be true or false.");
    const result = await env.DB.prepare(
      "UPDATE characters SET active = ?, updated_at = ? WHERE id = ?",
    ).bind(body.active ? 1 : 0, new Date().toISOString(), parts[1]).run();
    if (!result.meta?.changes) return error("Character not found.", 404);
    return json({ ok: true });
  }
  return error("Method not allowed.", 405);
}
