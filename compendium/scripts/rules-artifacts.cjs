// Reads stable-ID history and writes additive Compendium rule metadata artifacts.
const fs = require("node:fs");
const path = require("node:path");
const { writeJSON } = require("../../shared/build/output.cjs");
const { buildRulesArtifacts } = require("./rules-metadata.cjs");

const RULES_METADATA_FILE = "rules-metadata.json";
const ORIGINAL_IDS_FILE = "original-ids.json";
const COVERAGE_FILE = "coverage.json";
const CHARACTER_CERTIFICATION_REPORT_FILE = "character-certification-report.json";
const { CHARACTER_CERTIFICATIONS } = require("./certifications.cjs");

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
  const originalIds = artifacts.originalIds.entries;
  const certifiedEntries = Object.entries(CHARACTER_CERTIFICATIONS).map(([originalId, certification]) => {
    const id = originalIds[originalId] || "";
    const metadata = artifacts.rulesMetadata.entries[id];
    return {
      id,
      originalId,
      ruleset: certification.certification?.ruleset || metadata?.ruleset || "unknown",
      levels: certification.certification?.levels || [],
      status: metadata?.automation?.status || "missing",
    };
  }).sort((left, right) => left.originalId.localeCompare(right.originalId));
  writeJSON(path.join(outputRoot, CHARACTER_CERTIFICATION_REPORT_FILE), {
    version: 1,
    catalogVersion: artifacts.catalogVersion,
    generatedAt,
    scope: "Fighter and Wizard levels 1-5 with Human, Sage, and Soldier in 2014 (5e) and 2024 (5.5e), using Champion and Evocation subclasses.",
    certifiedEntries,
    unresolvedRules: certifiedEntries.filter((entry) => entry.status !== "rules-ready"),
    manualBranches: [
      "Non-ASI feats remain selectable as explicit manual/partial Compendium content; no feat effect is guessed.",
      "2014 Variant Human remains an explicit manual branch; standard Human is automatic.",
      "2024 Human supports the certified Tough path; other Origin Feats remain explicit manual branches.",
      "2024 Sage applies its ability, skill, tool, and feature grants; Magic Initiate spell choices remain manual until the spell catalog is certified.",
    ],
    deferredInteractions: [
      "Tactical Mind refund confirmation belongs to the V4 Actions interaction task.",
      "Memorize Spell choice UI belongs to the V4 Spells interaction task.",
    ],
    sources: [
      "https://www.dndbeyond.com/sources/dnd/basic-rules-2014/classes",
      "https://www.dndbeyond.com/sources/dnd/basic-rules-2014/races",
      "https://www.dndbeyond.com/sources/dnd/basic-rules-2014/personality-and-background",
      "https://www.dndbeyond.com/sources/dnd/br-2024/character-classes",
      "https://www.dndbeyond.com/sources/dnd/br-2024/character-origins",
      "https://www.dndbeyond.com/sources/dnd/br-2024/creating-a-character",
    ],
  });
  return {
    catalogVersion: artifacts.catalogVersion,
    rulesMetadataFile: RULES_METADATA_FILE,
    originalIdLookupFile: ORIGINAL_IDS_FILE,
    coverageFile: COVERAGE_FILE,
    characterCertificationReportFile: CHARACTER_CERTIFICATION_REPORT_FILE,
  };
}

module.exports = {
  COVERAGE_FILE,
  CHARACTER_CERTIFICATION_REPORT_FILE,
  ORIGINAL_IDS_FILE,
  RULES_METADATA_FILE,
  loadStableIdMap,
  writeRulesArtifacts,
};
