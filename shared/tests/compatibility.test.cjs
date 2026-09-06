// Verifies URL, storage, API, and seed compatibility.
const assert = require("node:assert/strict");
const fs = require("node:fs");

function source(file) {
  return fs.readFileSync(file, "utf8");
}

const pageBases = new Map([
  ["admin/index.html", "/"],
  ["login/index.html", "/"],
  ["char/index.html", "/"],
  ["char/tracker.html", "../"],
  ["combat-loot/index.html", "/"],
  ["compendium/index.html", "/"],
  ["dm-screen/index.html", "/"],
  ["music/index.html", "/"],
  ["public-initiative/index.html", "/"],
  ["player-screen/index.html", "/"],
  ["wiki/index.html", "/"],
]);

for (const [file, base] of pageBases) {
  assert.match(source(file), new RegExp(`<base href=["']${base}["']>`), `${file} must preserve its base URL.`);
}

const catalog = JSON.parse(source("char/catalog.json"));
for (const id of [...catalog.characters, "template"]) {
  const file = `char/${id}/index.html`;
  const basePattern = id === "template" ? /<base href=["']\/["']>/ : /<base href=["']\.\.\/\.\.\/["']>/;
  assert.match(source(file), basePattern, `${file} must resolve from the site root.`);
  const integration = source(file).indexOf('src="integrations/character-compendium/index.js"');
  const characterPage = source(file).indexOf('src="char/js/entries/character-page.js"');
  assert.ok(integration >= 0 && integration < characterPage, `${file} must load the optional integration before the Character page.`);
}

const storageContracts = new Map([
  ["char/js/storage-keys.js", [
    "dnd-characters",
    "dnd-deleted-characters",
    "dnd-new-character",
    'dnd-${characterId || "character"}-state',
    'dnd-${characterId || "character"}-notes',
  ]],
  ["combat-loot/js/repository.js", ["dnd-combat-loot-presets-v1", "dnd-combat-loot-draft-v1"]],
  ["music/js/repository.js", ["dnd-music-tracks", "dnd-music-settings"]],
  ["wiki/js/repository.js", ["dnd-wiki-pages-v1"]],
  ["shared/js/settings.js", ["cassianslog-runtime-settings"]],
  ["shared/js/theme.js", ["dnd-theme"]],
  ["shared/js/cloud-store.js", ["cassianslog-write-token"]],
  ["screens/js/repository.js", ["cassianslog-screen-v1"]],
]);

for (const [file, keys] of storageContracts) {
  const content = source(file);
  keys.forEach((key) => assert.ok(content.includes(key), `${file} must preserve storage key ${key}.`));
}

const worker = source("cloudflare/worker.js");
const workerAuthentication = source("cloudflare/auth.js");
for (const route of [
  "/api/health",
  "/api/settings",
  "/api/admin",
  "/api/compendium/catalog",
  "/api/compendium/categories/",
  "/api/characters",
  "/api/combat-loot",
  "/api/music",
  "/api/public-initiative",
  "/api/screens",
  "/api/wiki",
  "/api/auth",
]) {
  assert.ok(worker.includes(route), `The Worker must preserve ${route}.`);
}
assert.match(workerAuthentication, /LEGACY_ADMIN_TOKEN_ENABLED/, "Legacy admin-token access must require an explicit opt-in.");
assert.match(workerAuthentication, /if \(\(await loadSettings\(env\)\)\.openWrites\) return true;/, "Open writes may bypass only ordinary write authentication.");

const seed = source("cloudflare/scripts/build-seed.cjs");
assert.match(seed, /INSERT INTO characters[\s\S]*ON CONFLICT\(id\) DO NOTHING;/, "Seeds must not overwrite existing Character documents.");
assert.match(seed, /INSERT INTO wiki_documents[\s\S]*ON CONFLICT\(id\) DO NOTHING;/, "Seeds must not overwrite the existing Wiki document.");

const publicEntrypoints = new Set([
  "char/js/editor/extensions.js",
  "compendium/js/api.js",
]);
for (const file of publicEntrypoints) {
  assert.ok(fs.existsSync(file), `${file} is a compatibility boundary for optional integrations.`);
}

console.log("URL, storage, API, seed, and integration compatibility contracts passed.");
