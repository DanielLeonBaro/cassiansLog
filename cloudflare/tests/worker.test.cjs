const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

(async () => {
  const { handleRequest } = await import(`${pathToFileURL(path.resolve("cloudflare/worker.js"))}?test=${Date.now()}`);
  const env = {
    WRITE_TOKEN: "correct horse battery staple",
    LEGACY_ADMIN_TOKEN_ENABLED: "true",
    AUTH_REQUIRED: "false",
    ASSETS: { fetch: async () => new Response("asset") },
    DB: {
      prepare(sql) {
        if (sql === "SELECT 1") return { first: async () => ({ 1: 1 }) };
        if (sql.includes("FROM app_settings")) return { first: async () => null };
        if (sql === "SELECT id FROM users WHERE email = ? COLLATE NOCASE") {
          return { bind: () => ({ first: async () => ({ id: "primary-admin" }) }) };
        }
        if (sql.includes("FROM user_sessions JOIN users")) {
          return { bind: () => ({ first: async () => ({
            id: "primary-admin",
            email: "dleonbaro@gmail.com",
            roles_json: "[]",
          }) }) };
        }
        throw new Error(`Unexpected SQL in routing test: ${sql}`);
      },
    },
  };

  const asset = await handleRequest(new Request("https://example.test/char/", { headers: { cookie: "cassianslog_session=test" } }), env);
  assert.equal(await asset.text(), "asset");

  const localAsset = await handleRequest(new Request("http://localhost:8787/char/"), {
    ASSETS: { fetch: async () => new Response("local asset") },
  });
  assert.equal(localAsset.status, 200, "Localhost page requests should bypass login without a database.");
  assert.equal(await localAsset.text(), "local asset");

  const failedBootstrap = await handleRequest(new Request("https://example.test/char/"), {
    ASSETS: env.ASSETS,
    DB: { prepare: () => { throw new Error("bootstrap unavailable"); } },
  });
  assert.equal(failedBootstrap.status, 503, "Authentication bootstrap failures should not escape as Worker 1101 errors.");

  const assetRequests = [];
  const customCharacter = await handleRequest(
    new Request("https://example.test/char/custom-hero/?edit=1", { headers: { cookie: "cassianslog_session=test" } }),
    {
      ...env,
      ASSETS: { fetch: async (request) => {
        assetRequests.push(new URL(request.url).pathname);
        return new URL(request.url).pathname === "/char/template/"
          ? new Response("template shell")
          : new Response("missing", { status: 404 });
      } },
    },
  );
  assert.equal(customCharacter.status, 200);
  assert.equal(await customCharacter.text(), "template shell");
  assert.deepEqual(assetRequests, ["/char/custom-hero/", "/char/template/"]);

  const wikiAssetRequests = [];
  const wikiPage = await handleRequest(
    new Request("https://example.test/wiki/fiora", { headers: { cookie: "cassianslog_session=test" } }),
    {
      ...env,
      ASSETS: { fetch: async (request) => {
        wikiAssetRequests.push(new URL(request.url).pathname);
        return new URL(request.url).pathname === "/wiki/"
          ? new Response("wiki shell")
          : new Response("missing", { status: 404 });
      } },
    },
  );
  assert.equal(wikiPage.status, 200);
  assert.equal(await wikiPage.text(), "wiki shell");
  assert.deepEqual(wikiAssetRequests, ["/wiki/fiora", "/wiki/"]);

  const anonymousPage = await handleRequest(new Request("https://example.test/char/"), env);
  assert.equal(anonymousPage.status, 302, "Anonymous page requests should redirect to login.");
  assert.match(anonymousPage.headers.get("location"), /\/login\//);

  const nestedAsset = await handleRequest(
    new Request("https://example.test/char/js/missing.js"),
    { ...env, ASSETS: { fetch: async () => new Response("missing", { status: 404 }) } },
  );
  assert.equal(nestedAsset.status, 404, "Only character page routes should use the template shell.");

  const nestedWikiAsset = await handleRequest(
    new Request("https://example.test/wiki/js/missing.js"),
    { ...env, ASSETS: { fetch: async () => new Response("missing", { status: 404 }) } },
  );
  assert.equal(nestedWikiAsset.status, 404, "Only wiki page routes should use the wiki shell.");

  const health = await handleRequest(new Request("https://example.test/api/health"), env);
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { ok: true });

  const anonymousApi = await handleRequest(
    new Request("https://example.test/api/settings"),
    { ...env, AUTH_REQUIRED: undefined },
  );
  assert.equal(anonymousApi.status, 401, "Anonymous API requests should be rejected.");
  const restrictedApi = await handleRequest(
    new Request("https://example.test/api/wiki", { headers: { cookie: "cassianslog_session=test" } }),
    {
      ...env,
      AUTH_REQUIRED: undefined,
      DB: {
        prepare(sql) {
          if (sql.includes("FROM user_sessions JOIN users")) {
            return { bind: () => ({ first: async () => ({
              id: "characters-only",
              email: "player@example.com",
              roles_json: '["characters"]',
            }) }) };
          }
          throw new Error(`Unexpected SQL in role access test: ${sql}`);
        },
      },
    },
  );
  assert.equal(restrictedApi.status, 403, "Account roles should protect API resources as well as navigation.");

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

  const deniedMusic = await handleRequest(new Request("https://example.test/api/music", {
    method: "PUT",
    body: JSON.stringify({ version: 1, tracks: [], settings: { fadeIn: 3, fadeOut: 2 } }),
  }), env);
  assert.equal(deniedMusic.status, 401);

  const deniedCharacterStyle = await handleRequest(new Request("https://example.test/api/characters/cassian/style", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ style: "v2" }),
  }), env);
  assert.equal(deniedCharacterStyle.status, 401, "Player style changes should follow ordinary write protection.");

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
  const settingsBody = await settings.json();
  assert.equal(settingsBody.writeProtectionEnabled, true);
  assert.equal(settingsBody.characterSheetStyle, "v1", "Absent settings should default to Style v1.");
  assert.deepEqual(settingsBody.characterSheetStyleOverrides, {});

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
  assert.equal(adminBody.settings.sections["public-initiative"], true, "Legacy settings should enable the new navigation by default.");
  assert.equal(adminBody.settings.characterSheetStyle, "v1", "Legacy stored settings should load as Style v1.");
  assert.deepEqual(adminBody.settings.characterSheetStyleOverrides, {});
  assert.equal(adminBody.characters[0].name, "Cassian");

  const sectionKeys = Object.keys(JSON.parse(fs.readFileSync("shared/config/sections.json", "utf8")).sections);
  let liveSettings = {
    sections: Object.fromEntries(sectionKeys.map((key) => [key, true])),
    openWrites: true,
    characterSheetStyle: "v1",
    characterSheetStyleOverrides: {},
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

  const legacySections = { ...liveSettings.sections };
  delete legacySections["public-initiative"];
  const legacySettingsWrite = await handleRequest(new Request("https://example.test/api/admin/settings", {
    method: "PUT",
    headers: adminHeaders,
    body: JSON.stringify({ ...liveSettings, sections: legacySections }),
  }), settingsEnv);
  assert.equal(legacySettingsWrite.status, 200, "The previous Admin client should remain compatible.");
  assert.equal(liveSettings.sections["public-initiative"], true);

  for (const openWrites of [false, true]) {
    const response = await handleRequest(new Request("https://example.test/api/admin/settings", {
      method: "PUT",
      headers: adminHeaders,
      body: JSON.stringify({ ...liveSettings, openWrites }),
    }), settingsEnv);
    assert.equal(response.status, 200, `Public writes should save as ${openWrites}`);
    assert.equal(liveSettings.openWrites, openWrites);
  }

  for (const characterSheetStyle of ["v1", "v2", "v1"]) {
    const response = await handleRequest(new Request("https://example.test/api/admin/settings", {
      method: "PUT",
      headers: adminHeaders,
      body: JSON.stringify({ ...liveSettings, characterSheetStyle }),
    }), settingsEnv);
    assert.equal(response.status, 200, `Character sheet style ${characterSheetStyle} should save.`);
    assert.equal(liveSettings.characterSheetStyle, characterSheetStyle);
    const publicResponse = await handleRequest(new Request("https://example.test/api/settings"), settingsEnv);
    assert.equal((await publicResponse.json()).characterSheetStyle, characterSheetStyle);
  }

  const styleOverrideResponse = await handleRequest(new Request("https://example.test/api/admin/settings", {
    method: "PUT",
    headers: adminHeaders,
    body: JSON.stringify({
      ...liveSettings,
      characterSheetStyle: "v1",
      characterSheetStyleOverrides: { cassian: "v2", ally: "v1" },
    }),
  }), settingsEnv);
  assert.equal(styleOverrideResponse.status, 200, "Per-character sheet styles should save.");
  assert.deepEqual(liveSettings.characterSheetStyleOverrides, { cassian: "v2", ally: "v1" });
  const publicOverrideResponse = await handleRequest(
    new Request("https://example.test/api/settings"),
    settingsEnv,
  );
  assert.deepEqual(
    (await publicOverrideResponse.json()).characterSheetStyleOverrides,
    { cassian: "v2", ally: "v1" },
  );

  async function savePlayerStyle(style, authorization = "") {
    const headers = { "content-type": "application/json" };
    if (authorization) headers.authorization = authorization;
    return handleRequest(new Request("https://example.test/api/characters/cassian/style", {
      method: "PUT",
      headers,
      body: JSON.stringify({ style }),
    }), settingsEnv);
  }

  let playerStyleResponse = await savePlayerStyle("v1");
  assert.equal(playerStyleResponse.status, 200);
  assert.equal((await playerStyleResponse.json()).style, "v1");
  assert.equal(liveSettings.characterSheetStyleOverrides.cassian, "v1");

  const adminStyleResponse = await handleRequest(new Request("https://example.test/api/admin/settings", {
    method: "PUT",
    headers: adminHeaders,
    body: JSON.stringify({
      ...liveSettings,
      characterSheetStyleOverrides: { ...liveSettings.characterSheetStyleOverrides, cassian: "v2" },
    }),
  }), settingsEnv);
  assert.equal(adminStyleResponse.status, 200);
  assert.equal(liveSettings.characterSheetStyleOverrides.cassian, "v2");

  playerStyleResponse = await savePlayerStyle("v1");
  assert.equal(playerStyleResponse.status, 200);
  const lastWriteSettings = await handleRequest(new Request("https://example.test/api/settings"), settingsEnv);
  assert.equal(
    (await lastWriteSettings.json()).characterSheetStyleOverrides.cassian,
    "v1",
    "The last player or Admin style save should win.",
  );

  await handleRequest(new Request("https://example.test/api/admin/settings", {
    method: "PUT",
    headers: adminHeaders,
    body: JSON.stringify({ ...liveSettings, openWrites: false }),
  }), settingsEnv);
  assert.equal((await savePlayerStyle("v2")).status, 401);
  assert.equal(
    (await savePlayerStyle("v2", "Bearer correct horse battery staple")).status,
    200,
    "The ordinary write token should authorize a protected player style change.",
  );
  assert.equal(
    (await savePlayerStyle("future", "Bearer correct horse battery staple")).status,
    400,
    "Unknown player-selected styles must be rejected.",
  );
  await handleRequest(new Request("https://example.test/api/admin/settings", {
    method: "PUT",
    headers: adminHeaders,
    body: JSON.stringify({ ...liveSettings, openWrites: true }),
  }), settingsEnv);

  const beforeInvalidStyle = JSON.stringify(liveSettings);
  const invalidStyle = await handleRequest(new Request("https://example.test/api/admin/settings", {
    method: "PUT",
    headers: adminHeaders,
    body: JSON.stringify({ ...liveSettings, characterSheetStyle: "future" }),
  }), settingsEnv);
  assert.equal(invalidStyle.status, 400, "Unknown character sheet styles must be rejected.");
  assert.equal(JSON.stringify(liveSettings), beforeInvalidStyle);

  const invalidOverride = await handleRequest(new Request("https://example.test/api/admin/settings", {
    method: "PUT",
    headers: adminHeaders,
    body: JSON.stringify({
      ...liveSettings,
      characterSheetStyleOverrides: { cassian: "future" },
    }),
  }), settingsEnv);
  assert.equal(invalidOverride.status, 400, "Unknown per-character sheet styles must be rejected.");

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

  let musicLibrary = null;
  let musicUpdatedAt = null;
  const musicEnv = {
    ...env,
    OPEN_WRITES: "true",
    DB: {
      prepare(sql) {
        if (sql.includes("FROM app_settings")) return { first: async () => null };
        if (sql.startsWith("SELECT library_json")) {
          return { first: async () => musicLibrary ? { library_json: JSON.stringify(musicLibrary), updated_at: musicUpdatedAt } : null };
        }
        if (sql.startsWith("INSERT INTO music_library")) {
          return { bind(libraryJSON, updatedAt) {
            return { run: async () => {
              musicLibrary = JSON.parse(libraryJSON);
              musicUpdatedAt = updatedAt;
              return { meta: { changes: 1 } };
            } };
          } };
        }
        throw new Error(`Unexpected SQL in Music test: ${sql}`);
      },
    },
  };
  const emptyMusic = await handleRequest(new Request("https://example.test/api/music"), musicEnv);
  assert.deepEqual(await emptyMusic.json(), { library: null, updatedAt: null });
  const expectedMusic = {
    version: 1,
    tracks: [{
      id: "track-1",
      title: "The Abyss",
      url: "https://youtu.be/dQw4w9WgXcQ",
      tags: ["ambience", "suspense"],
      provider: "youtube",
      addedAt: "2026-08-18T00:00:00.000Z",
    }],
    settings: { fadeIn: 3, fadeOut: 2 },
  };
  const saveMusic = await handleRequest(new Request("https://example.test/api/music", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(expectedMusic),
  }), musicEnv);
  assert.equal(saveMusic.status, 200);
  assert.deepEqual(musicLibrary, expectedMusic);
  const restoredMusic = await handleRequest(new Request("https://example.test/api/music"), musicEnv);
  assert.deepEqual((await restoredMusic.json()).library, expectedMusic);

  let migratedWikiPages = null;
  const legacyWikiPages = [{
    id: "a4901fbc-0a6f-45dd-ad3f-f82f76e04007",
    name: "Fiora",
    type: "Character",
  }];
  const wikiEnv = {
    ...env,
    DB: {
      prepare(sql) {
        if (sql.startsWith("SELECT pages_json")) {
          return { first: async () => ({
            pages_json: JSON.stringify(legacyWikiPages),
            updated_at: "2026-08-18T00:00:00.000Z",
          }) };
        }
        if (sql.startsWith("UPDATE wiki_documents")) {
          return { bind(pagesJSON) {
            return { run: async () => {
              migratedWikiPages = JSON.parse(pagesJSON);
              return { meta: { changes: 1 } };
            } };
          } };
        }
        throw new Error(`Unexpected SQL in Wiki migration test: ${sql}`);
      },
    },
  };
  const migratedWiki = await handleRequest(new Request("https://example.test/api/wiki"), wikiEnv);
  assert.equal(migratedWiki.status, 200);
  const migratedWikiBody = await migratedWiki.json();
  assert.equal(migratedWikiBody.pages[0].id, "fiora");
  assert.deepEqual(
    migratedWikiBody.pages[0].legacyIds,
    ["a4901fbc-0a6f-45dd-ad3f-f82f76e04007"],
  );
  assert.deepEqual(migratedWikiPages, migratedWikiBody.pages, "D1 should persist migrated Wiki IDs");

  let savedWikiPages = null;
  const wikiWriteEnv = {
    ...env,
    OPEN_WRITES: "true",
    DB: {
      prepare(sql) {
        if (sql.includes("FROM app_settings")) return { first: async () => null };
        if (sql.startsWith("INSERT INTO wiki_documents")) {
          return { bind(pagesJSON) {
            return { run: async () => {
              savedWikiPages = JSON.parse(pagesJSON);
              return { meta: { changes: 1 } };
            } };
          } };
        }
        throw new Error(`Unexpected SQL in Wiki write test: ${sql}`);
      },
    },
  };
  const savedWiki = await handleRequest(new Request("https://example.test/api/wiki", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ pages: legacyWikiPages }),
  }), wikiWriteEnv);
  assert.equal(savedWiki.status, 200);
  assert.equal(savedWikiPages[0].id, "fiora", "Every Wiki write should enforce title-derived IDs");
  assert.deepEqual(savedWikiPages[0].legacyIds, [legacyWikiPages[0].id]);

  const adminSource = fs.readFileSync("admin/js/entry.js", "utf8");
  sectionKeys.forEach((key) => assert.ok(adminSource.includes(`${key}:`) || adminSource.includes(`"${key}":`), `${key} needs an admin toggle`));
  assert.match(
    fs.readFileSync("cloudflare/scripts/build-seed.cjs", "utf8"),
    /\{ id: "template", active: 0 \}/,
    "The template must be seeded into D1 as unavailable.",
  );
  assert.match(
    fs.readFileSync("cloudflare/migrations/0004_music_library.sql", "utf8"),
    /CREATE TABLE IF NOT EXISTS music_library/,
    "Music D1 storage must have an additive migration.",
  );
  assert.match(
    fs.readFileSync("cloudflare/migrations/0005_public_initiative_setting.sql", "utf8"),
    /json_set[\s\S]*public-initiative[\s\S]*json\('true'\)/,
    "Public Initiative must have an additive settings migration.",
  );
  assert.match(
    fs.readFileSync("cloudflare/migrations/0007_wiki_navigation.sql", "utf8"),
    /json_set[\s\S]*wiki[\s\S]*json\('true'\)/,
    "Wiki navigation must be enabled for existing D1 settings.",
  );
  assert.match(
    fs.readFileSync("wrangler.jsonc", "utf8"),
    /"run_worker_first": \["\/\*"\]/,
    "Every page route must run through the Worker authentication guard.",
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
