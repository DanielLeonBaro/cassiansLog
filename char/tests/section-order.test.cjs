const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

(async () => {
  const moduleURL = `${pathToFileURL(path.resolve("char/js/tracker/section-order.js"))}?test=${Date.now()}`;
  const {
    DEFAULT_V1_SECTION_ORDER,
    V1_SECTION_DEFINITIONS,
    moveV1SectionBefore,
    moveV1SectionBy,
    normalizeV1SectionOrder,
  } = await import(moduleURL);

  assert.deepEqual([...DEFAULT_V1_SECTION_ORDER], [
    "character-overview", "character-stats", "hit-points", "combat", "spellcasting",
    "prepared-spells", "all-possibilities", "inventory", "notes",
  ]);
  assert.deepEqual(
    normalizeV1SectionOrder(["inventory", "future", "combat", "inventory"]),
    [
      "inventory", "combat", "character-overview", "character-stats", "hit-points",
      "spellcasting", "prepared-spells", "all-possibilities", "notes",
    ],
  );
  assert.deepEqual(normalizeV1SectionOrder(null), [...DEFAULT_V1_SECTION_ORDER]);

  const inventoryBeforeCombat = moveV1SectionBefore(DEFAULT_V1_SECTION_ORDER, "inventory", "combat");
  assert.deepEqual(inventoryBeforeCombat.slice(0, 5), [
    "character-overview", "character-stats", "hit-points", "inventory", "combat",
  ]);
  assert.deepEqual(
    moveV1SectionBy(DEFAULT_V1_SECTION_ORDER, "combat", -1).slice(0, 4),
    ["character-overview", "character-stats", "combat", "hit-points"],
  );
  assert.deepEqual(
    moveV1SectionBy(DEFAULT_V1_SECTION_ORDER, "character-overview", -1),
    [...DEFAULT_V1_SECTION_ORDER],
  );

  const stats = V1_SECTION_DEFINITIONS.find(({ id }) => id === "character-stats");
  const hitPoints = V1_SECTION_DEFINITIONS.find(({ id }) => id === "hit-points");
  assert.deepEqual([...stats.elementIds], ["quickStatsCard", "combatAccordion"]);
  assert.deepEqual([...hitPoints.elementIds], ["hpManager", "death-saves-section"]);
  console.log("V1 character section ordering tests passed.");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
