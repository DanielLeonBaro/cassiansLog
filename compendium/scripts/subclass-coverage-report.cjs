// Audits every subclass and derives deterministic parent-class/gate metadata.
const AUTOMATION_STATUSES = new Set(["rules-ready", "partial", "manual"]);

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function list(value) {
  return Array.isArray(value) ? value : [];
}

function words(value) {
  return text(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/([a-z])['’]s\b/gi, "$1")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((word) => word && !/^v\d+$/.test(word))
    .map((word) => word.length > 3 && word.endsWith("s") && !/(ss|us|is)$/.test(word) ? word.slice(0, -1) : word);
}

function key(value) {
  return words(value).join(" ");
}

function supportKeys(entry) {
  return [...new Set([
    ...list(entry?.facets?.supports),
    ...text(entry?.supports).split(","),
  ].map(key).filter(Boolean))];
}

function gateMatches(support, alias) {
  return support === alias || support.endsWith(` ${alias}`) || alias.endsWith(` ${support}`);
}

function originalIdNamesClass(subclass, classEntry) {
  const id = ` ${key(subclass?.originalId)} `;
  const name = key(classEntry?.name);
  return Boolean(name && id.includes(` ${name} `));
}

function classGates(classEntry, featureByOriginalId, metadata) {
  const className = text(classEntry?.name);
  const fallbackLevel = Number(metadata?.rulesOverride?.subclassLevel || 0);
  const gates = [];
  list(classEntry?.rules?.grants).forEach((grant) => {
    if (!/class feature/i.test(text(grant?.type))) return;
    const name = text(featureByOriginalId.get(grant.id)?.name);
    if (!name) return;
    gates.push({
      name,
      level: Number(grant.level || fallbackLevel || 1),
      aliases: [...new Set([key(name), key(`${className} ${name}`)].filter(Boolean))],
    });
  });
  list(metadata?.rulesOverride?.features).forEach((feature) => {
    const name = text(feature?.name);
    if (!name) return;
    gates.push({
      name,
      level: Number(feature.level || fallbackLevel || 1),
      aliases: [...new Set([key(name), key(`${className} ${name}`)].filter(Boolean))],
    });
  });
  if (fallbackLevel) {
    gates.push({
      name: `${className} Subclass`,
      level: fallbackLevel,
      aliases: [key(`${className} Subclass`), key(`${className} Archetype`)],
    });
  }
  return gates;
}

function directEvidence(subclass, classEntry, supports) {
  let score = 0;
  if (originalIdNamesClass(subclass, classEntry)) score += 4;
  if (text(subclass.inputPath) && subclass.inputPath === classEntry.inputPath) score += 3;
  const className = key(classEntry.name);
  if (className && supports.some((support) => support.startsWith(`${className} `))) score += 2;
  return score;
}

function rawCandidates(subclass, classes, gatesByClassId, metadata) {
  const supports = supportKeys(subclass);
  return classes.flatMap((classEntry) => {
    if (metadata[classEntry.id]?.ruleset !== metadata[subclass.id]?.ruleset) return [];
    return list(gatesByClassId.get(classEntry.id))
      .filter((gate) => supports.some((support) => gate.aliases.some((alias) => gateMatches(support, alias))))
      .map((gate) => ({ classEntry, gate, supports, directScore: directEvidence(subclass, classEntry, supports) }));
  });
}

function familyScores(rows) {
  const scores = new Map();
  rows.forEach(({ candidates }) => candidates.forEach(({ classEntry, supports, directScore }) => {
    if (!directScore) return;
    supports.forEach((support) => {
      const scoreKey = `${support}\u0000${classEntry.name}`;
      scores.set(scoreKey, (scores.get(scoreKey) || 0) + directScore);
    });
  }));
  return scores;
}

function resolvedFamily(row, ownerScores) {
  const families = [...new Set(row.candidates.map(({ classEntry }) => classEntry.name))];
  if (families.length <= 1) return families[0] || "";
  const direct = families.map((name) => ({
    name,
    score: Math.max(...row.candidates.filter(({ classEntry }) => classEntry.name === name).map(({ directScore }) => directScore)),
  })).sort((left, right) => right.score - left.score || left.name.localeCompare(right.name));
  if (direct[0].score > direct[1].score) return direct[0].name;
  const owned = families.map((name) => ({
    name,
    score: row.supports.reduce((sum, support) => sum + (ownerScores.get(`${support}\u0000${name}`) || 0), 0),
  })).sort((left, right) => right.score - left.score || left.name.localeCompare(right.name));
  return owned[0].score > owned[1].score ? owned[0].name : "";
}

function uniqueParentLinks(candidates, family) {
  const byId = new Map();
  candidates.filter(({ classEntry }) => classEntry.name === family).forEach(({ classEntry, gate, directScore }) => {
    const current = byId.get(classEntry.id);
    const candidate = {
      id: classEntry.id,
      originalId: text(classEntry.originalId),
      name: text(classEntry.name),
      source: text(classEntry.publication) || "Unknown Source",
      gate: { name: gate.name, level: gate.level },
      evidence: directScore ? "direct" : "gate-owner",
    };
    if (!current || directScore > (current.evidence === "direct" ? 0 : -1)) byId.set(classEntry.id, candidate);
  });
  return [...byId.values()].sort((left, right) => left.id.localeCompare(right.id));
}

function gapsFor(metadata, parents) {
  const gaps = [];
  list(metadata?.automation?.reasons).forEach((reason) => gaps.push({ code: reason, message: `Automation gap: ${String(reason).replaceAll("-", " ")}.` }));
  list(metadata?.dependencies).filter(({ status }) => status !== "resolved").forEach(({ originalId }) => gaps.push({ code: "unresolved-dependency", sourceId: originalId, message: `Compendium dependency ${originalId} is unresolved.` }));
  if (!parents.length) gaps.push({ code: "unresolved-parent-class", message: "No single parent class family could be proven from Compendium support metadata." });
  return gaps;
}

function validateSubclassCoverageReport(report) {
  if (report?.version !== 1 || !/^sha256-[a-f0-9]{20}$/.test(report.catalogVersion || "")) throw new TypeError("Subclass coverage report needs a versioned Compendium catalog.");
  if (!Array.isArray(report.subclasses) || !report.subclasses.length) throw new TypeError("Subclass coverage report has no subclasses.");
  report.subclasses.forEach((entry) => {
    if (!entry.id || !entry.originalId || !entry.source || !entry.publisher) throw new TypeError(`Subclass ${entry.id || "(missing)"} lacks provenance.`);
    if (!AUTOMATION_STATUSES.has(entry.status)) throw new TypeError(`Subclass ${entry.id} has invalid automation status.`);
    if (!entry.selectable || !entry.parentClasses.length) throw new TypeError(`Subclass ${entry.id} has no proven selectable parent.`);
    if (entry.parentClasses.some((parent) => !parent.id || !parent.gate?.name || !(parent.gate.level > 0))) throw new TypeError(`Subclass ${entry.id} has an invalid parent gate.`);
    if (entry.status !== "rules-ready" && !entry.gaps.length) throw new TypeError(`Subclass ${entry.id} hides incomplete automation.`);
  });
  return report;
}

function buildSubclassCoverageReport({ catalogVersion, entries = [], rulesMetadata = {} }) {
  const classes = entries.filter(({ category }) => category === "classes");
  const subclasses = entries.filter(({ category }) => category === "subclasses");
  const featureByOriginalId = new Map(entries
    .filter((entry) => entry.category === "features" && text(entry.originalId))
    .map((entry) => [entry.originalId, entry]));
  const gatesByClassId = new Map(classes.map((entry) => [entry.id, classGates(entry, featureByOriginalId, rulesMetadata[entry.id])]));
  const rows = subclasses.map((subclass) => ({
    subclass,
    supports: supportKeys(subclass),
    candidates: rawCandidates(subclass, classes, gatesByClassId, rulesMetadata),
  }));
  const ownerScores = familyScores(rows);
  const audited = rows.map((row) => {
    const metadata = rulesMetadata[row.subclass.id] || {};
    const parents = uniqueParentLinks(row.candidates, resolvedFamily(row, ownerScores));
    const status = AUTOMATION_STATUSES.has(metadata.automation?.status) ? metadata.automation.status : "manual";
    return {
      id: row.subclass.id,
      originalId: text(row.subclass.originalId),
      name: text(row.subclass.name) || row.subclass.id,
      ruleset: metadata.ruleset,
      source: text(metadata.source || row.subclass.publication) || "Unknown Source",
      publisher: text(metadata.publisher) || "Unknown Publisher",
      status,
      selectable: parents.length > 0,
      supports: row.supports,
      parentClasses: parents,
      dependencies: list(metadata.dependencies),
      gaps: gapsFor(metadata, parents),
    };
  }).sort((left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id));
  return validateSubclassCoverageReport({
    version: 1,
    catalogVersion,
    scope: "Every Compendium subclass is linked only through declared support gates, direct identifiers, paths, or corpus-wide gate ownership; automation gaps remain explicit.",
    subclasses: audited,
    summary: {
      subclasses: audited.length,
      selectable: audited.filter(({ selectable }) => selectable).length,
      "rules-ready": audited.filter(({ status }) => status === "rules-ready").length,
      partial: audited.filter(({ status }) => status === "partial").length,
      manual: audited.filter(({ status }) => status === "manual").length,
      rulesets: Object.fromEntries(["5e", "5.5e", "agnostic"].map((ruleset) => [ruleset, audited.filter((entry) => entry.ruleset === ruleset).length])),
      subclassesWithGaps: audited.filter(({ gaps }) => gaps.length).length,
      unresolvedDependencies: audited.reduce((sum, entry) => sum + entry.dependencies.filter(({ status }) => status !== "resolved").length, 0),
      unresolvedParentClasses: audited.filter(({ selectable }) => !selectable).length,
    },
  });
}

module.exports = { buildSubclassCoverageReport, validateSubclassCoverageReport };
