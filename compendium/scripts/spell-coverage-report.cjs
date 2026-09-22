// Audits spell metadata, list membership, repertoires, grants, and source conflicts.
const STATUSES = new Set(["rules-ready", "partial", "manual"]);

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function list(value) {
  return Array.isArray(value) ? value : [];
}

function normalized(value) {
  return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function effectiveRules(entry, metadata) {
  return metadata?.rulesOverride && typeof metadata.rulesOverride === "object"
    ? metadata.rulesOverride
    : entry?.rules && typeof entry.rules === "object" ? entry.rules : {};
}

function booleanSetting(value) {
  if (value === true || text(value).toLowerCase() === "true") return true;
  if (value === false || text(value).toLowerCase() === "false") return false;
  return null;
}

function spellLevel(entry) {
  const level = Number(entry?.facets?.spellLevel ?? entry?.setters?.level);
  return Number.isInteger(level) && level >= 0 && level <= 9 ? level : null;
}

function supportValues(entry) {
  return [...new Set([...list(entry.facets?.supports), ...text(entry.supports).split(",")].map(text).filter(Boolean))];
}

function automationGaps(metadata) {
  const gaps = list(metadata?.automation?.reasons).map((reason) => ({ code: reason, message: `Automation gap: ${String(reason).replaceAll("-", " ")}.` }));
  list(metadata?.dependencies).filter(({ status }) => status !== "resolved").forEach(({ originalId }) => gaps.push({ code: "unresolved-dependency", sourceId: originalId, message: `Compendium dependency ${originalId} is unresolved.` }));
  return gaps;
}

function classListNames(entries, rulesMetadata) {
  const byRuleset = new Map();
  entries.filter(({ category }) => category === "classes").forEach((entry) => {
    const metadata = rulesMetadata[entry.id] || {};
    const ruleset = metadata.ruleset;
    if (!byRuleset.has(ruleset)) byRuleset.set(ruleset, new Map());
    const aliases = new Set([text(entry.name)]);
    const spellcasting = effectiveRules(entry, metadata).spellcasting;
    if (text(spellcasting?.spellList)) aliases.add(text(spellcasting.spellList));
    aliases.forEach((alias) => {
      if (alias) byRuleset.get(ruleset).set(normalized(alias), alias);
    });
  });
  return byRuleset;
}

function spellRecord(entry, metadata, listsByRuleset) {
  const level = spellLevel(entry);
  const supports = supportValues(entry);
  const classLists = listsByRuleset.get(metadata.ruleset) || new Map();
  const memberships = supports.filter((value) => classLists.has(normalized(value))).map((value) => classLists.get(normalized(value)));
  const settings = entry.setters || {};
  const gaps = automationGaps(metadata);
  if (!memberships.length) gaps.push({ code: "no-class-list", message: "No class spell-list membership is declared; treat as granted/manual until reviewed." });
  const requiredMetadata = [
    ["school", text(entry.facets?.school || settings.school)],
    ["casting-time", text(settings.time)],
    ["range", text(settings.range)],
    ["duration", text(settings.duration)],
  ];
  requiredMetadata.filter(([, value]) => !value).forEach(([field]) => gaps.push({ code: "missing-spell-metadata", field, message: `Spell ${field} is not declared.` }));
  if (level === null) gaps.push({ code: "invalid-spell-level", message: "Spell level is missing or outside 0–9." });
  return {
    id: entry.id,
    originalId: text(entry.originalId),
    name: text(entry.name) || entry.id,
    ruleset: metadata.ruleset,
    source: text(metadata.source || entry.publication) || "Unknown Source",
    publisher: text(metadata.publisher) || "Unknown Publisher",
    status: STATUSES.has(metadata.automation?.status) ? metadata.automation.status : "manual",
    level,
    school: text(entry.facets?.school || settings.school),
    castingTime: text(settings.time),
    range: text(settings.range),
    duration: text(settings.duration),
    components: {
      verbal: booleanSetting(settings.hasVerbalComponent),
      somatic: booleanSetting(settings.hasSomaticComponent),
      material: booleanSetting(settings.hasMaterialComponent),
      materialText: text(settings.materialComponent),
    },
    concentration: booleanSetting(settings.isConcentration),
    ritual: booleanSetting(settings.isRitual),
    classLists: [...new Set(memberships)].sort(),
    supportTags: supports.filter((value) => !classLists.has(normalized(value))).sort(),
    dependencies: list(metadata.dependencies),
    gaps,
  };
}

function repertoireRecords(entries, rulesMetadata) {
  return entries.flatMap((entry) => {
    const metadata = rulesMetadata[entry.id] || {};
    const spellcasting = effectiveRules(entry, metadata).spellcasting;
    if (!spellcasting) return [];
    const gaps = [];
    for (const field of ["ability", "spellList", "progression", "repertoire"]) {
      if (!text(spellcasting[field])) gaps.push({ code: "missing-repertoire-field", field, message: `Spellcasting ${field} is not declared.` });
    }
    return [{
      sourceId: entry.id,
      sourceName: text(entry.name) || entry.id,
      sourceCategory: entry.category,
      ruleset: metadata.ruleset,
      source: text(metadata.source || entry.publication) || "Unknown Source",
      publisher: text(metadata.publisher) || "Unknown Publisher",
      ability: text(spellcasting.ability),
      spellList: text(spellcasting.spellList),
      progression: text(spellcasting.progression),
      multiclassProgression: text(spellcasting.multiclassProgression),
      repertoire: text(spellcasting.repertoire),
      ritual: text(spellcasting.ritual),
      minimumLevel: Math.max(1, Number(spellcasting.minimumLevel) || 1),
      cantrips: spellcasting.cantrips ?? null,
      known: spellcasting.known ?? null,
      prepared: spellcasting.prepared ?? null,
      gaps,
    }];
  }).sort((left, right) => left.ruleset.localeCompare(right.ruleset) || left.sourceName.localeCompare(right.sourceName));
}

function grantedSpellRecords(entries, rulesMetadata, spellByOriginalId) {
  return entries.flatMap((entry) => {
    const metadata = rulesMetadata[entry.id] || {};
    const grants = list(effectiveRules(entry, metadata).grants);
    return grants.flatMap((grant, index) => {
      const target = spellByOriginalId.get(grant.id);
      if (!target && !/spell/i.test(text(grant.type))) return [];
      return [{
        id: `${entry.id}:grant:${index}`,
        sourceId: entry.id,
        sourceName: text(entry.name) || entry.id,
        sourceCategory: entry.category,
        ruleset: metadata.ruleset,
        source: text(metadata.source || entry.publication) || "Unknown Source",
        publisher: text(metadata.publisher) || "Unknown Publisher",
        targetOriginalId: text(grant.id),
        targetId: target?.id || "",
        targetName: target?.name || "",
        level: Math.max(1, Number(grant.level) || 1),
        prepared: grant.prepared ?? null,
        known: grant.known ?? null,
        status: target ? "resolved" : "missing",
      }];
    });
  }).sort((left, right) => left.sourceName.localeCompare(right.sourceName) || left.level - right.level || left.id.localeCompare(right.id));
}

function conflictRecords(spells) {
  const groups = new Map();
  spells.forEach((spell) => {
    const groupKey = `${spell.ruleset}\u0000${normalized(spell.name)}`;
    if (!groups.has(groupKey)) groups.set(groupKey, []);
    groups.get(groupKey).push(spell);
  });
  return [...groups.values()].filter((group) => group.length > 1).map((group) => {
    const signatures = new Set(group.map((spell) => JSON.stringify([spell.level, spell.school, spell.classLists])));
    return {
      ruleset: group[0].ruleset,
      name: group[0].name,
      entryIds: group.map(({ id }) => id).sort(),
      sources: [...new Set(group.map(({ source }) => source))].sort(),
      kind: signatures.size > 1 ? "rules-conflict" : "duplicate-source",
      fields: signatures.size > 1 ? ["level", "school", "classLists"] : [],
    };
  }).sort((left, right) => left.ruleset.localeCompare(right.ruleset) || left.name.localeCompare(right.name));
}

function validateSpellCoverageReport(report) {
  if (report?.version !== 1 || !/^sha256-[a-f0-9]{20}$/.test(report.catalogVersion || "")) throw new TypeError("Spell coverage report needs a versioned Compendium catalog.");
  if (!report.spells?.length || !report.repertoires?.length) throw new TypeError("Spell coverage report lacks spells or repertoires.");
  report.spells.forEach((spell) => {
    if (!spell.id || !spell.originalId || !spell.source || !spell.publisher || !STATUSES.has(spell.status)) throw new TypeError(`Spell ${spell.id || "(missing)"} lacks provenance or status.`);
    if (!Number.isInteger(spell.level) || spell.level < 0 || spell.level > 9) throw new TypeError(`Spell ${spell.id} has invalid level.`);
    if (spell.status !== "rules-ready" && !spell.gaps.length) throw new TypeError(`Spell ${spell.id} hides incomplete automation.`);
  });
  for (let level = 0; level <= 9; level += 1) {
    if (!report.summary.levels[String(level)]) throw new TypeError(`Spell coverage report lacks level ${level}.`);
  }
  return report;
}

function buildSpellCoverageReport({ catalogVersion, entries = [], rulesMetadata = {} }) {
  const listsByRuleset = classListNames(entries, rulesMetadata);
  const spellEntries = entries.filter(({ category }) => category === "spells");
  const spells = spellEntries.map((entry) => spellRecord(entry, rulesMetadata[entry.id] || {}, listsByRuleset))
    .sort((left, right) => left.level - right.level || left.name.localeCompare(right.name) || left.id.localeCompare(right.id));
  const repertoires = repertoireRecords(entries, rulesMetadata);
  const spellByOriginalId = new Map(spellEntries.map((entry) => [entry.originalId, entry]));
  const grantedSpells = grantedSpellRecords(entries, rulesMetadata, spellByOriginalId);
  const conflicts = conflictRecords(spells);
  return validateSpellCoverageReport({
    version: 1,
    catalogVersion,
    scope: "Every spell is audited across levels 0–9 for metadata, class-list membership, repertoire declarations, granted-spell references, provenance, automation gaps, and source conflicts.",
    spells,
    repertoires,
    grantedSpells,
    conflicts,
    summary: {
      spells: spells.length,
      levels: Object.fromEntries(Array.from({ length: 10 }, (_, level) => [String(level), spells.filter((spell) => spell.level === level).length])),
      rulesets: Object.fromEntries(["5e", "5.5e", "agnostic"].map((ruleset) => [ruleset, spells.filter((spell) => spell.ruleset === ruleset).length])),
      statuses: Object.fromEntries([...STATUSES].map((status) => [status, spells.filter((spell) => spell.status === status).length])),
      repertoires: repertoires.length,
      grantedSpells: grantedSpells.length,
      unresolvedGrantedSpells: grantedSpells.filter(({ status }) => status === "missing").length,
      spellsWithoutClassLists: spells.filter(({ classLists }) => !classLists.length).length,
      spellsWithGaps: spells.filter(({ gaps }) => gaps.length).length,
      conflicts: conflicts.length,
      rulesConflicts: conflicts.filter(({ kind }) => kind === "rules-conflict").length,
    },
  });
}

module.exports = { buildSpellCoverageReport, validateSpellCoverageReport };
