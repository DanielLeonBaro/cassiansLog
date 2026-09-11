// Verifies additive personal-layout storage, isolation, cascading rename/delete, and idempotency.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");

const directory = path.resolve("cloudflare/migrations");
const files = fs.readdirSync(directory).filter((name) => name.endsWith(".sql")).sort();
const migrationName = "0015_user_character_layouts.sql";
const migration = fs.readFileSync(path.join(directory, migrationName), "utf8");
const database = new DatabaseSync(":memory:");
database.exec("PRAGMA foreign_keys = ON");
files.filter((name) => name < migrationName).forEach((name) => database.exec(fs.readFileSync(path.join(directory, name), "utf8")));

const now = "2026-09-09T00:00:00.000Z";
database.prepare("INSERT INTO users (id, email, password_hash, password_salt, password_iterations, roles_json, created_at, updated_at) VALUES ('one', 'one@example.com', 'h', 's', 1, '[]', ?, ?)").run(now, now);
database.prepare("INSERT INTO users (id, email, password_hash, password_salt, password_iterations, roles_json, created_at, updated_at) VALUES ('two', 'two@example.com', 'h', 's', 1, '[]', ?, ?)").run(now, now);
database.prepare("INSERT INTO characters (id, document_json, source, active, created_at, updated_at) VALUES ('hero', '{}', 'custom', 1, ?, ?)").run(now, now);
database.exec(migration);

const layout = '{"version":1,"columns":2,"sections":[]}';
database.prepare("INSERT INTO user_character_layouts (user_id, character_id, layout_json, updated_at) VALUES (?, 'hero', ?, ?)").run("one", layout, now);
database.prepare("INSERT INTO user_character_layouts (user_id, character_id, layout_json, updated_at) VALUES (?, 'hero', ?, ?)").run("two", layout, now);
assert.equal(database.prepare("SELECT COUNT(*) AS count FROM user_character_layouts WHERE character_id = 'hero'").get().count, 2, "Users keep isolated layouts for one character.");
database.prepare("UPDATE characters SET id = 'champion' WHERE id = 'hero'").run();
assert.equal(database.prepare("SELECT COUNT(*) AS count FROM user_character_layouts WHERE character_id = 'champion'").get().count, 2, "Character rename cascades to layouts.");
database.prepare("DELETE FROM characters WHERE id = 'champion'").run();
assert.equal(database.prepare("SELECT COUNT(*) AS count FROM user_character_layouts").get().count, 0, "Character deletion removes orphaned layouts.");

database.exec(migration);
assert.ok(database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'campaign_user_character_layouts'").get());
assert.doesNotMatch(migration, /\b(?:DROP|ALTER)\b/i, "Migration 0015 remains additive and rollback-compatible.");
console.log("Character-layout migration isolation and compatibility tests passed.");
