const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

(async () => {
  const { handleRequest } = await import(`${pathToFileURL(path.resolve("cloudflare/worker.js"))}?test=${Date.now()}`);
  const env = {
    WRITE_TOKEN: "correct horse battery staple",
    ASSETS: { fetch: async () => new Response("asset") },
    DB: {
      prepare(sql) {
        if (sql === "SELECT 1") return { first: async () => ({ 1: 1 }) };
        if (sql.includes("FROM app_settings")) return { first: async () => null };
        throw new Error(`Unexpected SQL in routing test: ${sql}`);
      },
    },
  };

  const asset = await handleRequest(new Request("https://example.test/char/"), env);
  assert.equal(await asset.text(), "asset");

  const health = await handleRequest(new Request("https://example.test/api/health"), env);
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { ok: true });

  const denied = await handleRequest(new Request("https://example.test/api/combat-loot/draft", {
    method: "PUT",
    body: "{}",
  }), env);
  assert.equal(denied.status, 401);

  const deniedWiki = await handleRequest(new Request("https://example.test/api/wiki", {
    method: "PUT",
    body: JSON.stringify({ pages: [] }),
  }), env);
  assert.equal(deniedWiki.status, 401);

  const openInvalidWrite = await handleRequest(new Request("https://example.test/api/combat-loot/not-a-route", {
    method: "PUT",
    body: "{}",
  }), { ...env, OPEN_WRITES: "true" });
  assert.equal(openInvalidWrite.status, 405, "Open-write mode should bypass token authorization.");

  const missingSettingsTable = await handleRequest(new Request("https://example.test/api/combat-loot/not-a-route", {
    method: "PUT",
    body: "{}",
  }), {
    ...env,
    OPEN_WRITES: "true",
    DB: { prepare: () => ({ first: async () => { throw new Error("no such table: app_settings"); } }) },
  });
  assert.equal(missingSettingsTable.status, 405, "A pending settings migration must not block ordinary D1 writes.");

  const deniedAdmin = await handleRequest(new Request("https://example.test/api/admin"), env);
  assert.equal(deniedAdmin.status, 401, "Open writes must never expose admin settings.");

  const settings = await handleRequest(new Request("https://example.test/api/settings"), env);
  assert.equal(settings.status, 200);
  assert.equal((await settings.json()).writeProtectionEnabled, true);

  const adminEnv = {
    ...env,
    DB: {
      prepare(sql) {
        if (sql.includes("FROM app_settings")) {
          return { first: async () => ({
            settings_json: JSON.stringify({
              sections: { characters: false },
              openWrites: false,
            }),
            updated_at: "2026-08-18T00:00:00.000Z",
          }) };
        }
        if (sql.includes("FROM characters ORDER BY id")) {
          return { all: async () => ({ results: [{
            id: "cassian",
            document_json: JSON.stringify({ name: "Cassian" }),
            source: "bundled",
            active: 1,
            updated_at: "2026-08-18T00:00:00.000Z",
          }] }) };
        }
        throw new Error(`Unexpected SQL in admin test: ${sql}`);
      },
    },
  };
  const admin = await handleRequest(new Request("https://example.test/api/admin", {
    headers: { authorization: "Bearer correct horse battery staple" },
  }), adminEnv);
  assert.equal(admin.status, 200);
  const adminBody = await admin.json();
  assert.equal(adminBody.settings.openWrites, false);
  assert.equal(adminBody.settings.sections.characters, false);
  assert.equal(adminBody.characters[0].name, "Cassian");

  const sectionKeys = Object.keys(JSON.parse(fs.readFileSync("shared/config/sections.json", "utf8")).sections);
  let liveSettings = {
    sections: Object.fromEntries(sectionKeys.map((key) => [key, true])),
    openWrites: true,
  };
  let templateActive = false;
  const settingsEnv = {
    ...env,
    DB: {
      prepare(sql) {
        if (sql.includes("FROM app_settings")) {
          return { first: async () => ({
            settings_json: JSON.stringify(liveSettings),
            updated_at: "2026-08-18T00:00:00.000Z",
          }) };
        }
        if (sql.startsWith("INSERT INTO app_settings")) {
          return { bind(settingsJSON) {
            return { run: async () => {
              liveSettings = JSON.parse(settingsJSON);
              return { meta: { changes: 1 } };
            } };
          } };
        }
        if (sql.startsWith("UPDATE characters SET active")) {
          return { bind(active, _updatedAt, id) {
            return { run: async () => {
              assert.equal(id, "template");
              templateActive = Boolean(active);
              return { meta: { changes: 1 } };
            } };
          } };
        }
        if (sql.includes("FROM characters WHERE active = 1")) {
          return { all: async () => ({ results: templateActive ? [{
            id: "template",
            document_json: JSON.stringify({ id: "template", name: "Character Template" }),
            source: "bundled",
            updated_at: "2026-08-18T00:00:00.000Z",
          }] : [] }) };
        }
        throw new Error(`Unexpected SQL in settings toggle test: ${sql}`);
      },
    },
  };
  const adminHeaders = {
    authorization: "Bearer correct horse battery staple",
    "content-type": "application/json",
  };

  for (const key of sectionKeys) {
    for (const enabled of [false, true]) {
      const next = { ...liveSettings, sections: { ...liveSettings.sections, [key]: enabled } };
      const response = await handleRequest(new Request("https://example.test/api/admin/settings", {
        method: "PUT",
        headers: adminHeaders,
        body: JSON.stringify(next),
      }), settingsEnv);
      assert.equal(response.status, 200, `${key} should save as ${enabled}`);
      assert.equal(liveSettings.sections[key], enabled, `${key} should persist as ${enabled}`);
    }
  }

  for (const openWrites of [false, true]) {
    const response = await handleRequest(new Request("https://example.test/api/admin/settings", {
      method: "PUT",
      headers: adminHeaders,
      body: JSON.stringify({ ...liveSettings, openWrites }),
    }), settingsEnv);
    assert.equal(response.status, 200, `Public writes should save as ${openWrites}`);
    assert.equal(liveSettings.openWrites, openWrites);
  }

  for (const active of [true, false, true]) {
    const response = await handleRequest(new Request("https://example.test/api/admin/characters/template", {
      method: "PUT",
      headers: adminHeaders,
      body: JSON.stringify({ active }),
    }), settingsEnv);
    assert.equal(response.status, 200, `Template availability should save as ${active}`);
    assert.equal(templateActive, active);
    const publicList = await handleRequest(new Request("https://example.test/api/characters"), settingsEnv);
    const listed = (await publicList.json()).characters.some((character) => character.id === "template");
    assert.equal(listed, active, `Template list visibility should follow active=${active}`);
  }

  const adminSource = fs.readFileSync("admin/js/entry.js", "utf8");
  sectionKeys.forEach((key) => assert.ok(adminSource.includes(`${key}:`) || adminSource.includes(`"${key}":`), `${key} needs an admin toggle`));
  assert.match(
    fs.readFileSync("cloudflare/scripts/build-seed.cjs", "utf8"),
    /\{ id: "template", active: 0 \}/,
    "The template must be seeded into D1 as unavailable.",
  );

  const missingBinding = await handleRequest(new Request("https://example.test/api/health"), {
    ASSETS: env.ASSETS,
  });
  assert.equal(missingBinding.status, 503);

  console.log("Cloudflare Worker routing and write protection tests passed.");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
