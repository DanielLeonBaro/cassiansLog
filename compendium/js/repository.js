// Loads and caches the Compendium catalog and category documents.
const categoryCache = new Map();
let catalogPromise;
let rulesMetadataPromise;

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

function loadLocalRulesMetadata() {
  if (!rulesMetadataPromise) {
    rulesMetadataPromise = getOptionalJSON(new URL("../data/rules-metadata.json", import.meta.url))
      .then((document) => document?.entries && typeof document.entries === "object"
        ? document.entries
        : {});
  }
  return rulesMetadataPromise;
}

export function applyRulesMetadata(entries, metadata) {
  return entries.map((entry) => {
    const {
      rulesOverride,
      requirementsOverride,
      prerequisiteOverride,
      settersOverride,
      sheetAttributesOverride,
      ...rulesMetadata
    } = metadata[entry.id] || {};
    return {
      ...entry,
      ...rulesMetadata,
      ...(rulesOverride ? { rules: rulesOverride } : {}),
      ...(requirementsOverride !== undefined ? { requirements: requirementsOverride } : {}),
      ...(prerequisiteOverride !== undefined ? { prerequisite: prerequisiteOverride } : {}),
      setters: { ...(entry.setters || {}), ...(settersOverride || {}) },
      sheetAttributes: { ...(entry.sheetAttributes || {}), ...(sheetAttributesOverride || {}) },
    };
  });
}

export function loadCompendiumCatalog() {
  if (!catalogPromise) {
    const localCatalog = () => Promise.all([
      getJSON(new URL("../data/manifest.json", import.meta.url), "The compendium files could not be loaded."),
      getJSON(new URL("../data/index.json", import.meta.url), "The compendium files could not be loaded."),
      loadLocalRulesMetadata(),
    ]).then(([manifest, index, metadata]) => ({
      manifest,
      entries: applyRulesMetadata(index.entries, metadata),
    }));
    catalogPromise = Promise.all([
      getOptionalJSON("api/compendium/catalog"),
      localCatalog(),
    ]).then(([cloud, local]) => {
      if (!cloud?.manifest || !Array.isArray(cloud.entries)) return local;
      const facetsById = new Map(
        local.entries.map((entry) => [entry.id, entry.facets]),
      );
      const metadataById = new Map(local.entries.map((entry) => [entry.id, entry]));
      return {
        manifest: { ...local.manifest, ...cloud.manifest },
        entries: cloud.entries.map((entry) => {
          const localEntry = metadataById.get(entry.id) || {};
          const merged = {
            ...localEntry,
            ...entry,
            facets: entry.facets || facetsById.get(entry.id),
          };
          if (!localEntry.certification) return merged;
          return {
            ...merged,
            ruleset: localEntry.ruleset,
            publisher: localEntry.publisher,
            source: localEntry.source,
            dependencies: localEntry.dependencies,
            automation: localEntry.automation,
            certification: localEntry.certification,
            rules: localEntry.rules,
            requirements: localEntry.requirements,
            prerequisite: localEntry.prerequisite,
            setters: { ...(entry.setters || {}), ...(localEntry.setters || {}) },
            sheetAttributes: { ...(entry.sheetAttributes || {}), ...(localEntry.sheetAttributes || {}) },
          };
        }),
      };
    });
  }
  return catalogPromise;
}

export async function loadCompendiumCategory(category, manifest) {
  if (categoryCache.has(category)) return categoryCache.get(category);
  const definition = manifest.categories.find((item) => item.id === category);
  if (!definition) throw new Error(`Unknown compendium category: ${category}`);
  const promise = Promise.all([
    getOptionalJSON(`api/compendium/categories/${encodeURIComponent(category)}`)
      .then((cloud) => Array.isArray(cloud?.entries)
      ? cloud.entries
      : getJSON(new URL(`../data/${definition.file}`, import.meta.url)).then((value) => value.entries)),
    loadLocalRulesMetadata(),
  ]).then(([entries, metadata]) => applyRulesMetadata(entries, metadata));
  categoryCache.set(category, promise);
  return promise;
}

export function resetCompendiumCache() {
  catalogPromise = undefined;
  rulesMetadataPromise = undefined;
  categoryCache.clear();
}
