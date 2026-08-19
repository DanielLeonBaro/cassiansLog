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
  const { chooseCharacterSheetTab, tabForScrollTarget } = await import(moduleURL);

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
  console.log("Character sheet layout mapping and ownership tests passed.");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
