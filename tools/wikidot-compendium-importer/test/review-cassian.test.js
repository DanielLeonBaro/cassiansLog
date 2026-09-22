import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { buildCassianImportPreview, previewCassianImport, stageCassianImport } from "../src/review-cassian.js";
import { writeAtomic } from "../src/paths.js";

function entry(id, overrides = {}) {
  return { id, originalId: `ORIGINAL_${id}`, name: id, type: "Feat", category: "feats", publication: "Test Source", ruleset: "5e", summary: id, ...overrides };
}

async function packageAt(root, entries) {
  const manifest = { schemaVersion: 1, format: "cassians-log-compendium-import", entries: entries.length, categories: [{ id: "feats", label: "Feats", file: "feats.json", count: entries.length }], publications: ["Test Source"] };
  await writeAtomic(path.join(root, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  await writeAtomic(path.join(root, "index.json"), `${JSON.stringify({ entries }, null, 2)}\n`);
  await writeAtomic(path.join(root, "feats.json"), `${JSON.stringify({ category: "feats", label: "Feats", entries }, null, 2)}\n`);
}

test("preview classifies adds, updates, duplicates, and conflicts deterministically", () => {
  const existing = [entry("same"), entry("changed", { summary: "old" }), entry("collision", { name: "Old Name" })];
  const candidates = [entry("new"), entry("same"), entry("changed", { summary: "new" }), entry("collision", { name: "New Name" })];
  const first = buildCassianImportPreview(existing, candidates);
  const second = buildCassianImportPreview(existing, candidates);
  assert.deepEqual(first.counts, { add: 1, update: 1, duplicate: 1, conflict: 1 });
  assert.equal(first.blocked, true);
  assert.equal(first.previewHash, second.previewHash);
});

test("preview deduplicates by semantic identity when legacy IDs differ", () => {
  const existing = [entry("legacy", { originalId: "", name: "Alert" })];
  const candidates = [entry("wikidot-alert", { name: "Alert" })];
  const preview = buildCassianImportPreview(existing, candidates);
  assert.equal(preview.decisions[0].matchBy, "identity");
  assert.equal(preview.decisions[0].matchId, "legacy");
  assert.equal(preview.decisions[0].status, "update");
});

test("staging requires reviewed current hash and never changes source catalog", async (context) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "wikidot-review-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  const catalogDir = path.join(root, "catalog");
  const candidateDir = path.join(root, "candidate");
  const stagingDir = path.join(root, "staged");
  await packageAt(catalogDir, [entry("same"), entry("changed", { summary: "old" })]);
  await packageAt(candidateDir, [entry("same"), entry("changed", { summary: "new" }), entry("new")]);
  const sourceBefore = await readFile(path.join(catalogDir, "index.json"), "utf8");
  const preview = await previewCassianImport({ catalogDir, candidateDir, reportFile: path.join(root, "preview.json") });
  assert.deepEqual(preview.counts, { add: 1, update: 1, duplicate: 1, conflict: 0 });
  await assert.rejects(() => stageCassianImport({ catalogDir, candidateDir, stagingDir, acceptedPreviewHash: "wrong" }), /stale|accepted/i);
  const result = await stageCassianImport({ catalogDir, candidateDir, stagingDir, acceptedPreviewHash: preview.previewHash });
  assert.equal(result.staged, true);
  assert.equal(await readFile(path.join(catalogDir, "index.json"), "utf8"), sourceBefore);
  const staged = JSON.parse(await readFile(path.join(stagingDir, "index.json"), "utf8"));
  assert.equal(staged.entries.length, 3);
  assert.equal(staged.entries.find(({ id }) => id === "changed").summary, "new");
});

test("staging blocks reviewed previews that contain conflicts", async (context) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "wikidot-conflict-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  const catalogDir = path.join(root, "catalog");
  const candidateDir = path.join(root, "candidate");
  await packageAt(catalogDir, [entry("collision", { name: "Old" })]);
  await packageAt(candidateDir, [entry("collision", { name: "New" })]);
  const preview = await previewCassianImport({ catalogDir, candidateDir });
  await assert.rejects(() => stageCassianImport({ catalogDir, candidateDir, stagingDir: path.join(root, "stage"), acceptedPreviewHash: preview.previewHash }), /blocked.*conflict/i);
});
