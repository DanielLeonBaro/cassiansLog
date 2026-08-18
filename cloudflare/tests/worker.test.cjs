const assert = require("node:assert/strict");
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

  const missingBinding = await handleRequest(new Request("https://example.test/api/health"), {
    ASSETS: env.ASSETS,
  });
  assert.equal(missingBinding.status, 503);

  console.log("Cloudflare Worker routing and write protection tests passed.");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
