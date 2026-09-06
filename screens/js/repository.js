// Owns Player and DM Screen serialization, persistence, and fallback precedence.
import { cloneJSON } from "../../shared/js/text.js";
import { createEmptyScreen, MAX_SCREEN_DOCUMENT_BYTES, normalizeScreenDocument, screenDocumentBytes } from "./model.js";
import { campaignApiPath, campaignStorageKey } from "../../shared/js/campaign-context.js";

export const MAX_SCREEN_BYTES = MAX_SCREEN_DOCUMENT_BYTES;

export function screenStorageKey(userId, kind) {
  return campaignStorageKey(`cassianslog-screen-v1:${encodeURIComponent(userId)}:${kind}`);
}

export function calculatorHistoryStorageKey(userId, kind, widgetId) {
  return `${screenStorageKey(userId, kind)}:calculator:${widgetId}`;
}

function readStored(key, fallback, storage = localStorage) {
  try {
    const value = JSON.parse(storage.getItem(key) || "null");
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

function writeStored(key, value, storage = localStorage) {
  storage.setItem(key, JSON.stringify(value));
}

async function requestJSON(path, options = {}) {
  const response = await fetch(campaignApiPath(path), {
    ...options,
    headers: {
      accept: "application/json",
      ...(options.body ? { "content-type": "application/json" } : {}),
      ...options.headers,
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const problem = new Error(body.error || `Screen request failed (${response.status}).`);
    problem.status = response.status;
    throw problem;
  }
  return body;
}

function localSnapshot(userId, kind, storage) {
  const value = readStored(screenStorageKey(userId, kind), null, storage);
  if (!value || typeof value !== "object") return null;
  return {
    document: normalizeScreenDocument(value.document),
    pending: value.pending === true,
    updatedAt: value.updatedAt || null,
  };
}

function cacheSnapshot(userId, kind, snapshot, storage) {
  writeStored(screenStorageKey(userId, kind), {
    document: normalizeScreenDocument(snapshot.document),
    pending: snapshot.pending === true,
    updatedAt: snapshot.updatedAt || new Date().toISOString(),
  }, storage);
}

export async function loadScreen({ userId, kind, local = false, storage = localStorage } = {}) {
  const cached = localSnapshot(userId, kind, storage);
  if (local) return cloneJSON(cached?.document || createEmptyScreen());

  if (cached?.pending) {
    try {
      const result = await requestJSON(`api/screens/${kind}`, {
        method: "PUT",
        body: JSON.stringify({ document: cached.document }),
      });
      cacheSnapshot(userId, kind, { document: cached.document, pending: false, updatedAt: result.updatedAt }, storage);
      return cloneJSON(cached.document);
    } catch {
      return cloneJSON(cached.document);
    }
  }

  try {
    const cloud = await requestJSON(`api/screens/${kind}`);
    if (cloud.document) {
      const document = normalizeScreenDocument(cloud.document);
      cacheSnapshot(userId, kind, { document, pending: false, updatedAt: cloud.updatedAt }, storage);
      return cloneJSON(document);
    }
    if (cached?.document.widgets.length) {
      await saveScreen({ userId, kind, document: cached.document, storage });
      return cloneJSON(cached.document);
    }
    return createEmptyScreen();
  } catch {
    return cloneJSON(cached?.document || createEmptyScreen());
  }
}

export async function saveScreen({ userId, kind, document, local = false, storage = localStorage } = {}) {
  const normalized = normalizeScreenDocument(document);
  if (screenDocumentBytes(normalized) > MAX_SCREEN_BYTES) {
    throw new RangeError("This screen is too large to save. Remove an uploaded image or shorten a reference.");
  }
  cacheSnapshot(userId, kind, { document: normalized, pending: !local }, storage);
  if (local) return { ok: true, local: true, document: cloneJSON(normalized) };
  try {
    const result = await requestJSON(`api/screens/${kind}`, {
      method: "PUT",
      body: JSON.stringify({ document: normalized }),
    });
    cacheSnapshot(userId, kind, { document: normalized, pending: false, updatedAt: result.updatedAt }, storage);
    return { ...result, document: cloneJSON(normalized) };
  } catch (error) {
    cacheSnapshot(userId, kind, { document: normalized, pending: true }, storage);
    throw error;
  }
}

export async function loadCalculatorHistory({ userId, kind, widgetId, before, local = false, storage = localStorage } = {}) {
  if (!local) {
    const query = before ? `?before=${encodeURIComponent(before)}` : "";
    return requestJSON(`api/screens/${kind}/calculators/${encodeURIComponent(widgetId)}/history${query}`);
  }
  const items = readStored(calculatorHistoryStorageKey(userId, kind, widgetId), [], storage);
  const start = before ? items.findIndex((item) => item.id < before) : 0;
  const page = items.slice(Math.max(0, start), Math.max(0, start) + 50);
  return { items: cloneJSON(page), nextCursor: page.length === 50 ? page.at(-1).id : null };
}

export async function addCalculatorHistory({ userId, kind, widgetId, expression, result, local = false, storage = localStorage } = {}) {
  if (!local) {
    return requestJSON(`api/screens/${kind}/calculators/${encodeURIComponent(widgetId)}/history`, {
      method: "POST",
      body: JSON.stringify({ expression, result }),
    });
  }
  const key = calculatorHistoryStorageKey(userId, kind, widgetId);
  const items = readStored(key, [], storage);
  const entry = { id: Math.max(Date.now(), Number(items[0]?.id || 0) + 1), expression, result, createdAt: new Date().toISOString() };
  writeStored(key, [entry, ...items], storage);
  return cloneJSON(entry);
}

export async function clearCalculatorHistory({ userId, kind, widgetId, local = false, storage = localStorage } = {}) {
  if (!local) {
    return requestJSON(`api/screens/${kind}/calculators/${encodeURIComponent(widgetId)}/history`, { method: "DELETE" });
  }
  storage.removeItem(calculatorHistoryStorageKey(userId, kind, widgetId));
  return { ok: true };
}
