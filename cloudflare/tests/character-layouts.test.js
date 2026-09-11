// Verifies authenticated personal-layout API validation, user isolation, and migration fallback.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { characterRoute } from "../routes/characters.js";
import { createSession } from "../user-auth.js";
import { DEFAULT_V3_LAYOUT, normalizeV3Layout } from "../../shared/js/v3-layout.js";

class Statement {
  constructor(database, sql, values = []) { this.database = database; this.sql = sql; this.values = values; }
  bind(...values) { return new Statement(this.database, this.sql, values); }
  async first() { return this.database.prepare(this.sql).get(...this.values) || null; }
  async all() { return { results: this.database.prepare(this.sql).all(...this.values) }; }
  async run() { return { meta: this.database.prepare(this.sql).run(...this.values) }; }
}

function d1(database) {
  return {
    prepare: (sql) => new Statement(database, sql),
    async batch(statements) {
      database.exec("BEGIN");
      try {
        for (const statement of statements) await statement.run();
        database.exec("COMMIT");
      } catch (error) {
        database.exec("ROLLBACK");
        throw error;
      }
    },
  };
}

function createDatabase({ layouts = true } = {}) {
  const database = new DatabaseSync(":memory:");
  database.exec("PRAGMA foreign_keys = ON");
  const directory = path.resolve("cloudflare/migrations");
  fs.readdirSync(directory).filter((name) => name.endsWith(".sql") && (layouts || name < "0015_user_character_layouts.sql")).sort()
    .forEach((name) => database.exec(fs.readFileSync(path.join(directory, name), "utf8")));
  return database;
}

function request(cookie, { method = "GET", body } = {}) {
  return new Request("https://example.test/api/characters/hero/layout", {
    method,
    headers: { ...(cookie ? { cookie } : {}), ...(body ? { "content-type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
}

async function call(env, cookie, options) {
  const response = await characterRoute(request(cookie, options), env, "hero", "layout");
  return { response, body: await response.json() };
}

const database = createDatabase();
const env = { DB: d1(database), WRITE_TOKEN: "edit-token" };
const now = "2026-09-09T00:00:00.000Z";
for (const [id, email] of [["alice", "alice@example.com"], ["bob", "bob@example.com"]]) {
  database.prepare("INSERT INTO users (id, email, password_hash, password_salt, password_iterations, roles_json, created_at, updated_at) VALUES (?, ?, 'h', 's', 1, '[]', ?, ?)").run(id, email, now, now);
}
database.prepare("INSERT INTO characters (id, document_json, source, active, created_at, updated_at) VALUES ('hero', '{\"id\":\"hero\"}', 'custom', 1, ?, ?)").run(now, now);
const alice = (await createSession("alice", env)).split(";")[0];
const bob = (await createSession("bob", env)).split(";")[0];

let result = await call(env, "");
assert.equal(result.response.status, 401);
result = await call(env, alice);
assert.equal(result.body.layout, null);
const threeColumns = normalizeV3Layout({ ...DEFAULT_V3_LAYOUT, columns: 3 });
result = await call(env, alice, { method: "PUT", body: { layout: threeColumns } });
assert.equal(result.response.status, 200);
assert.equal(result.body.layout.columns, 3);
result = await call(env, bob);
assert.equal(result.body.layout, null, "One user's layout must never leak to another user.");
result = await call(env, alice, { method: "PUT", body: { layout: { version: 1, columns: 3, sections: [] } } });
assert.equal(result.response.status, 400);
const renameResponse = await characterRoute(new Request("https://example.test/api/characters/hero/id", {
  method: "PUT",
  headers: { cookie: alice, authorization: "Bearer edit-token", "content-type": "application/json" },
  body: '{"id":"champion"}',
}), env, "hero", "id");
assert.equal(renameResponse.status, 200);
assert.equal(database.prepare("SELECT character_id FROM user_character_layouts WHERE user_id = 'alice'").get().character_id, "champion", "Global rename should preserve the personal layout through FK cascading.");

const oldDatabase = createDatabase({ layouts: false });
const oldEnv = { DB: d1(oldDatabase) };
oldDatabase.prepare("INSERT INTO users (id, email, password_hash, password_salt, password_iterations, roles_json, created_at, updated_at) VALUES ('alice', 'alice@example.com', 'h', 's', 1, '[]', ?, ?)").run(now, now);
oldDatabase.prepare("INSERT INTO characters (id, document_json, source, active, created_at, updated_at) VALUES ('hero', '{}', 'custom', 1, ?, ?)").run(now, now);
const oldCookie = (await createSession("alice", oldEnv)).split(";")[0];
result = await call(oldEnv, oldCookie);
assert.equal(result.response.status, 503);
assert.match(result.body.error, /0015/);

console.log("Character-layout API authentication, validation, isolation, and fallback tests passed.");
