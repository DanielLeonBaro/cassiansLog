import { normalizeWikiPages } from "../wiki/js/model.js";

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
};
const MAX_JSON_BYTES = 1_800_000;
const ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,127}$/i;
const CHARACTER_SHEET_STYLES = new Set(["v1", "v2"]);
const DEFAULT_SECTIONS = {
  characters: true, "combat-loot": true, compendium: true, music: true, wiki: false,
  "character-overview": true, "character-stats": true, "hit-points": true,
  combat: true, spellcasting: true, "prepared-spells": true,
  "all-possibilities": true, inventory: true, notes: true,
};

function json(value, status = 200, headers = {}) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { ...JSON_HEADERS, ...headers },
  });
}

function error(message, status = 400) {
  return json({ error: message }, status);
}

function safeId(value) {
  return ID_PATTERN.test(value || "") ? value : null;
}

async function staticAsset(request, env, url) {
  const response = await env.ASSETS.fetch(request);
  if (response.status !== 404 || request.method !== "GET") return response;

  if (/^\/char\/[a-z0-9][a-z0-9-]{0,127}\/?$/i.test(url.pathname)) {
    const templateURL = new URL("/char/template/", url);
    templateURL.search = url.search;
    return env.ASSETS.fetch(new Request(templateURL.toString(), request));
  }
  if (/^\/wiki\/[^/]+\/?$/i.test(url.pathname)) {
    const wikiURL = new URL("/wiki/", url);
    return env.ASSETS.fetch(new Request(wikiURL.toString(), request));
  }
  return response;
}

function secureEqual(left, right) {
  const a = new TextEncoder().encode(left || "");
  const b = new TextEncoder().encode(right || "");
  let mismatch = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    mismatch |= (a[index] || 0) ^ (b[index] || 0);
  }
  return mismatch === 0;
}

function tokenAuthorized(request, token) {
  if (!token) return false;
  const header = request.headers.get("authorization") || "";
  return header.startsWith("Bearer ") && secureEqual(header.slice(7), token);
}

function storedCharacterSheetStyleOverrides(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([id, style]) => (
    safeId(id) && CHARACTER_SHEET_STYLES.has(style)
  )));
}

async function loadSettings(env) {
  let row = null;
  try {
    row = await env.DB.prepare(
      "SELECT settings_json, updated_at FROM app_settings WHERE id = 'default'",
    ).first();
  } catch (caught) {
    console.warn("D1 runtime settings are unavailable; using deployment defaults.", caught);
  }
  const stored = parseStored(row?.settings_json, {});
  return {
    sections: { ...DEFAULT_SECTIONS, ...(stored.sections || {}) },
    openWrites: typeof stored.openWrites === "boolean" ? stored.openWrites : env.OPEN_WRITES === "true",
    characterSheetStyle: CHARACTER_SHEET_STYLES.has(stored.characterSheetStyle)
      ? stored.characterSheetStyle
      : "v1",
    characterSheetStyleOverrides: storedCharacterSheetStyleOverrides(
      stored.characterSheetStyleOverrides,
    ),
    updatedAt: row?.updated_at || null,
  };
}

async function authorized(request, env) {
  if ((await loadSettings(env)).openWrites) return true;
  return tokenAuthorized(request, env.WRITE_TOKEN);
}

function adminAuthorized(request, env) {
  return tokenAuthorized(request, env.ADMIN_TOKEN || env.WRITE_TOKEN);
}

async function bodyJSON(request) {
  const length = Number(request.headers.get("content-length")) || 0;
  if (length > MAX_JSON_BYTES) throw new RangeError("The document is too large.");
  const text = await request.text();
  if (new TextEncoder().encode(text).length > MAX_JSON_BYTES) {
    throw new RangeError("The document is too large.");
  }
  return JSON.parse(text);
}

function parseStored(value, fallback = null) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

async function compendiumCatalog(env) {
  const [meta, rows] = await Promise.all([
    env.DB.prepare("SELECT value_json FROM app_meta WHERE key = 'compendium-manifest'").first(),
    env.DB.prepare("SELECT index_json FROM compendium_entries ORDER BY name, publication").all(),
  ]);
  if (!meta) return error("The Compendium has not been seeded.", 503);
  return json({
    manifest: parseStored(meta.value_json, {}),
    entries: rows.results.map((row) => parseStored(row.index_json, {})),
  }, 200, { "cache-control": "public, max-age=300" });
}

async function compendiumCategory(category, env) {
  const rows = await env.DB.prepare(
    "SELECT detail_json FROM compendium_entries WHERE category = ? ORDER BY name",
  ).bind(category).all();
  return json({ entries: rows.results.map((row) => parseStored(row.detail_json, {})) }, 200, {
    "cache-control": "public, max-age=300",
  });
}

async function listCharacters(env) {
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

async function characterRoute(request, env, id, tail) {
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
  return error("Method not allowed.", 405);
}

async function combatSnapshot(env) {
  const [presets, draft] = await Promise.all([
    env.DB.prepare("SELECT * FROM combat_presets ORDER BY created_at").all(),
    env.DB.prepare("SELECT draft_json FROM combat_drafts WHERE id = 'default'").first(),
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
  });
}

async function combatRoute(request, env, parts) {
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
  return error("Method not allowed.", 405);
}

function normalizeMusicLibrary(body) {
  if (!body || typeof body !== "object" || body.version !== 1 || !Array.isArray(body.tracks)) return null;
  if (body.tracks.length > 2000 || !body.settings || typeof body.settings !== "object") return null;
  const fadeIn = Number(body.settings.fadeIn);
  const fadeOut = Number(body.settings.fadeOut);
  if (![fadeIn, fadeOut].every((value) => Number.isFinite(value) && value >= 0 && value <= 30)) return null;
  const tracks = [];
  for (const track of body.tracks) {
    if (!safeId(track?.id) || typeof track.title !== "string" || !track.title.trim() || track.title.length > 120) return null;
    if (typeof track.url !== "string" || !track.url || track.url.length > 2048) return null;
    if (!["youtube", "spotify"].includes(track.provider) || typeof track.addedAt !== "string") return null;
    if (!Array.isArray(track.tags) || track.tags.length > 100) return null;
    if (!track.tags.every((tag) => typeof tag === "string" && tag.length > 0 && tag.length <= 64)) return null;
    tracks.push({
      id: track.id,
      title: track.title.trim(),
      url: track.url,
      tags: [...new Set(track.tags)],
      provider: track.provider,
      addedAt: track.addedAt,
    });
  }
  return { version: 1, tracks, settings: { fadeIn, fadeOut } };
}

async function musicRoute(request, env) {
  if (request.method === "GET") {
    const row = await env.DB.prepare(
      "SELECT library_json, updated_at FROM music_library WHERE id = 'default'",
    ).first();
    return json({
      library: row ? parseStored(row.library_json, null) : null,
      updatedAt: row?.updated_at || null,
    });
  }
  if (request.method !== "PUT") return error("Method not allowed.", 405);
  if (!await authorized(request, env)) return error("Edit password required.", 401);
  const library = normalizeMusicLibrary(await bodyJSON(request));
  if (!library) return error("Invalid Music library.");
  const now = new Date().toISOString();
  await env.DB.prepare(
    "INSERT INTO music_library (id, library_json, updated_at) VALUES ('default', ?, ?) ON CONFLICT(id) DO UPDATE SET library_json = excluded.library_json, updated_at = excluded.updated_at",
  ).bind(JSON.stringify(library), now).run();
  return json({ ok: true, updatedAt: now });
}

async function wikiRoute(request, env) {
  if (request.method === "GET") {
    const row = await env.DB.prepare(
      "SELECT pages_json, updated_at FROM wiki_documents WHERE id = 'default'",
    ).first();
    if (!row) return error("The Wiki has not been seeded.", 404);
    const storedPages = parseStored(row.pages_json);
    if (!Array.isArray(storedPages) || !storedPages.every((page) => page?.id && page?.name)) {
      return error("The Wiki document is invalid.", 500);
    }
    const pages = normalizeWikiPages(storedPages);
    let updatedAt = row.updated_at;
    if (JSON.stringify(pages) !== JSON.stringify(storedPages)) {
      updatedAt = new Date().toISOString();
      await env.DB.prepare(
        "UPDATE wiki_documents SET pages_json = ?, updated_at = ? WHERE id = 'default'",
      ).bind(JSON.stringify(pages), updatedAt).run();
    }
    return json({ pages, updatedAt });
  }
  if (!await authorized(request, env)) return error("Edit password required.", 401);
  if (request.method === "PUT") {
    const body = await bodyJSON(request);
    if (!Array.isArray(body?.pages) || !body.pages.every((page) => page?.id && page?.name)) {
      return error("Invalid Wiki document.");
    }
    const pages = normalizeWikiPages(body.pages);
    const now = new Date().toISOString();
    await env.DB.prepare(
      "INSERT INTO wiki_documents (id, pages_json, updated_at) VALUES ('default', ?, ?) ON CONFLICT(id) DO UPDATE SET pages_json = excluded.pages_json, updated_at = excluded.updated_at",
    ).bind(JSON.stringify(pages), now).run();
    return json({ ok: true, updatedAt: now });
  }
  return error("Method not allowed.", 405);
}

async function publicSettings(env) {
  const settings = await loadSettings(env);
  return json({
    sections: settings.sections,
    characterSheetStyle: settings.characterSheetStyle,
    characterSheetStyleOverrides: settings.characterSheetStyleOverrides,
    writeProtectionEnabled: !settings.openWrites,
    updatedAt: settings.updatedAt,
  });
}

function normalizeSettings(body) {
  if (!body || typeof body !== "object" || typeof body.openWrites !== "boolean") return null;
  if (!body.sections || typeof body.sections !== "object" || Array.isArray(body.sections)) return null;
  if (!CHARACTER_SHEET_STYLES.has(body.characterSheetStyle)) return null;
  const styleOverrides = body.characterSheetStyleOverrides ?? {};
  if (!styleOverrides || typeof styleOverrides !== "object" || Array.isArray(styleOverrides)) return null;
  if (!Object.entries(styleOverrides).every(([id, style]) => (
    safeId(id) && CHARACTER_SHEET_STYLES.has(style)
  ))) return null;
  const sections = {};
  for (const key of Object.keys(DEFAULT_SECTIONS)) {
    if (typeof body.sections[key] !== "boolean") return null;
    sections[key] = body.sections[key];
  }
  return {
    sections,
    openWrites: body.openWrites,
    characterSheetStyle: body.characterSheetStyle,
    characterSheetStyleOverrides: { ...styleOverrides },
  };
}

async function adminRoute(request, env, parts) {
  if (!adminAuthorized(request, env)) return error("Admin password required.", 401);
  if (request.method === "GET" && parts.length === 0) {
    const [settings, characters] = await Promise.all([
      loadSettings(env),
      env.DB.prepare(
        "SELECT id, document_json, source, active, updated_at FROM characters ORDER BY id",
      ).all(),
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
    const settings = normalizeSettings(await bodyJSON(request));
    if (!settings) return error("Invalid application settings.");
    const now = new Date().toISOString();
    await env.DB.prepare(
      "INSERT INTO app_settings (id, settings_json, updated_at) VALUES ('default', ?, ?) ON CONFLICT(id) DO UPDATE SET settings_json = excluded.settings_json, updated_at = excluded.updated_at",
    ).bind(JSON.stringify(settings), now).run();
    return json({ ok: true, settings: { ...settings, updatedAt: now } });
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

export async function handleRequest(request, env) {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/api/")) return staticAsset(request, env, url);
  if (!env.DB) return error("D1 binding is unavailable.", 503);
  try {
    if (url.pathname === "/api/health" && request.method === "GET") {
      await env.DB.prepare("SELECT 1").first();
      return json({ ok: true });
    }
    if (url.pathname === "/api/settings" && request.method === "GET") return publicSettings(env);
    if (url.pathname === "/api/admin" || url.pathname.startsWith("/api/admin/")) {
      const parts = url.pathname.slice("/api/admin".length).split("/").filter(Boolean).map(decodeURIComponent);
      return adminRoute(request, env, parts);
    }
    if (url.pathname === "/api/compendium/catalog" && request.method === "GET") {
      return compendiumCatalog(env);
    }
    if (url.pathname.startsWith("/api/compendium/categories/") && request.method === "GET") {
      const category = safeId(decodeURIComponent(url.pathname.split("/").at(-1)));
      return category ? compendiumCategory(category, env) : error("Invalid category.");
    }
    if (url.pathname === "/api/characters" && request.method === "GET") return listCharacters(env);
    if (url.pathname.startsWith("/api/characters/")) {
      const parts = url.pathname.slice("/api/characters/".length).split("/").map(decodeURIComponent);
      return characterRoute(request, env, parts[0], parts[1] || "");
    }
    if (url.pathname === "/api/combat-loot" || url.pathname.startsWith("/api/combat-loot/")) {
      const parts = url.pathname.slice("/api/combat-loot".length).split("/").filter(Boolean).map(decodeURIComponent);
      return combatRoute(request, env, parts);
    }
    if (url.pathname === "/api/music") return musicRoute(request, env);
    if (url.pathname === "/api/wiki") return wikiRoute(request, env);
    return error("API route not found.", 404);
  } catch (caught) {
    console.error("API request failed", caught);
    if (caught instanceof SyntaxError) return error("Request body must be valid JSON.");
    if (caught instanceof RangeError) return error(caught.message, 413);
    return error("The database request failed.", 500);
  }
}

export default {
  fetch: handleRequest,
};
