const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
};
const MAX_JSON_BYTES = 1_800_000;
const ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,127}$/i;

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

function authorized(request, env) {
  if (!env.WRITE_TOKEN) return false;
  const header = request.headers.get("authorization") || "";
  return header.startsWith("Bearer ") && secureEqual(header.slice(7), env.WRITE_TOKEN);
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
  if (request.method !== "GET" && !authorized(request, env)) return error("Edit password required.", 401);

  if (!tail && request.method === "PUT") {
    const body = await bodyJSON(request);
    if (!body?.document || typeof body.document !== "object" || body.document.id !== id) {
      return error("Character document and route IDs must match.");
    }
    const now = new Date().toISOString();
    await env.DB.prepare(
      "INSERT INTO characters (id, document_json, source, active, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?) ON CONFLICT(id) DO UPDATE SET document_json = excluded.document_json, source = excluded.source, active = 1, updated_at = excluded.updated_at",
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
  if (!authorized(request, env)) return error("Edit password required.", 401);
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

async function wikiRoute(request, env) {
  if (request.method === "GET") {
    const row = await env.DB.prepare(
      "SELECT pages_json, updated_at FROM wiki_documents WHERE id = 'default'",
    ).first();
    if (!row) return error("The Wiki has not been seeded.", 404);
    return json({ pages: parseStored(row.pages_json, []), updatedAt: row.updated_at });
  }
  if (!authorized(request, env)) return error("Edit password required.", 401);
  if (request.method === "PUT") {
    const body = await bodyJSON(request);
    if (!Array.isArray(body?.pages) || !body.pages.every((page) => page?.id && page?.name)) {
      return error("Invalid Wiki document.");
    }
    const now = new Date().toISOString();
    await env.DB.prepare(
      "INSERT INTO wiki_documents (id, pages_json, updated_at) VALUES ('default', ?, ?) ON CONFLICT(id) DO UPDATE SET pages_json = excluded.pages_json, updated_at = excluded.updated_at",
    ).bind(JSON.stringify(body.pages), now).run();
    return json({ ok: true, updatedAt: now });
  }
  return error("Method not allowed.", 405);
}

export async function handleRequest(request, env) {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(request);
  if (!env.DB) return error("D1 binding is unavailable.", 503);
  try {
    if (url.pathname === "/api/health" && request.method === "GET") {
      await env.DB.prepare("SELECT 1").first();
      return json({ ok: true });
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
