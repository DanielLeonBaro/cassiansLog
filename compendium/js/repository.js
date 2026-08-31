// Loads and caches the Compendium catalog and category documents.
const categoryCache = new Map();
let catalogPromise;

async function getOptionalJSON(url) {
  try {
    const response = await fetch(url, { headers: { accept: "application/json" } });
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}

async function getJSON(url, message) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(message || `Could not load ${url}`);
  return response.json();
}

export function loadCompendiumCatalog() {
  if (!catalogPromise) {
    const localCatalog = () => Promise.all([
      getJSON(new URL("../data/manifest.json", import.meta.url), "The compendium files could not be loaded."),
      getJSON(new URL("../data/index.json", import.meta.url), "The compendium files could not be loaded."),
    ]).then(([manifest, index]) => ({ manifest, entries: index.entries }));
    catalogPromise = getOptionalJSON("api/compendium/catalog").then(async (cloud) => {
      if (!cloud?.manifest || !Array.isArray(cloud.entries)) return localCatalog();
      if (cloud.entries.every((entry) => entry.facets)) return cloud;
      const local = await localCatalog();
      const facetsById = new Map(
        local.entries.map((entry) => [entry.id, entry.facets]),
      );
      return {
        manifest: cloud.manifest,
        entries: cloud.entries.map((entry) => ({
          ...entry,
          facets: entry.facets || facetsById.get(entry.id),
        })),
      };
    });
  }
  return catalogPromise;
}

export async function loadCompendiumCategory(category, manifest) {
  if (categoryCache.has(category)) return categoryCache.get(category);
  const definition = manifest.categories.find((item) => item.id === category);
  if (!definition) throw new Error(`Unknown compendium category: ${category}`);
  const promise = getOptionalJSON(`api/compendium/categories/${encodeURIComponent(category)}`)
    .then((cloud) => Array.isArray(cloud?.entries)
      ? cloud.entries
      : getJSON(new URL(`../data/${definition.file}`, import.meta.url)).then((value) => value.entries));
  categoryCache.set(category, promise);
  return promise;
}

export function resetCompendiumCache() {
  catalogPromise = undefined;
  categoryCache.clear();
}
