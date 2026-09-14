// Verifies local facets enrich older D1 Compendium index rows.
import assert from "node:assert/strict";

const originalFetch = globalThis.fetch;
globalThis.fetch = async (url) => {
  const value = String(url);
  if (value === "api/compendium/catalog") {
    return new Response(JSON.stringify({
      manifest: { categories: [], publications: [] },
      entries: [{ id: "shortsword", name: "Shortsword", rules: { stats: [{ name: "stale", value: "1" }] } }],
    }));
  }
  if (value === "api/compendium/categories/items") {
    return new Response(JSON.stringify({
      entries: [{ id: "shortsword", name: "Shortsword", description: "A blade." }],
    }));
  }
  if (value.endsWith("/data/manifest.json")) {
    return new Response(JSON.stringify({ categories: [], publications: [] }));
  }
  if (value.endsWith("/data/index.json")) {
    return new Response(JSON.stringify({
      entries: [{
        id: "shortsword",
        facets: { kinds: ["Swords"], damageTypes: ["Piercing"] },
      }],
    }));
  }
  if (value.endsWith("/data/rules-metadata.json")) {
    return new Response(JSON.stringify({
      entries: {
        shortsword: {
          ruleset: "5e",
          publisher: "Wizards of the Coast",
          source: "Player's Handbook",
          dependencies: [],
          automation: { status: "manual", reasons: ["no-automation-data"], expressions: [] },
          certification: { ruleset: "5e", levels: [1, 5] },
          rulesOverride: { stats: [{ name: "certified", value: "1" }] },
          requirementsOverride: "",
          prerequisiteOverride: "",
          settersOverride: { hd: "d10" },
          sheetAttributesOverride: {},
        },
      },
    }));
  }
  return new Response("Not found", { status: 404 });
};

try {
  const { loadCompendiumCatalog, loadCompendiumCategory } = await import(`../js/repository.js?test=${Date.now()}`);
  const catalog = await loadCompendiumCatalog();
  assert.deepEqual(catalog.entries[0].facets, {
    kinds: ["Swords"],
    damageTypes: ["Piercing"],
  });
  assert.equal(catalog.entries[0].ruleset, "5e");
  assert.equal(catalog.entries[0].publisher, "Wizards of the Coast");
  assert.equal(catalog.entries[0].automation.status, "manual");
  assert.equal(catalog.entries[0].rules.stats[0].name, "certified", "local certifications override stale D1 rules");
  assert.equal(catalog.entries[0].setters.hd, "d10");
  const items = await loadCompendiumCategory("items", {
    categories: [{ id: "items", file: "items.json" }],
  });
  assert.equal(items[0].description, "A blade.");
  assert.equal(items[0].ruleset, "5e");
  assert.equal(items[0].automation.status, "manual");
} finally {
  globalThis.fetch = originalFetch;
}

console.log("Compendium repository facet fallback tests passed.");
