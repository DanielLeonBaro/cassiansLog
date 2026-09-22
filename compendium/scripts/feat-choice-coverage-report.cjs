// Audits feats and class/subclass choice declarations without inventing effects.
const STATUSES = new Set(["rules-ready", "partial", "manual"]);
const CLASS_CHOICE_FEATURE_TYPES = new Set(["Class Feature", "Archetype Feature"]);
const ORIGINAL_ID_PATTERN = /\bID_[A-Z0-9_]+\b/g;

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

function statusOf(metadata) {
  return STATUSES.has(metadata?.automation?.status) ? metadata.automation.status : "manual";
}

function repeatabilityFor(entry) {
  const setting = text(entry?.setters?.["allow duplicate"] || entry?.setters?.allowDuplicate).toLowerCase();
  if (setting === "true") return { status: "allowed", evidence: "allow duplicate setter" };
  if (setting === "false") return { status: "blocked", evidence: "allow duplicate setter" };
  if (entry.originalId && text(entry.requirements).includes(`!${entry.originalId}`)) return { status: "blocked", evidence: "self-exclusion requirement" };
  return { status: "unspecified", evidence: "No repeatability declaration; builder must not infer one." };
}

function minimumLevelFor(entry) {
  const declared = `${text(entry.prerequisite)} ${text(entry.requirements)}`;
  const matches = [
    ...[...declared.matchAll(/level\s*(\d+)\s*\+/gi)].map((match) => Number(match[1])),
    ...[...declared.matchAll(/\[character:(\d+)\]/gi)].map((match) => Number(match[1])),
  ].filter((level) => Number.isFinite(level) && level > 0);
  return matches.length ? Math.max(...matches) : 1;
}

function automationGaps(metadata) {
  const gaps = list(metadata?.automation?.reasons).map((reason) => ({ code: reason, message: `Automation gap: ${String(reason).replaceAll("-", " ")}.` }));
  list(metadata?.dependencies).filter(({ status }) => status !== "resolved").forEach(({ originalId }) => gaps.push({ code: "unresolved-dependency", sourceId: originalId, message: `Compendium dependency ${originalId} is unresolved.` }));
  return gaps;
}

function featRecord(entry, metadata) {
  const rules = effectiveRules(entry, metadata);
  const grants = list(rules.grants);
  const selections = list(rules.selections);
  const stats = list(rules.stats);
  const gaps = automationGaps(metadata);
  const repeatability = repeatabilityFor({ ...entry, setters: { ...(entry.setters || {}), ...(metadata.settersOverride || {}) } });
  if (!grants.length && !selections.length && !stats.length) gaps.push({ code: "no-declared-effects", message: "No machine-readable feat effect is declared." });
  if (repeatability.status === "unspecified") gaps.push({ code: "repeatability-unspecified", message: repeatability.evidence });
  return {
    id: entry.id,
    originalId: text(entry.originalId),
    name: text(entry.name) || entry.id,
    type: text(entry.type),
    ruleset: metadata.ruleset,
    source: text(metadata.source || entry.publication) || "Unknown Source",
    publisher: text(metadata.publisher) || "Unknown Publisher",
    status: statusOf(metadata),
    prerequisite: { text: text(metadata.prerequisiteOverride ?? entry.prerequisite), expression: text(metadata.requirementsOverride ?? entry.requirements), minimumLevel: minimumLevelFor({ ...entry, prerequisite: metadata.prerequisiteOverride ?? entry.prerequisite, requirements: metadata.requirementsOverride ?? entry.requirements }) },
    repeatability,
    coverage: { grants: grants.length, selections: selections.length, stats: stats.length },
    dependencies: list(metadata.dependencies),
    gaps,
  };
}

function choiceSource(entry) {
  return entry.category === "classes" || entry.category === "subclasses"
    || (entry.category === "features" && CLASS_CHOICE_FEATURE_TYPES.has(entry.type));
}

function choiceRecord(entry, choice, index, metadata, originalIds) {
  const supports = text(choice.supports);
  const referencedOriginalIds = [...new Set(supports.match(ORIGINAL_ID_PATTERN) || [])].sort();
  const missingReferences = referencedOriginalIds.filter((id) => !originalIds.has(id));
  const items = list(choice.items);
  const manualItems = items.filter((item) => {
    const rules = item?.rules || {};
    return !list(rules.grants).length && !list(rules.selections).length && !list(rules.stats).length;
  });
  const gaps = automationGaps(metadata);
  missingReferences.forEach((sourceId) => gaps.push({ code: "unresolved-option", sourceId, message: `Choice option ${sourceId} is unresolved.` }));
  if (manualItems.length) gaps.push({ code: "manual-option-effects", count: manualItems.length, message: `${manualItems.length} inline option(s) have no declared effect.` });
  if (!items.length && !supports) gaps.push({ code: "missing-options", message: "No inline or supported option catalog is declared." });
  return {
    id: `${entry.id}:selection:${index}`,
    sourceId: entry.id,
    sourceOriginalId: text(entry.originalId),
    sourceName: text(entry.name) || entry.id,
    sourceCategory: entry.category,
    sourceType: text(entry.type),
    ruleset: metadata.ruleset,
    source: text(metadata.source || entry.publication) || "Unknown Source",
    publisher: text(metadata.publisher) || "Unknown Publisher",
    status: statusOf(metadata),
    name: text(choice.name) || `Choice ${index + 1}`,
    type: text(choice.type) || "Unspecified",
    level: Math.max(1, Number(choice.level) || 1),
    count: choice.number ?? 1,
    requirements: text(choice.requirements),
    supports,
    options: { inline: items.length, manualInline: manualItems.length, referenced: referencedOriginalIds.length, missingReferences },
    gaps,
  };
}

function validateFeatChoiceCoverageReport(report) {
  if (report?.version !== 1 || !/^sha256-[a-f0-9]{20}$/.test(report.catalogVersion || "")) throw new TypeError("Feat/choice coverage report needs a versioned Compendium catalog.");
  if (!report.feats?.length || !report.choices?.length) throw new TypeError("Feat/choice coverage report lacks entries.");
  report.feats.forEach((entry) => {
    if (!entry.id || !entry.originalId || !entry.source || !entry.publisher || !STATUSES.has(entry.status)) throw new TypeError(`Feat ${entry.id || "(missing)"} lacks provenance or status.`);
    if (!entry.repeatability?.status || !(entry.prerequisite?.minimumLevel > 0)) throw new TypeError(`Feat ${entry.id} lacks repeatability or gate metadata.`);
    if (entry.status !== "rules-ready" && !entry.gaps.length) throw new TypeError(`Feat ${entry.id} hides incomplete automation.`);
  });
  report.choices.forEach((choice) => {
    if (!choice.id || !choice.sourceId || !choice.source || !choice.publisher || !STATUSES.has(choice.status) || !(choice.level > 0)) throw new TypeError(`Choice ${choice.id || "(missing)"} lacks source, status, or gate metadata.`);
  });
  return report;
}

function buildFeatChoiceCoverageReport({ catalogVersion, entries = [], rulesMetadata = {} }) {
  const originalIds = new Set(entries.map(({ originalId }) => originalId).filter(Boolean));
  const feats = entries.filter(({ category }) => category === "feats")
    .map((entry) => featRecord(entry, rulesMetadata[entry.id] || {}))
    .sort((left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id));
  const choices = entries.filter(choiceSource).flatMap((entry) => {
    const metadata = rulesMetadata[entry.id] || {};
    return list(effectiveRules(entry, metadata).selections).map((choice, index) => choiceRecord(entry, choice, index, metadata, originalIds));
  }).sort((left, right) => left.sourceName.localeCompare(right.sourceName) || left.level - right.level || left.id.localeCompare(right.id));
  return validateFeatChoiceCoverageReport({
    version: 1,
    catalogVersion,
    scope: "Every feat and class/subclass choice declaration is audited for prerequisites, repeatability, level gates, grants/options, provenance, and explicit missing effects.",
    feats,
    choices,
    summary: {
      feats: feats.length,
      choices: choices.length,
      choiceSources: new Set(choices.map(({ sourceId }) => sourceId)).size,
      featStatuses: Object.fromEntries([...STATUSES].map((status) => [status, feats.filter((entry) => entry.status === status).length])),
      choiceStatuses: Object.fromEntries([...STATUSES].map((status) => [status, choices.filter((entry) => entry.status === status).length])),
      repeatability: Object.fromEntries(["allowed", "blocked", "unspecified"].map((status) => [status, feats.filter((entry) => entry.repeatability.status === status).length])),
      featsWithPrerequisites: feats.filter((entry) => entry.prerequisite.text || entry.prerequisite.expression).length,
      featsWithGaps: feats.filter(({ gaps }) => gaps.length).length,
      choicesWithGaps: choices.filter(({ gaps }) => gaps.length).length,
      unresolvedChoiceOptions: choices.reduce((sum, choice) => sum + choice.options.missingReferences.length, 0),
      manualInlineOptions: choices.reduce((sum, choice) => sum + choice.options.manualInline, 0),
    },
  });
}

module.exports = { buildFeatChoiceCoverageReport, validateFeatChoiceCoverageReport };
