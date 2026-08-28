import { initiativeNamesFromSnapshot } from "../../public-initiative/js/model.js";
import { json, parseStored } from "../http.js";

export async function publicInitiativeRoute(env) {
  const row = await env.DB.prepare(
    "SELECT draft_json, updated_at FROM combat_drafts WHERE id = 'default'",
  ).first();
  const draft = row ? parseStored(row.draft_json) : null;
  return json({ names: initiativeNamesFromSnapshot({ draft }), updatedAt: row?.updated_at || null });
}
