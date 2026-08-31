// Handles music API routing, validation, authorization, and D1 persistence.
import { authorized } from "../auth.js";
import { bodyJSON, error, json, parseStored, safeId } from "../http.js";

export function normalizeMusicLibrary(body) {
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
    if (track.loopable !== undefined && typeof track.loopable !== "boolean") return null;
    if (!Array.isArray(track.tags) || track.tags.length > 100) return null;
    if (!track.tags.every((tag) => typeof tag === "string" && tag.length > 0 && tag.length <= 64)) return null;
    tracks.push({
      id: track.id,
      title: track.title.trim(),
      url: track.url,
      tags: [...new Set(track.tags)],
      provider: track.provider,
      loopable: track.loopable === true,
      addedAt: track.addedAt,
    });
  }
  return { version: 1, tracks, settings: { fadeIn, fadeOut } };
}

export async function musicRoute(request, env) {
  if (request.method === "GET") {
    const row = await env.DB.prepare(
      "SELECT library_json, updated_at FROM music_library WHERE id = 'default'",
    ).first();
    return json({ library: row ? parseStored(row.library_json, null) : null, updatedAt: row?.updated_at || null });
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
