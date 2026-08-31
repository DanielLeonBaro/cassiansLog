// Verifies reversible, idempotent Compendium cleanup SQL against SQLite.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { DatabaseSync } = require("node:sqlite");

const fullIndex = JSON.parse(
  fs.readFileSync("compendium/dataFullBackup/index.json", "utf8"),
).entries;
const cleanIndex = JSON.parse(
  fs.readFileSync("compendium/data/index.json", "utf8"),
).entries;
const cleanManifest = JSON.parse(
  fs.readFileSync("compendium/data/manifest.json", "utf8"),
);
const cleanIds = new Set(cleanIndex.map((entry) => entry.id));
const removed = fullIndex.find((entry) => !cleanIds.has(entry.id));
const kept = cleanIndex[0];

assert.ok(removed);
assert.ok(kept);

const database = new DatabaseSync(":memory:");
database.exec(`
  CREATE TABLE app_meta (
    key TEXT PRIMARY KEY,
    value_json TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE compendium_entries (
    id TEXT PRIMARY KEY,
    category TEXT NOT NULL,
    name TEXT NOT NULL,
    publication TEXT NOT NULL DEFAULT '',
    type TEXT NOT NULL DEFAULT '',
    index_json TEXT NOT NULL,
    detail_json TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`);

database.prepare(
  "INSERT INTO app_meta (key, value_json, updated_at) VALUES (?, ?, ?)",
).run("compendium-manifest", '{"entries":16153}', "before-cleanup");
const insertEntry = database.prepare(
  "INSERT INTO compendium_entries (id, category, name, publication, type, index_json, detail_json, updated_at) VALUES (?, ?, ?, ?, ?, '{}', '{}', 'before-cleanup')",
);
for (const entry of [removed, kept]) {
  insertEntry.run(entry.id, entry.category, entry.name, entry.publication, entry.type);
}

const cleanupSQL = fs.readFileSync(
  "cloudflare/scripts/remove-compendium-noise.sql",
  "utf8",
);
database.exec(cleanupSQL);
database.exec(cleanupSQL);

assert.equal(
  database.prepare("SELECT COUNT(*) AS count FROM compendium_entries").get().count,
  1,
);
assert.equal(
  database.prepare("SELECT id FROM compendium_entries").get().id,
  kept.id,
);
assert.equal(
  database.prepare("SELECT COUNT(*) AS count FROM compendium_entries_cleanup_backup_20260831").get().count,
  1,
);
assert.equal(
  JSON.parse(database.prepare("SELECT value_json FROM app_meta WHERE key = 'compendium-manifest'").get().value_json).entries,
  cleanManifest.entries,
);

database.exec(
  fs.readFileSync("cloudflare/scripts/restore-compendium-noise.sql", "utf8"),
);
assert.equal(
  database.prepare("SELECT COUNT(*) AS count FROM compendium_entries").get().count,
  2,
);
assert.equal(
  database.prepare("SELECT updated_at FROM app_meta WHERE key = 'compendium-manifest'").get().updated_at,
  "before-cleanup",
);
database.close();

console.log("Compendium cleanup SQL tests passed.");
