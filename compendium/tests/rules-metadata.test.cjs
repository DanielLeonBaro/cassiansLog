// Verifies deterministic Compendium provenance, dependencies, coverage, and safe certification.
const assert = require("node:assert/strict");
const {
  buildRulesArtifacts,
  publisherFor,
  rulesetFor,
} = require("../scripts/rules-metadata.cjs");

const entries = [
  {
    id: "phbClassFighter",
    originalId: "ID_PHB_CLASS_FIGHTER",
    name: "Fighter",
    type: "Class",
    category: "classes",
    publication: "Player's Handbook",
    inputPath: "core\\players-handbook\\class-fighter.xml",
    prerequisite: "ID_SHARED_PROFICIENCY",
    requirements: "",
    supports: "",
    setters: {},
    rules: {
      grants: [
        { id: "ID_SHARED_PROFICIENCY", level: "1" },
        { id: "ID_MISSING_FEATURE", requirements: "!ID_OTHER_MISSING" },
      ],
      selections: [{ supports: "ID_SHARED_PROFICIENCY|Skill" }],
      stats: [{ name: "strength", value: "1" }],
    },
    related: [],
  },
  {
    id: "aleProficiencyShared",
    originalId: "ID_SHARED_PROFICIENCY",
    name: "Shared proficiency",
    type: "Proficiency",
    category: "proficiencies",
    publication: "Aurora Legacy Essentials",
    inputPath: "AuroraLegacy\\core\\ALE.xml",
    setters: {},
    rules: null,
    related: [],
  },
  {
    id: "phb24ClassWizard",
    originalId: "ID_WOTC_PHB24_CLASS_WIZARD",
    name: "Wizard",
    type: "Class",
    category: "classes",
    publication: "Player's Handbook (2024)",
    inputPath: "AuroraLegacy\\core\\players-handbook-2024\\class-wizard.xml",
    setters: {},
    rules: null,
    related: [],
  },
  {
    id: "kpSpellExample",
    originalId: "ID_KBP_SPELL_EXAMPLE",
    name: "Example",
    type: "Spell",
    category: "spells",
    publication: "Example Book",
    inputPath: "third-party\\kobold-press\\spells.xml",
    setters: { level: "1" },
    rules: null,
    related: [],
  },
];

assert.equal(rulesetFor(entries[0]), "5e");
assert.equal(rulesetFor(entries[1]), "agnostic");
assert.equal(rulesetFor(entries[2]), "5.5e");
assert.equal(publisherFor(entries[0]), "Wizards of the Coast");
assert.equal(publisherFor(entries[1]), "Aurora Legacy");
assert.equal(publisherFor(entries[3]), "Kobold Press");

const artifacts = buildRulesArtifacts(structuredClone(entries));
const fighter = artifacts.rulesMetadata.entries.phbClassFighter;
assert.equal(fighter.ruleset, "5e");
assert.equal(fighter.publisher, "Wizards of the Coast");
assert.equal(fighter.source, "Player's Handbook");
assert.deepEqual(fighter.dependencies, [
  { originalId: "ID_MISSING_FEATURE", resolvedId: "", status: "missing" },
  { originalId: "ID_OTHER_MISSING", resolvedId: "", status: "missing" },
  { originalId: "ID_SHARED_PROFICIENCY", resolvedId: "aleProficiencyShared", status: "resolved" },
]);
assert.equal(fighter.automation.status, "partial");
assert.ok(fighter.automation.reasons.includes("uncertified"));
assert.ok(fighter.automation.reasons.includes("unresolved-dependencies"));
assert.ok(fighter.automation.reasons.includes("unsupported-expressions"));
assert.equal(artifacts.rulesMetadata.entries.phb24ClassWizard.ruleset, "5.5e");
assert.equal(artifacts.rulesMetadata.entries.kpSpellExample.automation.status, "manual");
assert.equal(artifacts.originalIds.entries.ID_PHB_CLASS_FIGHTER, "phbClassFighter");
assert.equal(artifacts.coverage.totals.entries, entries.length);
assert.equal(
  artifacts.coverage.totals["rules-ready"]
    + artifacts.coverage.totals.partial
    + artifacts.coverage.totals.manual,
  entries.length,
);
assert.ok(artifacts.coverage.unsupportedExpressions.some((entry) => entry.type === "grant"));

const supported = new Set(["grant", "level", "prerequisite"]);
const readyEntries = [
  {
    ...entries[0],
    rules: { grants: [{ id: "ID_SHARED_PROFICIENCY", level: "1" }], selections: [], stats: [] },
  },
  entries[1],
];
const certified = buildRulesArtifacts(structuredClone(readyEntries), {
  certifiedOriginalIds: new Set(["ID_PHB_CLASS_FIGHTER"]),
  supportedExpressions: supported,
});
assert.equal(certified.rulesMetadata.entries.phbClassFighter.automation.status, "rules-ready");
assert.deepEqual(certified.rulesMetadata.entries.phbClassFighter.automation.reasons, []);

const reversed = buildRulesArtifacts(structuredClone([...entries].reverse()));
assert.equal(reversed.catalogVersion, artifacts.catalogVersion);
assert.deepEqual(reversed.rulesMetadata, artifacts.rulesMetadata);
assert.deepEqual(reversed.originalIds, artifacts.originalIds);
assert.deepEqual(reversed.coverage, artifacts.coverage);

assert.throws(
  () => buildRulesArtifacts([entries[0], { ...entries[1], originalId: entries[0].originalId }]),
  /Ambiguous Compendium original ID/,
);
assert.throws(
  () => buildRulesArtifacts([entries[0], { ...entries[1], id: entries[0].id }]),
  /Duplicate Compendium stable ID/,
);

console.log("Compendium rule metadata and coverage tests passed.");
