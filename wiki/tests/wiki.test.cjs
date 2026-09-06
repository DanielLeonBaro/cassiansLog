// Verifies wiki seed and clean routes.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

(async () => {
  const { compactWikiPageId, findWikiPageById, normalizeWikiPages } = await import(
    `${pathToFileURL(path.resolve("wiki/js/model.js"))}?test=${Date.now()}`
  );
  const { wikiPageId, wikiPageURL } = await import(
    `${pathToFileURL(path.resolve("wiki/js/routing.js"))}?test=${Date.now()}`
  );
  const pages = JSON.parse(fs.readFileSync("wiki/data/pages.json", "utf8"));
  assert.ok(Array.isArray(pages), "Wiki seed should be an array");
  assert.ok(pages.length >= 23, "Wiki should include published entities and reference pages");

  const ids = new Set();
  const names = new Map();
  for (const page of pages) {
    assert.ok(page.id, "Every page should have an id");
    assert.ok(page.name, "Every page should have a name");
    assert.ok(page.type, `${page.name} should have a type`);
    assert.equal(page.id, compactWikiPageId(page.name), `${page.name} should use its compact title ID`);
    assert.ok(!ids.has(page.id), `Duplicate wiki id: ${page.id}`);
    ids.add(page.id);
    const normalized = page.name.toLocaleLowerCase();
    assert.ok(!names.has(normalized), `Duplicate wiki name: ${page.name}`);
    names.set(normalized, page);
  }

  for (const required of [
    "Breugaire",
    "Fiora",
    "Las Seis Sombras",
    "La Luz del Velo Dorado",
    "Mapa de Breugaire",
    "La historia de Breugaire",
    "Von Bloodingtons",
  ]) {
    assert.ok(names.has(required.toLocaleLowerCase()), `Missing imported page: ${required}`);
  }

  const aliases = new Map();
  for (const page of pages) {
    for (const alias of page.aliases || []) aliases.set(alias.toLocaleLowerCase(), page);
  }

  for (const page of pages) {
    for (const match of String(page.body || "").matchAll(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g)) {
      const target = match[1].trim().toLocaleLowerCase();
      assert.ok(names.has(target) || aliases.has(target), `${page.name} has a broken mention: ${match[1]}`);
    }
  }

  assert.equal(compactWikiPageId("La Casa von Bloodington"), "lacasavonbloodington");
  assert.equal(compactWikiPageId("Érase una vez!"), "eraseunavez");
  assert.equal(wikiPageURL("fiora"), "/wiki/fiora");
  assert.equal(wikiPageId("/wiki/fiora", ""), "fiora");
  assert.equal(wikiPageId("/wiki/", "#page=old-id"), "old-id");

  const migrated = normalizeWikiPages([{
    id: "a4901fbc-0a6f-45dd-ad3f-f82f76e04007",
    name: "Fiora",
  }]);
  assert.deepEqual(migrated, [{
    id: "fiora",
    name: "Fiora",
    legacyIds: ["a4901fbc-0a6f-45dd-ad3f-f82f76e04007"],
  }]);
  assert.deepEqual(normalizeWikiPages(migrated), migrated, "Wiki migration should be idempotent");
  assert.equal(findWikiPageById(migrated, "fiora"), migrated[0]);
  assert.equal(findWikiPageById(migrated, "a4901fbc-0a6f-45dd-ad3f-f82f76e04007"), migrated[0]);

  const fiora = names.get("fiora");
  const bloodington = names.get("la casa von bloodington");
  assert.equal(fiora.id, "fiora");
  assert.equal(bloodington.id, "lacasavonbloodington");
  assert.ok(fiora.legacyIds.includes("a4901fbc-0a6f-45dd-ad3f-f82f76e04007"));

  const wikiScript = fs.readFileSync("wiki/js/page.js", "utf8");
  const wikiRepository = fs.readFileSync("wiki/js/repository.js", "utf8");
  const wikiRouting = fs.readFileSync("wiki/js/routing.js", "utf8");
  const wikiMarkdown = fs.readFileSync("wiki/js/markdown.js", "utf8");
  const wikiHTML = fs.readFileSync("wiki/index.html", "utf8");
  assert.ok(!wikiScript.includes('href="#page='), "Wiki links must remain under the wiki base path");
  assert.match(wikiRouting, /campaignPagePath\("wiki"\)/, "Wiki links should use campaign-aware clean paths");
  assert.match(wikiScript, /history\.replaceState/, "Legacy links should be canonicalized in place");
  assert.match(wikiScript, /compactWikiPageId\(name\)/, "Editor saves should derive IDs from titles");
  assert.match(wikiHTML, /Formatting guide/, "The page editor should include its formatting guide");
  assert.match(wikiRepository, /readCloudJSON\("api\/wiki"/, "Wiki loads shared D1 data first");
  assert.match(wikiRepository, /writeCloudJSON\("api\/wiki"/, "Wiki saves edits to D1");
  assert.match(wikiHTML, /id="wiki-image-modal"/, "Wiki should include the full-image modal");
  assert.match(wikiMarkdown, /data-wiki-image/, "Body images should open in the full-image modal");

  console.log(`Wiki seed and clean-route tests passed (${pages.length} pages).`);
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
