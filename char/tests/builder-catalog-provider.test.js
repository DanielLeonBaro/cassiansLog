// Verifies Character Builder's optional Compendium provider boundary.
import assert from "node:assert/strict";
import {
  loadCharacterBuilderCatalog,
  registerCharacterBuilderCatalogProvider,
} from "../js/builder/catalog-provider.js";

await assert.rejects(loadCharacterBuilderCatalog(), /integration is unavailable/);
assert.throws(() => registerCharacterBuilderCatalogProvider(null), /must be a function/);
registerCharacterBuilderCatalogProvider(async () => ({ manifest: { catalogVersion: "test" }, entries: [{ id: "fighter" }] }));
assert.deepEqual(await loadCharacterBuilderCatalog(), {
  manifest: { catalogVersion: "test" },
  entries: [{ id: "fighter" }],
});

console.log("Character Builder optional catalog-provider tests passed.");
