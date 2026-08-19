const assert = require("node:assert/strict");
const fs = require("node:fs");

const html = fs.readFileSync("public-initiative/index.html", "utf8");
const page = fs.readFileSync("public-initiative/js/page.js", "utf8");
const entry = fs.readFileSync("public-initiative/js/entry.js", "utf8");
const combatPage = fs.readFileSync("combat-loot/index.html", "utf8");

assert.match(html, /id="initiative-list"/);
assert.doesNotMatch(html, /<(?:form|input|textarea|select)\b|contenteditable=/i);
assert.match(page, /readCloudJSON\("api\/combat-loot"/);
assert.doesNotMatch(page, /writeCloudJSON|addEventListener/);
assert.match(page, /item\.textContent = name/);
assert.match(combatPage, /href="public-initiative\/"/);
assert.match(entry, /activePage: "public-initiative"/);

console.log("Public Initiative page structure tests passed.");
