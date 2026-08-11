const categoryCache = new Map();
let catalogPromise;

async function getJSON(path, message) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(message || `Could not load ${path}`);
  return response.json();
}

export function loadCompendiumCatalog() {
  if (!catalogPromise) {
    catalogPromise = Promise.all([
      getJSON("data/compendium/manifest.json", "The compendium files could not be loaded."),
      getJSON("data/compendium/index.json", "The compendium files could not be loaded."),
    ]).then(([manifest, index]) => ({ manifest, entries: index.entries }));
  }
  return catalogPromise;
}

export async function loadCompendiumCategory(category, manifest) {
  if (categoryCache.has(category)) return categoryCache.get(category);
  const definition = manifest.categories.find((item) => item.id === category);
  if (!definition) throw new Error(`Unknown compendium category: ${category}`);
  const promise = getJSON(`data/compendium/${definition.file}`).then((value) => value.entries);
  categoryCache.set(category, promise);
  return promise;
}

export function resetCompendiumCache() {
  catalogPromise = undefined;
  categoryCache.clear();
}
