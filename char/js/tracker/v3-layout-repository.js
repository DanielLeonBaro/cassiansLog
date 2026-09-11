// Persists each user's campaign-aware V3 tracker layout with an offline cache.
import { campaignApiPath, campaignStorageKey } from "../../../shared/js/campaign-context.js";
import { isLocalRuntimeHost } from "../../../shared/js/runtime-host.js";
import { cloneJSON } from "../../../shared/js/text.js";
import { DEFAULT_V3_LAYOUT, normalizeV3Layout } from "../../../shared/js/v3-layout.js";

const STORAGE_PREFIX = "cassianslog-character-layout-v3";

export function v3LayoutStorageKey(userId, characterId, storage = globalThis.localStorage) {
  return campaignStorageKey(`${STORAGE_PREFIX}:${encodeURIComponent(userId)}:${encodeURIComponent(characterId)}`, storage);
}

function readSnapshot(userId, characterId, storage = globalThis.localStorage) {
  try {
    const parsed = JSON.parse(storage?.getItem(v3LayoutStorageKey(userId, characterId, storage)) || "null");
    if (!parsed || typeof parsed !== "object") return null;
    return {
      layout: normalizeV3Layout(parsed.layout),
      pending: parsed.pending === true,
      updatedAt: parsed.updatedAt || null,
    };
  } catch {
    return null;
  }
}

function cacheSnapshot(userId, characterId, snapshot, storage = globalThis.localStorage) {
  storage?.setItem(v3LayoutStorageKey(userId, characterId, storage), JSON.stringify({
    layout: normalizeV3Layout(snapshot.layout),
    pending: snapshot.pending === true,
    updatedAt: snapshot.updatedAt || new Date().toISOString(),
  }));
}

async function requestLayout(characterId, options = {}) {
  const response = await fetch(campaignApiPath(`api/characters/${encodeURIComponent(characterId)}/layout`), {
    ...options,
    headers: {
      accept: "application/json",
      ...(options.body ? { "content-type": "application/json" } : {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `Character layout request failed (${response.status}).`);
  return body;
}

export async function loadV3Layout({ userId, characterId, canEdit = true, storage = globalThis.localStorage } = {}) {
  const fallback = normalizeV3Layout(DEFAULT_V3_LAYOUT);
  if (!canEdit || !userId || !characterId) return fallback;
  const cached = readSnapshot(userId, characterId, storage);
  if (isLocalRuntimeHost()) return cloneJSON(cached?.layout || fallback);

  if (cached?.pending) {
    try {
      const saved = await requestLayout(characterId, {
        method: "PUT",
        body: JSON.stringify({ layout: cached.layout }),
      });
      cacheSnapshot(userId, characterId, { layout: saved.layout, pending: false, updatedAt: saved.updatedAt }, storage);
      return cloneJSON(saved.layout);
    } catch {
      return cloneJSON(cached.layout);
    }
  }

  try {
    const cloud = await requestLayout(characterId);
    if (cloud.layout) {
      cacheSnapshot(userId, characterId, { layout: cloud.layout, pending: false, updatedAt: cloud.updatedAt }, storage);
      return cloneJSON(normalizeV3Layout(cloud.layout));
    }
    if (cached?.layout) {
      await saveV3Layout({ userId, characterId, layout: cached.layout, storage });
      return cloneJSON(cached.layout);
    }
  } catch {
    return cloneJSON(cached?.layout || fallback);
  }
  return fallback;
}

export async function saveV3Layout({ userId, characterId, layout, storage = globalThis.localStorage } = {}) {
  if (!userId || !characterId) throw new TypeError("User and character IDs are required.");
  const normalized = normalizeV3Layout(layout);
  const local = isLocalRuntimeHost();
  cacheSnapshot(userId, characterId, { layout: normalized, pending: !local }, storage);
  if (local) return { ok: true, local: true, layout: cloneJSON(normalized) };
  try {
    const result = await requestLayout(characterId, {
      method: "PUT",
      body: JSON.stringify({ layout: normalized }),
    });
    cacheSnapshot(userId, characterId, { layout: result.layout, pending: false, updatedAt: result.updatedAt }, storage);
    return { ...result, layout: cloneJSON(result.layout) };
  } catch (error) {
    cacheSnapshot(userId, characterId, { layout: normalized, pending: true }, storage);
    throw error;
  }
}
