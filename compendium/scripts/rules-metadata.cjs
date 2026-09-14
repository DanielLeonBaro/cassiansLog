// Derives deterministic ruleset, provenance, dependency, and automation metadata.
const crypto = require("node:crypto");
const {
  CERTIFIED_ORIGINAL_IDS,
  SUPPORTED_RULE_EXPRESSIONS,
} = require("./automation-coverage.cjs");
const { certificationFor, effectiveCertifiedEntry } = require("./certifications.cjs");

const RULE_METADATA_VERSION = 1;
const ORIGINAL_ID_PATTERN = /\bID_[A-Z0-9_]+\b/g;
const AUTOMATION_STATUSES = ["rules-ready", "partial", "manual"];

function normalizedPath(value) {
  return String(value || "").replaceAll("\\", "/").toLowerCase();
}

function titleCase(value) {
  return String(value || "")
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");
}

function rulesetFor(entry) {
  const marker = `${entry.originalId || ""} ${entry.publication || ""} ${entry.inputPath || ""}`;
  if (/PHB24|players-handbook-2024|\(2024\)/i.test(marker)) return "5.5e";
  if (entry.publication === "Aurora Legacy Essentials") return "agnostic";
  if (entry.originalId || entry.publication || entry.inputPath) return "5e";
  return "unknown";
}

function publisherFor(entry) {
  const inputPath = normalizedPath(entry.inputPath);
  const [root, packageName] = inputPath.split("/");
  if (entry.publication === "Aurora Legacy Essentials") return "Aurora Legacy";
  if (["core", "supplements", "unearthed-arcana", "tashas-cauldron-of-everything", "the-book-of-many-things"].includes(root)) {
    return "Wizards of the Coast";
  }
  if (root === "auroralegacy" && ["core", "supplements", "unearthed-arcana"].includes(packageName)) {
    return "Wizards of the Coast";
  }
  if (root === "third-party") return titleCase(packageName) || "Unknown";
  if (root === "dms-guild") return "Dungeon Masters Guild";
  if (root === "reddit") return "Reddit";
  if (root === "dndwiki") return "D&D Wiki";
  if (root === "homebrew") return "Homebrew";
  return "Unknown";
}

function expressionOccurrences(entry) {
  const expressions = [];
  const rules = entry.rules && typeof entry.rules === "object" ? entry.rules : {};
  const groups = [
    ["grant", rules.grants],
    ["selection", rules.selections],
    ["stat", rules.stats],
  ];
  groups.forEach(([type, records]) => {
    if (!Array.isArray(records)) return;
    records.forEach((record) => {
      expressions.push(type);
      if (record?.level !== undefined) expressions.push("level");
      if (record?.requirements) expressions.push("requirements");
      if (record?.supports) expressions.push("supports");
      if (record?.spellcasting) expressions.push("spellcasting");
      if (record?.prepared !== undefined) expressions.push("prepared");
      if (record?.known !== undefined) expressions.push("known");
    });
  });
  if (entry.prerequisite) expressions.push("prerequisite");
  if (entry.requirements) expressions.push("requirements");
  return expressions;
}

function dependencyOriginalIds(entry) {
  const references = new Set(
    (entry.related || entry.relatedIds || [])
      .map((reference) => typeof reference === "string" ? reference : reference?.originalId)
      .filter(Boolean),
  );
  const searchable = JSON.stringify({
    rules: entry.rules,
    prerequisite: entry.prerequisite,
    requirements: entry.requirements,
    supports: entry.supports,
  }) || "";
  for (const match of searchable.matchAll(ORIGINAL_ID_PATTERN)) references.add(match[0]);
  references.delete(entry.originalId);
  return [...references].sort((left, right) => left.localeCompare(right));
}

function automationFor(entry, dependencies, certifiedOriginalIds, supportedExpressions) {
  const occurrences = expressionOccurrences(entry);
  const expressions = [...new Set(occurrences)].sort();
  const unsupported = expressions.filter((expression) => !supportedExpressions.has(expression));
  const unresolved = dependencies.some((dependency) => dependency.status === "missing");
  const certified = certifiedOriginalIds.has(entry.originalId);
  const reasons = [];
  let status = "manual";

  if (certified && !unresolved && !unsupported.length) status = "rules-ready";
  else if (certified || expressions.length) status = "partial";

  if (status === "manual") reasons.push("no-automation-data");
  else if (!certified) reasons.push("uncertified");
  if (unresolved) reasons.push("unresolved-dependencies");
  if (unsupported.length) reasons.push("unsupported-expressions");

  return { status, reasons, expressions, occurrences };
}

function emptySummary() {
  return {
    entries: 0,
    "rules-ready": 0,
    partial: 0,
    manual: 0,
    resolvedDependencies: 0,
    missingDependencies: 0,
  };
}

function incrementSummary(summary, metadata) {
  summary.entries += 1;
  summary[metadata.automation.status] += 1;
  metadata.dependencies.forEach((dependency) => {
    if (dependency.status === "resolved") summary.resolvedDependencies += 1;
    else summary.missingDependencies += 1;
  });
}

function sortedObject(entries) {
  return Object.fromEntries([...entries].sort(([left], [right]) => left.localeCompare(right)));
}

function catalogVersionFor(entries, metadataById) {
  const records = [...entries]
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((entry) => ({
      id: entry.id,
      originalId: entry.originalId,
      name: entry.name,
      type: entry.type,
      category: entry.category,
      publication: entry.publication,
      setters: entry.setters,
      rules: entry.rules,
      prerequisite: entry.prerequisite,
      requirements: entry.requirements,
      metadata: metadataById.get(entry.id),
    }));
  const digest = crypto.createHash("sha256").update(JSON.stringify(records)).digest("hex").slice(0, 20);
  return `sha256-${digest}`;
}

function buildRulesArtifacts(entries, {
  certifiedOriginalIds = CERTIFIED_ORIGINAL_IDS,
  supportedExpressions = SUPPORTED_RULE_EXPRESSIONS,
} = {}) {
  const byOriginalId = new Map();
  const byId = new Map();
  entries.forEach((entry) => {
    if (!entry?.id) throw new Error("Compendium rule metadata requires every entry to have a stable ID.");
    if (byId.has(entry.id)) throw new Error(`Duplicate Compendium stable ID: ${entry.id}`);
    byId.set(entry.id, entry);
    if (!entry.originalId) return;
    if (byOriginalId.has(entry.originalId)) {
      throw new Error(`Ambiguous Compendium original ID: ${entry.originalId}`);
    }
    byOriginalId.set(entry.originalId, entry);
  });

  const metadataById = new Map();
  const occurrenceCounts = new Map();
  entries.forEach((entry) => {
    const effectiveEntry = effectiveCertifiedEntry(entry);
    const certification = certificationFor(entry);
    const dependencies = dependencyOriginalIds(effectiveEntry).map((originalId) => {
      const resolved = byOriginalId.get(originalId);
      return {
        originalId,
        resolvedId: resolved?.id || "",
        status: resolved ? "resolved" : "missing",
      };
    });
    const automation = automationFor(
      effectiveEntry,
      dependencies,
      certifiedOriginalIds,
      supportedExpressions,
    );
    automation.occurrences.forEach((expression) => {
      const current = occurrenceCounts.get(expression) || { entries: new Set(), occurrences: 0 };
      current.entries.add(entry.id);
      current.occurrences += 1;
      occurrenceCounts.set(expression, current);
    });
    const { occurrences, ...publicAutomation } = automation;
    metadataById.set(entry.id, {
      ruleset: rulesetFor(entry),
      publisher: publisherFor(entry),
      source: entry.publication || "Unknown Source",
      dependencies,
      automation: publicAutomation,
      ...(certification ? {
        certification: certification.certification || {},
        rulesOverride: certification.rules,
        requirementsOverride: certification.requirements ?? "",
        prerequisiteOverride: certification.prerequisite ?? "",
        settersOverride: certification.setters || {},
        sheetAttributesOverride: certification.sheetAttributes || {},
      } : {}),
    });
  });

  const catalogVersion = catalogVersionFor(entries, metadataById);
  const total = emptySummary();
  const categorySummaries = new Map();
  const rulesetSummaries = new Map();
  entries.forEach((entry) => {
    const metadata = metadataById.get(entry.id);
    incrementSummary(total, metadata);
    if (!categorySummaries.has(entry.category)) categorySummaries.set(entry.category, emptySummary());
    if (!rulesetSummaries.has(metadata.ruleset)) rulesetSummaries.set(metadata.ruleset, emptySummary());
    incrementSummary(categorySummaries.get(entry.category), metadata);
    incrementSummary(rulesetSummaries.get(metadata.ruleset), metadata);
  });

  const unsupportedExpressions = [...occurrenceCounts]
    .filter(([expression]) => !supportedExpressions.has(expression))
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([type, count]) => ({
      type,
      entries: count.entries.size,
      occurrences: count.occurrences,
    }));

  const metadataEntries = sortedObject([...metadataById]);
  const originalIdEntries = sortedObject(
    [...byOriginalId].map(([originalId, entry]) => [originalId, entry.id]),
  );
  return {
    catalogVersion,
    rulesMetadata: {
      version: RULE_METADATA_VERSION,
      catalogVersion,
      entries: metadataEntries,
    },
    originalIds: {
      version: RULE_METADATA_VERSION,
      catalogVersion,
      entries: originalIdEntries,
    },
    coverage: {
      version: RULE_METADATA_VERSION,
      catalogVersion,
      totals: total,
      categories: sortedObject(categorySummaries),
      rulesets: sortedObject(rulesetSummaries),
      unsupportedExpressions,
      stableIds: {
        entries: byId.size,
        originalIds: byOriginalId.size,
        missingOriginalIds: entries.length - byOriginalId.size,
        collisions: 0,
        ambiguities: 0,
      },
    },
  };
}

module.exports = {
  AUTOMATION_STATUSES,
  ORIGINAL_ID_PATTERN,
  RULE_METADATA_VERSION,
  buildRulesArtifacts,
  publisherFor,
  rulesetFor,
};
