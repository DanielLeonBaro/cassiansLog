// Verifies campaign creation, discovery, membership, permissions, and content isolation.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { campaignPasswordProblem, normalizeCampaignSlug, validCampaignSlug } from "../campaigns.js";
import { campaignRoute } from "../routes/campaigns.js";
import { createSession } from "../user-auth.js";
import { handleRequest } from "../worker.js";

class D1Statement {
  constructor(database, sql, values = []) {
    this.database = database;
    this.sql = sql;
    this.values = values;
  }

  bind(...values) {
    return new D1Statement(this.database, this.sql, values);
  }

  async first() {
    return this.database.prepare(this.sql).get(...this.values) || null;
  }

  async all() {
    return { results: this.database.prepare(this.sql).all(...this.values) };
  }

  async run() {
    const result = this.database.prepare(this.sql).run(...this.values);
    return { meta: { changes: result.changes, last_row_id: Number(result.lastInsertRowid || 0) } };
  }
}

function d1(database) {
  return {
    prepare(sql) {
      return new D1Statement(database, sql);
    },
    async batch(statements) {
      database.exec("BEGIN");
      try {
        const results = [];
        for (const statement of statements) results.push(await statement.run());
        database.exec("COMMIT");
        return results;
      } catch (error) {
        database.exec("ROLLBACK");
        throw error;
      }
    },
  };
}

function request(pathname, cookie, { method = "GET", body } = {}) {
  return new Request(`https://example.test${pathname}`, {
    method,
    headers: {
      accept: "application/json",
      ...(cookie ? { cookie } : {}),
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function call(env, cookie, parts, options) {
  const response = await campaignRoute(request(`/api/campaigns/${parts.join("/")}`, cookie, options), env, parts);
  return { response, body: await response.json() };
}

const database = new DatabaseSync(":memory:");
database.exec("PRAGMA foreign_keys = ON");
const migrations = path.resolve("cloudflare/migrations");
for (const name of fs.readdirSync(migrations).filter((name) => name.endsWith(".sql")).sort()) {
  database.exec(fs.readFileSync(path.join(migrations, name), "utf8"));
}
const env = { DB: d1(database) };
const now = new Date().toISOString();
for (const [id, email] of [["admin", "dleonbaro@gmail.com"], ["alice", "alice@example.com"], ["bob", "bob@example.com"], ["carol", "carol@example.com"], ["dave", "dave@example.com"]]) {
  database.prepare("INSERT INTO users (id, email, password_hash, password_salt, password_iterations, roles_json, created_at, updated_at) VALUES (?, ?, 'hash', 'salt', 1, '[]', ?, ?)")
    .run(id, email, now, now);
}
const cookies = {};
for (const id of ["admin", "alice", "bob", "carol", "dave"]) cookies[id] = (await createSession(id, env)).split(";")[0];

assert.equal(normalizeCampaignSlug("  Crème of Strahd!  "), "cremeofstrahd");
assert.equal(validCampaignSlug("curseofstrahd"), true);
assert.equal(validCampaignSlug("curse-of-strahd"), false);
assert.match(campaignPasswordProblem("12345"), /at least 6/);
assert.equal(campaignPasswordProblem("secret"), "");

let result = await call(env, cookies.alice, [], { method: "POST", body: { name: "Curse of Strahd", description: "Fog, vampires, and bad choices.", banner: "data:image/png;base64,YmFubmVy", password: "secret" } });
assert.equal(result.response.status, 201);
assert.equal(result.body.campaign.slug, "curseofstrahd");
assert.equal(result.body.campaign.role, "dm");
assert.equal(result.body.campaign.description, "Fog, vampires, and bad choices.");
assert.equal(result.body.campaign.banner, "data:image/png;base64,YmFubmVy");

result = await call(env, cookies.bob, []);
const visible = result.body.campaigns.find((campaign) => campaign.slug === "curseofstrahd");
const aotr = result.body.campaigns.find((campaign) => campaign.slug === "aotr");
assert.equal(aotr.name, "Apotheosis of the Rings");
assert.equal(aotr.joinEnabled, false);
assert.equal(visible.joined, false);
assert.equal(visible.name, "Curse of Strahd");
assert.equal(visible.description, "Fog, vampires, and bad choices.");
result = await call(env, cookies.bob, ["curseofstrahd", "wiki"]);
assert.equal(result.response.status, 403, "Visible metadata must not grant content access.");

result = await call(env, cookies.bob, ["curseofstrahd", "join"], { method: "POST", body: { password: "wrong" } });
assert.equal(result.response.status, 401);
database.prepare("DELETE FROM campaign_join_attempts").run();
result = await call(env, cookies.bob, ["curseofstrahd", "join"], { method: "POST", body: { password: "secret" } });
assert.equal(result.response.status, 200);
assert.equal(result.body.role, "player");
await call(env, cookies.carol, ["curseofstrahd", "join"], { method: "POST", body: { password: "secret" } });

result = await call(env, cookies.bob, ["curseofstrahd", "wiki"], { method: "PUT", body: { pages: [{ id: "home", name: "Home" }] } });
assert.equal(result.response.status, 403, "Players cannot edit shared content.");
result = await call(env, cookies.alice, ["curseofstrahd", "wiki"], { method: "PUT", body: { pages: [{ id: "home", name: "Home" }] } });
assert.equal(result.response.status, 200);

const hero = { id: "hero", name: "Hero" };
result = await call(env, cookies.bob, ["curseofstrahd", "characters", "hero"], { method: "PUT", body: { document: hero, source: "custom" } });
assert.equal(result.response.status, 200);
assert.equal(result.body.created, true);
result = await call(env, cookies.bob, ["curseofstrahd", "characters", "hero", "notes"], { method: "PUT", body: { value: [{ title: "Private" }] } });
assert.equal(result.response.status, 200);
result = await call(env, cookies.carol, ["curseofstrahd", "characters", "hero"]);
assert.equal(result.response.status, 200);
assert.equal(result.body.canEdit, false);
result = await call(env, cookies.carol, ["curseofstrahd", "characters", "hero", "notes"]);
assert.equal(result.response.status, 403);
result = await call(env, cookies.carol, ["curseofstrahd", "characters", "hero"], { method: "PUT", body: { document: hero } });
assert.equal(result.response.status, 403);

result = await call(env, cookies.alice, ["curseofstrahd", "characters", "hero", "assignments"], { method: "PUT", body: { userIds: ["carol"] } });
assert.equal(result.response.status, 200);
result = await call(env, cookies.carol, ["curseofstrahd", "characters", "hero", "notes"]);
assert.equal(result.response.status, 200, "Assigned players can read character notes.");
const screen = { version: 1, widgets: [] };
result = await call(env, cookies.carol, ["curseofstrahd", "screens", "player"], { method: "PUT", body: { document: screen } });
assert.equal(result.response.status, 200);
result = await call(env, cookies.alice, ["curseofstrahd", "members", "carol"], { method: "DELETE" });
assert.equal(result.response.status, 200);
assert.equal(database.prepare("SELECT COUNT(*) AS count FROM campaign_character_editors WHERE user_id = 'carol'").get().count, 0, "Membership removal clears character assignments.");
assert.equal(database.prepare("SELECT COUNT(*) AS count FROM campaign_user_screens WHERE user_id = 'carol'").get().count, 1, "Membership removal preserves private Screens.");

result = await call(env, cookies.alice, ["curseofstrahd", "password"], { method: "PUT", body: { password: "rotated-secret" } });
assert.equal(result.response.status, 200);
result = await call(env, cookies.bob, ["curseofstrahd", "wiki"]);
assert.equal(result.response.status, 200, "Password rotation does not remove existing members.");
for (let attempt = 1; attempt <= 5; attempt += 1) {
  result = await call(env, cookies.dave, ["curseofstrahd", "join"], { method: "POST", body: { password: "wrong" } });
  assert.equal(result.response.status, attempt === 5 ? 429 : 401);
}
result = await call(env, cookies.dave, ["curseofstrahd", "join"], { method: "POST", body: { password: "rotated-secret" } });
assert.equal(result.response.status, 429, "A correct password cannot bypass an active throttle.");
database.prepare("DELETE FROM campaign_join_attempts WHERE user_id = 'dave'").run();
result = await call(env, cookies.dave, ["curseofstrahd", "join"], { method: "POST", body: { password: "secret" } });
assert.equal(result.response.status, 401, "Rotated passwords reject the old value for future joins.");
database.prepare("DELETE FROM campaign_join_attempts WHERE user_id = 'dave'").run();
result = await call(env, cookies.dave, ["curseofstrahd", "join"], { method: "POST", body: { password: "rotated-secret" } });
assert.equal(result.response.status, 200);
result = await call(env, cookies.carol, ["curseofstrahd", "join"], { method: "POST", body: { password: "rotated-secret" } });
assert.equal(result.response.status, 200);
result = await call(env, cookies.carol, ["curseofstrahd", "screens", "player"]);
assert.deepEqual(result.body.document, screen, "A private Screen returns after rejoining.");

result = await call(env, cookies.alice, [], { method: "POST", body: { name: "Other", slug: "other", password: "secret" } });
assert.equal(result.response.status, 201);
result = await call(env, cookies.alice, ["other", "characters", "hero"], { method: "PUT", body: { document: { id: "hero", name: "Other Hero" } } });
assert.equal(result.response.status, 200);
assert.equal(database.prepare("SELECT COUNT(*) AS count FROM campaign_characters WHERE id = 'hero'").get().count, 2);

result = await call(env, cookies.alice, ["curseofstrahd", "members", "bob"], { method: "PATCH", body: { role: "dm" } });
assert.equal(result.response.status, 200);
result = await call(env, cookies.alice, ["curseofstrahd", "members", "alice"], { method: "PATCH", body: { role: "player" } });
assert.equal(result.response.status, 200);
result = await call(env, cookies.bob, ["curseofstrahd", "membership", "me"], { method: "DELETE" });
assert.equal(result.response.status, 409, "The final DM cannot leave.");

let assetPath = "";
env.ASSETS = {
  async fetch(assetRequest) {
    assetPath = new URL(assetRequest.url).pathname;
    return new Response("shell", { status: 200 });
  },
};
result.response = await handleRequest(new Request("https://example.test/c/curseofstrahd/wiki/home", { headers: { cookie: cookies.bob } }), env);
assert.equal(result.response.status, 200);
assert.equal(assetPath, "/wiki/", "Campaign Wiki deep links use the Wiki shell.");
const campaignId = database.prepare("SELECT campaign_id FROM campaign_slugs WHERE slug = 'curseofstrahd'").get().campaign_id;
result.response = await handleRequest(new Request(`https://example.test/api/admin/campaigns/${campaignId}/slug`, { method: "PUT", headers: { cookie: cookies.alice, "content-type": "application/json" }, body: '{"slug":"ravenloft"}' }), env);
assert.equal(result.response.status, 401, "Campaign DMs cannot rename URL slugs.");
result.response = await handleRequest(new Request(`https://example.test/api/admin/campaigns/${campaignId}/slug`, { method: "PUT", headers: { cookie: cookies.admin, "content-type": "application/json" }, body: '{"slug":"ravenloft"}' }), env);
assert.equal(result.response.status, 200, "The primary Admin can rename a campaign slug.");
result.response = await handleRequest(new Request("https://example.test/c/curseofstrahd/wiki/home", { headers: { cookie: cookies.bob } }), env);
assert.equal(result.response.status, 301);
assert.equal(result.response.headers.get("location"), "https://example.test/c/ravenloft/wiki/home");
result.response = await handleRequest(new Request("https://example.test/c/ravenloft/wiki/home", { headers: { cookie: cookies.alice } }), env);
assert.equal(result.response.status, 200);
database.prepare("INSERT OR IGNORE INTO campaign_memberships (campaign_id, user_id, role, joined_at, updated_at) VALUES ('campaign-breugaire', 'alice', 'dm', ?, ?)").run(now, now);
result.response = await handleRequest(new Request("https://example.test/c/breugaire/wiki/home", { headers: { cookie: cookies.alice } }), env);
assert.equal(result.response.status, 301);
assert.equal(result.response.headers.get("location"), "https://example.test/c/aotr/wiki/home");
result.response = await handleRequest(new Request("https://example.test/wiki/home", { headers: { cookie: cookies.alice } }), env);
assert.equal(result.response.status, 302);
assert.equal(result.response.headers.get("location"), "https://example.test/c/aotr/wiki/home");
result.response = await handleRequest(new Request("https://example.test/compendium/", { headers: { cookie: cookies.alice } }), env);
assert.equal(result.response.status, 200);
assert.equal(assetPath, "/compendium/", "The global Compendium remains unscoped.");

console.log("Campaign discovery, membership, permissions, privacy, isolation, and route tests passed.");
