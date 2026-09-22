import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { cassianEntry, exportCassian, validateCassianPackage } from "../src/export-cassian.js";
import { writeNormalizedRecord } from "../src/normalize.js";

function record(overrides = {}) {
  return {
    schemaVersion: 1, name: "Fireball", type: "spell", ruleset: "5.5e", contentClassification: "official", publication: "Player's Handbook",
    sourcePageUrl: "https://dnd2024.wikidot.com/spell:fireball", retrievedAt: "2026-09-22T00:00:00.000Z", rawSha256: "abcdef1234567890",
    parserVersion: "dnd2024-1", licenseStatus: "private-use-only", automationStatus: "manual",
    content: { paragraphs: ["A bright streak flashes."], level: 3, school: "Evocation", castingTime: "Action", range: "150 feet", components: "V, S, M", duration: "Instantaneous", spellLists: ["Sorcerer", "Wizard"], tags: ["evocation"], prerequisite: "" }, warnings: [],
    ...overrides,
  };
}

test("Cassian entry matches category/add contract and retains provenance", () => {
  const entry = cassianEntry({ ...record(), id: "wikidot-5-5e-spell-fireball-abc" });
  assert.equal(entry.category, "spells");
  assert.equal(entry.type, "Spell");
  assert.equal(entry.add.target, "spells");
  assert.equal(entry.add.value.level, 3);
  assert.equal(entry.ruleset, "5.5e");
  assert.equal(entry.sourcePageUrl, record().sourcePageUrl);
  assert.equal(entry.automation.status, "manual");
  assert.match(entry.originalId, /^ID_WIKIDOT_5_5E_SPELL_FIREBALL_/);
});

test("Cassian export is strict, valid, and deterministic", async (context) => {
  const outputDir = await mkdtemp(path.join(os.tmpdir(), "wikidot-cassian-"));
  context.after(() => rm(outputDir, { recursive: true, force: true }));
  await writeNormalizedRecord(outputDir, record());
  await writeNormalizedRecord(outputDir, record({ name: "Human", type: "species", sourcePageUrl: "https://dnd2024.wikidot.com/species:human", rawSha256: "1234567890abcdef", content: { paragraphs: ["Humans are resourceful."], tags: ["common"] } }));
  const result = await exportCassian({ outputDir });
  assert.equal(result.valid, true);
  assert.equal(result.entries, 2);
  const root = path.join(outputDir, "exports", "cassians-log");
  const manifest = JSON.parse(await readFile(path.join(root, "manifest.json"), "utf8"));
  const index = JSON.parse(await readFile(path.join(root, "index.json"), "utf8"));
  const categories = {
    spells: JSON.parse(await readFile(path.join(root, "spells.json"), "utf8")),
    races: JSON.parse(await readFile(path.join(root, "races.json"), "utf8")),
  };
  assert.deepEqual(validateCassianPackage({ manifest, index, categories }), { valid: true, entries: 2, errors: [] });
  assert.equal(manifest.redistributionAllowed, false);
  const first = await readFile(path.join(root, "index.json"), "utf8");
  await exportCassian({ outputDir });
  assert.equal(await readFile(path.join(root, "index.json"), "utf8"), first);
});

test("Cassian export blocks unresolved license review", async (context) => {
  const outputDir = await mkdtemp(path.join(os.tmpdir(), "wikidot-cassian-strict-"));
  context.after(() => rm(outputDir, { recursive: true, force: true }));
  await writeNormalizedRecord(outputDir, record({ licenseStatus: "unknown" }));
  await assert.rejects(() => exportCassian({ outputDir }), /strict validation.*unknown-license-status/i);
});
