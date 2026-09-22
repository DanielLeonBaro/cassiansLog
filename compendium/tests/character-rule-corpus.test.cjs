// Verifies complete two-edition Character rule-domain evidence mapping.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  buildCharacterRuleCorpus,
  validateCharacterRuleCorpus,
} = require("../scripts/character-rule-corpus.cjs");

const catalogVersion = "sha256-1234567890abcdef1234";
const entries = [
  { id: "fighter", category: "classes" },
  { id: "fighter24", category: "classes" },
  { id: "human", category: "races" },
  { id: "human24", category: "races" },
];
const rulesMetadata = {
  fighter: { ruleset: "5e", automation: { status: "rules-ready" } },
  fighter24: { ruleset: "5.5e", automation: { status: "rules-ready" } },
  human: { ruleset: "5e", automation: { status: "rules-ready" } },
  human24: { ruleset: "5.5e", automation: { status: "rules-ready" } },
};
const corpus = buildCharacterRuleCorpus({ catalogVersion, entries, rulesMetadata });

assert.equal(corpus.version, 1);
assert.deepEqual(corpus.rulesets, ["5e", "5.5e"]);
assert.equal(corpus.coverage.domains, 11);
assert.equal(corpus.coverage.unresolvedPointers, 0);
assert.deepEqual(corpus.domains["class-progression"].editions["5e"].entryIds, ["fighter"]);
assert.deepEqual(corpus.domains.origin.editions["5.5e"].entryIds, ["human24"]);
assert.ok(corpus.domains.spellcasting.requirements.includes("Pact Magic"));
assert.ok(corpus.domains.equipment.requirements.includes("containers"));
assert.ok(corpus.domains["runtime-rests"].requirements.includes("runtime state separate from build choices"));
for (const domain of Object.values(corpus.domains)) {
  for (const ruleset of corpus.rulesets) {
    const edition = domain.editions[ruleset];
    assert.ok(["rules-ready", "partial", "manual"].includes(edition.status));
    assert.ok(edition.sourceIds.length && edition.fixtures.length);
  }
}
assert.deepEqual(
  buildCharacterRuleCorpus({ catalogVersion, entries: [...entries].reverse(), rulesMetadata }),
  corpus,
  "corpus generation must be deterministic",
);
const invalid = structuredClone(corpus);
invalid.domains.origin.editions["5e"].sourceIds = ["missing-source"];
assert.throws(() => validateCharacterRuleCorpus(invalid), /invalid 5e sources/);

const manifest = JSON.parse(fs.readFileSync("compendium/data/manifest.json", "utf8"));
assert.equal(manifest.characterRuleCorpusFile, "character-rule-corpus.json");
const generated = JSON.parse(fs.readFileSync(path.join("compendium/data", manifest.characterRuleCorpusFile), "utf8"));
assert.equal(generated.catalogVersion, manifest.catalogVersion);
assert.equal(generated.coverage.unresolvedPointers, 0);
assert.equal(generated.domains["class-progression"].editions["5e"].entryIds.includes("phbClassFighter"), true);
assert.equal(generated.domains["class-progression"].editions["5.5e"].entryIds.includes("phb24ClassFighter"), true);
Object.values(generated.domains).forEach((domain) => Object.values(domain.editions).forEach((edition) => {
  edition.fixtures.forEach((fixture) => assert.equal(fs.existsSync(fixture), true, `Missing corpus fixture ${fixture}`));
  edition.sourceIds.forEach((sourceId) => assert.ok(generated.sources[sourceId], `Missing corpus source ${sourceId}`));
  edition.dependencies.forEach((domainId) => assert.ok(generated.domains[domainId], `Missing corpus dependency ${domainId}`));
}));

console.log("Character rule corpus manifest tests passed.");
