import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createCombatLootDocument, updateTrackerCell } from "../js/model.js";
import { renderTracker } from "../js/view.js";

let document = createCombatLootDocument();
let combat = document.tables.find((table) => table.type === "combat");
const row = combat.rows[0];
const byRole = (role) => combat.columns.find((column) => column.role === role);

const initiativeHTML = renderTracker(document.tables.find((table) => table.type === "initiative"));
assert.match(initiativeHTML, /data-action="add-row-end"[^>]*class="[^"]*bg-emerald-700/);
assert.match(initiativeHTML, /data-action="set-party"[^>]*class="[^"]*bg-yellow-200/);
assert.match(initiativeHTML, /data-action="bring-party"[^>]*class="[^"]*bg-yellow-200/);
assert.match(initiativeHTML, />Set a Party<\/button>/);
assert.match(initiativeHTML, />Bring a Party<\/button>/);
assert.match(initiativeHTML, /class="inline-flex gap-1"><button[^>]*data-action="sort-initiative"/);
assert.match(initiativeHTML, /data-action="sort-initiative"[^>]*class="[^"]*bg-violet-300/);
assert.match(initiativeHTML, /data-action="send-to-combat"[^>]*class="[^"]*bg-violet-300/);

let html = renderTracker(combat);
assert.match(html, /data-action="add-column-end"[^>]*class="[^"]*bg-emerald-700/);
assert.match(html, /data-damage-cell/);
assert.match(html, /Hide row tools/);
assert.match(html, /Hide Character Info/);
assert.match(html, /Hide Rounds/);
assert.match(html, /data-action="toggle-row-tools"[^>]*class="[^"]*border-stone-400[^"]*bg-white\/70/);
assert.doesNotMatch(
  html.match(/data-damage-cell[^>]*>/)?.[0] || "",
  /aria-invalid/,
  "blank placeholder rows should not show a Damage error",
);
document = updateTrackerCell(document, combat.id, row.id, byRole("hp").id, "");
document = updateTrackerCell(document, combat.id, row.id, byRole("damage").id, "");
combat = document.tables.find((table) => table.type === "combat");
assert.doesNotMatch(renderTracker(combat), /aria-invalid="true"/);

document = updateTrackerCell(document, combat.id, row.id, byRole("character").id, "Cassian");
document = updateTrackerCell(document, combat.id, row.id, byRole("hp").id, "40");
document = updateTrackerCell(document, combat.id, row.id, byRole("damage").id, "5+10-2");
combat = document.tables.find((table) => table.type === "combat");
html = renderTracker(combat);
assert.match(html, />13<\/span>/);
assert.match(html, />5\+10-2<\/span>/);
assert.match(html, /Current HP: 27/);
assert.match(html, /data-current-hp[^>]*class="[^"]*min-h-12[^"]*min-w-52/);
assert.match(
  html,
  new RegExp(`data-action="open-cell-editor"[^>]*data-column-id="${byRole("condition").id}"`),
);
assert.match(
  html,
  new RegExp(`data-inline-cell[^>]*data-column-id="${byRole("hp").id}"[^>]*class="[^"]*min-h-12[^"]*min-w-52`),
);
assert.match(html, /style="left:0;width:15rem;min-width:15rem"/);
assert.match(html, /style="left:15rem"/);
assert.match(html, /style="left:18rem"/);

document = updateTrackerCell(document, combat.id, row.id, byRole("damage").id, "");
combat = document.tables.find((table) => table.type === "combat");
html = renderTracker(combat);
assert.match(html, /Current HP: 40/);
assert.doesNotMatch(
  html.match(/data-damage-cell[^>]*>/)?.[0] || "",
  /aria-invalid/,
  "zero Damage should remain valid for an active character",
);

html = renderTracker(combat, {
  hideCharacterInfo: true,
  hideRounds: true,
  hideRowTools: true,
});
assert.doesNotMatch(html, /value="Damage"/);
assert.doesNotMatch(html, /value="Round 1"/);
assert.doesNotMatch(html, />Row tools<\/th>/);
assert.match(html, /value="Character"/);
assert.match(html, /data-action="toggle-row-tools"[^>]*class="[^"]*border-blood-500[^"]*bg-blood-500/);

const pageHTML = readFileSync(new URL("../index.html", import.meta.url), "utf8");
assert.match(pageHTML, /<div class="flex flex-col gap-4">/);
assert.doesNotMatch(pageHTML, /xl:flex-row xl:items-end xl:justify-between/);
assert.match(pageHTML, /id="send-combat-dialog"/);
assert.match(pageHTML, /id="bring-party-dialog"/);
assert.match(pageHTML, /id="party-conflict-dialog"/);
assert.match(pageHTML, /id="party-name"/);
assert.match(pageHTML, /id="sort-send-combat"[^>]*>Sort &amp; Send<\/button>/);
assert.match(pageHTML, /id="send-combat-as-is"[^>]*>Send as they are<\/button>/);
assert.match(pageHTML, /id="cancel-send-combat"[^>]*>Cancel<\/button>/);

console.log("Combat tracker view tests passed.");
