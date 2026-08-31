// Verifies theme D1 CRUD and assignments.
import assert from "node:assert/strict";
import fs from "node:fs";
import { adminRoute } from "../routes/admin.js";
import { adminThemeRoute } from "../routes/admin-themes.js";
import { authRoute } from "../routes/auth.js";
import { assignUserTheme, saveUserThemePreference } from "../themes.js";

const themes = new Map([
  ["cassians-classic", { id: "cassians-classic", name: "Cassian’s Classic", background_name: "Charcoal Gray", background_hex: "#18181B", accent_name: "Brick Red", accent_hex: "#B83B35", protected: 1, updated_at: "old" }],
  ["custom", { id: "custom", name: "Custom", background_name: "Blue", background_hex: "#123456", accent_name: "Cream", accent_hex: "#FFF1D2", protected: 0, updated_at: "old" }],
]);
const users = new Set(["user-1"]);
const preferences = new Map([["user-1", {
  theme_id: "custom",
  reversed: 1,
  font_mode: "white",
  background_id: "graph-paper",
  updated_at: "old",
}]]);

function statement(sql) {
  return {
    sql,
    values: [],
    bind(...values) { this.values = values; return this; },
    async all() {
      if (sql.includes("FROM oauth_accounts")) return { results: [] };
      return { results: [] };
    },
    async first() {
      if (sql === "SELECT id FROM users WHERE email = ? COLLATE NOCASE") return { id: "primary-admin" };
      if (sql.includes("FROM user_sessions JOIN users")) return { id: "user-1", email: "player@example.com", roles_json: '["characters"]' };
      if (sql.includes("FROM themes WHERE id = ?")) return themes.get(this.values[0]) || null;
      if (sql.includes("COUNT(*) AS count")) return { count: [...preferences.values()].filter((item) => item.theme_id === this.values[0]).length };
      if (sql.includes("FROM users WHERE id = ?")) return users.has(this.values[0]) ? { id: this.values[0] } : null;
      if (sql.includes("FROM user_theme_preferences WHERE user_id = ?")) return preferences.get(this.values[0]) || null;
      return null;
    },
    async run() {
      if (sql.includes("COUNT(*) AS count")) return { results: [await this.first()], meta: { changes: 0 } };
      if (sql.startsWith("INSERT INTO themes")) {
        const [id, name, backgroundName, backgroundHex, accentName, accentHex, createdAt, updatedAt] = this.values;
        if ([...themes.values()].some((theme) => theme.name.toLowerCase() === name.toLowerCase())) throw new Error("UNIQUE constraint failed: themes.name");
        themes.set(id, { id, name, background_name: backgroundName, background_hex: backgroundHex, accent_name: accentName, accent_hex: accentHex, protected: 0, created_at: createdAt, updated_at: updatedAt });
      } else if (sql.startsWith("UPDATE themes SET")) {
        const [name, backgroundName, backgroundHex, accentName, accentHex, updatedAt, id] = this.values;
        themes.set(id, { ...themes.get(id), name, background_name: backgroundName, background_hex: backgroundHex, accent_name: accentName, accent_hex: accentHex, updated_at: updatedAt });
      } else if (sql.startsWith("DELETE FROM themes")) {
        const [id] = this.values;
        if (sql.includes("NOT EXISTS") && [...preferences.values()].some((value) => value.theme_id === id)) {
          return { meta: { changes: 0 } };
        }
        themes.delete(id);
        for (const [userId, value] of preferences) if (value.theme_id === id) preferences.delete(userId);
      } else if (sql.startsWith("INSERT INTO user_theme_preferences")) {
        const [userId, themeId, reversed, fontMode, backgroundId, updatedAt] = this.values.length === 6
          ? this.values
          : [this.values[0], this.values[1], 0, "auto", "default-squared", this.values[2]];
        const previous = preferences.get(userId);
        preferences.set(userId, sql.includes("ON CONFLICT(user_id) DO UPDATE SET theme_id") && previous
          ? { ...previous, theme_id: themeId, updated_at: updatedAt }
          : { theme_id: themeId, reversed, font_mode: fontMode, background_id: backgroundId, updated_at: updatedAt });
      }
      return { meta: { changes: 1 } };
    },
  };
}

const env = { DB: {
  prepare: statement,
  batch: (statements) => Promise.all(statements.map((item) => item.run())),
} };
const invalid = await adminThemeRoute(new Request("https://example.test/api/admin/themes", {
  method: "POST",
  body: JSON.stringify({ name: "Bad", backgroundName: "Blue", backgroundHex: "blue", accentName: "Cream", accentHex: "#FFF1D2" }),
}), env, ["themes"]);
assert.equal(invalid.status, 400);

const duplicate = await adminThemeRoute(new Request("https://example.test/api/admin/themes", {
  method: "POST",
  body: JSON.stringify({ name: " custom ", backgroundName: "Blue", backgroundHex: "#123456", accentName: "Cream", accentHex: "#FFF1D2" }),
}), env, ["themes"]);
assert.equal(duplicate.status, 409, "Theme names must be unique case-insensitively.");

const created = await adminThemeRoute(new Request("https://example.test/api/admin/themes", {
  method: "POST",
  body: JSON.stringify({ name: "  New Theme  ", backgroundName: "Night", backgroundHex: "#112233", accentName: "Glow", accentHex: "#aabbcc" }),
}), env, ["themes"]);
assert.equal(created.status, 201);
const createdTheme = (await created.json()).theme;
assert.equal(createdTheme.name, "New Theme");
assert.equal(createdTheme.accentHex, "#AABBCC");

const edited = await adminThemeRoute(new Request("https://example.test/api/admin/themes/custom", {
  method: "PUT",
  body: JSON.stringify({ name: "Custom Updated", backgroundName: "Ocean", backgroundHex: "#234567", accentName: "Sand", accentHex: "#FFEEDD" }),
}), env, ["themes", "custom"]);
assert.equal(edited.status, 200);
assert.equal((await edited.json()).theme.id, "custom", "Editing a theme must preserve its stable ID.");

const protectedDelete = await adminThemeRoute(new Request("https://example.test/api/admin/themes/cassians-classic", { method: "DELETE" }), env, ["themes", "cassians-classic"]);
assert.equal(protectedDelete.status, 409);
const needsConfirmation = await adminThemeRoute(new Request("https://example.test/api/admin/themes/custom", { method: "DELETE" }), env, ["themes", "custom"]);
assert.equal(needsConfirmation.status, 409);
const confirmationBody = await needsConfirmation.json();
assert.equal(confirmationBody.peopleUsingTheme, 1);
assert.equal(confirmationBody.error, "People using this theme: 1. Removing it will return them to Cassian’s Classic.");
assert.equal(themes.has("custom"), true, "An in-use theme must remain until deletion is explicitly confirmed.");

const assigned = await assignUserTheme("user-1", "cassians-classic", env);
assert.equal(assigned.preference.themeId, "cassians-classic");
assert.equal(assigned.preference.reversed, true, "Admin assignment must preserve reverse choice.");
assert.equal(assigned.preference.fontMode, "white", "Admin assignment must preserve font choice.");
assert.equal(assigned.preference.backgroundId, "graph-paper", "Admin assignment must preserve background choice.");
const saved = await saveUserThemePreference("user-1", {
  themeId: "custom",
  reversed: false,
  fontMode: "black",
  backgroundId: "graph-paper",
}, env);
assert.equal(saved.themeId, "custom");
assert.equal(preferences.get("user-1").font_mode, "black", "The latest account save must replace the complete preference.");
assert.equal(preferences.get("user-1").background_id, "graph-paper");

const removed = await adminThemeRoute(new Request("https://example.test/api/admin/themes/custom?confirm=1", { method: "DELETE" }), env, ["themes", "custom"]);
assert.equal(removed.status, 200);
assert.equal((await removed.json()).resetUsers, 1);
assert.equal(preferences.has("user-1"), false, "Deleting an assigned theme must cascade its preference.");

const anonymousThemeWrite = await authRoute(new Request("https://example.test/api/auth/theme", {
  method: "PUT",
  body: JSON.stringify({ themeId: "cassians-classic", reversed: false, fontMode: "auto" }),
}), env, ["theme"]);
assert.equal(anonymousThemeWrite.status, 401, "Open-write authorization must never replace a signed-in session for theme preferences.");
const authenticatedThemeWrite = await authRoute(new Request("https://example.test/api/auth/theme", {
  method: "PUT",
  headers: { cookie: "cassianslog_session=test" },
  body: JSON.stringify({ themeId: "cassians-classic", reversed: true, fontMode: "auto", backgroundId: "shooting-stars" }),
}), env, ["theme"]);
assert.equal(authenticatedThemeWrite.status, 200);
const authenticatedPreference = (await authenticatedThemeWrite.json()).themePreference;
assert.equal(authenticatedPreference.reversed, true);
assert.equal(authenticatedPreference.backgroundId, "default-squared", "Removed animated choices must normalize safely.");
const legacyThemeWrite = await authRoute(new Request("https://example.test/api/auth/theme", {
  method: "PUT",
  headers: { cookie: "cassianslog_session=test" },
  body: JSON.stringify({ themeId: "cassians-classic", reversed: false, fontMode: "auto" }),
}), env, ["theme"]);
assert.equal(legacyThemeWrite.status, 200);
assert.equal((await legacyThemeWrite.json()).themePreference.backgroundId, "default-squared", "An older open tab must preserve the normalized background.");
const session = await authRoute(new Request("https://example.test/api/auth/session", {
  headers: { cookie: "cassianslog_session=test" },
}), env, ["session"]);
assert.equal((await session.json()).user.themePreference.themeId, "cassians-classic", "Session responses must include the complete D1 theme preference.");
const ordinaryAdmin = await adminRoute(new Request("https://example.test/api/admin/themes", {
  method: "POST",
  headers: { cookie: "cassianslog_session=test" },
  body: JSON.stringify({}),
}), env, ["themes"]);
assert.equal(ordinaryAdmin.status, 401, "Theme CRUD must remain primary-admin-only.");

const migration = fs.readFileSync("cloudflare/migrations/0008_themes.sql", "utf8");
const backgroundMigration = fs.readFileSync("cloudflare/migrations/0010_theme_backgrounds.sql", "utf8");
for (const table of ["themes", "user_theme_preferences"]) assert.match(migration, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
assert.match(migration, /COLLATE NOCASE UNIQUE/);
assert.match(migration, /REFERENCES themes\(id\) ON DELETE CASCADE/);
assert.equal((migration.match(/^  \('[a-z0-9-]+',/gm) || []).length, 28, "Migration must insert all built-in themes.");
assert.equal((migration.match(/, 1, '1970/g) || []).length, 3, "Exactly three built-in themes must be protected.");
assert.match(backgroundMigration, /ADD COLUMN background_id TEXT NOT NULL DEFAULT 'default-squared'/);

console.log("Theme D1 CRUD, assignment, deletion, and migration contract tests passed.");
