const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

global.window = {};
require("../data/wiki-pages.js");

const pages = global.window.WIKI_SEED;
assert.ok(Array.isArray(pages), "Wiki seed should be an array");
assert.ok(pages.length >= 23, "Wiki should include published entities and reference pages");

const ids = new Set();
const names = new Map();
for (const page of pages) {
  assert.ok(page.id, "Every page should have an id");
  assert.ok(page.name, "Every page should have a name");
  assert.ok(page.type, `${page.name} should have a type`);
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

const wikiScript = fs.readFileSync(path.join(__dirname, "..", "js", "wiki.js"), "utf8");
const wikiHTML = fs.readFileSync(path.join(__dirname, "..", "wiki", "index.html"), "utf8");
assert.ok(!wikiScript.includes('href="#page='), "Wiki links must remain under the wiki base path");
assert.match(wikiScript, /wiki\/#page=/, "Wiki links should include the wiki path before the hash");
assert.match(wikiHTML, /Formatting guide/, "The page editor should include its formatting guide");

console.log(`Wiki seed tests passed (${pages.length} pages).`);
