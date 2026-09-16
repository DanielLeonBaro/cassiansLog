// Verifies additive, isolated, idempotent Character Builder draft storage.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");

const directory = path.resolve("cloudflare/migrations");
const files = fs.readdirSync(directory).filter((name) => name.endsWith(".sql")).sort();
const migrationName = "0017_character_build_drafts.sql";
const migration = fs.readFileSync(path.join(directory, migrationName), "utf8");

const freshDatabase = new DatabaseSync(":memory:");
freshDatabase.exec("PRAGMA foreign_keys = ON");
files.forEach((name) => freshDatabase.exec(fs.readFileSync(path.join(directory, name), "utf8")));
for (const table of ["character_build_drafts", "campaign_character_build_drafts"]) {
  assert.equal(
    freshDatabase.prepare("SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name = ?").get(table).count,
    1,
    `Fresh migration chain creates ${table}.`,
  );
}
freshDatabase.exec(migration);

const database = new DatabaseSync(":memory:");
database.exec("PRAGMA foreign_keys = ON");
files.filter((name) => name < migrationName).forEach((name) => database.exec(fs.readFileSync(path.join(directory, name), "utf8")));

const now = "2026-09-14T00:00:00.000Z";
for (const id of ["one", "two"]) database.prepare(
  "INSERT INTO users (id, email, password_hash, password_salt, password_iterations, roles_json, created_at, updated_at) VALUES (?, ?, 'h', 's', 1, '[]', ?, ?)",
).run(id, `${id}@example.com`, now, now);
database.prepare("INSERT INTO campaigns (id, name, created_at, updated_at) VALUES ('campaign-two', 'Second', ?, ?)").run(now, now);
database.prepare("INSERT INTO characters (id, document_json, source, active, created_at, updated_at) VALUES ('existing', '{}', 'custom', 1, ?, ?)").run(now, now);

database.exec(migration);
const incomplete = JSON.stringify({ id: "draft-character", characterSchemaVersion: 2, build: { version: 1, status: "incomplete" } });
database.prepare(
  "INSERT INTO character_build_drafts (user_id, draft_id, document_json, current_step, status, version, created_at, updated_at) VALUES (?, 'same', ?, 'class', 'incomplete', 1, ?, ?)",
).run("one", incomplete, now, now);
database.prepare(
  "INSERT INTO character_build_drafts (user_id, draft_id, document_json, current_step, status, version, created_at, updated_at) VALUES (?, 'same', ?, 'home', 'incomplete', 1, ?, ?)",
).run("two", incomplete, now, now);
for (const campaignId of ["campaign-breugaire", "campaign-two"]) database.prepare(
  "INSERT INTO campaign_character_build_drafts (campaign_id, user_id, draft_id, document_json, current_step, status, version, created_at, updated_at) VALUES (?, 'one', 'same', ?, 'review', 'complete', 1, ?, ?)",
).run(campaignId, incomplete, now, now);

assert.equal(database.prepare("SELECT COUNT(*) AS count FROM character_build_drafts WHERE draft_id = 'same'").get().count, 2);
assert.equal(database.prepare("SELECT COUNT(*) AS count FROM campaign_character_build_drafts WHERE draft_id = 'same'").get().count, 2);
assert.equal(database.prepare("SELECT COUNT(*) AS count FROM characters WHERE id = 'existing'").get().count, 1, "Existing Characters survive expansion.");
database.exec(migration);
assert.equal(database.prepare("SELECT COUNT(*) AS count FROM character_build_drafts").get().count, 2, "Reapplying migration preserves drafts.");
assert.doesNotMatch(migration, /\b(?:DROP|ALTER)\b/i, "Migration remains additive.");

database.prepare("DELETE FROM users WHERE id = 'one'").run();
assert.equal(database.prepare("SELECT COUNT(*) AS count FROM character_build_drafts WHERE user_id = 'one'").get().count, 0);
assert.equal(database.prepare("SELECT COUNT(*) AS count FROM campaign_character_build_drafts WHERE user_id = 'one'").get().count, 0);
assert.equal(database.prepare("SELECT COUNT(*) AS count FROM character_build_drafts WHERE user_id = 'two'").get().count, 1);

console.log("Character Builder draft migration fresh, upgrade, preservation, isolation, and idempotency tests passed.");
