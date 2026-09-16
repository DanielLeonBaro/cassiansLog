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
const CORE_CLASS_CERTIFICATIONS = [
  ["Barbarian", "ID_WOTC_PHB_CLASS_BARBARIAN", "ID_WOTC_PHB24_CLASS_BARBARIAN"],
  ["Bard", "ID_WOTC_PHB_CLASS_BARD", "ID_WOTC_PHB24_CLASS_BARD"],
  ["Cleric", "ID_WOTC_PHB_CLASS_CLERIC", "ID_WOTC_PHB24_CLASS_CLERIC"],
  ["Druid", "ID_WOTC_PHB_CLASS_DRUID", "ID_WOTC_PHB24_CLASS_DRUID"],
  ["Fighter", "ID_WOTC_PHB_CLASS_FIGHTER", "ID_WOTC_PHB24_CLASS_FIGHTER"],
  ["Monk", "ID_WOTC_PHB_CLASS_MONK", "ID_WOTC_PHB24_CLASS_MONK"],
  ["Paladin", "ID_WOTC_PHB_CLASS_PALADIN", "ID_WOTC_PHB24_CLASS_PALADIN"],
  ["Ranger", "ID_WOTC_PHB_CLASS_RANGER", "ID_WOTC_PHB24_CLASS_RANGER"],
  ["Rogue", "ID_WOTC_PHB_CLASS_ROGUE", "ID_WOTC_PHB24_CLASS_ROGUE"],
  ["Sorcerer", "ID_WOTC_PHB_CLASS_SORCERER", "ID_WOTC_PHB24_CLASS_SORCERER"],
  ["Warlock", "ID_WOTC_PHB_CLASS_WARLOCK", "ID_WOTC_PHB24_CLASS_WARLOCK"],
  ["Wizard", "ID_WOTC_PHB_CLASS_WIZARD", "ID_WOTC_PHB24_CLASS_WIZARD"],
];

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
  const certificationByOriginalId = new Map(certifiedEntries.map((entry) => [entry.originalId, entry]));
  const coreClasses = CORE_CLASS_CERTIFICATIONS.map(([name, legacyId, revisedId]) => ({
    name,
    editions: {
      "5e": certificationByOriginalId.get(legacyId) || { originalId: legacyId, status: "missing" },
      "5.5e": certificationByOriginalId.get(revisedId) || { originalId: revisedId, status: "missing" },
    },
  }));
  const allCoreClassesCertified = coreClasses.every(({ editions }) =>
    Object.values(editions).every(({ status }) => status === "rules-ready"));
  writeJSON(path.join(outputRoot, CHARACTER_CERTIFICATION_REPORT_FILE), {
    version: 2,
    catalogVersion: artifacts.catalogVersion,
    generatedAt,
    scope: "All twelve core classes at levels 1-20 with Human, Sage, and Soldier in 2014 (5e) and 2024 (5.5e), using one representative subclass per class: Champion, Evocation, Life Domain, Oath of Devotion, Circle of the Land, Hunter, College of Lore, Draconic, Fiend, Berserker, Open Hand, and Thief.",
    allCoreClassesCertified,
    coreClasses,
    certifiedEntries,
    unresolvedRules: certifiedEntries.filter((entry) => entry.status !== "rules-ready"),
    manualBranches: [
      "Non-ASI feats remain selectable as explicit manual/partial Compendium content; no feat effect is guessed.",
      "2014 Variant Human remains an explicit manual branch; standard Human is automatic.",
      "2024 Human supports the certified Tough path; other Origin Feats remain explicit manual branches.",
      "2024 Sage applies its ability, skill, tool, and feature grants; Magic Initiate spell choices remain manual until the spell catalog is certified.",
      "Life Domain and Oath of Devotion always-prepared spell lists remain explicit manual branches until their spell entries are certified.",
      "Circle of the Land spells and Ranger Favored Enemy spell grants remain explicit manual branches until their spell entries are certified.",
      "Bard Magical Secrets, College of Lore cross-list choices, and Draconic granted spells remain explicit manual branches until cross-list spell validation is certified.",
      "Sorcery Point spell-slot conversion, individual Metamagic costs, and Sorcerous Restoration's once-per-Long-Rest recovery remain explicit manual resource adjustments.",
      "Warlock invocation effects, patron spell grants, Mystic Arcanum, and pact-slot recovery features remain explicit manual branches until their individual spell, target, and event effects are certified.",
      "Barbarian Rage state effects, capped capstone abilities, conditional Berserker effects, Monk weapon eligibility, multi-point Focus features, and target effects remain explicit manual branches.",
      "Rogue Sneak Attack eligibility, Reliable Talent roll floors, Cunning Strike target effects, and Thief magic-item and initiative exceptions remain explicit manual branches.",
    ],
    deferredInteractions: [
      "Target selection, target damage, and spell-effect resolution remain outside the tracker scope.",
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
