// Verifies local facets enrich older D1 Compendium index rows.
import assert from "node:assert/strict";

const originalFetch = globalThis.fetch;
globalThis.fetch = async (url) => {
  const value = String(url);
  if (value === "api/compendium/catalog") {
    return new Response(JSON.stringify({
      manifest: { categories: [], publications: [] },
      entries: [{ id: "shortsword", name: "Shortsword" }],
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
  return new Response("Not found", { status: 404 });
};

try {
  const { loadCompendiumCatalog } = await import(`../js/repository.js?test=${Date.now()}`);
  const catalog = await loadCompendiumCatalog();
  assert.deepEqual(catalog.entries[0].facets, {
    kinds: ["Swords"],
    damageTypes: ["Piercing"],
  });
} finally {
  globalThis.fetch = originalFetch;
}

console.log("Compendium repository facet fallback tests passed.");
