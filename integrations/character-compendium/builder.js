// Connects Character Builder's public catalog-provider seam to Compendium's public API.
import { registerCharacterBuilderCatalogProvider } from "../../char/js/builder/catalog-provider.js";
import { loadCompendiumCatalog } from "../../compendium/js/api.js";

registerCharacterBuilderCatalogProvider(loadCompendiumCatalog);
