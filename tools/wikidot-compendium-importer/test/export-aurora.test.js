import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { auroraDocument, auroraId, exportAurora, validateAuroraXml } from "../src/export-aurora.js";
import { writeNormalizedRecord } from "../src/normalize.js";

function record(overrides = {}) {
  return {
    schemaVersion: 1, name: "Fireball & Flame", type: "spell", ruleset: "5.5e", contentClassification: "official", publication: "Player's Handbook",
    sourcePageUrl: "https://dnd2024.wikidot.com/spell:fireball", retrievedAt: "2026-09-22T00:00:00.000Z", rawSha256: "abcdef1234567890",
    parserVersion: "dnd2024-1", licenseStatus: "private-use-only", automationStatus: "manual",
    content: { paragraphs: ["Fire < blooms & fades."], level: 3, school: "Evocation", castingTime: "Action", range: "150 feet", components: "V, S, M (sulfur)", duration: "Instantaneous", spellLists: ["Wizard"], prerequisite: "" }, warnings: [],
    ...overrides,
  };
}

test("Aurora document validates, escapes text, and preserves provenance", () => {
  const value = { ...record(), id: "wikidot-5.5e-spell-fireball-a1b2c3d4e5f6" };
  const document = auroraDocument([value]);
  assert.deepEqual(validateAuroraXml(document), { valid: true, elements: 1, errors: [] });
  assert.match(document, /Fireball &amp; Flame/);
  assert.match(document, /Fire &lt; blooms &amp; fades/);
  assert.match(document, /<set name="license-status">private-use-only<\/set>/);
  assert.match(document, /<set name="hasMaterialComponent">true<\/set>/);
  assert.equal(auroraId(value), auroraId({ ...value, rawSha256: "changed", content: {} }), "ID is source-record stable, not content-hash based");
});

test("Aurora export groups by ruleset/publication and rebuilds deterministically", async (context) => {
  const outputDir = await mkdtemp(path.join(os.tmpdir(), "wikidot-aurora-"));
  context.after(() => rm(outputDir, { recursive: true, force: true }));
  await writeNormalizedRecord(outputDir, record());
  const result = await exportAurora({ outputDir });
  assert.equal(result.records, 1);
  const target = path.join(outputDir, "exports", "aurora", "5-5e", "player-s-handbook.xml");
  const first = await readFile(target, "utf8");
  assert.equal(validateAuroraXml(first).valid, true);
  await exportAurora({ outputDir });
  assert.equal(await readFile(target, "utf8"), first);
  const manifest = JSON.parse(await readFile(path.join(outputDir, "exports", "aurora", "manifest.json"), "utf8"));
  assert.equal(manifest.redistributionAllowed, false);
});

test("Aurora export blocks unknown license status", async (context) => {
  const outputDir = await mkdtemp(path.join(os.tmpdir(), "wikidot-aurora-strict-"));
  context.after(() => rm(outputDir, { recursive: true, force: true }));
  await writeNormalizedRecord(outputDir, record({ licenseStatus: "unknown" }));
  await assert.rejects(() => exportAurora({ outputDir }), /strict validation.*unknown-license-status/i);
});
