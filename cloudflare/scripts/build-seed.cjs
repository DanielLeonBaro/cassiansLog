const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");
const output = path.join(root, ".cloudflare", "d1-seed.sql");
const dataRoot = path.join(root, "compendium", "data");

function readJSON(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function sql(value) {
  return `'${String(value).replace(/\0/g, "").replace(/'/g, "''")}'`;
}

const manifest = readJSON(path.join(dataRoot, "manifest.json"));
const index = readJSON(path.join(dataRoot, "index.json"));
const indexById = new Map(index.entries.map((entry) => [entry.id, entry]));
const generatedAt = manifest.generatedAt || new Date(0).toISOString();
const statements = [
  `INSERT INTO app_meta (key, value_json, updated_at) VALUES ('compendium-manifest', ${sql(JSON.stringify(manifest))}, ${sql(generatedAt)}) ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at;`,
];

let entryCount = 0;
for (const category of manifest.categories) {
  const data = readJSON(path.join(dataRoot, category.file));
  for (const detail of data.entries) {
    const summary = indexById.get(detail.id);
    if (!summary) throw new Error(`Missing index entry for ${detail.id}`);
    const values = [
      detail.id,
      category.id,
      summary.name || detail.name || "",
      summary.publication || detail.publication || "",
      summary.type || detail.type || "",
      JSON.stringify(summary),
      JSON.stringify(detail),
      generatedAt,
    ].map(sql).join(", ");
    statements.push(`INSERT INTO compendium_entries (id, category, name, publication, type, index_json, detail_json, updated_at) VALUES (${values}) ON CONFLICT(id) DO UPDATE SET category = excluded.category, name = excluded.name, publication = excluded.publication, type = excluded.type, index_json = excluded.index_json, detail_json = excluded.detail_json, updated_at = excluded.updated_at;`);
    entryCount += 1;
  }
}

const catalog = readJSON(path.join(root, "char", "catalog.json"));
for (const id of catalog.characters) {
  const document = readJSON(path.join(root, "char", id, "character.json"));
  const timestamp = generatedAt;
  statements.push(`INSERT INTO characters (id, document_json, source, active, created_at, updated_at) VALUES (${sql(id)}, ${sql(JSON.stringify(document))}, 'bundled', 1, ${sql(timestamp)}, ${sql(timestamp)}) ON CONFLICT(id) DO NOTHING;`);
}

fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, `${statements.join("\n")}\n`);
console.log(`Created ${output} with ${entryCount} compendium entries and ${catalog.characters.length} characters.`);
