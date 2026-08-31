// Handles combat loot API routing, validation, authorization, and D1 persistence.
import { authorized } from "../auth.js";
import { bodyJSON, error, json, parseStored, safeId } from "../http.js";

export async function combatSnapshot(env) {
  const [presets, draft, partyLibrary] = await Promise.all([
    env.DB.prepare("SELECT * FROM combat_presets ORDER BY created_at").all(),
    env.DB.prepare("SELECT draft_json FROM combat_drafts WHERE id = 'default'").first(),
    env.DB.prepare("SELECT draft_json FROM combat_drafts WHERE id = 'party-library'").first(),
  ]);
  return json({
    presets: presets.results.map((row) => ({
      id: row.id,
      baseName: row.base_name,
      label: row.label,
      document: parseStored(row.document_json, {}),
      active: Boolean(row.active),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })),
    draft: draft ? parseStored(draft.draft_json) : null,
    partyLibrary: partyLibrary ? parseStored(partyLibrary.draft_json) : null,
  });
}

export async function combatRoute(request, env, parts) {
  if (request.method === "GET" && parts.length === 0) return combatSnapshot(env);
  if (!await authorized(request, env)) return error("Edit password required.", 401);
  if (parts[0] === "presets" && safeId(parts[1]) && request.method === "PUT") {
    const preset = await bodyJSON(request);
    if (preset?.id !== parts[1] || !preset.document || !preset.baseName || !preset.label) {
      return error("Invalid preset document.");
    }
    await env.DB.prepare(
      "INSERT INTO combat_presets (id, base_name, label, document_json, active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET base_name = excluded.base_name, label = excluded.label, document_json = excluded.document_json, active = excluded.active, updated_at = excluded.updated_at",
    ).bind(preset.id, preset.baseName, preset.label, JSON.stringify(preset.document), preset.active === false ? 0 : 1, preset.createdAt, preset.updatedAt).run();
    return json({ ok: true });
  }
  if (parts[0] === "draft" && parts.length === 1 && request.method === "PUT") {
    const draft = await bodyJSON(request);
    const now = new Date().toISOString();
    await env.DB.prepare(
      "INSERT INTO combat_drafts (id, draft_json, updated_at) VALUES ('default', ?, ?) ON CONFLICT(id) DO UPDATE SET draft_json = excluded.draft_json, updated_at = excluded.updated_at",
    ).bind(JSON.stringify(draft), now).run();
    return json({ ok: true, updatedAt: now });
  }
  if (parts[0] === "party-library" && parts.length === 1 && request.method === "PUT") {
    const partyLibrary = await bodyJSON(request);
    if (partyLibrary?.version !== 1 || !Array.isArray(partyLibrary.parties)) {
      return error("Invalid party library.");
    }
    const now = new Date().toISOString();
    await env.DB.prepare(
      "INSERT INTO combat_drafts (id, draft_json, updated_at) VALUES ('party-library', ?, ?) ON CONFLICT(id) DO UPDATE SET draft_json = excluded.draft_json, updated_at = excluded.updated_at",
    ).bind(JSON.stringify(partyLibrary), now).run();
    return json({ ok: true, updatedAt: now });
  }
  return error("Method not allowed.", 405);
}
