// Proves reviewed conversion is non-mutating, rules-ready-only, and exactly reversible.
import assert from "node:assert/strict";
import {
  applyCharacterAutomationPreview,
  canRollbackCharacterAutomation,
  previewCharacterAutomation,
  rollbackCharacterAutomation,
} from "../js/conversion.js";

const catalog = {
  manifest: { catalogVersion: "conversion-test-v1" },
  entries: [
    { id: "fighter-14", name: "Fighter", category: "classes", ruleset: "5e", automation: { status: "rules-ready" } },
    { id: "fighter-24", name: "Fighter", category: "classes", ruleset: "5.5e", automation: { status: "rules-ready" } },
    { id: "champion-14", name: "Champion", category: "subclasses", ruleset: "5e", automation: { status: "rules-ready" } },
    { id: "human-14", name: "Human", category: "races", ruleset: "5e", automation: { status: "rules-ready" } },
    { id: "soldier-14", name: "Soldier", category: "backgrounds", ruleset: "5e", automation: { status: "rules-ready" } },
    { id: "longsword-partial", name: "Longsword", category: "items", ruleset: "5e", automation: { status: "partial" } },
    { id: "shield-ready", name: "Shield", category: "items", ruleset: "5e", automation: { status: "rules-ready" } },
  ],
};
const source = {
  id: "legacy-fighter",
  name: "Legacy Fighter",
  class: "Fighter",
  subclass: "Champion",
  race: "Human",
  background: "Soldier",
  level: 5,
  ac: 19,
  hp: { current: 44, max: 44, temp: 0 },
  stats: { str: { score: 18, modifier: 4, save: 7, skills: [] } },
  spells: [{ id: "spell-1", name: "Magic Initiate Spell", prepared: true }],
  inventory: [{ id: "sword", name: "Longsword", quantity: 1 }, { id: "shield", name: "Shield", quantity: 1 }],
  unknownFutureField: { keep: true },
};
const before = structuredClone(source);
const preview = previewCharacterAutomation(source, catalog, { ruleset: "5e" });

assert.deepEqual(source, before, "preview must not mutate the source document");
assert.deepEqual(preview.matched.map((item) => item.definitionId), ["fighter-14", "champion-14", "human-14", "soldier-14", "shield-ready"]);
assert.ok(preview.unresolved.some((item) => item.sourceValue === "Longsword" && /not rules-ready/.test(item.reason)));
assert.ok(preview.unresolved.some((item) => item.kind === "abilities"));
assert.ok(preview.unresolved.some((item) => item.kind === "spell"));
assert.deepEqual(preview.removed, []);
assert.equal(preview.build.levels[0].classId, "fighter-14");
assert.equal(preview.build.levels[0].subclassId, "champion-14");
assert.equal(preview.build.inventory[0].definitionId, "shield-ready");
assert.equal(preview.build.catalogVersion, "conversion-test-v1");

const converted = applyCharacterAutomationPreview(preview, { convertedAt: "2026-09-15T00:00:00.000Z" });
assert.equal(converted.characterSchemaVersion, 2);
assert.equal(converted.build.mode, "rules");
assert.equal(converted.build.status, "incomplete");
assert.equal(converted.ac, source.ac, "conversion must preserve imported/manual totals");
assert.deepEqual(converted.hp, source.hp);
assert.deepEqual(converted.stats, source.stats);
assert.deepEqual(converted.unknownFutureField, source.unknownFutureField);
assert.deepEqual(converted.build.conversion.rollbackDocument, source);
assert.equal(canRollbackCharacterAutomation(converted), true);
assert.deepEqual(rollbackCharacterAutomation(converted), source, "rollback must restore the exact pre-conversion document");

const changedRollback = rollbackCharacterAutomation(converted);
changedRollback.name = "Changed clone";
assert.equal(converted.build.conversion.rollbackDocument.name, source.name, "rollback result must not share references");

const multi = previewCharacterAutomation({ ...source, class: "Fighter / Wizard" }, catalog, { ruleset: "5e" });
assert.deepEqual(multi.build.levels, []);
assert.ok(multi.unresolved.some((item) => item.kind === "class" && /cannot prove each class level/.test(item.reason)));

const wrongEdition = previewCharacterAutomation(source, catalog, { ruleset: "5.5e" });
assert.equal(wrongEdition.build.levels[0].classId, "fighter-24");
assert.equal(wrongEdition.build.speciesId, "");
assert.ok(wrongEdition.unresolved.some((item) => item.kind === "species"));

const imported = previewCharacterAutomation({ ...source, importSnapshot: { source: "dnd-beyond", method: "pdf", automation: "manual" } }, catalog);
assert.equal(imported.source, "dnd-beyond");
assert.throws(() => rollbackCharacterAutomation(source), /no conversion rollback copy/);

console.log("Character conversion preview and rollback tests passed.");
