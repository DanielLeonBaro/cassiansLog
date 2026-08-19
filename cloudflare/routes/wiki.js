import { normalizeWikiPages } from "../../wiki/js/model.js";
import { authorized } from "../auth.js";
import { bodyJSON, error, json, parseStored } from "../http.js";

export async function wikiRoute(request, env) {
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
