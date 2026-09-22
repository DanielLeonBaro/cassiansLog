// Audits race/species, background, language, and origin-grant coverage.
const CATEGORIES = new Set(["races", "backgrounds", "languages"]);
const STATUSES = new Set(["rules-ready", "partial", "manual"]);

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function list(value) {
  return Array.isArray(value) ? value : [];
}

function effectiveRules(entry, metadata) {
  return metadata?.rulesOverride && typeof metadata.rulesOverride === "object"
    ? metadata.rulesOverride
    : entry?.rules && typeof entry.rules === "object" ? entry.rules : {};
}

function countBy(records, property, fallback = "Unspecified") {
  const counts = new Map();
  records.forEach((record) => {
    const value = text(record?.[property]) || fallback;
    counts.set(value, (counts.get(value) || 0) + 1);
  });
  return Object.fromEntries([...counts].sort(([left], [right]) => left.localeCompare(right)));
}

function coverageFor(rules, dependencies) {
  const grants = list(rules.grants);
  const selections = list(rules.selections);
  const stats = list(rules.stats);
  const missing = dependencies.filter(({ status }) => status !== "resolved");
  return {
    grants: { count: grants.length, types: countBy(grants, "type") },
    selections: { count: selections.length, types: countBy(selections, "type") },
    stats: { count: stats.length, names: countBy(stats, "name", "Unnamed stat") },
    declaredLevels: [...new Set([...grants, ...selections, ...stats].map(({ level }) => Number(level)).filter((level) => Number.isFinite(level) && level > 0))].sort((left, right) => left - right),
    dependencies: {
      count: dependencies.length,
      resolved: dependencies.length - missing.length,
      missing: missing.map(({ originalId }) => originalId).filter(Boolean).sort(),
    },
  };
}

function gapsFor(metadata, rules) {
  const gaps = [];
  list(metadata?.automation?.reasons).forEach((reason) => gaps.push({ code: reason, message: `Automation gap: ${String(reason).replaceAll("-", " ")}.` }));
  list(metadata?.dependencies).filter(({ status }) => status !== "resolved").forEach(({ originalId }) => gaps.push({ code: "unresolved-dependency", sourceId: originalId, message: `Compendium dependency ${originalId} is unresolved.` }));
  list(rules.warnings).forEach((warning) => gaps.push({ code: text(warning?.code) || "manual-origin-rule", message: text(warning?.message) || "This origin rule requires manual handling." }));
  return gaps;
}

function validateOriginCoverageReport(report) {
  if (report?.version !== 1 || !/^sha256-[a-f0-9]{20}$/.test(report.catalogVersion || "")) throw new TypeError("Origin coverage report needs a versioned Compendium catalog.");
  if (!Array.isArray(report.entries) || !report.entries.length) throw new TypeError("Origin coverage report has no entries.");
  report.entries.forEach((entry) => {
    if (!entry.id || !entry.originalId || !entry.source || !entry.publisher || !CATEGORIES.has(entry.category)) throw new TypeError(`Origin entry ${entry.id || "(missing)"} lacks category or provenance.`);
    if (!STATUSES.has(entry.status)) throw new TypeError(`Origin entry ${entry.id} has invalid automation status.`);
    if (entry.status !== "rules-ready" && !entry.gaps.length) throw new TypeError(`Origin entry ${entry.id} hides incomplete automation.`);
  });
  for (const ruleset of ["5e", "5.5e"]) {
    if (!report.editions?.[ruleset]?.entryIds?.length) throw new TypeError(`Origin coverage report lacks ${ruleset} entries.`);
  }
  return report;
}

function buildOriginCoverageReport({ catalogVersion, entries = [], rulesMetadata = {} }) {
  const audited = entries.filter(({ category }) => CATEGORIES.has(category)).map((entry) => {
    const metadata = rulesMetadata[entry.id] || {};
    const rules = effectiveRules(entry, metadata);
    const dependencies = list(metadata.dependencies);
    const status = STATUSES.has(metadata.automation?.status) ? metadata.automation.status : "manual";
    return {
      id: entry.id,
      originalId: text(entry.originalId),
      name: text(entry.name) || entry.id,
      type: text(entry.type),
      category: entry.category,
      ruleset: metadata.ruleset,
      source: text(metadata.source || entry.publication) || "Unknown Source",
      publisher: text(metadata.publisher) || "Unknown Publisher",
      status,
      supports: [...new Set([...list(entry.facets?.supports), ...text(entry.supports).split(",")].map(text).filter(Boolean))],
      coverage: coverageFor(rules, dependencies),
      dependencies,
      gaps: gapsFor(metadata, rules),
    };
  }).sort((left, right) => left.category.localeCompare(right.category) || left.name.localeCompare(right.name) || left.id.localeCompare(right.id));
  const categorySummary = Object.fromEntries([...CATEGORIES].map((category) => [category, {
    entries: audited.filter((entry) => entry.category === category).length,
    "rules-ready": audited.filter((entry) => entry.category === category && entry.status === "rules-ready").length,
    partial: audited.filter((entry) => entry.category === category && entry.status === "partial").length,
    manual: audited.filter((entry) => entry.category === category && entry.status === "manual").length,
  }]));
  const edition = (ruleset) => {
    const compatible = audited.filter((entry) => entry.ruleset === ruleset || entry.ruleset === "agnostic");
    return {
      entryIds: compatible.map(({ id }) => id),
      categories: Object.fromEntries([...CATEGORIES].map((category) => [category, compatible.filter((entry) => entry.category === category).length])),
      warnings: compatible.filter(({ gaps }) => gaps.length).map(({ id, gaps }) => ({ id, codes: [...new Set(gaps.map(({ code }) => code))] })),
    };
  };
  return validateOriginCoverageReport({
    version: 1,
    catalogVersion,
    scope: "Every Compendium race/species, background, and language is audited for edition, provenance, grants, choices, stats, dependencies, and explicit automation gaps.",
    entries: audited,
    editions: { "5e": edition("5e"), "5.5e": edition("5.5e") },
    summary: {
      entries: audited.length,
      categories: categorySummary,
      "rules-ready": audited.filter(({ status }) => status === "rules-ready").length,
      partial: audited.filter(({ status }) => status === "partial").length,
      manual: audited.filter(({ status }) => status === "manual").length,
      entriesWithGaps: audited.filter(({ gaps }) => gaps.length).length,
      unresolvedDependencies: audited.reduce((sum, entry) => sum + entry.coverage.dependencies.missing.length, 0),
      grantDeclarations: audited.reduce((sum, entry) => sum + entry.coverage.grants.count, 0),
      selectionDeclarations: audited.reduce((sum, entry) => sum + entry.coverage.selections.count, 0),
      statDeclarations: audited.reduce((sum, entry) => sum + entry.coverage.stats.count, 0),
    },
  });
}

module.exports = { buildOriginCoverageReport, validateOriginCoverageReport };
