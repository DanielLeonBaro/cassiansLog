// Verifies schema-v2 normalization and exact legacy manual projection.
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  CHARACTER_BUILD_VERSION,
  CHARACTER_RULESETS,
  CHARACTER_SCHEMA_VERSION,
  normalizeCharacterDocument,
  projectManualCharacterSheet,
} from "../js/model.js";

const fixture = (name) => JSON.parse(fs.readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8"));

assert.equal(CHARACTER_SCHEMA_VERSION, 2);
assert.equal(CHARACTER_BUILD_VERSION, 1);
assert.deepEqual(CHARACTER_RULESETS, ["5e", "5.5e"]);

const legacy = fixture("legacy-character-v1.json");
const legacySnapshot = structuredClone(legacy);
const normalizedLegacy = normalizeCharacterDocument(legacy);
assert.deepEqual(legacy, legacySnapshot, "Normalization must not mutate a legacy document.");
assert.equal(normalizedLegacy.characterSchemaVersion, 2);
assert.equal(normalizedLegacy.build.version, 1);
assert.equal(normalizedLegacy.build.mode, "manual");
assert.equal(normalizedLegacy.build.status, "complete");
assert.equal(normalizedLegacy.build.ruleset, "5e");
assert.equal(normalizedLegacy.build.preferences.hitPoints, "manual");
assert.deepEqual(normalizedLegacy.build.levels, [], "Legacy names must not be guessed into Compendium IDs.");
assert.deepEqual(
  projectManualCharacterSheet(normalizedLegacy),
  legacy,
  "Manual projection must preserve every legacy total and unknown field exactly.",
);
assert.deepEqual(
  normalizeCharacterDocument(normalizedLegacy),
  normalizedLegacy,
  "Normalization must be idempotent.",
);

const manual = fixture("manual-character-v2.json");
const normalizedManual = normalizeCharacterDocument(manual);
assert.equal(normalizedManual.build.ruleset, "5.5e");
assert.deepEqual(normalizedManual.build.preferences.enabledSources, ["phb-2024", "homebrew"]);
assert.equal(normalizedManual.build.preferences.customPreference, true);
assert.equal(normalizedManual.build.levels[0].classId, "fighter-2024");
assert.equal(normalizedManual.build.levels[0].subclassId, "champion-2024");
assert.deepEqual(normalizedManual.build.levels[0].hitPointRolls, [8, 7]);
assert.equal(normalizedManual.build.levels[0].customLevelField, "preserve me");
assert.equal(normalizedManual.build.abilityScores.base.str, 17);
assert.equal(normalizedManual.build.abilityScores.base.customAbility, 3);
assert.deepEqual(normalizedManual.build.spells.knownIds, ["spell-a", "spell-b"]);
assert.equal(normalizedManual.build.inventory[0].instanceId, "armor-one");
assert.equal(normalizedManual.build.inventory[0].customItemField, true);
assert.equal(normalizedManual.build.overrides.ac.reason, "House rule");
assert.equal(normalizedManual.build.overrides.ac.customOverrideField, true);
assert.deepEqual(normalizedManual.build.customBuildField, { kept: true });
assert.equal(normalizedManual.customTopLevel, "preserve me");
assert.deepEqual(normalizeCharacterDocument(normalizedManual), normalizedManual);

const malformed = normalizeCharacterDocument({
  id: "malformed",
  build: {
    version: 99,
    mode: "unknown",
    status: "unknown",
    ruleset: "future",
    preferences: [],
    levels: [null, { level: 500, hitPointRolls: ["", "nope", 6] }],
    abilityScores: { method: "unknown", base: { str: "nope", dex: "14" } },
    spells: {
      knownIds: [null, " magic-missile "],
      assignments: {
        " magic-missile ": { profileId: " wizard ", repertoire: " spellbook ", custom: true },
        invalid: null,
      },
    },
    inventory: [null, { quantity: -4 }],
    overrides: { "": { value: 1 }, ac: null },
  },
}, { defaultRuleset: "5.5e" });
assert.equal(malformed.build.version, 1);
assert.equal(malformed.build.mode, "manual");
assert.equal(malformed.build.status, "complete");
assert.equal(malformed.build.ruleset, "5.5e");
assert.equal(malformed.build.levels.length, 1);
assert.equal(malformed.build.levels[0].level, 20);
assert.deepEqual(malformed.build.levels[0].hitPointRolls, [6]);
assert.deepEqual(malformed.build.abilityScores.base, { dex: 14 });
assert.deepEqual(malformed.build.spells.knownIds, ["magic-missile"]);
assert.deepEqual(malformed.build.spells.assignments, {
  "magic-missile": { profileId: "wizard", repertoire: "spellbook", custom: true },
});
assert.equal(malformed.build.inventory[0].quantity, 0);
assert.deepEqual(malformed.build.overrides, {});
assert.deepEqual(normalizeCharacterDocument(null), normalizeCharacterDocument([]));

const rulesCharacter = normalizeCharacterDocument({ build: { mode: "rules", ruleset: "5e" } });
assert.equal(rulesCharacter.build.status, "incomplete");
assert.equal(rulesCharacter.build.preferences.hitPoints, "fixed");
assert.throws(
  () => projectManualCharacterSheet(rulesCharacter),
  /requires build\.mode to be manual/,
  "Rules-mode documents must not expose stale flat totals as a manual projection.",
);

console.log("Character schema-v2 normalization and manual projection tests passed.");
