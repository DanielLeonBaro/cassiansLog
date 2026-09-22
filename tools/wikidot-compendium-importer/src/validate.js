import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { LICENSE_STATUSES } from "./normalize.js";
import { publicationFolder } from "./source-name.js";
import { safeSegment, sha256, writeAtomic } from "./paths.js";

async function files(root) {
  try {
    const entries = await readdir(root, { withFileTypes: true });
    return (await Promise.all(entries.map((entry) => {
      const target = path.join(root, entry.name);
      return entry.isDirectory() ? files(target) : [target];
    }))).flat();
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
}

export async function validateRawOutput(outputDir) {
  const metadataFiles = (await files(path.join(outputDir, "raw"))).filter((file) => file.endsWith(".json"));
  const errors = [];
  for (const metadataFile of metadataFiles) {
    try {
      const metadata = JSON.parse(await readFile(metadataFile, "utf8"));
      const htmlFile = metadataFile.replace(/\.json$/, ".html");
      const body = await readFile(htmlFile, "utf8");
      if (sha256(body) !== metadata.rawSha256) errors.push({ file: metadataFile, code: "raw-hash-mismatch" });
      for (const field of ["sourcePageUrl", "retrievedAt", "rawSha256", "site", "ruleset", "licenseStatus"]) if (!metadata[field]) errors.push({ file: metadataFile, code: "missing-field", field });
      if (metadata.licenseStatus && !LICENSE_STATUSES.includes(metadata.licenseStatus)) errors.push({ file: metadataFile, code: "invalid-license-status", value: metadata.licenseStatus });
    } catch (error) {
      errors.push({ file: metadataFile, code: "invalid-raw-record", message: error.message });
    }
  }
  return { valid: !errors.length, records: metadataFiles.length, errors };
}

const REQUIRED_NORMALIZED_FIELDS = [
  "schemaVersion", "id", "name", "type", "ruleset", "contentClassification", "sourcePageUrl", "retrievedAt",
  "rawSha256", "parserVersion", "licenseStatus", "automationStatus", "content", "warnings",
];

function relative(outputDir, file) {
  return path.relative(outputDir, file).split(path.sep).join("/");
}

function identity(record) {
  return [record.ruleset, record.contentClassification, record.type, safeSegment(record.name)].join(":");
}

function countBy(records, field) {
  const counts = {};
  for (const record of records) {
    const key = String(record[field] || "_unknown");
    counts[key] = (counts[key] || 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort(([left], [right]) => left.localeCompare(right)));
}

export function detectConflicts(entries) {
  const groups = new Map();
  for (const entry of entries) {
    const key = identity(entry.record);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(entry);
  }
  const conflicts = [];
  for (const [key, candidates] of groups) {
    const urls = new Set(candidates.map(({ record }) => record.sourcePageUrl));
    const publications = new Set(candidates.map(({ record }) => record.publication));
    const payloads = new Set(candidates.map(({ record }) => sha256(JSON.stringify(record.content))));
    if (candidates.length < 2 || (urls.size === 1 && publications.size === 1 && payloads.size === 1)) continue;
    const reasons = [];
    if (urls.size > 1) reasons.push("source-url-mismatch");
    if (publications.size > 1) reasons.push("publication-mismatch");
    if (payloads.size > 1) reasons.push("content-mismatch");
    conflicts.push({
      identity: key,
      reasons,
      records: candidates.map(({ file, record }) => ({ file, id: record.id, publication: record.publication, sourcePageUrl: record.sourcePageUrl, rawSha256: record.rawSha256 }))
        .sort((left, right) => left.file.localeCompare(right.file)),
    });
  }
  return conflicts.sort((left, right) => left.identity.localeCompare(right.identity));
}

export async function validateNormalizedOutput(outputDir, { strict = false } = {}) {
  const normalizedFiles = (await files(path.join(outputDir, "normalized"))).filter((file) => file.endsWith(".json")).sort();
  const errors = [];
  const warnings = [];
  const entries = [];
  for (const normalizedFile of normalizedFiles) {
    const file = relative(outputDir, normalizedFile);
    try {
      const record = JSON.parse(await readFile(normalizedFile, "utf8"));
      entries.push({ file, record });
      for (const field of REQUIRED_NORMALIZED_FIELDS) {
        if (record[field] === undefined || record[field] === null || record[field] === "") errors.push({ file, code: "missing-field", field });
      }
      if (!LICENSE_STATUSES.includes(record.licenseStatus)) errors.push({ file, code: "invalid-license-status", value: record.licenseStatus || "" });
      const parts = file.split("/");
      const expectedFolder = publicationFolder(record.publication);
      if (parts[0] !== "normalized" || parts[1] !== record.ruleset || parts[2] !== expectedFolder || parts[3] !== record.type) {
        errors.push({ file, code: "publication-path-mismatch", expected: `normalized/${record.ruleset}/${expectedFolder}/${record.type}/` });
      }
      if (!record.publication) (strict ? errors : warnings).push({ file, code: "unknown-publication" });
      if (record.licenseStatus === "unknown") (strict ? errors : warnings).push({ file, code: "unknown-license-status" });
    } catch (error) {
      errors.push({ file, code: "invalid-normalized-record", message: error.message });
    }
  }
  const conflicts = detectConflicts(entries);
  if (strict) for (const conflict of conflicts) errors.push({ code: "record-conflict", identity: conflict.identity });
  else for (const conflict of conflicts) warnings.push({ code: "record-conflict", identity: conflict.identity });
  const records = entries.map(({ record }) => record);
  return {
    valid: !errors.length,
    strict,
    records: entries.length,
    errors: errors.sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right))),
    warnings: warnings.sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right))),
    coverage: {
      rulesets: countBy(records, "ruleset"), types: countBy(records, "type"), publications: countBy(records, "publication"),
      contentClassifications: countBy(records, "contentClassification"), licenseStatuses: countBy(records, "licenseStatus"),
    },
    conflictReport: { schemaVersion: 1, conflictGroups: conflicts.length, conflicts },
  };
}

export async function validateOutput(outputDir, { strict = false, writeReports = true } = {}) {
  const raw = await validateRawOutput(outputDir);
  const normalized = await validateNormalizedOutput(outputDir, { strict });
  const report = {
    schemaVersion: 1,
    valid: raw.valid && normalized.valid,
    strict,
    raw: { valid: raw.valid, records: raw.records, errors: raw.errors.map((error) => ({ ...error, file: error.file ? relative(outputDir, error.file) : error.file })) },
    normalized: { valid: normalized.valid, records: normalized.records, errors: normalized.errors, warnings: normalized.warnings, coverage: normalized.coverage },
  };
  if (writeReports) {
    await writeAtomic(path.join(outputDir, "reports", "validation.json"), `${JSON.stringify(report, null, 2)}\n`);
    await writeAtomic(path.join(outputDir, "reports", "conflicts.json"), `${JSON.stringify(normalized.conflictReport, null, 2)}\n`);
  }
  return { ...report, conflictReport: normalized.conflictReport };
}
