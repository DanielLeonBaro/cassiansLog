// Calculates rules-mode abilities, saves, skills, passives, and their source traces.
import { evaluateIdRequirement } from "./requirements.js";
import { ABILITIES, PASSIVE_SKILLS, SKILLS } from "./core-definitions.js";
import { activeRuleEntries } from "./active-rules.js";

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalized(value) {
  return text(value).toLowerCase().replaceAll(/\s+/g, " ");
}

function strictNumber(value) {
  const source = text(String(value ?? ""));
  if (!/^[+-]?\d+(?:\.\d+)?$/.test(source)) return null;
  const number = Number(source);
  return Number.isFinite(number) ? number : null;
}

function minimumLevel(value) {
  const number = Math.trunc(Number(value));
  return Number.isFinite(number) && number > 0 ? number : 1;
}

function catalogEntries(catalog) {
  if (Array.isArray(catalog)) return catalog;
  return Array.isArray(catalog?.entries) ? catalog.entries : [];
}

function createCatalogIndex(catalog) {
  return new Map(catalogEntries(catalog)
    .filter((entry) => entry && text(entry.id))
    .map((entry) => [entry.id, entry]));
}

function warningCollector(initial = []) {
  const warnings = new Map();
  const add = (warning) => {
    const key = [warning.code, warning.path, warning.entryId, warning.sourceId].join("|");
    if (!warnings.has(key)) warnings.set(key, warning);
  };
  initial.forEach(add);
  return {
    add,
    sorted: () => [...warnings.values()].sort((left, right) =>
      left.code.localeCompare(right.code)
      || text(left.path).localeCompare(text(right.path))
      || text(left.entryId).localeCompare(text(right.entryId))),
  };
}

function ruleSource(record, value, kind = "rules", details = {}) {
  return {
    kind,
    sourceId: record.entry.id,
    originalId: text(record.entry.originalId),
    label: text(record.entry.name) || record.entry.id,
    ruleIndex: record.ruleIndex,
    value,
    ...details,
  };
}

function traceValue(value, sources) {
  return { value, sources };
}

function abilityMap() {
  const map = new Map();
  ABILITIES.forEach((ability) => {
    map.set(ability.id, ability);
    map.set(ability.name.toLowerCase(), ability);
  });
  return map;
}

function skillMap() {
  return new Map(SKILLS.map((skill) => [skill.ruleName, skill]));
}

function activeAliases(graph) {
  const aliases = new Set();
  graph.activeEntries.forEach((entry) => {
    if (entry.id) aliases.add(entry.id);
    if (entry.originalId) aliases.add(entry.originalId);
  });
  return aliases;
}

function applicableStatRules(graph, catalogIndex, aliases, warnings) {
  const records = [];
  activeRuleEntries(graph, [...catalogIndex.values()]).forEach(({ entry, active }) => {
    if (!entry || entry.automation?.status !== "rules-ready") return;
    const stats = Array.isArray(entry.rules?.stats) ? entry.rules.stats : [];
    stats.forEach((rule, ruleIndex) => {
      if (active.level < minimumLevel(rule?.level)) return;
      const requirement = evaluateIdRequirement(rule?.requirements, aliases);
      if (requirement.status === "unmet") return;
      if (requirement.status === "unsupported") {
        warnings.add({
          code: "unsupported-rule-expression",
          path: `catalog.${entry.id}.rules.stats.${ruleIndex}.requirements`,
          entryId: entry.id,
          sourceId: entry.id,
          blocking: true,
          message: `${entry.name || entry.id} has unsupported stat requirements.`,
        });
        return;
      }
      records.push({ entry, active, rule, ruleIndex });
    });
  });
  return records;
}

export function collectApplicableStatRules({ graph, catalog, warnings }) {
  return applicableStatRules(graph, createCatalogIndex(catalog), activeAliases(graph), warnings);
}

function unsupportedRule(record, warnings, detail = "stat expression") {
  warnings.add({
    code: "unsupported-rule-expression",
    path: `catalog.${record.entry.id}.rules.stats.${record.ruleIndex}`,
    entryId: record.entry.id,
    sourceId: record.entry.id,
    blocking: true,
    message: `${record.entry.name || record.entry.id} has an unsupported ${detail}.`,
  });
}

function proficiencyValue(value, proficiency) {
  const expression = normalized(value);
  if (expression === "proficiency") return { value: proficiency, rank: 3, proficiencyLevel: "proficient" };
  if (expression === "proficiency:half:up") {
    return { value: Math.ceil(proficiency / 2), rank: 2, proficiencyLevel: "half", rounding: "up" };
  }
  if (expression === "proficiency:half") {
    return { value: Math.floor(proficiency / 2), rank: 1, proficiencyLevel: "half", rounding: "down" };
  }
  return null;
}

function resolveModifierValue(value, proficiency, modifiers) {
  const number = strictNumber(value);
  if (number !== null) return { value: number, rank: 0 };
  const proficiencyResult = proficiencyValue(value, proficiency);
  if (proficiencyResult) return proficiencyResult;
  const abilityReference = normalized(value).match(/^(strength|dexterity|constitution|intelligence|wisdom|charisma|str|dex|con|int|wis|cha):modifier$/);
  if (!abilityReference) return null;
  const ability = abilityMap().get(abilityReference[1]);
  return ability ? { value: modifiers[ability.id], rank: 0 } : null;
}

function strongest(records) {
  return [...records].sort((left, right) =>
    right.rank - left.rank
    || right.value - left.value
    || left.source.sourceId.localeCompare(right.source.sourceId))[0] || null;
}

function append(map, key, value) {
  if (!map.has(key)) map.set(key, []);
  map.get(key).push(value);
}

function abilityScores(document, records, warnings, trace, overrideResolver) {
  const definitions = abilityMap();
  const contributions = new Map(ABILITIES.map((ability) => [ability.id, []]));
  const handled = new Set();

  records.forEach((record) => {
    const ability = definitions.get(normalized(record.rule?.name));
    if (!ability) return;
    const value = strictNumber(record.rule?.value);
    handled.add(record);
    if (value === null) {
      unsupportedRule(record, warnings, "ability-score value");
      return;
    }
    contributions.get(ability.id).push({ value, source: ruleSource(record, value) });
  });

  const scores = {};
  const modifiers = {};
  ABILITIES.forEach((ability) => {
    const supplied = document.build.abilityScores.base[ability.id];
    const valid = Number.isFinite(supplied);
    const base = valid ? supplied : 10;
    if (!valid) warnings.add({
      code: "missing-ability-score",
      path: `build.abilityScores.base.${ability.id}`,
      blocking: true,
      message: `${ability.name} has no base score; neutral placeholder 10 is shown.`,
    });
    if (valid && (!Number.isInteger(base) || base < 1 || base > 30)) warnings.add({
      code: "invalid-ability-score",
      path: `build.abilityScores.base.${ability.id}`,
      blocking: true,
      message: `${ability.name} must be a whole number from 1 through 30.`,
    });
    const sources = [{
      kind: "base",
      sourceId: `build.abilityScores.base.${ability.id}`,
      label: `Base ${ability.name}`,
      value: base,
    }, ...contributions.get(ability.id).map((item) => item.source)];
    const automaticScore = base + contributions.get(ability.id).reduce((sum, item) => sum + item.value, 0);
    const scorePath = `stats.${ability.id}.score`;
    const scoreResult = overrideResolver.number(scorePath, automaticScore, sources, { integer: true, minimum: 1 });
    const modifierSources = [{
      kind: "ability",
      sourceId: scorePath,
      label: `${ability.name} modifier formula`,
      value: Math.floor((scoreResult.value - 10) / 2),
    }];
    const modifierPath = `stats.${ability.id}.modifier`;
    const modifierResult = overrideResolver.number(
      modifierPath,
      Math.floor((scoreResult.value - 10) / 2),
      modifierSources,
      { integer: true },
    );
    scores[ability.id] = scoreResult.value;
    modifiers[ability.id] = modifierResult.value;
    trace[scorePath] = scoreResult.trace;
    trace[modifierPath] = modifierResult.trace;
  });
  return { scores, modifiers, handled };
}

function classifyCoreRules(records, handled, proficiency, modifiers, warnings, deferRule) {
  const skills = skillMap();
  const abilities = abilityMap();
  const skillProficiency = new Map();
  const saveProficiency = new Map();
  const skillMisc = new Map();
  const saveMisc = new Map();
  const passiveMisc = new Map();

  records.forEach((record) => {
    if (handled.has(record)) return;
    const name = normalized(record.rule?.name);
    let match = name.match(/^(.+):proficiency$/);
    if (match && skills.has(match[1])) {
      handled.add(record);
      if (normalized(record.rule?.value) !== "proficiency") {
        unsupportedRule(record, warnings, "skill-proficiency value");
        return;
      }
      const tier = normalized(record.rule?.bonus) === "double" ? 2 : 1;
      append(skillProficiency, skills.get(match[1]).id, {
        tier,
        rank: tier,
        value: proficiency * tier,
        source: ruleSource(record, proficiency * tier, "proficiency", {
          multiplier: tier,
          proficiencyLevel: tier === 2 ? "expertise" : "proficient",
        }),
      });
      return;
    }

    match = name.match(/^(strength|dexterity|constitution|intelligence|wisdom|charisma|str|dex|con|int|wis|cha):save:proficiency$/);
    if (match) {
      handled.add(record);
      if (normalized(record.rule?.value) !== "proficiency") {
        unsupportedRule(record, warnings, "save-proficiency value");
        return;
      }
      const ability = abilities.get(match[1]);
      const tier = normalized(record.rule?.bonus) === "double" ? 2 : 1;
      append(saveProficiency, ability.id, {
        tier,
        rank: tier,
        value: proficiency * tier,
        source: ruleSource(record, proficiency * tier, "proficiency", {
          multiplier: tier,
          proficiencyLevel: tier === 2 ? "expertise" : "proficient",
        }),
      });
      return;
    }

    match = name.match(/^(.+):(misc|passive)$/);
    if (match && skills.has(match[1])) {
      handled.add(record);
      const resolved = resolveModifierValue(record.rule?.value, proficiency, modifiers);
      if (!resolved) {
        unsupportedRule(record, warnings, `skill-${match[2]} value`);
        return;
      }
      append(match[2] === "passive" ? passiveMisc : skillMisc, skills.get(match[1]).id, {
        ...resolved,
        source: ruleSource(
          record,
          resolved.value,
          resolved.rank ? "proficiency" : "rules",
          resolved.rank ? {
            proficiencyLevel: resolved.proficiencyLevel,
            rounding: resolved.rounding,
          } : {},
        ),
      });
      return;
    }

    match = name.match(/^(strength|dexterity|constitution|intelligence|wisdom|charisma|str|dex|con|int|wis|cha):save:misc$/);
    if (match) {
      handled.add(record);
      const resolved = resolveModifierValue(record.rule?.value, proficiency, modifiers);
      if (!resolved) {
        unsupportedRule(record, warnings, "saving-throw value");
        return;
      }
      append(saveMisc, abilities.get(match[1]).id, {
        ...resolved,
        source: ruleSource(
          record,
          resolved.value,
          resolved.rank ? "proficiency" : "rules",
          resolved.rank ? {
            proficiencyLevel: resolved.proficiencyLevel,
            rounding: resolved.rounding,
          } : {},
        ),
      });
      return;
    }
  });

  records.forEach((record) => {
    if (!handled.has(record) && !deferRule(record)) unsupportedRule(record, warnings);
  });
  return { skillProficiency, saveProficiency, skillMisc, saveMisc, passiveMisc };
}

function additiveSources(records, { ignoreProficiency = false } = {}) {
  const ordinary = records.filter((record) => !record.rank);
  const proficiency = ignoreProficiency ? [] : [strongest(records.filter((record) => record.rank))].filter(Boolean);
  return [...ordinary, ...proficiency];
}

function calculateStats(scores, modifiers, proficiency, classified, trace, overrideResolver) {
  const stats = {};
  const skillResults = new Map();

  ABILITIES.forEach((ability) => {
    const saveWinner = strongest(classified.saveProficiency.get(ability.id) || []);
    const saveMisc = additiveSources(classified.saveMisc.get(ability.id) || [], {
      ignoreProficiency: Boolean(saveWinner),
    });
    const saveSources = [{
      kind: "ability",
      sourceId: `stats.${ability.id}.modifier`,
      label: `${ability.name} modifier`,
      value: modifiers[ability.id],
    }];
    if (saveWinner) saveSources.push(saveWinner.source);
    saveSources.push(...saveMisc.map((item) => item.source));
    const savePath = `stats.${ability.id}.save`;
    const saveResult = overrideResolver.number(
      savePath,
      saveSources.reduce((sum, source) => sum + source.value, 0),
      saveSources,
      { integer: true },
    );
    const save = saveResult.value;
    trace[savePath] = saveResult.trace;
    trace[`stats.${ability.id}.save.proficiency`] = traceValue(
      saveWinner?.source.proficiencyLevel || "none",
      saveWinner ? [saveWinner.source] : [],
    );

    const abilitySkills = SKILLS.filter((skill) => skill.ability === ability.id);
    const skills = abilitySkills.map((skill, index) => {
      const proficiencyWinner = strongest(classified.skillProficiency.get(skill.id) || []);
      const misc = additiveSources(classified.skillMisc.get(skill.id) || [], {
        ignoreProficiency: Boolean(proficiencyWinner),
      });
      const sources = [{
        kind: "ability",
        sourceId: `stats.${ability.id}.modifier`,
        label: `${ability.name} modifier`,
        value: modifiers[ability.id],
      }];
      if (proficiencyWinner) sources.push(proficiencyWinner.source);
      sources.push(...misc.map((item) => item.source));
      const path = `stats.${ability.id}.skills.${index}.modifier`;
      const modifierResult = overrideResolver.number(
        path,
        sources.reduce((sum, source) => sum + source.value, 0),
        sources,
        { integer: true },
      );
      const modifier = modifierResult.value;
      trace[path] = modifierResult.trace;
      const halfWinner = proficiencyWinner
        ? null
        : strongest((classified.skillMisc.get(skill.id) || []).filter((item) => item.rank));
      trace[`stats.${ability.id}.skills.${index}.proficiency`] = traceValue(
        proficiencyWinner?.source.proficiencyLevel || halfWinner?.source.proficiencyLevel || "none",
        proficiencyWinner ? [proficiencyWinner.source] : halfWinner ? [halfWinner.source] : [],
      );
      skillResults.set(skill.id, { modifier, proficiencyWinner, path });
      return {
        name: skill.name,
        modifier,
        proficiency: Boolean(proficiencyWinner),
      };
    });
    stats[ability.id] = { score: scores[ability.id], modifier: modifiers[ability.id], save, skills };
  });
  return { stats, skillResults };
}

function calculatePassives(skillResults, classified, trace, overrideResolver) {
  const passives = {};
  PASSIVE_SKILLS.forEach(({ skillId, sheetPath }) => {
    const skill = skillResults.get(skillId);
    const extra = additiveSources(classified.passiveMisc.get(skillId) || []);
    const sources = [{ kind: "base", sourceId: sheetPath, label: "Passive base", value: 10 }, {
      kind: "skill",
      sourceId: skill.path,
      label: `${SKILLS.find((candidate) => candidate.id === skillId).name} modifier`,
      value: skill.modifier,
    }, ...extra.map((item) => item.source)];
    const result = overrideResolver.number(
      sheetPath,
      sources.reduce((sum, source) => sum + source.value, 0),
      sources,
      { integer: true },
    );
    passives[sheetPath] = result.value;
    trace[sheetPath] = result.trace;
  });
  return passives;
}

export function calculateCoreCharacterValues({
  document,
  graph,
  catalog,
  overrideResolver,
  deferRule = () => false,
  extraStatRecords = [],
}) {
  const warnings = warningCollector(graph.warnings);
  const trace = {};
  const totalLevel = document.build.levels.reduce((sum, level) => sum + Number(level.level || 0), 0);
  const boundedLevel = Math.max(1, Math.min(20, totalLevel || 1));
  if (!totalLevel) warnings.add({
    code: "missing-class-level",
    path: "build.levels",
    blocking: true,
    message: "At least one class level is required; level 1 proficiency is shown.",
  });
  if (totalLevel > 20) warnings.add({
    code: "invalid-character-level",
    path: "build.levels",
    blocking: true,
    message: "Total character level cannot exceed 20.",
  });
  const automaticProficiency = 2 + Math.floor((boundedLevel - 1) / 4);
  trace.level = traceValue(totalLevel, document.build.levels.map((level, index) => ({
    kind: "level",
    sourceId: `build.levels.${index}.level`,
    label: `Class level ${index + 1}`,
    value: Number(level.level || 0),
  })));
  const proficiencyResult = overrideResolver.number("proficiency", automaticProficiency, [{
    kind: "level",
    sourceId: "level",
    label: `Proficiency for level ${boundedLevel}`,
    value: automaticProficiency,
  }], { integer: true, minimum: 0 });
  const proficiency = proficiencyResult.value;
  trace.proficiency = proficiencyResult.trace;

  const records = [...collectApplicableStatRules({ graph, catalog, warnings }), ...extraStatRecords];
  const abilityResult = abilityScores(document, records, warnings, trace, overrideResolver);
  const classified = classifyCoreRules(
    records,
    abilityResult.handled,
    proficiency,
    abilityResult.modifiers,
    warnings,
    deferRule,
  );
  const statsResult = calculateStats(
    abilityResult.scores,
    abilityResult.modifiers,
    proficiency,
    classified,
    trace,
    overrideResolver,
  );
  const passives = calculatePassives(statsResult.skillResults, classified, trace, overrideResolver);
  return {
    level: totalLevel,
    proficiency,
    stats: statsResult.stats,
    passives,
    trace,
    warnings: warnings.sorted(),
  };
}
