// Handles characters API routing, validation, authorization, and D1 persistence.
import { authorized } from "../auth.js";
import { bodyJSON, error, json, parseStored, safeId } from "../http.js";
import { CHARACTER_SHEET_STYLES, loadSettings, saveSettings } from "../settings.js";
import { userFromRequest } from "../user-auth.js";
import { normalizeV3Layout, validV3Layout } from "../../shared/js/v3-layout.js";

function layoutStorageUnavailable(caught) {
  return /no such table|user_character_layouts/i.test(String(caught?.message || caught));
}

async function characterLayoutRoute(request, env, id) {
  const user = await userFromRequest(request, env);
  if (!user) return error("Sign in to manage your character layout.", 401);
  try {
    const character = await env.DB.prepare("SELECT id FROM characters WHERE id = ? AND active = 1").bind(id).first();
    if (!character) return error("Character not found.", 404);
    if (request.method === "GET") {
      const row = await env.DB.prepare(
        "SELECT layout_json, updated_at FROM user_character_layouts WHERE user_id = ? AND character_id = ?",
      ).bind(user.id, id).first();
      return json({ layout: row ? normalizeV3Layout(parseStored(row.layout_json, {})) : null, updatedAt: row?.updated_at || null });
    }
    if (request.method !== "PUT") return error("Method not allowed.", 405);
    const layout = (await bodyJSON(request))?.layout;
    if (!validV3Layout(layout)) return error("Invalid V3 character layout.");
    const now = new Date().toISOString();
    const normalized = normalizeV3Layout(layout);
    await env.DB.prepare(
      `INSERT INTO user_character_layouts (user_id, character_id, layout_json, updated_at)
      VALUES (?, ?, ?, ?) ON CONFLICT(user_id, character_id) DO UPDATE SET
        layout_json = excluded.layout_json, updated_at = excluded.updated_at`,
    ).bind(user.id, id, JSON.stringify(normalized), now).run();
    return json({ ok: true, layout: normalized, updatedAt: now });
  } catch (caught) {
    if (layoutStorageUnavailable(caught)) return error("Character layout storage is unavailable. Apply migration 0015.", 503);
    throw caught;
  }
}

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
  if (tail === "layout") return characterLayoutRoute(request, env, id);
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
    try {
      await env.DB.prepare("DELETE FROM user_character_layouts WHERE character_id = ?").bind(id).run();
    } catch (caught) {
      if (!layoutStorageUnavailable(caught)) throw caught;
    }
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
  if (tail === "id" && request.method === "PUT") {
    const nextId = safeId((await bodyJSON(request))?.id);
    if (!nextId) return error("Character ID is invalid.");
    if (nextId === id) return json({ ok: true, id });
    const existing = await env.DB.prepare("SELECT id FROM characters WHERE id = ? AND active = 1").bind(id).first();
    if (!existing) return error("Character not found.", 404);
    const occupied = await env.DB.prepare("SELECT id FROM characters WHERE id = ?").bind(nextId).first();
    if (occupied) return error("That character ID already exists.", 409);
    const now = new Date().toISOString();
    const settings = await loadSettings(env);
    const overrides = { ...settings.characterSheetStyleOverrides };
    const renamedOverride = Object.hasOwn(overrides, id);
    if (renamedOverride) {
      overrides[nextId] = overrides[id];
      delete overrides[id];
      settings.characterSheetStyleOverrides = overrides;
    }
    const statements = [
      env.DB.prepare("UPDATE characters SET id = ?, document_json = json_set(document_json, '$.id', ?), updated_at = ? WHERE id = ?").bind(nextId, nextId, now, id),
      env.DB.prepare("UPDATE character_runtime SET character_id = ? WHERE character_id = ?").bind(nextId, id),
    ];
    if (renamedOverride) statements.push(env.DB.prepare("UPDATE app_settings SET settings_json = ?, updated_at = ? WHERE id = 'default'")
      .bind(JSON.stringify(settings), now));
    await env.DB.batch(statements);
    return json({ ok: true, id: nextId, previousId: id, updatedAt: now });
  }
  if (tail === "style" && request.method === "PUT") {
    const body = await bodyJSON(request);
    if (!CHARACTER_SHEET_STYLES.has(body?.style)) return error("Character sheet style must be v1, v2, or v3.");
    const settings = await loadSettings(env);
    settings.characterSheetStyleOverrides = { ...settings.characterSheetStyleOverrides, [id]: body.style };
    const saved = await saveSettings(env, settings);
    return json({ ok: true, style: body.style, updatedAt: saved.updatedAt });
  }
  return error("Method not allowed.", 405);
}
