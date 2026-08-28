import {
  MAX_SCREEN_DOCUMENT_BYTES,
  normalizeScreenDocument,
  screenDocumentBytes,
  SCREEN_KINDS,
  validScreenDocument,
} from "../../screens/js/model.js";
import { bodyJSON, error, json, parseStored, safeId } from "../http.js";
import { hasRole, userFromRequest } from "../user-auth.js";

const HISTORY_PAGE_SIZE = 50;

function storageUnavailable(caught) {
  return /no such table|has no column/i.test(String(caught?.message || caught));
}

async function screenUser(request, env, kind) {
  if (!SCREEN_KINDS.has(kind)) return { response: error("Screen kind must be player or dm.") };
  const user = await userFromRequest(request, env);
  if (!user) return { response: error("Sign in required.", 401) };
  const role = kind === "dm" ? "dm-screen" : "player-screen";
  if (!hasRole(user, role)) return { response: error("Your account cannot access this screen.", 403) };
  if (user.localBypass) return { response: error("Screen cloud storage is disabled on localhost.", 409) };
  return { user };
}

async function storedScreen(userId, kind, env) {
  return env.DB.prepare(
    "SELECT document_json, updated_at FROM user_screens WHERE user_id = ? AND screen_kind = ?",
  ).bind(userId, kind).first();
}

async function calculatorExists(userId, kind, widgetId, env) {
  const row = await storedScreen(userId, kind, env);
  const document = normalizeScreenDocument(parseStored(row?.document_json, {}));
  return document.widgets.some((widget) => widget.id === widgetId && widget.type === "calculator");
}

async function screenDocumentRoute(request, env, user, kind) {
  if (request.method === "GET") {
    const row = await storedScreen(user.id, kind, env);
    return json({
      document: row ? normalizeScreenDocument(parseStored(row.document_json, {})) : null,
      updatedAt: row?.updated_at || null,
    });
  }
  if (request.method !== "PUT") return error("Method not allowed.", 405);
  const body = await bodyJSON(request);
  if (!validScreenDocument(body?.document)) return error("Invalid screen document.");
  const document = normalizeScreenDocument(body.document);
  if (screenDocumentBytes(document) > MAX_SCREEN_DOCUMENT_BYTES) return error("The screen document is too large.", 413);
  const now = new Date().toISOString();
  await env.DB.prepare(
    "INSERT INTO user_screens (user_id, screen_kind, document_json, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(user_id, screen_kind) DO UPDATE SET document_json = excluded.document_json, updated_at = excluded.updated_at",
  ).bind(user.id, kind, JSON.stringify(document), now).run();

  const calculatorIds = document.widgets.filter((widget) => widget.type === "calculator").map((widget) => widget.id);
  if (calculatorIds.length) {
    const placeholders = calculatorIds.map(() => "?").join(", ");
    await env.DB.prepare(
      `DELETE FROM screen_calculator_history WHERE user_id = ? AND screen_kind = ? AND widget_id NOT IN (${placeholders})`,
    ).bind(user.id, kind, ...calculatorIds).run();
  } else {
    await env.DB.prepare(
      "DELETE FROM screen_calculator_history WHERE user_id = ? AND screen_kind = ?",
    ).bind(user.id, kind).run();
  }
  return json({ ok: true, updatedAt: now });
}

async function calculatorHistoryRoute(request, env, user, kind, widgetId) {
  if (!safeId(widgetId)) return error("Invalid calculator widget ID.");
  if (!await calculatorExists(user.id, kind, widgetId, env)) return error("Calculator widget not found.", 404);

  if (request.method === "GET") {
    const before = Number(new URL(request.url).searchParams.get("before"));
    const query = before > 0
      ? env.DB.prepare(
        "SELECT id, expression, result, created_at FROM screen_calculator_history WHERE user_id = ? AND screen_kind = ? AND widget_id = ? AND id < ? ORDER BY id DESC LIMIT ?",
      ).bind(user.id, kind, widgetId, before, HISTORY_PAGE_SIZE)
      : env.DB.prepare(
        "SELECT id, expression, result, created_at FROM screen_calculator_history WHERE user_id = ? AND screen_kind = ? AND widget_id = ? ORDER BY id DESC LIMIT ?",
      ).bind(user.id, kind, widgetId, HISTORY_PAGE_SIZE);
    const rows = await query.all();
    const items = rows.results.map((row) => ({
      id: row.id,
      expression: row.expression,
      result: row.result,
      createdAt: row.created_at,
    }));
    return json({ items, nextCursor: items.length === HISTORY_PAGE_SIZE ? items.at(-1).id : null });
  }
  if (request.method === "POST") {
    const body = await bodyJSON(request);
    const expression = typeof body?.expression === "string" ? body.expression.trim() : "";
    const result = typeof body?.result === "string" ? body.result.trim() : "";
    if (!expression || expression.length > 200 || !result || result.length > 200) {
      return error("Calculation history entry is invalid.");
    }
    const createdAt = new Date().toISOString();
    const inserted = await env.DB.prepare(
      "INSERT INTO screen_calculator_history (user_id, screen_kind, widget_id, expression, result, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    ).bind(user.id, kind, widgetId, expression, result, createdAt).run();
    return json({ id: inserted.meta?.last_row_id, expression, result, createdAt }, 201);
  }
  if (request.method === "DELETE") {
    await env.DB.prepare(
      "DELETE FROM screen_calculator_history WHERE user_id = ? AND screen_kind = ? AND widget_id = ?",
    ).bind(user.id, kind, widgetId).run();
    return json({ ok: true });
  }
  return error("Method not allowed.", 405);
}

export async function screenRoute(request, env, parts) {
  const kind = parts[0] || "";
  try {
    const access = await screenUser(request, env, kind);
    if (access.response) return access.response;
    if (parts.length === 1) return await screenDocumentRoute(request, env, access.user, kind);
    if (parts.length === 4 && parts[1] === "calculators" && parts[3] === "history") {
      return await calculatorHistoryRoute(request, env, access.user, kind, parts[2]);
    }
    return error("Screen route not found.", 404);
  } catch (caught) {
    if (storageUnavailable(caught)) return error("Screen storage is unavailable. Apply migration 0009.", 503);
    throw caught;
  }
}
