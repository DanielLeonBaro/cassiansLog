import { authorized } from "../auth.js";
import { bodyJSON, error, json, parseStored, safeId } from "../http.js";
import { CHARACTER_SHEET_STYLES, loadSettings, saveSettings } from "../settings.js";

export async function listCharacters(env) {
  const rows = await env.DB.prepare(
    "SELECT id, document_json, source, updated_at FROM characters WHERE active = 1 ORDER BY id",
  ).all();
  return json({ characters: rows.results.map((row) => ({
    id: row.id,
    source: row.source,
    updatedAt: row.updated_at,
    document: parseStored(row.document_json, {}),
  })) });
}

export async function characterRoute(request, env, id, tail) {
  if (!safeId(id)) return error("Invalid character ID.");
  if (!tail && request.method === "GET") {
    const row = await env.DB.prepare(
      "SELECT document_json, source, active, updated_at FROM characters WHERE id = ?",
    ).bind(id).first();
    if (!row || !row.active) return error("Character not found.", 404);
    return json({ id, source: row.source, updatedAt: row.updated_at, document: parseStored(row.document_json, {}) });
  }
  if (request.method !== "GET" && !await authorized(request, env)) return error("Edit password required.", 401);
  if (!tail && request.method === "PUT") {
    const body = await bodyJSON(request);
    if (!body?.document || typeof body.document !== "object" || body.document.id !== id) {
      return error("Character document and route IDs must match.");
    }
    const now = new Date().toISOString();
    await env.DB.prepare(
      "INSERT INTO characters (id, document_json, source, active, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?) ON CONFLICT(id) DO UPDATE SET document_json = excluded.document_json, source = excluded.source, updated_at = excluded.updated_at",
    ).bind(id, JSON.stringify(body.document), body.source === "bundled" ? "bundled" : "custom", now, now).run();
    return json({ ok: true, updatedAt: now });
  }
  if (!tail && request.method === "DELETE") {
    await env.DB.prepare("UPDATE characters SET active = 0, updated_at = ? WHERE id = ?")
      .bind(new Date().toISOString(), id).run();
    return json({ ok: true });
  }
  if ((tail === "state" || tail === "notes") && request.method === "GET") {
    const column = tail === "state" ? "state_json" : "notes_json";
    const row = await env.DB.prepare(`SELECT ${column} AS value_json FROM character_runtime WHERE character_id = ?`)
      .bind(id).first();
    return json({ value: row?.value_json ? parseStored(row.value_json) : null });
  }
  if ((tail === "state" || tail === "notes") && request.method === "PUT") {
    const body = await bodyJSON(request);
    const column = tail === "state" ? "state_json" : "notes_json";
    const now = new Date().toISOString();
    await env.DB.prepare(
      `INSERT INTO character_runtime (character_id, ${column}, updated_at) VALUES (?, ?, ?) ON CONFLICT(character_id) DO UPDATE SET ${column} = excluded.${column}, updated_at = excluded.updated_at`,
    ).bind(id, JSON.stringify(body.value), now).run();
    return json({ ok: true, updatedAt: now });
  }
  if (tail === "style" && request.method === "PUT") {
    const body = await bodyJSON(request);
    if (!CHARACTER_SHEET_STYLES.has(body?.style)) return error("Character sheet style must be v1 or v2.");
    const settings = await loadSettings(env);
    settings.characterSheetStyleOverrides = { ...settings.characterSheetStyleOverrides, [id]: body.style };
    const saved = await saveSettings(env, settings);
    return json({ ok: true, style: body.style, updatedAt: saved.updatedAt });
  }
  return error("Method not allowed.", 405);
}
