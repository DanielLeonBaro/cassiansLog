// Verifies theme-background migration on fresh and existing D1 schemas.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");

const directory = path.resolve("cloudflare/migrations");
const files = fs.readdirSync(directory).filter((name) => name.endsWith(".sql")).sort();
const migrationName = "0010_theme_backgrounds.sql";
const migration = fs.readFileSync(path.join(directory, migrationName), "utf8");
const removalMigrationName = "0011_remove_animated_backgrounds.sql";
const removalMigration = fs.readFileSync(path.join(directory, removalMigrationName), "utf8");

function apply(database, names) {
  names.forEach((name) => database.exec(fs.readFileSync(path.join(directory, name), "utf8")));
}

const fresh = new DatabaseSync(":memory:");
fresh.exec("PRAGMA foreign_keys = ON");
apply(fresh, files);
const freshColumn = fresh.prepare("PRAGMA table_info(user_theme_preferences)").all()
  .find((column) => column.name === "background_id");
assert.equal(freshColumn.notnull, 1);
assert.equal(freshColumn.dflt_value, "'default-squared'");

const upgraded = new DatabaseSync(":memory:");
upgraded.exec("PRAGMA foreign_keys = ON");
apply(upgraded, files.filter((name) => name < migrationName));
const now = "2026-08-31T00:00:00.000Z";
upgraded.prepare("INSERT INTO users (id, email, password_hash, password_salt, password_iterations, roles_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
  .run("user-1", "background@example.com", "hash", "salt", 1, "[]", now, now);
upgraded.prepare("INSERT INTO user_theme_preferences (user_id, theme_id, reversed, font_mode, updated_at) VALUES (?, ?, ?, ?, ?)")
  .run("user-1", "cassians-classic", 1, "white", now);
upgraded.exec(migration);
assert.deepEqual(
  { ...upgraded.prepare("SELECT theme_id, reversed, font_mode, background_id FROM user_theme_preferences WHERE user_id = ?").get("user-1") },
  { theme_id: "cassians-classic", reversed: 1, font_mode: "white", background_id: "default-squared" },
  "Existing theme choices must survive with Default Squared added.",
);

upgraded.prepare("UPDATE user_theme_preferences SET background_id = ? WHERE user_id = ?").run("fireflies", "user-1");
upgraded.prepare(`INSERT INTO user_theme_preferences (user_id, theme_id, reversed, font_mode, updated_at)
  VALUES (?, ?, ?, ?, ?)
  ON CONFLICT(user_id) DO UPDATE SET
    theme_id = excluded.theme_id,
    reversed = excluded.reversed,
    font_mode = excluded.font_mode,
    updated_at = excluded.updated_at`)
  .run("user-1", "evil-cassian", 0, "auto", now);
assert.equal(
  upgraded.prepare("SELECT background_id FROM user_theme_preferences WHERE user_id = ?").get("user-1").background_id,
  "fireflies",
  "A previous Worker version must keep working without erasing the new background.",
);
upgraded.exec(removalMigration);
assert.equal(
  upgraded.prepare("SELECT background_id FROM user_theme_preferences WHERE user_id = ?").get("user-1").background_id,
  "default-squared",
  "Removed animated backgrounds must return existing users to Default Squared.",
);
upgraded.prepare("UPDATE user_theme_preferences SET background_id = ? WHERE user_id = ?").run("graph-paper", "user-1");
upgraded.exec(removalMigration);
assert.equal(
  upgraded.prepare("SELECT background_id FROM user_theme_preferences WHERE user_id = ?").get("user-1").background_id,
  "graph-paper",
  "Static background choices must remain unchanged.",
);
assert.doesNotMatch(migration, /\b(?:DROP|DELETE)\b/i, "Migration must remain additive and preserve rollback to previous code.");
assert.doesNotMatch(removalMigration, /\b(?:DROP|DELETE)\b/i, "Removal migration must update only retired selections.");

console.log("Theme-background migration fresh, upgrade, and rollback compatibility tests passed.");
