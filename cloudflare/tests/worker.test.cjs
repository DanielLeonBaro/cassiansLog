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
        assert.equal(sql, "SELECT 1");
        return { first: async () => ({ 1: 1 }) };
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

  const missingBinding = await handleRequest(new Request("https://example.test/api/health"), {
    ASSETS: env.ASSETS,
  });
  assert.equal(missingBinding.status, 503);

  console.log("Cloudflare Worker routing and write protection tests passed.");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
