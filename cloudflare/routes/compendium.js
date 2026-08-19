import { error, json, parseStored } from "../http.js";

export async function compendiumCatalog(env) {
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

export async function compendiumCategory(category, env) {
  const rows = await env.DB.prepare(
    "SELECT detail_json FROM compendium_entries WHERE category = ? ORDER BY name",
  ).bind(category).all();
  return json({ entries: rows.results.map((row) => parseStored(row.detail_json, {})) }, 200, {
    "cache-control": "public, max-age=300",
  });
}
