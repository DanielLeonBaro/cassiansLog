// Handles campaign-scoped Character data, assignments, private notes, and legacy mirroring.
import { canEditCharacter, canManageCampaign, LEGACY_CAMPAIGN_ID } from "../campaigns.js";
import { bodyJSON, error, json, parseStored, safeId } from "../http.js";
import { CHARACTER_SHEET_STYLES, loadSettings } from "../settings.js";

function record(row, access) {
  return {
    id: row.id,
    source: row.source,
    updatedAt: row.updated_at,
    document: parseStored(row.document_json, {}),
    canEdit: canManageCampaign(access) || Boolean(row.assigned),
    canManage: canManageCampaign(access),
  };
}

export async function listCampaignCharacters(env, access) {
  const manager = canManageCampaign(access);
  const rows = manager
    ? await env.DB.prepare(
      "SELECT id, document_json, source, updated_at, 1 AS assigned FROM campaign_characters WHERE campaign_id = ? AND active = 1 ORDER BY id",
    ).bind(access.campaign.id).all()
    : await env.DB.prepare(
      `SELECT characters.id, characters.document_json, characters.source, characters.updated_at,
        EXISTS(SELECT 1 FROM campaign_character_editors AS editors
          WHERE editors.campaign_id = characters.campaign_id
            AND editors.character_id = characters.id AND editors.user_id = ?) AS assigned
      FROM campaign_characters AS characters
      WHERE characters.campaign_id = ? AND characters.active = 1 ORDER BY characters.id`,
    ).bind(access.user.id, access.campaign.id).all();
  return json({ characters: rows.results.map((row) => record(row, access)), authoritative: true });
}

async function characterDocument(request, env, id, access) {
  const campaignId = access.campaign.id;
  if (request.method === "GET") {
    const row = await env.DB.prepare(
      "SELECT id, document_json, source, active, updated_at FROM campaign_characters WHERE campaign_id = ? AND id = ?",
    ).bind(campaignId, id).first();
    if (!row || !row.active) return error("Character not found.", 404);
    row.assigned = await canEditCharacter(access, id, env);
    return json(record(row, access));
  }
  if (request.method === "PUT") {
    const body = await bodyJSON(request);
    if (!body?.document || typeof body.document !== "object" || body.document.id !== id) return error("Character document and route IDs must match.");
    const existing = await env.DB.prepare("SELECT id FROM campaign_characters WHERE campaign_id = ? AND id = ?")
      .bind(campaignId, id).first();
    const manager = canManageCampaign(access);
    if (existing && !await canEditCharacter(access, id, env)) return error("You are not assigned to edit this character.", 403);
    const now = new Date().toISOString();
    const source = body.source === "bundled" ? "bundled" : "custom";
    const documentJSON = JSON.stringify(body.document);
    const statements = [env.DB.prepare(
      `INSERT INTO campaign_characters (campaign_id, id, document_json, source, active, created_at, updated_at)
      VALUES (?, ?, ?, ?, 1, ?, ?) ON CONFLICT(campaign_id, id) DO UPDATE SET
        document_json = excluded.document_json, source = excluded.source, active = 1, updated_at = excluded.updated_at`,
    ).bind(campaignId, id, documentJSON, source, now, now)];
    if (!existing && !manager && !access.user.localBypass) statements.push(env.DB.prepare(
      "INSERT INTO campaign_character_editors (campaign_id, character_id, user_id, assigned_at) VALUES (?, ?, ?, ?)",
    ).bind(campaignId, id, access.user.id, now));
    if (campaignId === LEGACY_CAMPAIGN_ID) statements.push(env.DB.prepare(
      "INSERT INTO characters (id, document_json, source, active, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?) ON CONFLICT(id) DO UPDATE SET document_json = excluded.document_json, source = excluded.source, active = 1, updated_at = excluded.updated_at",
    ).bind(id, documentJSON, source, now, now));
    await env.DB.batch(statements);
    return json({ ok: true, created: !existing, updatedAt: now });
  }
  if (request.method === "DELETE") {
    if (!canManageCampaign(access)) return error("Campaign DM access required.", 403);
    const now = new Date().toISOString();
    const statements = [env.DB.prepare("UPDATE campaign_characters SET active = 0, updated_at = ? WHERE campaign_id = ? AND id = ?")
      .bind(now, campaignId, id)];
    if (campaignId === LEGACY_CAMPAIGN_ID) statements.push(env.DB.prepare("UPDATE characters SET active = 0, updated_at = ? WHERE id = ?").bind(now, id));
    await env.DB.batch(statements);
    return json({ ok: true });
  }
  return error("Method not allowed.", 405);
}

async function runtimeRoute(request, env, id, tail, access) {
  const campaignId = access.campaign.id;
  const editable = await canEditCharacter(access, id, env);
  if (tail === "notes" && !editable) return error("Character notes are private to assigned players and DMs.", 403);
  const column = tail === "state" ? "state_json" : "notes_json";
  if (request.method === "GET") {
    const row = await env.DB.prepare(
      `SELECT ${column} AS value_json FROM campaign_character_runtime WHERE campaign_id = ? AND character_id = ?`,
    ).bind(campaignId, id).first();
    return json({ value: row?.value_json ? parseStored(row.value_json) : null, canEdit: editable });
  }
  if (request.method !== "PUT") return error("Method not allowed.", 405);
  if (!editable) return error("You are not assigned to edit this character.", 403);
  const body = await bodyJSON(request);
  const now = new Date().toISOString();
  const value = JSON.stringify(body.value);
  const statements = [env.DB.prepare(
    `INSERT INTO campaign_character_runtime (campaign_id, character_id, ${column}, updated_at)
    VALUES (?, ?, ?, ?) ON CONFLICT(campaign_id, character_id) DO UPDATE SET
      ${column} = excluded.${column}, updated_at = excluded.updated_at`,
  ).bind(campaignId, id, value, now)];
  if (campaignId === LEGACY_CAMPAIGN_ID) statements.push(env.DB.prepare(
    `INSERT INTO character_runtime (character_id, ${column}, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(character_id) DO UPDATE SET ${column} = excluded.${column}, updated_at = excluded.updated_at`,
  ).bind(id, value, now));
  await env.DB.batch(statements);
  return json({ ok: true, updatedAt: now });
}

async function assignmentsRoute(request, env, id, access) {
  if (!canManageCampaign(access)) return error("Campaign DM access required.", 403);
  const campaignId = access.campaign.id;
  if (request.method === "GET") {
    const rows = await env.DB.prepare(
      `SELECT users.id, users.email FROM campaign_character_editors AS editors
      JOIN users ON users.id = editors.user_id
      WHERE editors.campaign_id = ? AND editors.character_id = ? ORDER BY users.email COLLATE NOCASE`,
    ).bind(campaignId, id).all();
    return json({ editors: rows.results });
  }
  if (request.method !== "PUT") return error("Method not allowed.", 405);
  const body = await bodyJSON(request);
  if (!Array.isArray(body?.userIds) || body.userIds.some((userId) => typeof userId !== "string")) return error("Editor user IDs must be an array.");
  const userIds = [...new Set(body.userIds)];
  if (userIds.length) {
    const placeholders = userIds.map(() => "?").join(", ");
    const members = await env.DB.prepare(
      `SELECT user_id FROM campaign_memberships WHERE campaign_id = ? AND role = 'player' AND user_id IN (${placeholders})`,
    ).bind(campaignId, ...userIds).all();
    if (members.results.length !== userIds.length) return error("Every character editor must be a campaign player.");
  }
  const now = new Date().toISOString();
  await env.DB.batch([
    env.DB.prepare("DELETE FROM campaign_character_editors WHERE campaign_id = ? AND character_id = ?").bind(campaignId, id),
    ...userIds.map((userId) => env.DB.prepare(
      "INSERT INTO campaign_character_editors (campaign_id, character_id, user_id, assigned_at) VALUES (?, ?, ?, ?)",
    ).bind(campaignId, id, userId, now)),
  ]);
  return json({ ok: true, userIds, updatedAt: now });
}

async function renameRoute(request, env, id, access) {
  if (request.method !== "PUT") return error("Method not allowed.", 405);
  if (!canManageCampaign(access)) return error("Campaign DM access required.", 403);
  const nextId = safeId((await bodyJSON(request))?.id);
  if (!nextId) return error("Character ID is invalid.");
  if (nextId === id) return json({ ok: true, id });
  const campaignId = access.campaign.id;
  const occupied = await env.DB.prepare("SELECT id FROM campaign_characters WHERE campaign_id = ? AND id = ?")
    .bind(campaignId, nextId).first();
  if (occupied) return error("That character ID already exists in this campaign.", 409);
  const now = new Date().toISOString();
  const settingsRow = await env.DB.prepare("SELECT settings_json FROM campaign_settings WHERE campaign_id = ?").bind(campaignId).first();
  const settings = parseStored(settingsRow?.settings_json, {});
  const overrides = { ...(settings.characterSheetStyleOverrides || {}) };
  const renamedOverride = Object.hasOwn(overrides, id);
  if (renamedOverride) {
    overrides[nextId] = overrides[id];
    delete overrides[id];
    settings.characterSheetStyleOverrides = overrides;
  }
  const statements = [env.DB.prepare(
    "UPDATE campaign_characters SET id = ?, document_json = json_set(document_json, '$.id', ?), updated_at = ? WHERE campaign_id = ? AND id = ?",
  ).bind(nextId, nextId, now, campaignId, id)];
  if (renamedOverride) statements.push(env.DB.prepare(
    "UPDATE campaign_settings SET settings_json = ?, updated_at = ? WHERE campaign_id = ?",
  ).bind(JSON.stringify(settings), now, campaignId));
  if (campaignId === LEGACY_CAMPAIGN_ID) {
    statements.push(
      env.DB.prepare("UPDATE characters SET id = ?, document_json = json_set(document_json, '$.id', ?), updated_at = ? WHERE id = ?").bind(nextId, nextId, now, id),
      env.DB.prepare("UPDATE character_runtime SET character_id = ? WHERE character_id = ?").bind(nextId, id),
    );
    if (renamedOverride) {
      const legacy = await loadSettings(env);
      const legacyOverrides = { ...legacy.characterSheetStyleOverrides };
      legacyOverrides[nextId] = legacyOverrides[id] || overrides[nextId];
      delete legacyOverrides[id];
      legacy.characterSheetStyleOverrides = legacyOverrides;
      statements.push(env.DB.prepare("UPDATE app_settings SET settings_json = ?, updated_at = ? WHERE id = 'default'")
        .bind(JSON.stringify(legacy), now));
    }
  }
  await env.DB.batch(statements);
  return json({ ok: true, id: nextId, previousId: id, updatedAt: now });
}

async function styleRoute(request, env, id, access) {
  if (request.method !== "PUT") return error("Method not allowed.", 405);
  if (!canManageCampaign(access)) return error("Campaign DM access required.", 403);
  const style = (await bodyJSON(request))?.style;
  if (!CHARACTER_SHEET_STYLES.has(style)) return error("Character sheet style must be v1 or v2.");
  const row = await env.DB.prepare("SELECT settings_json FROM campaign_settings WHERE campaign_id = ?").bind(access.campaign.id).first();
  const settings = parseStored(row?.settings_json, {});
  settings.characterSheetStyleOverrides = { ...(settings.characterSheetStyleOverrides || {}), [id]: style };
  const now = new Date().toISOString();
  const statements = [env.DB.prepare("UPDATE campaign_settings SET settings_json = ?, updated_at = ? WHERE campaign_id = ?")
    .bind(JSON.stringify(settings), now, access.campaign.id)];
  if (access.campaign.id === LEGACY_CAMPAIGN_ID) {
    const legacy = await loadSettings(env);
    legacy.characterSheetStyleOverrides = { ...legacy.characterSheetStyleOverrides, [id]: style };
    statements.push(env.DB.prepare("UPDATE app_settings SET settings_json = ?, updated_at = ? WHERE id = 'default'")
      .bind(JSON.stringify(legacy), now));
  }
  await env.DB.batch(statements);
  return json({ ok: true, style, updatedAt: now });
}

export async function campaignCharacterRoute(request, env, parts, access) {
  const id = safeId(parts[0]);
  if (!id) return error("Invalid character ID.");
  const tail = parts[1] || "";
  if (!tail) return characterDocument(request, env, id, access);
  if (["state", "notes"].includes(tail) && parts.length === 2) return runtimeRoute(request, env, id, tail, access);
  if (tail === "assignments" && parts.length === 2) return assignmentsRoute(request, env, id, access);
  if (tail === "id" && parts.length === 2) return renameRoute(request, env, id, access);
  if (tail === "style" && parts.length === 2) return styleRoute(request, env, id, access);
  return error("Character route not found.", 404);
}
