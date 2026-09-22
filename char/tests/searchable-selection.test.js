// Verifies reusable searchable selection filtering, metadata, limits, and removals.
import assert from "node:assert/strict";
import { searchableSelectionEntry, searchableSelectionState, updateSearchableSelection } from "../js/builder/searchable-selection.js";

const entries = [
  { id: "light", name: "Light", summary: "Creates light.", ruleset: "5e", publication: "Player's Handbook", automation: { status: "rules-ready" }, minimumLevel: 1 },
  { id: "bolt", name: "Fire Bolt", description: "Ranged spell attack.", ruleset: "5.5e", source: "Free Rules 2024", automationStatus: "partial", prerequisite: "Wizard", unavailableReason: "Requires spellcasting" },
  { id: "shield", name: "Shield", summary: "Defensive spell.", publication: "Player's Handbook" },
];

assert.deepEqual(searchableSelectionEntry(entries[1]), {
  ...entries[1], summary: "Ranged spell attack.", publication: "Free Rules 2024", automation: "partial",
  minimumLevel: 0, levelLabel: "", prerequisite: "Wizard", unavailableReason: "Requires spellcasting",
});
const state = searchableSelectionState({ entries, selectedIds: ["light"], query: "2024 partial" });
assert.deepEqual(state.selected.map(({ id }) => id), ["light"]);
assert.deepEqual(state.results.map(({ id }) => id), ["bolt"]);
assert.deepEqual(updateSearchableSelection(["light"], "light", { entries }), ["light"]);
assert.deepEqual(updateSearchableSelection(["light"], "bolt", { entries }), ["light"]);
assert.deepEqual(updateSearchableSelection(["light"], "shield", { entries, maxSelected: 1 }), ["light"]);
assert.deepEqual(updateSearchableSelection(["light"], "shield", { entries, multiple: false }), ["shield"]);
assert.deepEqual(updateSearchableSelection(["light"], "light", { entries, remove: true }), []);

console.log("Searchable builder selection model tests passed.");
