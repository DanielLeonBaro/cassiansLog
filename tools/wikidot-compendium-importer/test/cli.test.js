import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { writeNormalizedRecord } from "../src/normalize.js";
import { sha256, writeAtomic } from "../src/paths.js";
import { validateOutput, validateRawOutput } from "../src/validate.js";
import { argumentsFor, crawl } from "../src/cli.js";

test("CLI dry-run validates site without network or output writes", async () => {
  const options = argumentsFor(["crawl", "--site", "5e", "--url", "https://dnd5e.wikidot.com/background:far-traveler", "--dry-run"]);
  const output = await crawl(options);
  assert.equal(output.dryRun, true);
  assert.equal(output.pages[0].site, "5e");
});

test("2024 discovery dry-run chooses the 2024 index without network", async () => {
  const options = argumentsFor(["crawl", "--site", "5.5e", "--type", "class", "--dry-run"]);
  const output = await crawl(options);
  assert.equal(output.discovery, true);
  assert.deepEqual(output.pages, [{ url: "https://dnd2024.wikidot.com/", site: "5.5e", index: true }]);
});

test("offline validation checks raw metadata and hashes", async (context) => {
  const output = await mkdtemp(path.join(os.tmpdir(), "wikidot-output-"));
  context.after(() => rm(output, { recursive: true, force: true }));
  const base = path.join(output, "raw", "dnd5e.wikidot.com", "far-traveler");
  const body = "<html>fixture</html>";
  await writeAtomic(`${base}.html`, body);
  await writeAtomic(`${base}.json`, JSON.stringify({ site: "5e", ruleset: "5e", sourcePageUrl: "https://dnd5e.wikidot.com/background:far-traveler", retrievedAt: "2026-09-22T00:00:00.000Z", rawSha256: sha256(body), licenseStatus: "unknown" }));
  assert.deepEqual(await validateRawOutput(output), { valid: true, records: 1, errors: [] });
  await writeAtomic(`${base}.html`, "changed");
  const invalid = await validateRawOutput(output);
  assert.equal(invalid.valid, false);
  assert.equal(invalid.errors[0].code, "raw-hash-mismatch");
  assert.match(await readFile(`${base}.json`, "utf8"), /rawSha256/);
});

function normalizedRecord(overrides = {}) {
  return {
    schemaVersion: 1,
    name: "Far Traveler",
    type: "background",
    ruleset: "5e",
    contentClassification: "official",
    publication: "Sword Coast Adventurer's Guide",
    sourcePageUrl: "https://dnd5e.wikidot.com/background:far-traveler",
    retrievedAt: "2026-09-22T00:00:00.000Z",
    rawSha256: "abc123",
    parserVersion: "dnd5e-1",
    licenseStatus: "private-use-only",
    automationStatus: "manual",
    content: { paragraphs: ["Traveler"] },
    warnings: [],
    ...overrides,
  };
}

test("validation writes deterministic provenance and conflict reports", async (context) => {
  const output = await mkdtemp(path.join(os.tmpdir(), "wikidot-reports-"));
  context.after(() => rm(output, { recursive: true, force: true }));
  const first = normalizedRecord();
  const second = normalizedRecord({ sourcePageUrl: "https://dnd5e.wikidot.com/background:far-traveler-copy", rawSha256: "def456", content: { paragraphs: ["Different"] } });
  const firstWrite = await writeNormalizedRecord(output, first);
  await writeNormalizedRecord(output, second);
  assert.match(firstWrite.filePath, /normalized\/5e\/sword-coast-adventurer-s-guide\/background/);

  const normal = await validateOutput(output);
  assert.equal(normal.valid, true);
  assert.equal(normal.conflictReport.conflictGroups, 1);
  assert.ok(normal.normalized.warnings.some(({ code }) => code === "record-conflict"));
  const firstValidation = await readFile(path.join(output, "reports", "validation.json"), "utf8");
  const firstConflicts = await readFile(path.join(output, "reports", "conflicts.json"), "utf8");
  await validateOutput(output);
  assert.equal(await readFile(path.join(output, "reports", "validation.json"), "utf8"), firstValidation);
  assert.equal(await readFile(path.join(output, "reports", "conflicts.json"), "utf8"), firstConflicts);

  const strict = await validateOutput(output, { strict: true, writeReports: false });
  assert.equal(strict.valid, false);
  assert.ok(strict.normalized.errors.some(({ code }) => code === "record-conflict"));
});

test("strict validation fails unknown publication and license state", async (context) => {
  const output = await mkdtemp(path.join(os.tmpdir(), "wikidot-strict-"));
  context.after(() => rm(output, { recursive: true, force: true }));
  await writeNormalizedRecord(output, normalizedRecord({ publication: "", licenseStatus: "unknown" }));
  const normal = await validateOutput(output, { writeReports: false });
  assert.equal(normal.valid, true);
  assert.deepEqual(normal.normalized.warnings.map(({ code }) => code).sort(), ["unknown-license-status", "unknown-publication"]);
  const strict = await validateOutput(output, { strict: true, writeReports: false });
  assert.equal(strict.valid, false);
  assert.ok(strict.normalized.errors.some(({ code }) => code === "unknown-publication"));
  assert.ok(strict.normalized.errors.some(({ code }) => code === "unknown-license-status"));
});
