// Calculates rules-mode durability, mobility, senses, and named proficiencies.
import { collectApplicableStatRules } from "./core-calculations.js";
import { activeRuleEntries } from "./active-rules.js";

const MOVEMENT_TYPES = Object.freeze(["walk", "fly", "climb", "swim", "burrow"]);
const SENSE_TYPES = Object.freeze(["darkvision", "blindsight", "tremorsense", "truesight"]);

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

function entries(catalog) {
  return Array.isArray(catalog) ? catalog : Array.isArray(catalog?.entries) ? catalog.entries : [];
}

function catalogIndex(catalog) {
  const index = new Map();
  entries(catalog).forEach((entry) => {
    if (!entry || !text(entry.id)) return;
    if (!index.has(entry.id)) index.set(entry.id, entry);
    if (text(entry.originalId) && !index.has(entry.originalId)) index.set(entry.originalId, entry);
  });
  return index;
}

function warningCollector() {
  const warnings = new Map();
  return {
    add(warning) {
      const key = [warning.code, warning.path, warning.entryId, warning.sourceId].join("|");
      if (!warnings.has(key)) warnings.set(key, warning);
    },
    sorted() {
      return [...warnings.values()].sort((left, right) =>
        left.code.localeCompare(right.code)
        || text(left.path).localeCompare(text(right.path))
        || text(left.entryId).localeCompare(text(right.entryId)));
    },
  };
}

function ruleSource(record, value, kind = "rules") {
  return {
    kind,
    sourceId: record.entry.id,
    originalId: text(record.entry.originalId),
    label: text(record.entry.name) || record.entry.id,
    ruleIndex: record.ruleIndex,
    value,
  };
}

function unsupported(record, warnings, detail = "durability stat expression") {
  warnings.add({
    code: "unsupported-rule-expression",
    path: `catalog.${record.entry.id}.rules.stats.${record.ruleIndex}`,
    entryId: record.entry.id,
    sourceId: record.entry.id,
    blocking: true,
    message: `${record.entry.name || record.entry.id} has an unsupported ${detail}.`,
  });
}

function ruleNumber(record, core) {
  const rawValue = record.rule?.value?.type === "table"
    ? record.rule.value.values?.[record.active?.level]
    : record.rule?.value;
  const number = strictNumber(rawValue);
  if (number !== null) {
    if (record.rule?.perClassLevel === true) return number * Number(record.active?.level || 0);
    return record.rule?.perLevel === true ? number * core.level : number;
  }
  const expression = normalized(rawValue);
  if (expression === "level") return core.level;
  if (expression === "proficiency") return core.proficiency;
  if (expression === "proficiency:half") return Math.floor(core.proficiency / 2);
  if (expression === "proficiency:half:up") return Math.ceil(core.proficiency / 2);
  const ability = expression.match(/^(strength|dexterity|constitution|intelligence|wisdom|charisma|str|dex|con|int|wis|cha):modifier$/);
  if (!ability) return null;
  const aliases = {
    strength: "str", dexterity: "dex", constitution: "con",
    intelligence: "int", wisdom: "wis", charisma: "cha",
  };
  return core.stats[aliases[ability[1]] || ability[1]]?.modifier ?? null;
}

function hasEquipmentCondition(record) {
  return Boolean(text(record.rule?.equipped));
}

function parseHitDie(value) {
  const match = normalized(value).match(/^d(6|8|10|12)$/);
  return match ? Number(match[1]) : null;
}

function hitPoints(document, catalog, core, runtime, hpBonuses, overrideResolver, warnings, trace) {
  const index = catalogIndex(catalog);
  const pools = new Map();
  const sources = [];
  let automaticMax = 0;
  let firstCharacterLevel = true;

  document.build.levels.forEach((level, levelIndex) => {
    const classEntry = index.get(level.classId);
    const die = classEntry?.automation?.status === "rules-ready" ? parseHitDie(classEntry.setters?.hd) : null;
    const classLevel = Number(level.level || 0);
    let rollCursor = 0;
    if (!die) {
      warnings.add({
        code: "unsupported-hit-die",
        path: `build.levels.${levelIndex}.classId`,
        entryId: classEntry?.id || level.classId,
        sourceId: classEntry?.id || level.classId,
        blocking: true,
        message: `${classEntry?.name || level.classId || "Class"} does not have a certified hit die.`,
      });
    } else {
      const dieName = `d${die}`;
      pools.set(dieName, (pools.get(dieName) || 0) + classLevel);
    }

    for (let classLevelIndex = 0; classLevelIndex < classLevel; classLevelIndex += 1) {
      let gained = 0;
      let kind = "hit-die";
      let sourceId = `build.levels.${levelIndex}.hitPointRolls.${rollCursor}`;
      let label = `${classEntry?.name || "Class"} HP`;
      if (die && firstCharacterLevel) {
        gained = die;
        kind = "hit-die-max";
        sourceId = `catalog.${classEntry.id}.setters.hd`;
        label = `${classEntry.name} first-level hit die`;
      } else if (die && document.build.preferences.hitPoints === "fixed") {
        gained = Math.floor(die / 2) + 1;
        kind = "hit-die-fixed";
        sourceId = `catalog.${classEntry.id}.setters.hd`;
        label = `${classEntry.name} fixed HP`;
      } else if (die) {
        const rollIndex = rollCursor;
        rollCursor += 1;
        const roll = level.hitPointRolls[rollIndex];
        sourceId = `build.levels.${levelIndex}.hitPointRolls.${rollIndex}`;
        if (!Number.isInteger(roll) || roll < 1 || roll > die) {
          warnings.add({
            code: "invalid-hit-point-roll",
            path: sourceId,
            entryId: classEntry.id,
            sourceId: classEntry.id,
            blocking: true,
            message: `${classEntry.name} needs a whole-number HP roll from 1 through ${die}.`,
          });
        } else {
          gained = roll;
          kind = "hit-die-roll";
          label = `${classEntry.name} rolled HP`;
        }
      }
      if (die) sources.push({ kind, sourceId, label, value: gained });
      automaticMax += gained;
      firstCharacterLevel = false;
    }
  });

  const constitutionPerLevel = core.stats.con.modifier;
  const constitutionTotal = constitutionPerLevel * core.level;
  automaticMax += constitutionTotal;
  sources.push({
    kind: "ability",
    sourceId: "stats.con.modifier",
    label: `Constitution modifier across ${core.level} levels`,
    value: constitutionTotal,
    perLevel: constitutionPerLevel,
  });
  hpBonuses.forEach((item) => {
    automaticMax += item.value;
    sources.push(item.source);
  });

  if (automaticMax < 1) {
    sources.push({
      kind: "minimum",
      sourceId: "rules.hp.minimum",
      label: "Minimum maximum hit points",
      value: 1 - automaticMax,
    });
    automaticMax = 1;
  }

  const hpResult = overrideResolver.number("hp.max", automaticMax, sources, {
    integer: true,
    minimum: 1,
  });
  trace["hp.max"] = hpResult.trace;
  const runtimeCurrent = strictNumber(runtime?.hp?.current);
  const snapshotCurrent = strictNumber(document.hp?.current);
  const current = Math.max(0, Math.min(hpResult.value, runtimeCurrent ?? snapshotCurrent ?? hpResult.value));
  const runtimeTemp = strictNumber(runtime?.hp?.temp);
  const snapshotTemp = strictNumber(document.hp?.temp);
  const temp = Math.max(0, runtimeTemp ?? snapshotTemp ?? 0);
  trace["hp.current"] = { value: current, sources: [{
    kind: runtimeCurrent !== null ? "runtime" : snapshotCurrent !== null ? "snapshot" : "default",
    sourceId: runtimeCurrent !== null ? "runtime.hp.current" : snapshotCurrent !== null ? "hp.current" : "hp.max",
    label: "Current hit points",
    value: current,
  }] };
  trace["hp.temp"] = { value: temp, sources: [{
    kind: runtimeTemp !== null ? "runtime" : snapshotTemp !== null ? "snapshot" : "default",
    sourceId: runtimeTemp !== null ? "runtime.hp.temp" : snapshotTemp !== null ? "hp.temp" : "hp.temp",
    label: "Temporary hit points",
    value: temp,
  }] };

  const savedHitDice = new Map((Array.isArray(runtime?.hitDice) ? runtime.hitDice : [])
    .filter((pool) => pool && text(pool.die))
    .map((pool) => [pool.die, pool]));
  const hitDice = [...pools.entries()]
    .sort((left, right) => Number(right[0].slice(1)) - Number(left[0].slice(1)))
    .map(([die, max]) => {
      const saved = strictNumber(savedHitDice.get(die)?.current);
      return { die, current: saved === null ? max : Math.max(0, Math.min(max, saved)), max };
    });
  trace.hitDice = {
    value: hitDice,
    sources: document.build.levels.map((level, levelIndex) => {
      const entry = index.get(level.classId);
      return {
        kind: "class",
        sourceId: entry?.id || level.classId,
        label: entry?.name || level.classId,
        value: Number(level.level || 0),
        die: entry?.setters?.hd || "",
        levelIndex,
      };
    }),
  };
  return { hp: { max: hpResult.value, current, temp }, hitDice };
}

function classifyRules(records, core, warnings) {
  const values = {
    hp: [],
    ac: [],
    initiative: [],
    movement: Object.fromEntries(MOVEMENT_TYPES.map((kind) => [kind, { base: [], misc: [] }])),
    senses: Object.fromEntries(SENSE_TYPES.map((kind) => [kind, { base: [], misc: [] }])),
  };

  records.forEach((record) => {
    const name = normalized(record.rule?.name);
    if (!isDurabilityStatRule(record)) return;
    if (hasEquipmentCondition(record) && record.equipmentResolved === false) return;
    if (hasEquipmentCondition(record) && record.equipmentResolved !== true) {
      unsupported(record, warnings, "equipment condition");
      return;
    }
    const value = ruleNumber(record, core);
    if (value === null) {
      if (/^(?:innate )?speed:(fly|climb|swim|burrow)$/.test(name)
        && ["speed", "innate speed"].includes(normalized(record.rule?.value))) {
        values.movement[name.match(/:(fly|climb|swim|burrow)$/)[1]].base.push({ reference: "walk", record });
        return;
      }
      unsupported(record, warnings);
      return;
    }
    const item = {
      value,
      source: ruleSource(record, value),
      stackingGroup: text(record.rule?.stackingGroup),
      stacking: normalized(record.rule?.stacking),
    };
    if (["hp", "additional:hp:max"].includes(name)) values.hp.push(item);
    else if (name === "ac:misc") values.ac.push(item);
    else if (["initiative", "initiative:misc"].includes(name)) values.initiative.push(item);
    else {
      const movement = name.match(/^(?:innate )?speed(?::(fly|climb|swim|burrow))?(?::(misc))?$/);
      if (movement) {
        const bucket = movement[2] || normalized(record.rule?.bonus) !== "base" ? "misc" : "base";
        values.movement[movement[1] || "walk"][bucket].push(item);
        return;
      }
      const sense = name.match(/^(darkvision|blindsight|tremorsense|truesight):range(?::(misc))?$/);
      if (sense) {
        values.senses[sense[1]][sense[2] ? "misc" : normalized(record.rule?.bonus) === "base" ? "base" : "misc"].push(item);
        return;
      }
      unsupported(record, warnings);
    }
  });
  return values;
}

function calculateMovement(values, overrideResolver, trace, encumbrance) {
  const movement = {};
  MOVEMENT_TYPES.forEach((kind) => {
    const records = values[kind];
    const baseCandidates = records.base.map((item) => item.reference === "walk"
      ? { value: movement.walk || 0, source: ruleSource(item.record, movement.walk || 0, "reference") }
      : item);
    const strongestBase = [...baseCandidates].sort((left, right) =>
      right.value - left.value || left.source.sourceId.localeCompare(right.source.sourceId))[0];
    const automaticBeforeBurden = (strongestBase?.value || 0) + records.misc.reduce((sum, item) => sum + item.value, 0);
    const penalty = automaticBeforeBurden > 0 ? Number(encumbrance?.speedPenalty || 0) : 0;
    const capped = encumbrance?.speedMaximum === null || encumbrance?.speedMaximum === undefined
      ? automaticBeforeBurden - penalty
      : Math.min(automaticBeforeBurden - penalty, encumbrance.speedMaximum);
    const sources = [...(strongestBase ? [strongestBase.source] : []), ...records.misc.map((item) => item.source)];
    if (penalty) sources.push({ kind: "encumbrance", sourceId: "encumbrance", label: "Encumbrance speed penalty", value: -penalty });
    if (encumbrance?.speedMaximum !== null && encumbrance?.speedMaximum !== undefined && capped < automaticBeforeBurden - penalty) {
      sources.push({ kind: "encumbrance", sourceId: "encumbrance", label: "Over-capacity speed maximum", value: encumbrance.speedMaximum });
    }
    const path = `movement.${kind}`;
    const result = overrideResolver.number(path, Math.max(0, capped), sources, { integer: true, minimum: 0 });
    movement[kind] = result.value;
    trace[path] = result.trace;
  });
  return movement;
}

function calculateSenses(values, overrideResolver, trace) {
  const senses = {};
  SENSE_TYPES.forEach((kind) => {
    const records = values[kind];
    const strongestBase = [...records.base].sort((left, right) =>
      right.value - left.value || left.source.sourceId.localeCompare(right.source.sourceId))[0];
    const automatic = (strongestBase?.value || 0) + records.misc.reduce((sum, item) => sum + item.value, 0);
    const sources = [...(strongestBase ? [strongestBase.source] : []), ...records.misc.map((item) => item.source)];
    const path = `senses.${kind}`;
    const result = overrideResolver.number(path, automatic, sources, { integer: true, minimum: 0 });
    senses[kind] = result.value;
    trace[path] = result.trace;
  });
  return senses;
}

function defenseKind(entry) {
  const explicit = normalized(entry.defense?.kind);
  const explicitKinds = {
    resistances: "resistances",
    immunities: "immunities",
    vulnerabilities: "vulnerabilities",
    conditionimmunities: "conditionImmunities",
  };
  if (explicitKinds[explicit]) return explicitKinds[explicit];
  if (normalized(entry.type) !== "condition") return "";
  const source = `${entry.originalId || ""} ${entry.name || ""}`.toLowerCase();
  if (source.includes("damage_resistance") || /\bresistance\b/.test(source)) return "resistances";
  if (source.includes("condition_immunity")) return "conditionImmunities";
  if (source.includes("damage_immunity") || /\bdamage immunity\b/.test(source)) return "immunities";
  if (source.includes("vulnerability") || /\bvulnerabilit/.test(source)) return "vulnerabilities";
  return "";
}

function defenseName(entry, kind) {
  if (text(entry.defense?.value)) return text(entry.defense.value);
  const idMatch = text(entry.originalId).match(/(?:DAMAGE_RESISTANCE|DAMAGE_IMMUNITY|CONDITION_IMMUNITY|VULNERABILITY)_([A-Z_]+)$/i);
  if (idMatch) return idMatch[1].toLowerCase().split("_").map((part) => part[0].toUpperCase() + part.slice(1)).join(" ");
  return text(entry.name)
    .replace(/^(?:damage )?(?:resistance|immunity|vulnerability)\s*[(:-]?/i, "")
    .replace(/[)]$/, "") || kind;
}

function namedCollections(graph, catalog, overrideResolver, trace) {
  const index = catalogIndex(catalog);
  const sources = { languages: [], proficiencies: [] };
  const defenses = { resistances: [], immunities: [], vulnerabilities: [], conditionImmunities: [] };
  const defenseSources = Object.fromEntries(Object.keys(defenses).map((kind) => [kind, []]));

  graph.activeEntries.forEach((active) => {
    const entry = index.get(active.id);
    if (!entry) return;
    const source = {
      kind: "grant",
      sourceId: entry.id,
      originalId: text(entry.originalId),
      label: text(entry.name) || entry.id,
      value: text(entry.name) || entry.id,
    };
    if (normalized(entry.type) === "language") sources.languages.push(source);
    if (normalized(entry.type) === "proficiency") sources.proficiencies.push(source);
    const kind = defenseKind(entry);
    if (kind) {
      const value = defenseName(entry, kind);
      defenses[kind].push(value);
      defenseSources[kind].push({ ...source, value });
    }
  });
  activeRuleEntries(graph, catalog).forEach(({ entry }) => {
    (Array.isArray(entry.rules?.languages) ? entry.rules.languages : []).forEach((value) => {
      const label = text(value);
      if (label) sources.languages.push({ kind: "rules", sourceId: entry.id, originalId: text(entry.originalId), label: text(entry.name) || entry.id, value: label });
    });
    (Array.isArray(entry.rules?.proficiencies) ? entry.rules.proficiencies : []).forEach((value) => {
      const label = text(value);
      if (label) sources.proficiencies.push({ kind: "rules", sourceId: entry.id, originalId: text(entry.originalId), label: text(entry.name) || entry.id, value: label });
    });
  });

  const result = {};
  ["languages", "proficiencies"].forEach((path) => {
    const automatic = [...new Set(sources[path].map((source) => source.value))]
      .sort((left, right) => left.localeCompare(right));
    const applied = overrideResolver.stringList(path, automatic, sources[path]);
    result[path] = applied.value;
    trace[path] = applied.trace;
  });
  Object.keys(defenses).forEach((kind) => {
    const automatic = [...new Set(defenses[kind])].sort((left, right) => left.localeCompare(right));
    const path = `defenses.${kind}`;
    const applied = overrideResolver.stringList(path, automatic, defenseSources[kind]);
    defenses[kind] = applied.value;
    trace[path] = applied.trace;
  });
  return { ...result, defenses };
}

export function isDurabilityStatRule(record) {
  const name = normalized(record?.rule?.name);
  return ["hp", "additional:hp:max", "ac", "ac:misc", "initiative", "initiative:misc"].includes(name)
    || /^(?:innate )?speed(?::(?:fly|climb|swim|burrow))?(?::misc)?$/.test(name)
    || /^(?:darkvision|blindsight|tremorsense|truesight):range(?::misc)?$/.test(name)
    || /^ac:/.test(name);
}

export function calculateDurabilityCharacterValues({
  document,
  graph,
  catalog,
  core,
  runtime,
  overrideResolver,
  inventory,
  extraStatRecords = [],
}) {
  const warnings = warningCollector();
  const trace = {};
  const bodyArmorType = normalized(inventory?.armor?.bodyArmorType);
  const bodyArmorEquipped = Boolean(bodyArmorType);
  const shieldEquipped = inventory?.armor?.hasShield === true;
  const armorEquipped = bodyArmorEquipped || shieldEquipped;
  const records = [...collectApplicableStatRules({ graph, catalog, warnings }), ...extraStatRecords]
    .map((record) => {
      if (!text(record.rule?.equipped) || record.equipmentResolved !== undefined) return record;
      const condition = normalized(record.rule.equipped);
      return {
        ...record,
        equipmentResolved: condition === "armor" ? armorEquipped
          : condition === "no-armor" ? !armorEquipped
            : condition === "no-body-armor" ? !bodyArmorEquipped
              : condition === "no-heavy-armor" ? bodyArmorType !== "heavy" : false,
      };
    });
  const classified = classifyRules(records, core, warnings);
  const hpResult = hitPoints(
    document,
    catalog,
    core,
    runtime,
    classified.hp,
    overrideResolver,
    warnings,
    trace,
  );

  const groupedAc = new Map();
  const ungroupedAc = [];
  classified.ac.forEach((item) => {
    if (!item.stackingGroup) {
      ungroupedAc.push(item);
      return;
    }
    const current = groupedAc.get(item.stackingGroup);
    if (!current || (item.stacking !== "first" && item.value > current.value)) groupedAc.set(item.stackingGroup, item);
  });
  const appliedAc = [...ungroupedAc, ...groupedAc.values()];
  const acSources = [...(inventory?.armor?.sources || [{ kind: "base", sourceId: "rules.ac", label: "Unarmored AC base", value: 10 }, {
    kind: "ability",
    sourceId: "stats.dex.modifier",
    label: "Dexterity modifier",
    value: core.stats.dex.modifier,
  }]), ...appliedAc.map((item) => item.source)];
  const acResult = overrideResolver.number(
    "ac",
    acSources.reduce((sum, source) => sum + source.value, 0),
    acSources,
    { integer: true, minimum: 0 },
  );
  trace.ac = acResult.trace;

  const initiativeSources = [{
    kind: "ability",
    sourceId: "stats.dex.modifier",
    label: "Dexterity modifier",
    value: core.stats.dex.modifier,
  }, ...classified.initiative.map((item) => item.source)];
  const initiativeResult = overrideResolver.number(
    "initiative",
    initiativeSources.reduce((sum, source) => sum + source.value, 0),
    initiativeSources,
    { integer: true },
  );
  trace.initiative = initiativeResult.trace;

  return {
    ...hpResult,
    ac: acResult.value,
    initiative: initiativeResult.value,
    movement: calculateMovement(classified.movement, overrideResolver, trace, inventory?.encumbrance),
    senses: calculateSenses(classified.senses, overrideResolver, trace),
    ...namedCollections(graph, catalog, overrideResolver, trace),
    trace,
    warnings: warnings.sorted(),
  };
}
