// Verifies NPC V4 style, accessibility, authority, and no-conversion contracts.
const assert = require("node:assert/strict");
const fs = require("node:fs");

const settings = fs.readFileSync("shared/js/settings.js", "utf8");
const route = fs.readFileSync("cloudflare/routes/campaign-npcs.js", "utf8");
const layout = fs.readFileSync("char/js/tracker/v4-layout.js", "utf8");
const entry = fs.readFileSync("char/js/entries/tracker.js", "utf8");
const tracker = fs.readFileSync("char/js/tracker/index.js", "utf8");
const editor = fs.readFileSync("char/js/editor/index.js", "utf8");

assert.doesNotMatch(settings, /style === "v4" \? DEFAULT_CHARACTER_SHEET_STYLE/);
assert.match(route, /new Set\(\["v1", "v2", "v3", "v4"\]\)/);
assert.match(route, /NPC tracker style must be v1, v2, v3, or v4/);
assert.match(layout, /sheet\.dataset\.v4Entity/);
assert.match(layout, /`\$\{entityLabel\(\)\} summary`/);
assert.match(layout, /`\$\{entityLabel\(\)\} tracker sections`/);
assert.match(entry, /const readOnlyControls = v4/);
assert.match(entry, /not\(\[data-tracker-action="open-v4-detail"\]\)/);
assert.match(tracker, /document\.body\?\.dataset\?\.trackerKind !== "npc"/);
assert.match(editor, /kind: npcMode \? "npc" : "character"/);
assert.match(editor, /\$\{npcMode \? "NPC" : "Character"\} tracker layout/);
assert.match(editor, /Fields outside the standard \$\{npcMode \? "NPC" : "character"\} schema/);

console.log("V4 freeform NPC accessible UI contracts passed.");
