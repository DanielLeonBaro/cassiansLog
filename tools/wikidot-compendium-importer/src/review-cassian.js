import { readFile } from "node:fs/promises";
import path from "node:path";
import { safeSegment, sha256, writeAtomic } from "./paths.js";

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

function identity(entry) {
  return [entry.category, entry.type, safeSegment(entry.name), safeSegment(entry.publication)].join(":");
}

async function json(file) {
  return JSON.parse(await readFile(file, "utf8"));
}

export async function loadCassianPackage(directory) {
  const manifest = await json(path.join(directory, "manifest.json"));
  const index = await json(path.join(directory, "index.json"));
  const categories = {};
  for (const definition of manifest.categories || []) categories[definition.id] = await json(path.join(directory, definition.file));
  return { manifest, index, categories };
}

function indexes(entries) {
  const maps = { id: new Map(), originalId: new Map(), identity: new Map() };
  for (const entry of entries) {
    for (const [kind, value] of [["id", entry.id], ["originalId", entry.originalId], ["identity", identity(entry)]]) {
      if (!value) continue;
      if (!maps[kind].has(value)) maps[kind].set(value, []);
      maps[kind].get(value).push(entry);
    }
  }
  return maps;
}

function decision(candidate, maps) {
  const matches = [
    ["id", maps.id.get(candidate.id) || []],
    ["originalId", maps.originalId.get(candidate.originalId) || []],
    ["identity", maps.identity.get(identity(candidate)) || []],
  ].find(([, values]) => values.length) || ["none", []];
  const [matchBy, values] = matches;
  const base = { candidateId: candidate.id, originalId: candidate.originalId, name: candidate.name, category: candidate.category, publication: candidate.publication, ruleset: candidate.ruleset };
  if (!values.length) return { ...base, status: "add", matchBy: "none", matchId: "", reasons: [] };
  if (values.length > 1) return { ...base, status: "conflict", matchBy, matchId: "", reasons: ["multiple-existing-matches"], existingIds: values.map(({ id }) => id).sort() };
  const existing = values[0];
  if ((matchBy === "id" || matchBy === "originalId") && identity(existing) !== identity(candidate)) {
    return { ...base, status: "conflict", matchBy, matchId: existing.id, reasons: ["stable-id-identity-mismatch"] };
  }
  if (stable(existing) === stable(candidate)) return { ...base, status: "duplicate", matchBy, matchId: existing.id, reasons: [] };
  return { ...base, status: "update", matchBy, matchId: existing.id, reasons: ["matched-entry-content-changed"] };
}

export function buildCassianImportPreview(existingEntries, candidateEntries) {
  const maps = indexes(existingEntries);
  const decisions = candidateEntries.map((candidate) => decision(candidate, maps))
    .sort((left, right) => left.status.localeCompare(right.status) || left.category.localeCompare(right.category) || left.name.localeCompare(right.name) || left.candidateId.localeCompare(right.candidateId));
  const counts = Object.fromEntries(["add", "update", "duplicate", "conflict"].map((status) => [status, decisions.filter((item) => item.status === status).length]));
  const body = { schemaVersion: 1, format: "cassians-log-import-preview", existingEntries: existingEntries.length, candidateEntries: candidateEntries.length, counts, blocked: counts.conflict > 0, decisions };
  return { ...body, previewHash: sha256(stable(body)) };
}

export async function previewCassianImport({ catalogDir, candidateDir, reportFile }) {
  const [existing, candidate] = await Promise.all([loadCassianPackage(catalogDir), loadCassianPackage(candidateDir)]);
  const report = buildCassianImportPreview(existing.index.entries || [], candidate.index.entries || []);
  if (reportFile) await writeAtomic(reportFile, `${JSON.stringify(report, null, 2)}\n`);
  return report;
}

function candidateDetails(candidatePackage) {
  return new Map(Object.values(candidatePackage.categories).flatMap(({ entries = [] }) => entries).map((entry) => [entry.id, entry]));
}

export async function stageCassianImport({ catalogDir, candidateDir, stagingDir, acceptedPreviewHash }) {
  if (!acceptedPreviewHash) throw new Error("Staging requires --accept-preview with the reviewed preview hash.");
  const [existing, candidate] = await Promise.all([loadCassianPackage(catalogDir), loadCassianPackage(candidateDir)]);
  const preview = buildCassianImportPreview(existing.index.entries || [], candidate.index.entries || []);
  if (preview.previewHash !== acceptedPreviewHash) throw new Error("Preview hash is stale or was not accepted.");
  if (preview.blocked) throw new Error("Import staging is blocked by unresolved conflicts.");
  const candidateIndex = new Map((candidate.index.entries || []).map((entry) => [entry.id, entry]));
  const details = candidateDetails(candidate);
  const decisions = new Map(preview.decisions.map((item) => [item.candidateId, item]));
  const indexEntries = [...(existing.index.entries || [])];
  const categories = structuredClone(existing.categories);
  for (const [candidateId, item] of decisions) {
    if (item.status === "duplicate") continue;
    const indexEntry = candidateIndex.get(candidateId);
    const detail = details.get(candidateId);
    categories[indexEntry.category] ||= { category: indexEntry.category, label: candidate.categories[indexEntry.category]?.label || indexEntry.category, entries: [] };
    if (item.status === "update") {
      const indexPosition = indexEntries.findIndex(({ id }) => id === item.matchId);
      indexEntries[indexPosition] = indexEntry;
      for (const document of Object.values(categories)) {
        const detailPosition = (document.entries || []).findIndex(({ id }) => id === item.matchId);
        if (detailPosition >= 0) document.entries.splice(detailPosition, 1);
      }
      categories[indexEntry.category].entries.push(detail);
    } else if (item.status === "add") {
      indexEntries.push(indexEntry);
      categories[indexEntry.category].entries.push(detail);
    }
  }
  indexEntries.sort((left, right) => left.category.localeCompare(right.category) || left.name.localeCompare(right.name) || left.id.localeCompare(right.id));
  for (const document of Object.values(categories)) document.entries.sort((left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id));
  const categoryDefinitions = Object.entries(categories).sort(([left], [right]) => left.localeCompare(right)).map(([id, document]) => ({ id, label: document.label || id, file: `${id}.json`, count: document.entries.length }));
  const manifest = {
    ...existing.manifest,
    entries: indexEntries.length,
    categories: categoryDefinitions,
    publications: [...new Set(indexEntries.map(({ publication }) => publication).filter(Boolean))].sort(),
    stagedImport: { previewHash: preview.previewHash, added: preview.counts.add, updated: preview.counts.update, duplicatesSkipped: preview.counts.duplicate },
  };
  await writeAtomic(path.join(stagingDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  await writeAtomic(path.join(stagingDir, "index.json"), `${JSON.stringify({ ...existing.index, entries: indexEntries }, null, 2)}\n`);
  for (const [id, document] of Object.entries(categories).sort(([left], [right]) => left.localeCompare(right))) await writeAtomic(path.join(stagingDir, `${id}.json`), `${JSON.stringify(document, null, 2)}\n`);
  return { staged: true, stagingDir, previewHash: preview.previewHash, counts: preview.counts, files: ["manifest.json", "index.json", ...categoryDefinitions.map(({ file }) => file)] };
}
