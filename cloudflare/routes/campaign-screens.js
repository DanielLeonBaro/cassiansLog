// Handles private per-campaign Player and DM Screens and calculator history.
import { MAX_SCREEN_DOCUMENT_BYTES, normalizeScreenDocument, screenDocumentBytes, SCREEN_KINDS, validScreenDocument } from "../../screens/js/model.js";
import { canManageCampaign, LEGACY_CAMPAIGN_ID } from "../campaigns.js";
import { bodyJSON, error, json, parseStored, safeId } from "../http.js";

const HISTORY_PAGE_SIZE = 50;

function screenAllowed(access, kind) {
  if (!SCREEN_KINDS.has(kind)) return error("Screen kind must be player or dm.");
  if (kind === "dm" && !canManageCampaign(access)) return error("Campaign DM access required.", 403);
  if (access.user.localBypass) return error("Screen cloud storage is disabled on localhost.", 409);
  return null;
}

async function storedScreen(access, kind, env) {
  return env.DB.prepare(
    "SELECT document_json, updated_at FROM campaign_user_screens WHERE campaign_id = ? AND user_id = ? AND screen_kind = ?",
  ).bind(access.campaign.id, access.user.id, kind).first();
}

async function documentRoute(request, env, access, kind) {
  if (request.method === "GET") {
    const row = await storedScreen(access, kind, env);
    return json({ document: row ? normalizeScreenDocument(parseStored(row.document_json, {})) : null, updatedAt: row?.updated_at || null });
  }
  if (request.method !== "PUT") return error("Method not allowed.", 405);
  const body = await bodyJSON(request);
  if (!validScreenDocument(body?.document)) return error("Invalid screen document.");
  const document = normalizeScreenDocument(body.document);
  if (screenDocumentBytes(document) > MAX_SCREEN_DOCUMENT_BYTES) return error("The screen document is too large.", 413);
  const now = new Date().toISOString();
  const documentJSON = JSON.stringify(document);
  const statements = [env.DB.prepare(
    `INSERT INTO campaign_user_screens (campaign_id, user_id, screen_kind, document_json, updated_at)
    VALUES (?, ?, ?, ?, ?) ON CONFLICT(campaign_id, user_id, screen_kind) DO UPDATE SET
      document_json = excluded.document_json, updated_at = excluded.updated_at`,
  ).bind(access.campaign.id, access.user.id, kind, documentJSON, now)];
  if (access.campaign.id === LEGACY_CAMPAIGN_ID) statements.push(env.DB.prepare(
    "INSERT INTO user_screens (user_id, screen_kind, document_json, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(user_id, screen_kind) DO UPDATE SET document_json = excluded.document_json, updated_at = excluded.updated_at",
  ).bind(access.user.id, kind, documentJSON, now));
  await env.DB.batch(statements);

  const ids = document.widgets.filter((widget) => widget.type === "calculator").map((widget) => widget.id);
  if (ids.length) {
    const placeholders = ids.map(() => "?").join(", ");
    await env.DB.prepare(
      `DELETE FROM campaign_screen_calculator_history WHERE campaign_id = ? AND user_id = ? AND screen_kind = ? AND widget_id NOT IN (${placeholders})`,
    ).bind(access.campaign.id, access.user.id, kind, ...ids).run();
    if (access.campaign.id === LEGACY_CAMPAIGN_ID) await env.DB.prepare(
      `DELETE FROM screen_calculator_history WHERE user_id = ? AND screen_kind = ? AND widget_id NOT IN (${placeholders})`,
    ).bind(access.user.id, kind, ...ids).run();
  } else {
    await env.DB.prepare("DELETE FROM campaign_screen_calculator_history WHERE campaign_id = ? AND user_id = ? AND screen_kind = ?")
      .bind(access.campaign.id, access.user.id, kind).run();
    if (access.campaign.id === LEGACY_CAMPAIGN_ID) await env.DB.prepare(
      "DELETE FROM screen_calculator_history WHERE user_id = ? AND screen_kind = ?",
    ).bind(access.user.id, kind).run();
  }
  return json({ ok: true, updatedAt: now });
}

async function calculatorExists(access, kind, widgetId, env) {
  const row = await storedScreen(access, kind, env);
  const document = normalizeScreenDocument(parseStored(row?.document_json, {}));
  return document.widgets.some((widget) => widget.id === widgetId && widget.type === "calculator");
}

async function historyRoute(request, env, access, kind, widgetId) {
  if (!safeId(widgetId)) return error("Invalid calculator widget ID.");
  if (!await calculatorExists(access, kind, widgetId, env)) return error("Calculator widget not found.", 404);
  const base = [access.campaign.id, access.user.id, kind, widgetId];
  if (request.method === "GET") {
    const before = Number(new URL(request.url).searchParams.get("before"));
    const query = before > 0
      ? env.DB.prepare("SELECT id, expression, result, created_at FROM campaign_screen_calculator_history WHERE campaign_id = ? AND user_id = ? AND screen_kind = ? AND widget_id = ? AND id < ? ORDER BY id DESC LIMIT ?").bind(...base, before, HISTORY_PAGE_SIZE)
      : env.DB.prepare("SELECT id, expression, result, created_at FROM campaign_screen_calculator_history WHERE campaign_id = ? AND user_id = ? AND screen_kind = ? AND widget_id = ? ORDER BY id DESC LIMIT ?").bind(...base, HISTORY_PAGE_SIZE);
    const rows = await query.all();
    const items = rows.results.map((row) => ({ id: row.id, expression: row.expression, result: row.result, createdAt: row.created_at }));
    return json({ items, nextCursor: items.length === HISTORY_PAGE_SIZE ? items.at(-1).id : null });
  }
  if (request.method === "POST") {
    const body = await bodyJSON(request);
    const expression = typeof body?.expression === "string" ? body.expression.trim() : "";
    const result = typeof body?.result === "string" ? body.result.trim() : "";
    if (!expression || expression.length > 200 || !result || result.length > 200) return error("Calculation history entry is invalid.");
    const createdAt = new Date().toISOString();
    const inserted = await env.DB.prepare(
      "INSERT INTO campaign_screen_calculator_history (campaign_id, user_id, screen_kind, widget_id, expression, result, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ).bind(...base, expression, result, createdAt).run();
    if (access.campaign.id === LEGACY_CAMPAIGN_ID) await env.DB.prepare(
      "INSERT INTO screen_calculator_history (user_id, screen_kind, widget_id, expression, result, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    ).bind(access.user.id, kind, widgetId, expression, result, createdAt).run();
    return json({ id: inserted.meta?.last_row_id, expression, result, createdAt }, 201);
  }
  if (request.method === "DELETE") {
    const statements = [env.DB.prepare("DELETE FROM campaign_screen_calculator_history WHERE campaign_id = ? AND user_id = ? AND screen_kind = ? AND widget_id = ?").bind(...base)];
    if (access.campaign.id === LEGACY_CAMPAIGN_ID) statements.push(env.DB.prepare("DELETE FROM screen_calculator_history WHERE user_id = ? AND screen_kind = ? AND widget_id = ?").bind(access.user.id, kind, widgetId));
    await env.DB.batch(statements);
    return json({ ok: true });
  }
  return error("Method not allowed.", 405);
}

export async function campaignScreenRoute(request, env, parts, access) {
  const kind = parts[0] || "";
  const denied = screenAllowed(access, kind);
  if (denied) return denied;
  if (parts.length === 1) return documentRoute(request, env, access, kind);
  if (parts.length === 4 && parts[1] === "calculators" && parts[3] === "history") return historyRoute(request, env, access, kind, parts[2]);
  return error("Screen route not found.", 404);
}
