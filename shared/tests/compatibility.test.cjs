const assert = require("node:assert/strict");
const fs = require("node:fs");

function source(file) {
  return fs.readFileSync(file, "utf8");
}

const pageBases = new Map([
  ["admin/index.html", "../"],
  ["char/index.html", "../"],
  ["char/tracker.html", "../"],
  ["combat-loot/index.html", "../"],
  ["compendium/index.html", "../"],
  ["music/index.html", "../"],
  ["public-initiative/index.html", "../"],
  ["wiki/index.html", "../"],
]);

for (const [file, base] of pageBases) {
  assert.match(source(file), new RegExp(`<base href=["']${base}["']>`), `${file} must preserve its base URL.`);
}

const catalog = JSON.parse(source("char/catalog.json"));
for (const id of [...catalog.characters, "template"]) {
  const file = `char/${id}/index.html`;
  assert.match(source(file), /<base href=["']\.\.\/\.\.\/["']>/, `${file} must resolve from the site root.`);
  const integration = source(file).indexOf('src="integrations/character-compendium/index.js"');
  const characterPage = source(file).indexOf('src="char/js/entries/character-page.js"');
  assert.ok(integration >= 0 && integration < characterPage, `${file} must load the optional integration before the Character page.`);
}

const storageContracts = new Map([
  ["char/js/archive/repository.js", ["dnd-characters", "dnd-deleted-characters", "dnd-new-character"]],
  ["combat-loot/js/repository.js", ["dnd-combat-loot-presets-v1", "dnd-combat-loot-draft-v1"]],
  ["music/js/repository.js", ["dnd-music-tracks", "dnd-music-settings"]],
  ["wiki/js/repository.js", ["dnd-wiki-pages-v1"]],
  ["shared/js/settings.js", ["cassianslog-runtime-settings"]],
  ["shared/js/theme.js", ["dnd-theme"]],
  ["shared/js/cloud-store.js", ["cassianslog-write-token"]],
  ["admin/js/entry.js", ["cassianslog-admin-token"]],
  ["char/js/tracker/state.js", ['dnd-${character.id || "character"}-state']],
  ["char/js/tracker/notes.js", ['dnd-${characterId || "character"}-notes']],
]);

for (const [file, keys] of storageContracts) {
  const content = source(file);
  keys.forEach((key) => assert.ok(content.includes(key), `${file} must preserve storage key ${key}.`));
}

const worker = source("cloudflare/worker.js");
for (const route of [
  "/api/health",
  "/api/settings",
  "/api/admin",
  "/api/compendium/catalog",
  "/api/compendium/categories/",
  "/api/characters",
  "/api/combat-loot",
  "/api/music",
  "/api/wiki",
]) {
  assert.ok(worker.includes(route), `The Worker must preserve ${route}.`);
}
assert.match(worker, /env\.ADMIN_TOKEN \|\| env\.WRITE_TOKEN/, "Admin authentication must remain separate from public writes.");
assert.match(worker, /if \(\(await loadSettings\(env\)\)\.openWrites\) return true;/, "Open writes may bypass only ordinary write authentication.");

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
