// Verifies Public Initiative page structure.
const assert = require("node:assert/strict");
const fs = require("node:fs");

const html = fs.readFileSync("public-initiative/index.html", "utf8");
const page = fs.readFileSync("public-initiative/js/page.js", "utf8");
const entry = fs.readFileSync("public-initiative/js/entry.js", "utf8");
const combatPage = fs.readFileSync("combat-loot/index.html", "utf8");

assert.match(html, /id="initiative-list"/);
assert.doesNotMatch(html, /<(?:form|input|textarea|select)\b|contenteditable=/i);
assert.match(page, /readCloudJSON\("api\/public-initiative"/);
assert.doesNotMatch(page, /writeCloudJSON|addEventListener/);
assert.match(html, /<ol id="initiative-list"/);
assert.match(page, /badge\.textContent = String\(index \+ 1\)/);
assert.match(page, /bg-blood-500[^"\n]*text-on-accent/);
assert.match(page, /label\.textContent = name/);
assert.match(combatPage, /href="public-initiative\/"/);
assert.match(entry, /activePage: "public-initiative"/);

console.log("Public Initiative page structure tests passed.");
