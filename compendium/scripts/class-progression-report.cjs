// Audits class progression without promoting incomplete Compendium rules to automation.
const AUTOMATION_STATUSES = new Set(["rules-ready", "partial", "manual"]);
const LEVELS = Object.freeze(Array.from({ length: 20 }, (_, index) => index + 1));
const FIXTURES = Object.freeze({
  barbarian: "char/tests/fixtures/barbarian-monk-levels-1-20.json",
  bard: "char/tests/fixtures/bard-sorcerer-levels-1-20.json",
  cleric: "char/tests/fixtures/cleric-paladin-levels-1-20.json",
  druid: "char/tests/fixtures/druid-ranger-levels-1-20.json",
  fighter: "char/tests/fixtures/fighter-wizard-levels-1-20.json",
  monk: "char/tests/fixtures/barbarian-monk-levels-1-20.json",
  paladin: "char/tests/fixtures/cleric-paladin-levels-1-20.json",
  ranger: "char/tests/fixtures/druid-ranger-levels-1-20.json",
  rogue: "char/tests/fixtures/rogue-levels-1-20.json",
  sorcerer: "char/tests/fixtures/bard-sorcerer-levels-1-20.json",
  warlock: "char/tests/fixtures/warlock-levels-1-20.json",
  wizard: "char/tests/fixtures/fighter-wizard-levels-1-20.json",
});

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function list(value) {
  return Array.isArray(value) ? value : [];
}

function levelOf(item) {
  const level = Math.trunc(Number(item?.level));
  return Number.isFinite(level) && level >= 1 && level <= 20 ? level : 1;
}

function nameOf(item, fallback) {
  return text(item?.name || item?.id || item?.label || item?.type) || fallback;
}

function recordsAtLevel(items, level, fallback) {
  return list(items).filter((item) => levelOf(item) === level).map((item) => nameOf(item, fallback));
}

function namedChoiceCoverage(rules, pattern) {
  const matches = list(rules.selections).filter((choice) => pattern.test([choice?.name, choice?.type, choice?.supports].map(text).join(" ")));
  return {
    count: matches.length,
    declaredLevels: [...new Set(matches.map(levelOf))].sort((left, right) => left - right),
    names: matches.map((choice) => nameOf(choice, "Unnamed choice")),
  };
}

function effectiveRules(entry, metadata) {
  return metadata?.rulesOverride && typeof metadata.rulesOverride === "object"
    ? metadata.rulesOverride
    : entry?.rules && typeof entry.rules === "object" ? entry.rules : {};
}

function coverageFor(rules, metadata) {
  const dependencies = list(metadata?.dependencies);
  const levels = LEVELS.map((level) => ({
    level,
    features: recordsAtLevel(rules.features, level, "Unnamed feature"),
    grants: recordsAtLevel(rules.grants, level, "Unnamed grant"),
    choices: recordsAtLevel(rules.selections, level, "Unnamed choice"),
    resources: recordsAtLevel(rules.resources, level, "Unnamed resource"),
    actions: recordsAtLevel(rules.actions, level, "Unnamed action"),
    warnings: list(rules.warnings).filter((warning) => levelOf(warning) === level).map((warning) => text(warning.message) || "Manual handling required."),
  }));
  const dimension = (key) => ({
    count: list(rules[key]).length,
    declaredLevels: [...new Set(list(rules[key]).map(levelOf))].sort((left, right) => left - right),
  });
  return {
    features: dimension("features"),
    grants: dimension("grants"),
    choices: dimension("selections"),
    resources: dimension("resources"),
    actions: dimension("actions"),
    weaponMasteries: namedChoiceCoverage(rules, /weapon mastery/i),
    epicBoons: namedChoiceCoverage(rules, /epic boon/i),
    dependencies: {
      count: dependencies.length,
      resolved: dependencies.filter(({ status }) => status === "resolved").length,
      missing: dependencies.filter(({ status }) => status !== "resolved").map(({ originalId }) => originalId).filter(Boolean).sort(),
    },
    levels,
  };
}

function gapsFor(entry, metadata, rules, fixture) {
  const gaps = [];
  if (!metadata?.certification || !list(metadata.certification.levels).includes(1) || !list(metadata.certification.levels).includes(20)) {
    gaps.push({ code: "uncertified-level-range", message: "Levels 1–20 do not have a reviewed certification fixture." });
  }
  list(metadata?.automation?.reasons).forEach((reason) => gaps.push({ code: reason, message: `Automation gap: ${String(reason).replaceAll("-", " ")}.` }));
  list(metadata?.dependencies).filter(({ status }) => status !== "resolved").forEach(({ originalId }) => gaps.push({ code: "unresolved-dependency", sourceId: originalId, message: `Compendium dependency ${originalId} is unresolved.` }));
  list(rules.warnings).forEach((warning) => gaps.push({ code: text(warning.code) || "manual-branch", level: levelOf(warning), message: text(warning.message) || `${entry.name || entry.id} requires manual handling.` }));
  if (!fixture) gaps.push({ code: "missing-golden-fixture", message: "No level 1–20 golden fixture is registered for this class." });
  const seen = new Set();
  return gaps.filter((gap) => {
    const key = [gap.code, gap.level, gap.sourceId, gap.message].join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function validateClassProgressionReport(report) {
  if (report?.version !== 1 || !["5e", "5.5e"].includes(report.ruleset)) throw new TypeError("Class progression report needs a supported ruleset.");
  if (!/^sha256-[a-f0-9]{20}$/.test(report.catalogVersion || "")) throw new TypeError("Class progression report needs a versioned Compendium catalog.");
  if (!Array.isArray(report.classes) || !report.classes.length) throw new TypeError("Class progression report has no classes.");
  report.classes.forEach((entry) => {
    if (!entry.id || !entry.originalId || !entry.source || !entry.publisher) throw new TypeError(`Class progression report entry ${entry.id || "(missing)"} lacks provenance.`);
    if (!AUTOMATION_STATUSES.has(entry.status)) throw new TypeError(`Class progression report entry ${entry.id} has invalid status.`);
    if (entry.coverage?.levels?.length !== 20 || entry.coverage.levels.some((level, index) => level.level !== index + 1)) throw new TypeError(`Class progression report entry ${entry.id} lacks levels 1–20.`);
    if (entry.status !== "rules-ready" && !entry.gaps.length) throw new TypeError(`Class progression report entry ${entry.id} hides incomplete automation.`);
  });
  return report;
}

function buildClassProgressionReport({ catalogVersion, entries = [], rulesMetadata = {}, ruleset }) {
  const classes = entries.filter((entry) => entry?.category === "classes" && rulesMetadata[entry.id]?.ruleset === ruleset)
    .map((entry) => {
      const metadata = rulesMetadata[entry.id] || {};
      const rules = effectiveRules(entry, metadata);
      const fixture = FIXTURES[text(entry.name).toLowerCase()] || "";
      return {
        id: entry.id,
        originalId: text(entry.originalId),
        name: text(entry.name) || entry.id,
        source: text(metadata.source || entry.publication) || "Unknown Source",
        publisher: text(metadata.publisher) || "Unknown Publisher",
        status: AUTOMATION_STATUSES.has(metadata.automation?.status) ? metadata.automation.status : "manual",
        certification: metadata.certification || null,
        fixture: fixture || null,
        coverage: coverageFor(rules, metadata),
        gaps: gapsFor(entry, metadata, rules, fixture),
      };
    }).sort((left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id));
  const counts = Object.fromEntries([...AUTOMATION_STATUSES].map((status) => [status, classes.filter((entry) => entry.status === status).length]));
  return validateClassProgressionReport({
    version: 1,
    catalogVersion,
    ruleset,
    scope: "Every selectable class is audited across levels 1–20. Reported declarations are evidence, not inferred missing features.",
    classes,
    summary: {
      classes: classes.length,
      ...counts,
      certifiedLevelRanges: classes.filter((entry) => entry.certification?.levels?.includes(1) && entry.certification.levels.includes(20)).length,
      classesWithGaps: classes.filter((entry) => entry.gaps.length).length,
      unresolvedDependencies: classes.reduce((sum, entry) => sum + entry.coverage.dependencies.missing.length, 0),
      classesWithWeaponMasteryChoices: classes.filter((entry) => entry.coverage.weaponMasteries.count).length,
      classesWithEpicBoonChoices: classes.filter((entry) => entry.coverage.epicBoons.count).length,
    },
  });
}

module.exports = { buildClassProgressionReport, validateClassProgressionReport };
