import assert from "node:assert/strict";
import { secureEqual, tokenAuthorized } from "../auth.js";
import { bodyJSON, parseStored, safeId } from "../http.js";
import { adminRoute } from "../routes/admin.js";
import { characterRoute } from "../routes/characters.js";
import { combatRoute } from "../routes/combat-loot.js";
import { compendiumCatalog } from "../routes/compendium.js";
import { musicRoute, normalizeMusicLibrary } from "../routes/music.js";
import { wikiRoute } from "../routes/wiki.js";

assert.equal(safeId("cassian-1"), "cassian-1");
assert.equal(safeId("../cassian"), null);
assert.deepEqual(parseStored('{"ok":true}'), { ok: true });
assert.equal(parseStored("invalid", "fallback"), "fallback");
assert.equal(secureEqual("secret", "secret"), true);
assert.equal(secureEqual("secret", "different"), false);
assert.equal(tokenAuthorized(new Request("https://example.test", {
  headers: { authorization: "Bearer secret" },
}), "secret"), true);

await assert.rejects(
  bodyJSON(new Request("https://example.test", {
    method: "POST",
    headers: { "content-length": "1800001" },
    body: "{}",
  })),
  /too large/,
);

const invalidCharacter = await characterRoute(
  new Request("https://example.test/api/characters/not_valid"),
  {},
  "not_valid",
  "",
);
assert.equal(invalidCharacter.status, 400);

const settingsOnlyEnv = {
  OPEN_WRITES: "true",
  DB: { prepare: () => ({ first: async () => null }) },
};
const invalidCombat = await combatRoute(
  new Request("https://example.test/api/combat-loot/not-a-route", { method: "PUT", body: "{}" }),
  settingsOnlyEnv,
  ["not-a-route"],
);
assert.equal(invalidCombat.status, 405);

const missingCompendium = await compendiumCatalog({
  DB: {
    prepare(sql) {
      return sql.includes("app_meta")
        ? { first: async () => null }
        : { all: async () => ({ results: [] }) };
    },
  },
});
assert.equal(missingCompendium.status, 503);

assert.deepEqual(normalizeMusicLibrary({
  version: 1,
  tracks: [],
  settings: { fadeIn: 3, fadeOut: 2 },
}), { version: 1, tracks: [], settings: { fadeIn: 3, fadeOut: 2 } });
const invalidMusicMethod = await musicRoute(
  new Request("https://example.test/api/music", { method: "POST" }),
  {},
);
assert.equal(invalidMusicMethod.status, 405);

const missingWiki = await wikiRoute(new Request("https://example.test/api/wiki"), {
  DB: { prepare: () => ({ first: async () => null }) },
});
assert.equal(missingWiki.status, 404);

const deniedAdmin = await adminRoute(
  new Request("https://example.test/api/admin"),
  { WRITE_TOKEN: "secret" },
  [],
);
assert.equal(deniedAdmin.status, 401);

console.log("Cloudflare Worker helper and route-module tests passed.");
