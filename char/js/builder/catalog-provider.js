// Defines Character Builder's feature-neutral registration seam for optional Compendium catalogs.
let catalogProvider = null;

export function registerCharacterBuilderCatalogProvider(provider) {
  if (typeof provider !== "function") throw new TypeError("Character Builder catalog provider must be a function.");
  catalogProvider = provider;
}

export async function loadCharacterBuilderCatalog() {
  if (!catalogProvider) throw new Error("Character Builder Compendium integration is unavailable.");
  return catalogProvider();
}
