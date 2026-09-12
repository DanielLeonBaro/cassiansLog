// Handles campaign NPC trackers, server-side player redaction, runtime state, and layouts.
import { canManageCampaign } from "../campaigns.js";
import { bodyJSON, error, json, parseStored, safeId } from "../http.js";
import { CHARACTER_SHEET_STYLES } from "../settings.js";
import { normalizeV3Layout, validV3Layout } from "../../shared/js/v3-layout.js";
import { normalizeNpcVisibility, projectNpcForPlayer } from "../../shared/js/npc-visibility.js";

function managerRequired(access) {
  return canManageCampaign(access) ? null : error("Campaign DM access required.", 403);
}

function npcRecord(row, access) {
  const manager = canManageCampaign(access);
  const fullDocument = parseStored(row.document_json, {});
  const visibility = normalizeNpcVisibility(parseStored(row.visibility_json, {}));
  const playerProjection = projectNpcForPlayer(fullDocument, visibility);
  const projected = manager
    ? { document: fullDocument, visibleFields: playerProjection.visibleFields }
    : playerProjection;
  return {
    id: row.id,
    updatedAt: row.updated_at,
    document: projected.document,
    visibleFields: projected.visibleFields,
    ...(manager ? { visibility, playerVisible: Boolean(row.player_visible) } : {}),
    canEdit: manager,
    canManage: manager,
  };
}

export async function listCampaignNpcs(env, access) {
  const manager = canManageCampaign(access);
  const rows = await env.DB.prepare(
    `SELECT id, document_json, visibility_json, player_visible, updated_at
    FROM campaign_npcs WHERE campaign_id = ? AND active = 1${manager ? "" : " AND player_visible = 1"} ORDER BY id`,
  ).bind(access.campaign.id).all();
  return json({ npcs: rows.results.map((row) => npcRecord(row, access)), authoritative: true, canManage: manager });
}

async function npcDocument(request, env, id, access) {
  const campaignId = access.campaign.id;
  if (request.method === "GET") {
    const row = await env.DB.prepare(
      "SELECT id, document_json, visibility_json, player_visible, active, updated_at FROM campaign_npcs WHERE campaign_id = ? AND id = ?",
    ).bind(campaignId, id).first();
    if (!row || !row.active || (!canManageCampaign(access) && !row.player_visible)) return error("NPC not found.", 404);
    return json(npcRecord(row, access));
  }
  const denied = managerRequired(access);
  if (denied) return denied;
  if (request.method === "PUT") {
    const body = await bodyJSON(request);
    if (!body?.document || typeof body.document !== "object" || body.document.id !== id) {
      return error("NPC document and route IDs must match.");
    }
    if (typeof body.playerVisible !== "boolean") return error("NPC player visibility must be true or false.");
    const visibility = normalizeNpcVisibility(body.visibility);
    const now = new Date().toISOString();
    const existing = await env.DB.prepare("SELECT id FROM campaign_npcs WHERE campaign_id = ? AND id = ?")
      .bind(campaignId, id).first();
    await env.DB.prepare(
      `INSERT INTO campaign_npcs (campaign_id, id, document_json, visibility_json, player_visible, active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 1, ?, ?) ON CONFLICT(campaign_id, id) DO UPDATE SET
        document_json = excluded.document_json, visibility_json = excluded.visibility_json,
        player_visible = excluded.player_visible, active = 1, updated_at = excluded.updated_at`,
    ).bind(campaignId, id, JSON.stringify(body.document), JSON.stringify(visibility), body.playerVisible ? 1 : 0, now, now).run();
    return json({ ok: true, created: !existing, updatedAt: now });
  }
  if (request.method === "DELETE") {
    await env.DB.prepare("UPDATE campaign_npcs SET active = 0, updated_at = ? WHERE campaign_id = ? AND id = ?")
      .bind(new Date().toISOString(), campaignId, id).run();
    return json({ ok: true });
  }
  return error("Method not allowed.", 405);
}

async function visibilityRoute(request, env, id, access) {
  if (request.method !== "PUT") return error("Method not allowed.", 405);
  const denied = managerRequired(access);
  if (denied) return denied;
  const playerVisible = (await bodyJSON(request))?.playerVisible;
  if (typeof playerVisible !== "boolean") return error("NPC player visibility must be true or false.");
  const result = await env.DB.prepare(
    "UPDATE campaign_npcs SET player_visible = ?, updated_at = ? WHERE campaign_id = ? AND id = ? AND active = 1",
  ).bind(playerVisible ? 1 : 0, new Date().toISOString(), access.campaign.id, id).run();
  if (!result.meta?.changes) return error("NPC not found.", 404);
  return json({ ok: true, playerVisible });
}

async function runtimeRoute(request, env, id, tail, access) {
  const manager = canManageCampaign(access);
  if (tail === "notes" && !manager) return error("NPC notes are private to campaign DMs.", 403);
  const column = tail === "state" ? "state_json" : "notes_json";
  if (request.method === "GET") {
    if (!manager) return json({ value: null, canEdit: false });
    const row = await env.DB.prepare(
      `SELECT ${column} AS value_json FROM campaign_npc_runtime WHERE campaign_id = ? AND npc_id = ?`,
    ).bind(access.campaign.id, id).first();
    return json({ value: row?.value_json ? parseStored(row.value_json) : null, canEdit: true });
  }
  if (request.method !== "PUT") return error("Method not allowed.", 405);
  const denied = managerRequired(access);
  if (denied) return denied;
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO campaign_npc_runtime (campaign_id, npc_id, ${column}, updated_at)
    VALUES (?, ?, ?, ?) ON CONFLICT(campaign_id, npc_id) DO UPDATE SET
      ${column} = excluded.${column}, updated_at = excluded.updated_at`,
  ).bind(access.campaign.id, id, JSON.stringify((await bodyJSON(request))?.value), now).run();
  return json({ ok: true, updatedAt: now });
}

async function renameRoute(request, env, id, access) {
  if (request.method !== "PUT") return error("Method not allowed.", 405);
  const denied = managerRequired(access);
  if (denied) return denied;
  const nextId = safeId((await bodyJSON(request))?.id);
  if (!nextId) return error("NPC ID is invalid.");
  if (nextId === id) return json({ ok: true, id });
  const occupied = await env.DB.prepare("SELECT id FROM campaign_npcs WHERE campaign_id = ? AND id = ?")
    .bind(access.campaign.id, nextId).first();
  if (occupied) return error("That NPC ID already exists in this campaign.", 409);
  const now = new Date().toISOString();
  const changed = await env.DB.prepare(
    "UPDATE campaign_npcs SET id = ?, document_json = json_set(document_json, '$.id', ?), updated_at = ? WHERE campaign_id = ? AND id = ? AND active = 1",
  ).bind(nextId, nextId, now, access.campaign.id, id).run();
  if (!changed.meta?.changes) return error("NPC not found.", 404);
  return json({ ok: true, id: nextId, previousId: id, updatedAt: now });
}

async function styleRoute(request, env, id, access) {
  if (request.method !== "PUT") return error("Method not allowed.", 405);
  const denied = managerRequired(access);
  if (denied) return denied;
  const style = (await bodyJSON(request))?.style;
  if (!CHARACTER_SHEET_STYLES.has(style)) return error("NPC tracker style must be v1, v2, or v3.");
  const row = await env.DB.prepare("SELECT settings_json FROM campaign_settings WHERE campaign_id = ?")
    .bind(access.campaign.id).first();
  const settings = parseStored(row?.settings_json, {});
  settings.npcSheetStyleOverrides = { ...(settings.npcSheetStyleOverrides || {}), [id]: style };
  const now = new Date().toISOString();
  await env.DB.prepare("UPDATE campaign_settings SET settings_json = ?, updated_at = ? WHERE campaign_id = ?")
    .bind(JSON.stringify(settings), now, access.campaign.id).run();
  return json({ ok: true, style, updatedAt: now });
}

async function layoutRoute(request, env, id, access) {
  const denied = managerRequired(access);
  if (denied) return request.method === "GET" ? json({ layout: null, canEdit: false }) : denied;
  const npc = await env.DB.prepare("SELECT id FROM campaign_npcs WHERE campaign_id = ? AND id = ? AND active = 1")
    .bind(access.campaign.id, id).first();
  if (!npc) return error("NPC not found.", 404);
  if (request.method === "GET") {
    const row = await env.DB.prepare(
      "SELECT layout_json, updated_at FROM campaign_user_npc_layouts WHERE campaign_id = ? AND user_id = ? AND npc_id = ?",
    ).bind(access.campaign.id, access.user.id, id).first();
    return json({ layout: row ? normalizeV3Layout(parseStored(row.layout_json, {})) : null, updatedAt: row?.updated_at || null, canEdit: true });
  }
  if (request.method !== "PUT") return error("Method not allowed.", 405);
  const layout = (await bodyJSON(request))?.layout;
  if (!validV3Layout(layout)) return error("Invalid V3 NPC layout.");
  const normalized = normalizeV3Layout(layout);
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO campaign_user_npc_layouts (campaign_id, user_id, npc_id, layout_json, updated_at)
    VALUES (?, ?, ?, ?, ?) ON CONFLICT(campaign_id, user_id, npc_id) DO UPDATE SET
      layout_json = excluded.layout_json, updated_at = excluded.updated_at`,
  ).bind(access.campaign.id, access.user.id, id, JSON.stringify(normalized), now).run();
  return json({ ok: true, layout: normalized, updatedAt: now, canEdit: true });
}

export async function campaignNpcRoute(request, env, parts, access) {
  const id = safeId(parts[0]);
  if (!id) return error("Invalid NPC ID.");
  const tail = parts[1] || "";
  if (!tail) return npcDocument(request, env, id, access);
  if (["state", "notes"].includes(tail) && parts.length === 2) return runtimeRoute(request, env, id, tail, access);
  if (tail === "visibility" && parts.length === 2) return visibilityRoute(request, env, id, access);
  if (tail === "id" && parts.length === 2) return renameRoute(request, env, id, access);
  if (tail === "style" && parts.length === 2) return styleRoute(request, env, id, access);
  if (tail === "layout" && parts.length === 2) return layoutRoute(request, env, id, access);
  return error("NPC route not found.", 404);
}
