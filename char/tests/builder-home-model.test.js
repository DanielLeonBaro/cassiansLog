// Verifies Home preferences, faceted Compendium filters, and confirmed ruleset cleanup previews.
import assert from "node:assert/strict";
import { createCharacterBuildDraft } from "../js/builder/model.js";
import {
  applyBuilderHomePreferences,
  builderCatalogFilterState,
  filterBuilderCatalogEntries,
  previewCharacterRulesetChange,
} from "../js/builder/home-model.js";

function entry(id, ruleset, publisher, publication, automation = "rules-ready", name = id) {
  return {
    id,
    originalId: `ID_${id.toUpperCase().replaceAll("-", "_")}`,
    name,
    ruleset,
    publisher,
    publication,
    source: publication,
    automation: { status: automation },
  };
}

const catalog = [
  entry("class-2014", "5e", "Wizards", "Legacy Book", "rules-ready", "Legacy Fighter"),
  entry("subclass-2014", "5e", "Wizards", "Legacy Book", "rules-ready", "Legacy Champion"),
  entry("species-2014", "5e", "Wizards", "Legacy Book", "rules-ready", "Legacy Human"),
  entry("background-2014", "5e", "Wizards", "Legacy Book", "partial", "Legacy Soldier"),
  entry("spell-2014", "5e", "Wizards", "Legacy Magic", "manual", "Legacy Spell"),
  entry("item-2014", "5e", "Wizards", "Legacy Gear", "rules-ready", "Legacy Sword"),
  entry("class-2024", "5.5e", "Wizards", "Modern Book", "rules-ready", "Modern Fighter"),
  entry("species-2024", "5.5e", "Wizards", "Modern Book", "partial", "Modern Human"),
  entry("third-party-2024", "5.5e", "Kobold Press", "Modern Third Party", "manual"),
  entry("shared-rule", "agnostic", "Aurora", "Shared Rules", "manual"),
];

const draft = createCharacterBuildDraft({ draftId: "home-model", now: "2026-09-14T10:00:00.000Z" });
let document = applyBuilderHomePreferences(draft.document, {
  progression: "milestone",
  hitPoints: "manual",
  encumbrance: "variant",
  coinWeight: false,
  prerequisites: false,
  publisher: "Wizards",
  automation: "rules-ready",
  enabledSources: ["Legacy Book", "Legacy Gear"],
  catalogVersion: "catalog-test",
}, catalog);
assert.equal(document.build.preferences.progression, "milestone");
assert.equal(document.build.preferences.hitPoints, "manual");
assert.equal(document.build.preferences.encumbrance, "variant");
assert.equal(document.build.preferences.coinWeight, false);
assert.equal(document.build.preferences.prerequisites, false);
assert.deepEqual(document.build.preferences.enabledSources, ["Legacy Book", "Legacy Gear"]);
assert.deepEqual(document.build.preferences.contentFilters, { publisher: "Wizards", automation: "rules-ready" });
assert.equal(document.build.catalogVersion, "catalog-test");

let state = builderCatalogFilterState(catalog, document);
assert.deepEqual(state.publishers, ["Aurora", "Wizards"]);
assert.deepEqual(state.publications, ["Legacy Book", "Legacy Gear"]);
assert.equal(state.coverageCounts["rules-ready"], 4);
assert.equal(state.coverageCounts.partial, 1);
assert.equal(state.coverageCounts.manual, 1);
assert.equal(state.filteredCount, 4);
assert.deepEqual(filterBuilderCatalogEntries(catalog, document).map(({ id }) => id), [
  "class-2014", "subclass-2014", "species-2014", "item-2014",
]);

document = applyBuilderHomePreferences(document, { publisher: "Aurora" }, catalog);
assert.equal(document.build.preferences.contentFilters.publisher, "Aurora");
assert.equal(document.build.preferences.contentFilters.automation, "", "Unavailable coverage resets to All.");
assert.deepEqual(document.build.preferences.enabledSources, [], "Hidden publication selections clear with the publisher filter.");
state = builderCatalogFilterState(catalog, document);
assert.equal(state.filteredCount, 1);

document = applyBuilderHomePreferences(document, { publisher: "Wizards", automation: "rules-ready", enabledSources: ["Legacy Book"] }, catalog);
document.build.levels = [{ classId: "class-2014", subclassId: "subclass-2014", level: 2, hitPointRolls: [7] }];
document.build.speciesId = "species-2014";
document.build.backgroundId = "background-2014";
document.build.abilityScores.base = { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 };
document.build.selections = {
  "class-2014:selection:0": ["subclass-2014"],
  "unknown-source:selection:0": ["unknown-option"],
};
document.build.spells.knownIds = ["spell-2014", "unknown-spell"];
document.build.spells.assignments = { "spell-2014": { profileId: "wizard", repertoire: "known" } };
document.build.inventory = [{ instanceId: "sword-one", definitionId: "item-2014", quantity: 1, containerId: "" }];
const snapshot = structuredClone(document);
const preview = previewCharacterRulesetChange(document, "5.5e", catalog);
assert.deepEqual(document, snapshot, "Ruleset preview must not mutate the saved draft.");
assert.equal(preview.changed, true);
assert.equal(preview.from, "5e");
assert.equal(preview.to, "5.5e");
assert.equal(preview.document.build.ruleset, "5.5e");
assert.deepEqual(preview.document.build.levels, []);
assert.equal(preview.document.build.speciesId, "");
assert.equal(preview.document.build.backgroundId, "");
assert.deepEqual(preview.document.build.selections, { "unknown-source:selection:0": ["unknown-option"] });
assert.deepEqual(preview.document.build.spells.knownIds, ["unknown-spell"]);
assert.deepEqual(preview.document.build.spells.assignments, {});
assert.deepEqual(preview.document.build.inventory, []);
assert.equal(preview.document.build.preferences.encumbrance, "standard");
assert.deepEqual(preview.document.build.preferences.enabledSources, []);
assert.deepEqual(preview.document.build.abilityScores.base, snapshot.build.abilityScores.base, "Edition-neutral base scores remain intact.");
assert.ok(preview.incompatible.some(({ kind, id }) => kind === "class" && id === "class-2014"));
assert.ok(preview.incompatible.some(({ kind, id }) => kind === "source" && id === "Legacy Book"));
assert.ok(preview.incompatible.some(({ kind }) => kind === "preference"));
assert.equal(previewCharacterRulesetChange(preview.document, "5.5e", catalog).changed, false);

console.log("Character Builder Home preference, filter, and ruleset-preview tests passed.");
