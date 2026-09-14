// Reads stable-ID history and writes additive Compendium rule metadata artifacts.
const fs = require("node:fs");
const path = require("node:path");
const { writeJSON } = require("../../shared/build/output.cjs");
const { buildRulesArtifacts } = require("./rules-metadata.cjs");

const RULES_METADATA_FILE = "rules-metadata.json";
const ORIGINAL_IDS_FILE = "original-ids.json";
const COVERAGE_FILE = "coverage.json";

function readJSON(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function loadStableIdMap(outputRoot) {
  const lookupPath = path.join(outputRoot, ORIGINAL_IDS_FILE);
  if (fs.existsSync(lookupPath)) {
    return new Map(Object.entries(readJSON(lookupPath).entries || {}));
  }
  const indexPath = path.join(outputRoot, "index.json");
  if (!fs.existsSync(indexPath)) return new Map();
  const entries = readJSON(indexPath).entries || [];
  return new Map(entries
    .filter((entry) => entry.originalId && entry.id)
    .map((entry) => [entry.originalId, entry.id]));
}

function writeRulesArtifacts(outputRoot, entries, generatedAt) {
  const artifacts = buildRulesArtifacts(entries);
  writeJSON(path.join(outputRoot, RULES_METADATA_FILE), {
    ...artifacts.rulesMetadata,
    generatedAt,
  });
  writeJSON(path.join(outputRoot, ORIGINAL_IDS_FILE), {
    ...artifacts.originalIds,
    generatedAt,
  });
  writeJSON(path.join(outputRoot, COVERAGE_FILE), {
    ...artifacts.coverage,
    generatedAt,
  });
  return {
    catalogVersion: artifacts.catalogVersion,
    rulesMetadataFile: RULES_METADATA_FILE,
    originalIdLookupFile: ORIGINAL_IDS_FILE,
    coverageFile: COVERAGE_FILE,
  };
}

module.exports = {
  COVERAGE_FILE,
  ORIGINAL_IDS_FILE,
  RULES_METADATA_FILE,
  loadStableIdMap,
  writeRulesArtifacts,
};
