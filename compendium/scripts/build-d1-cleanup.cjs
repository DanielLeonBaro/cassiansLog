// Builds reversible D1 cleanup SQL from full and cleaned Compendium indexes.
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");
const backupIndexPath = path.join(root, "compendium", "dataFullBackup", "index.json");
const cleanIndexPath = path.join(root, "compendium", "data", "index.json");
const cleanManifestPath = path.join(root, "compendium", "data", "manifest.json");
const cleanupPath = path.join(root, "cloudflare", "scripts", "remove-compendium-noise.sql");
const restorePath = path.join(root, "cloudflare", "scripts", "restore-compendium-noise.sql");
const backupTable = "compendium_entries_cleanup_backup_20260831";
const metaBackupTable = "app_meta_cleanup_backup_20260831";
const columns = "id, category, name, publication, type, index_json, detail_json, updated_at";

function readJSON(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function sql(value) {
  return `'${String(value).replace(/\0/g, "").replace(/'/g, "''")}'`;
}

function chunks(values, size) {
  const result = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

const fullIndex = readJSON(backupIndexPath).entries;
const cleanIndex = readJSON(cleanIndexPath).entries;
const cleanManifest = readJSON(cleanManifestPath);
const cleanIds = new Set(cleanIndex.map((entry) => entry.id));
const removedIds = fullIndex
  .filter((entry) => !cleanIds.has(entry.id))
  .map((entry) => entry.id)
  .sort((left, right) => left.localeCompare(right));

if (!removedIds.length) throw new Error("No removed Compendium entries found.");

const idChunks = chunks(removedIds, 200);
const cleanup = [
  "-- Reversible Compendium cleanup generated from compendium/dataFullBackup.",
  "-- Safe to rerun: original rows are retained in backup tables before deletion.",
  `CREATE TABLE IF NOT EXISTS ${backupTable} (`,
  "  id TEXT PRIMARY KEY,",
  "  category TEXT NOT NULL,",
  "  name TEXT NOT NULL,",
  "  publication TEXT NOT NULL DEFAULT '',",
  "  type TEXT NOT NULL DEFAULT '',",
  "  index_json TEXT NOT NULL,",
  "  detail_json TEXT NOT NULL,",
  "  updated_at TEXT NOT NULL",
  ");",
  `CREATE TABLE IF NOT EXISTS ${metaBackupTable} (`,
  "  key TEXT PRIMARY KEY,",
  "  value_json TEXT NOT NULL,",
  "  updated_at TEXT NOT NULL",
  ");",
  `INSERT OR IGNORE INTO ${metaBackupTable} (key, value_json, updated_at)`,
  "SELECT key, value_json, updated_at FROM app_meta WHERE key = 'compendium-manifest';",
  ...idChunks.map((ids) =>
    `INSERT OR IGNORE INTO ${backupTable} (${columns}) SELECT ${columns} FROM compendium_entries WHERE id IN (${ids.map(sql).join(", ")});`,
  ),
  ...idChunks.map((ids) =>
    `DELETE FROM compendium_entries WHERE id IN (${ids.map(sql).join(", ")});`,
  ),
  `UPDATE app_meta SET value_json = ${sql(JSON.stringify(cleanManifest))}, updated_at = ${sql(cleanManifest.generatedAt)} WHERE key = 'compendium-manifest';`,
  "SELECT COUNT(*) AS remaining_compendium_entries FROM compendium_entries;",
  `SELECT COUNT(*) AS backed_up_removed_entries FROM ${backupTable};`,
  "",
];

const restore = [
  "-- Restores rows and manifest saved by remove-compendium-noise.sql.",
  `INSERT OR REPLACE INTO compendium_entries (${columns}) SELECT ${columns} FROM ${backupTable};`,
  `INSERT OR REPLACE INTO app_meta (key, value_json, updated_at) SELECT key, value_json, updated_at FROM ${metaBackupTable} WHERE key = 'compendium-manifest';`,
  "SELECT COUNT(*) AS restored_compendium_entries FROM compendium_entries;",
  "",
];

fs.writeFileSync(cleanupPath, cleanup.join("\n"), "utf8");
fs.writeFileSync(restorePath, restore.join("\n"), "utf8");
console.log(`Created D1 cleanup for ${removedIds.length.toLocaleString()} Compendium entries.`);
