const categoryCache = new Map();
let catalogPromise;

async function getJSON(url, message) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(message || `Could not load ${url}`);
  return response.json();
}

export function loadCompendiumCatalog() {
  if (!catalogPromise) {
    catalogPromise = Promise.all([
      getJSON(new URL("../data/manifest.json", import.meta.url), "The compendium files could not be loaded."),
      getJSON(new URL("../data/index.json", import.meta.url), "The compendium files could not be loaded."),
    ]).then(([manifest, index]) => ({ manifest, entries: index.entries }));
  }
  return catalogPromise;
}

export async function loadCompendiumCategory(category, manifest) {
  if (categoryCache.has(category)) return categoryCache.get(category);
  const definition = manifest.categories.find((item) => item.id === category);
  if (!definition) throw new Error(`Unknown compendium category: ${category}`);
  const promise = getJSON(new URL(`../data/${definition.file}`, import.meta.url)).then((value) => value.entries);
  categoryCache.set(category, promise);
  return promise;
}

export function resetCompendiumCache() {
  catalogPromise = undefined;
  categoryCache.clear();
}
