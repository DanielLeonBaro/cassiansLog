// Verifies draft ownership, API methods, atomic finalization, assignments, and collisions.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { characterBuildDraftRoute, campaignCharacterBuildDraftRoute } from "../routes/character-build-drafts.js";

function d1(database) {
  function statement(sql, values = []) {
    return {
      bind(...next) { return statement(sql, next); },
      async first() { return database.prepare(sql).get(...values) || null; },
      async all() { return { success: true, results: database.prepare(sql).all(...values).map((row) => ({ ...row })), meta: {} }; },
      async run() {
        const result = database.prepare(sql).run(...values);
        return { success: true, results: [], meta: { changes: Number(result.changes || 0), last_row_id: result.lastInsertRowid } };
      },
    };
  }
  return {
    prepare: statement,
    async batch(statements) {
      database.exec("BEGIN IMMEDIATE");
      try {
        const results = [];
        for (const item of statements) results.push(await item.run());
        database.exec("COMMIT");
        return results;
      } catch (error) {
        database.exec("ROLLBACK");
        throw error;
      }
    },
  };
}

const database = new DatabaseSync(":memory:");
database.exec("PRAGMA foreign_keys = ON");
const migrationRoot = path.resolve("cloudflare/migrations");
fs.readdirSync(migrationRoot).filter((name) => name.endsWith(".sql")).sort()
  .forEach((name) => database.exec(fs.readFileSync(path.join(migrationRoot, name), "utf8")));
const now = "2026-09-14T00:00:00.000Z";
for (const [id, email] of [["localhost", "localhost@example.test"], ["player", "player@example.test"], ["other", "other@example.test"], ["dm", "dm@example.test"]]) {
  database.prepare("INSERT INTO users (id, email, password_hash, password_salt, password_iterations, roles_json, created_at, updated_at) VALUES (?, ?, 'h', 's', 1, '[]', ?, ?)")
    .run(id, email, now, now);
}
database.prepare("INSERT INTO campaign_memberships (campaign_id, user_id, role, joined_at, updated_at) VALUES ('campaign-breugaire', 'player', 'player', ?, ?)").run(now, now);
database.prepare("INSERT INTO campaign_memberships (campaign_id, user_id, role, joined_at, updated_at) VALUES ('campaign-breugaire', 'other', 'player', ?, ?)").run(now, now);
database.prepare("INSERT INTO campaign_memberships (campaign_id, user_id, role, joined_at, updated_at) VALUES ('campaign-breugaire', 'dm', 'dm', ?, ?)").run(now, now);
const env = { DB: d1(database) };
const campaign = { id: "campaign-breugaire" };
const playerAccess = { campaign, user: { id: "player", localBypass: false, isPrimaryAdmin: false }, membership: { role: "player" } };
const otherAccess = { campaign, user: { id: "other", localBypass: false, isPrimaryAdmin: false }, membership: { role: "player" } };
const dmAccess = { campaign, user: { id: "dm", localBypass: false, isPrimaryAdmin: false }, membership: { role: "dm" } };

function document(id, status = "incomplete") {
  return { id, name: id, characterSchemaVersion: 2, build: { version: 1, mode: "rules", status, ruleset: "5e" } };
}

function request(pathname, method = "GET", body) {
  return new Request(`https://example.test${pathname}`, {
    method,
    headers: body === undefined ? {} : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

let response = await campaignCharacterBuildDraftRoute(request("/draft", "PUT", { document: document("hero"), currentStep: "class" }), env, ["draft-one"], playerAccess);
assert.equal(response.status, 201);
response = await campaignCharacterBuildDraftRoute(request("/draft"), env, ["draft-one"], playerAccess);
assert.equal((await response.json()).draft.currentStep, "class");
assert.equal((await campaignCharacterBuildDraftRoute(request("/draft"), env, ["draft-one"], otherAccess)).status, 404, "Other player cannot read draft.");
assert.equal((await campaignCharacterBuildDraftRoute(request("/draft", "POST"), env, ["draft-one", "finalize"], playerAccess)).status, 400, "Incomplete draft cannot finalize.");

response = await campaignCharacterBuildDraftRoute(request("/draft", "PUT", { document: document("hero", "complete"), currentStep: "review" }), env, ["draft-one"], playerAccess);
assert.equal(response.status, 200);
response = await campaignCharacterBuildDraftRoute(request("/draft", "POST"), env, ["draft-one", "finalize"], playerAccess);
assert.equal(response.status, 201);
assert.equal((await response.json()).id, "hero");
assert.equal(database.prepare("SELECT COUNT(*) AS count FROM campaign_character_build_drafts WHERE draft_id = 'draft-one'").get().count, 0);
assert.equal(database.prepare("SELECT COUNT(*) AS count FROM campaign_characters WHERE id = 'hero'").get().count, 1);
assert.equal(database.prepare("SELECT COUNT(*) AS count FROM characters WHERE id = 'hero'").get().count, 1, "Compatibility campaign mirrors final Character.");
assert.equal(database.prepare("SELECT COUNT(*) AS count FROM campaign_character_editors WHERE character_id = 'hero' AND user_id = 'player'").get().count, 1);

database.prepare("INSERT INTO campaign_characters (campaign_id, id, document_json, source, active, created_at, updated_at) VALUES ('campaign-breugaire', 'occupied', '{}', 'custom', 0, ?, ?)").run(now, now);
response = await campaignCharacterBuildDraftRoute(request("/draft", "PUT", { document: document("occupied", "complete"), currentStep: "review" }), env, ["collision"], playerAccess);
assert.equal(response.status, 201);
response = await campaignCharacterBuildDraftRoute(request("/draft", "POST"), env, ["collision", "finalize"], playerAccess);
assert.equal(response.status, 409);
assert.equal(database.prepare("SELECT COUNT(*) AS count FROM campaign_character_build_drafts WHERE draft_id = 'collision'").get().count, 1, "Collision preserves draft.");

await campaignCharacterBuildDraftRoute(request("/draft", "PUT", { document: document("rollback-hero", "complete"), currentStep: "review" }), env, ["batch-fail"], playerAccess);
database.exec(`CREATE TRIGGER fail_builder_draft_delete BEFORE DELETE ON campaign_character_build_drafts
  WHEN OLD.draft_id = 'batch-fail' BEGIN SELECT RAISE(ABORT, 'forced finalize rollback'); END`);
await assert.rejects(
  campaignCharacterBuildDraftRoute(request("/draft", "POST"), env, ["batch-fail", "finalize"], playerAccess),
  /forced finalize rollback/,
);
assert.equal(database.prepare("SELECT COUNT(*) AS count FROM campaign_characters WHERE id = 'rollback-hero'").get().count, 0, "Failed batch rolls Character insert back.");
assert.equal(database.prepare("SELECT COUNT(*) AS count FROM campaign_character_build_drafts WHERE draft_id = 'batch-fail'").get().count, 1, "Failed batch preserves draft.");

await campaignCharacterBuildDraftRoute(request("/draft", "PUT", { document: document("dm-hero", "complete"), currentStep: "review" }), env, ["dm-draft"], dmAccess);
assert.equal((await campaignCharacterBuildDraftRoute(request("/draft", "POST"), env, ["dm-draft", "finalize"], dmAccess)).status, 201);
assert.equal(database.prepare("SELECT COUNT(*) AS count FROM campaign_character_editors WHERE character_id = 'dm-hero'").get().count, 0, "DM needs no assignment row.");

response = await characterBuildDraftRoute(new Request("http://localhost/api/character-build-drafts/global-one", {
  method: "PUT", body: JSON.stringify({ document: document("global-hero", "complete"), currentStep: "review" }),
}), env, ["global-one"]);
assert.equal(response.status, 201);
response = await characterBuildDraftRoute(new Request("http://localhost/api/character-build-drafts/global-one/finalize", { method: "POST" }), env, ["global-one", "finalize"]);
assert.equal(response.status, 201);
assert.equal(database.prepare("SELECT COUNT(*) AS count FROM characters WHERE id = 'global-hero'").get().count, 1);
assert.equal(database.prepare("SELECT COUNT(*) AS count FROM character_build_drafts WHERE draft_id = 'global-one'").get().count, 0);

assert.equal((await characterBuildDraftRoute(request("/draft"), env, ["unsigned"])).status, 401);
assert.equal((await campaignCharacterBuildDraftRoute(request("/draft"), env, ["bad_id"], playerAccess)).status, 400);
assert.equal((await campaignCharacterBuildDraftRoute(request("/draft", "PATCH"), env, ["collision"], playerAccess)).status, 405);
response = await campaignCharacterBuildDraftRoute(request("/draft", "DELETE"), env, ["missing"], playerAccess);
assert.deepEqual(await response.json(), { ok: true, deleted: false });

const unavailable = await characterBuildDraftRoute(new Request("http://localhost/api/character-build-drafts/missing"), {
  DB: { prepare() { throw new Error("no such table: character_build_drafts"); } },
}, ["missing"]);
assert.equal(unavailable.status, 503);

console.log("Character Builder draft API and atomic finalization tests passed.");
