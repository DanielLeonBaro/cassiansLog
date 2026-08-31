// Verifies character sheet layout and ownership.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

global.window = {
  matchMedia: () => ({ matches: false, addEventListener() {} }),
};
global.fetch = async () => ({ ok: true, json: async () => ({ characterSheetStyle: "v1", sections: {} }) });

(async () => {
  const moduleURL = `${pathToFileURL(path.resolve("char/js/tracker/layout.js"))}?test=${Date.now()}`;
  const { applyV1CharacterSheetOrder, chooseCharacterSheetTab, tabForScrollTarget } = await import(moduleURL);

  assert.equal(tabForScrollTarget("hpManager"), "combat");
  assert.equal(tabForScrollTarget("preparedSpellsSection"), "spellcasting");
  assert.equal(tabForScrollTarget("inventoryAccordion"), "inventory");
  assert.equal(tabForScrollTarget("unknown"), null);

  assert.equal(chooseCharacterSheetTab({
    requested: "notes",
    available: ["stats", "combat", "notes"],
  }), "notes");
  assert.equal(chooseCharacterSheetTab({
    requested: "spellcasting",
    available: ["stats", "combat", "notes"],
  }), "combat");
  assert.equal(chooseCharacterSheetTab({
    requested: "stats",
    available: ["stats", "combat", "notes"],
    desktop: true,
    lastWorkspace: "notes",
  }), "notes");
  assert.equal(chooseCharacterSheetTab({
    requested: "stats",
    available: ["stats"],
    desktop: true,
  }), "stats");

  const appended = [];
  const elementIds = [
    "characterDescription", "quickStatsCard", "combatAccordion", "hpManager",
    "death-saves-section", "combatResources", "spellcastingSection",
    "preparedSpellsSection", "allPossibilities", "inventory-page", "notesSection",
  ];
  const elements = new Map(elementIds.map((id) => [id, { id }]));
  elements.set("combat-page", { appendChild: (element) => appended.push(element.id) });
  global.document = {
    documentElement: { dataset: { characterSheetStyle: "v1" } },
    getElementById: (id) => elements.get(id) || null,
  };
  assert.equal(applyV1CharacterSheetOrder({
    v1SectionOrder: ["inventory", "combat", "character-stats", "hit-points"],
  }), true);
  assert.deepEqual(appended.slice(0, 7), [
    "inventory-page", "combatResources", "quickStatsCard", "combatAccordion",
    "hpManager", "death-saves-section", "characterDescription",
  ]);
  global.document.documentElement.dataset.characterSheetStyle = "v2";
  assert.equal(applyV1CharacterSheetOrder({ v1SectionOrder: ["notes"] }), false);
  assert.equal(appended.at(-1), "notesSection", "V2 must not move V1 sections.");
  delete global.document;

  const tracker = fs.readFileSync("char/tracker.html", "utf8");
  const layout = fs.readFileSync("char/js/tracker/layout.js", "utf8");
  const trackerIndex = fs.readFileSync("char/js/tracker/index.js", "utf8");
  const styles = fs.readFileSync("shared/styles/tailwind.css", "utf8");
  for (const id of [
    "hpManager", "combatResources", "spellcastingSection", "preparedSpellsSection",
    "allPossibilities", "inventory-page", "notesSection",
  ]) {
    assert.equal((tracker.match(new RegExp(`id=["']${id}["']`, "g")) || []).length, 1, `${id} should have one functional DOM instance.`);
    assert.ok(layout.includes(`document.getElementById("${id}")`), `${id} should be moved into v2 by reference.`);
  }
  assert.doesNotMatch(layout, /cloneNode|outerHTML/, "V2 must not clone tracker controls.");
  assert.doesNotMatch(trackerIndex, /v2-senses-card|<strong>Senses<\/strong>/, "V2 stats should not duplicate top-level senses.");
  assert.match(styles, /#characterDescription #character-portrait \{[\s\S]*?rounded-xl[\s\S]*?border-blood-500\/70/, "V2 portrait should stay square with the standard red accent.");
  assert.match(layout, /resolveCharacterSheetStyle\(settings, characterId\)/, "V2 should resolve the route's per-character style override.");
  assert.match(layout, /export function applyV1CharacterSheetOrder/, "V1 should apply each character's saved section order.");
  assert.match(layout, /normalizeV1SectionOrder\(character\.v1SectionOrder\)/, "V1 should normalize saved ordering before moving DOM sections.");
  assert.match(trackerIndex, /applyV1CharacterSheetOrder\(character\)/, "Every V1 refresh should reapply the current character order.");
  assert.doesNotMatch(styles, /\[data-character-sheet-style="v2"\] #inspiration-toggle/, "V2 must preserve V1's yellow Inspiration colors.");
  assert.match(tracker, /id="inspiration-toggle"[^>]*hover:border-yellow-300[^>]*aria-checked:bg-yellow-200/, "Inspiration should retain its V1 yellow states.");
  assert.match(tracker, /id="cinematic-toggle"[^>]*hover:border-violet-300[^>]*aria-checked:bg-violet-300/, "Cinematic should retain its V1 violet states.");
  console.log("Character sheet layout mapping and ownership tests passed.");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
