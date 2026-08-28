const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");

const directory = path.resolve("cloudflare/migrations");
const files = fs.readdirSync(directory).filter((name) => name.endsWith(".sql")).sort();
const screenMigration = fs.readFileSync(path.join(directory, "0009_user_screens.sql"), "utf8");

function apply(database, names = files) {
  names.forEach((name) => database.exec(fs.readFileSync(path.join(directory, name), "utf8")));
}

const fresh = new DatabaseSync(":memory:");
fresh.exec("PRAGMA foreign_keys = ON");
apply(fresh);
assert.deepEqual(
  fresh.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('user_screens', 'screen_calculator_history') ORDER BY name").all().map((row) => row.name),
  ["screen_calculator_history", "user_screens"],
);
assert.equal(fresh.prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'idx_screen_calculator_history'").get().name, "idx_screen_calculator_history");
assert.deepEqual(
  { ...fresh.prepare("SELECT json_extract(settings_json, '$.sections.player-screen') AS player, json_extract(settings_json, '$.sections.dm-screen') AS dm FROM app_settings WHERE id = 'default'").get() },
  { player: 1, dm: 1 },
);
fresh.exec(screenMigration);
assert.equal(fresh.prepare("SELECT COUNT(*) AS count FROM user_screens").get().count, 0, "Migration 0009 should be idempotent.");

const upgraded = new DatabaseSync(":memory:");
upgraded.exec("PRAGMA foreign_keys = ON");
apply(upgraded, files.filter((name) => name < "0009_user_screens.sql"));
upgraded.exec("UPDATE app_settings SET settings_json = json_set(settings_json, '$.sections.player-screen', json('false')) WHERE id = 'default'");
upgraded.exec(screenMigration);
assert.deepEqual(
  { ...upgraded.prepare("SELECT json_extract(settings_json, '$.sections.player-screen') AS player, json_extract(settings_json, '$.sections.dm-screen') AS dm FROM app_settings WHERE id = 'default'").get() },
  { player: 0, dm: 1 },
  "Migration must preserve an existing Player Screen setting while adding a missing DM Screen setting.",
);

const now = "2026-08-28T00:00:00.000Z";
upgraded.prepare("INSERT INTO users (id, email, password_hash, password_salt, password_iterations, roles_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run("user-1", "screen@example.com", "hash", "salt", 1, "[]", now, now);
upgraded.prepare("INSERT INTO user_screens (user_id, screen_kind, document_json, updated_at) VALUES (?, ?, ?, ?)").run("user-1", "player", '{"version":1,"widgets":[]}', now);
upgraded.prepare("INSERT INTO screen_calculator_history (user_id, screen_kind, widget_id, expression, result, created_at) VALUES (?, ?, ?, ?, ?, ?)").run("user-1", "player", "calc-1", "2+2", "4", now);
assert.throws(
  () => upgraded.prepare("INSERT INTO user_screens (user_id, screen_kind, document_json, updated_at) VALUES (?, ?, ?, ?)").run("user-1", "other", "{}", now),
  /CHECK constraint failed/,
);
upgraded.prepare("DELETE FROM users WHERE id = ?").run("user-1");
assert.equal(upgraded.prepare("SELECT COUNT(*) AS count FROM user_screens").get().count, 0);
assert.equal(upgraded.prepare("SELECT COUNT(*) AS count FROM screen_calculator_history").get().count, 0);
assert.doesNotMatch(screenMigration, /\b(?:DROP|ALTER)\b/i, "Rollback remains code-only because migration 0009 is additive.");

console.log("Screen migration fresh, upgrade, idempotency, and rollback-compatibility tests passed.");
