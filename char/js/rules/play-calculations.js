// Projects rules-ready feature actions/resources and mutable play conditions.
import { activeRuleEntries } from "./active-rules.js";
const ACTION_TYPES = new Map([
  ["action", "Action"],
  ["attack", "Action"],
  ["bonus action", "Bonus Action"],
  ["reaction", "Reaction"],
  ["free action", "Free Action"],
  ["other", "Other"],
]);

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalized(value) {
  return text(value).toLowerCase().replaceAll(/\s+/g, " ");
}

function entries(catalog) {
  return Array.isArray(catalog) ? catalog : Array.isArray(catalog?.entries) ? catalog.entries : [];
}

function indexCatalog(catalog) {
  return new Map(entries(catalog).filter((entry) => entry?.id).map((entry) => [entry.id, entry]));
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

function finiteInteger(value) {
  if (value === "" || value === null || value === undefined || typeof value === "boolean") return null;
  const number = Number(value);
  return Number.isInteger(number) ? number : null;
}

function expressionValue(expression, core) {
  const direct = finiteInteger(expression);
  if (direct !== null) return direct;
  if (expression && typeof expression === "object") {
    if (expression.type === "table") {
      const level = Number(expression.level === "class" ? core.level : core.level);
      return finiteInteger(expression.values?.[level]);
    }
    if (expression.type === "ability-modifier") {
      const aliases = {
        strength: "str", dexterity: "dex", constitution: "con",
        intelligence: "int", wisdom: "wis", charisma: "cha",
      };
      const ability = aliases[normalized(expression.ability)] || normalized(expression.ability);
      const modifier = finiteInteger(core.stats[ability]?.modifier);
      if (modifier === null) return null;
      const minimum = finiteInteger(expression.minimum);
      return minimum === null ? modifier : Math.max(minimum, modifier);
    }
    return null;
  }
  const value = normalized(expression).replace(/^\{\{/, "").replace(/\}\}$/, "");
  const number = finiteInteger(value);
  if (number !== null) return number;
  if (value === "level") return core.level;
  if (value === "proficiency") return core.proficiency;
  const match = value.match(/^(strength|dexterity|constitution|intelligence|wisdom|charisma|str|dex|con|int|wis|cha):modifier$/);
  if (!match) return null;
  const aliases = {
    strength: "str", dexterity: "dex", constitution: "con",
    intelligence: "int", wisdom: "wis", charisma: "cha",
  };
  return core.stats[aliases[match[1]] || match[1]]?.modifier ?? null;
}

function tableText(value, level) {
  if (value && typeof value === "object" && value.type === "table") {
    return text(value.values?.[level]);
  }
  return text(value);
}

function parsedUsage(entry, core) {
  const usage = text(entry.sheetAttributes?.usage);
  if (!usage) return { status: "none", usage };
  const match = usage.match(/^(.+?)\/(Short Rest|Long Rest|Short or Long Rest|Turn|Day)$/i);
  if (!match) return { status: "unsupported", usage };
  const maximum = expressionValue(match[1], core);
  if (maximum === null || maximum < 1) return { status: "unsupported", usage };
  const resetLabel = normalized(match[2]);
  const reset = resetLabel === "short rest" || resetLabel === "short or long rest" ? "short"
    : resetLabel === "turn" ? "turn"
      : resetLabel === "day" ? "day" : "long";
  return { status: "supported", usage, maximum, reset };
}

function runtimeUses(runtime) {
  return new Map((Array.isArray(runtime?.uses) ? runtime.uses : [])
    .filter((item) => item && text(item.id))
    .map((item) => [item.id, item]));
}

function currentUses(saved, maximum) {
  const number = finiteInteger(saved?.current);
  return number === null ? maximum : Math.max(0, Math.min(maximum, number));
}

function source(entry, value) {
  return {
    kind: "rules",
    sourceId: entry.id,
    originalId: text(entry.originalId),
    label: text(entry.name) || entry.id,
    value,
  };
}

function runtimeConditions(runtime, warnings) {
  if (runtime?.conditions !== undefined && !Array.isArray(runtime.conditions)) warnings.add({
    code: "invalid-runtime-state",
    path: "runtime.conditions",
    blocking: false,
    message: "Runtime conditions must be a list; invalid state was ignored.",
  });
  const conditions = new Map();
  (Array.isArray(runtime?.conditions) ? runtime.conditions : []).forEach((candidate, index) => {
    const item = typeof candidate === "string" ? { id: normalized(candidate).replaceAll(/[^a-z0-9]+/g, "-"), name: text(candidate) }
      : candidate && typeof candidate === "object" ? { ...candidate } : null;
    const name = text(item?.name) || text(item?.id);
    const id = text(item?.id) || normalized(name).replaceAll(/[^a-z0-9]+/g, "-");
    if (!name || !id) {
      warnings.add({
        code: "invalid-runtime-state",
        path: `runtime.conditions.${index}`,
        blocking: false,
        message: "Runtime condition needs an ID or name and was ignored.",
      });
      return;
    }
    if (!conditions.has(id)) conditions.set(id, { ...item, id, name });
  });
  return [...conditions.values()].sort((left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id));
}

function runtimeConcentration(runtime, warnings) {
  if (!runtime?.concentration) return null;
  const candidate = typeof runtime.concentration === "string"
    ? { name: text(runtime.concentration) }
    : runtime.concentration && typeof runtime.concentration === "object" ? { ...runtime.concentration } : null;
  const name = text(candidate?.name) || text(candidate?.id);
  if (!name) {
    warnings.add({
      code: "invalid-runtime-state",
      path: "runtime.concentration",
      blocking: false,
      message: "Runtime concentration needs an ID or name and was ignored.",
    });
    return null;
  }
  return { ...candidate, id: text(candidate.id) || normalized(name).replaceAll(/[^a-z0-9]+/g, "-"), name };
}

export function isPlayStatRule(record) {
  const usage = text(record?.entry?.sheetAttributes?.usage);
  const name = text(record?.rule?.name);
  return Boolean(usage && name && usage.includes(`{{${name}}}`));
}

export function calculatePlayCharacterValues({ graph, catalog, core, runtime, overrideResolver }) {
  const index = indexCatalog(catalog);
  const warnings = warningCollector();
  const savedUses = runtimeUses(runtime);
  const actions = [];
  const resources = [];
  const trace = {};

  const ruleEntries = activeRuleEntries(graph, catalog);
  ruleEntries.forEach(({ entry }) => index.set(entry.id, entry));
  ruleEntries.forEach(({ entry, active }) => {
    if (!entry || entry.automation?.status !== "rules-ready") return;
    const actionLabel = text(entry.sheetAttributes?.action);
    const usage = parsedUsage(entry, core);
    const resourceId = `rule-resource:${entry.id}`;
    let uses = null;
    if (usage.status === "supported") {
      const maximumResult = overrideResolver.number(
        `resources.${resourceId}.max`,
        usage.maximum,
        [source(entry, usage.maximum)],
        { integer: true, minimum: 1 },
      );
      const current = currentUses(savedUses.get(resourceId), maximumResult.value);
      uses = { current, max: maximumResult.value, reset: usage.reset };
      resources.push({
        id: resourceId,
        definitionId: entry.id,
        name: text(entry.name) || entry.id,
        category: text(entry.type) || "Feature",
        action: ACTION_TYPES.get(normalized(actionLabel)) || "Other",
        uses: { ...uses },
        description: text(entry.sheet) || text(entry.summary) || text(entry.description),
      });
      trace[`resources.${resourceId}.max`] = maximumResult.trace;
      trace[`resources.${resourceId}.current`] = {
        value: current,
        sources: [{
          kind: savedUses.has(resourceId) ? "runtime" : "default",
          sourceId: savedUses.has(resourceId) ? `runtime.uses.${resourceId}` : `resources.${resourceId}.max`,
          label: `${entry.name || entry.id} remaining uses`,
          value: current,
        }],
      };
    } else if (usage.status === "unsupported") {
      warnings.add({
        code: "unsupported-rule-expression",
        path: `catalog.${entry.id}.sheetAttributes.usage`,
        entryId: entry.id,
        sourceId: entry.id,
        blocking: true,
        message: `${entry.name || entry.id} has unsupported usage automation: ${usage.usage}.`,
      });
    }

    if (!actionLabel) return;
    const action = ACTION_TYPES.get(normalized(actionLabel));
    if (!action) {
      warnings.add({
        code: "unsupported-rule-expression",
        path: `catalog.${entry.id}.sheetAttributes.action`,
        entryId: entry.id,
        sourceId: entry.id,
        blocking: true,
        message: `${entry.name || entry.id} has unsupported action type ${actionLabel}.`,
      });
      return;
    }
    actions.push({
      id: `rule-action:${entry.id}`,
      definitionId: entry.id,
      name: text(entry.name) || entry.id,
      category: normalized(actionLabel) === "attack" ? "Attack" : text(entry.type) || "Feature",
      action,
      range: text(entry.sheetAttributes?.range),
      attack: text(entry.sheetAttributes?.attack),
      damage: text(entry.sheetAttributes?.damage),
      description: text(entry.sheet) || text(entry.summary) || text(entry.description),
      usage: usage.usage,
      ...(uses ? { resourceId, uses: { ...uses } } : {}),
    });

    void active;
  });

  ruleEntries.forEach(({ entry, active }) => {
    const resourceDefinitions = Array.isArray(entry.rules?.resources) ? entry.rules.resources : [];
    resourceDefinitions.forEach((rule, ruleIndex) => {
      if (active.level < (finiteInteger(rule.level) || 1)) return;
      if (finiteInteger(rule.maximumLevel) !== null && active.level > finiteInteger(rule.maximumLevel)) return;
      const maximum = expressionValue(rule.max, { ...core, level: active.level });
      if (maximum === null || maximum < 1 || !text(rule.id)) {
        warnings.add({ code: "unsupported-rule-expression", path: `catalog.${entry.id}.rules.resources.${ruleIndex}`, entryId: entry.id, sourceId: entry.id, blocking: true, message: `${entry.name || entry.id} has an invalid resource rule.` });
        return;
      }
      const resourceId = `rule-resource:${entry.id}:${rule.id}`;
      const maximumResult = overrideResolver.number(`resources.${resourceId}.max`, maximum, [source(entry, maximum)], { integer: true, minimum: 1 });
      const current = currentUses(savedUses.get(resourceId), maximumResult.value);
      const uses = {
        current,
        max: maximumResult.value,
        reset: tableText(rule.reset, active.level) || "long",
        ...(rule.recovery ? { recovery: rule.recovery } : {}),
      };
      const die = tableText(rule.die, active.level);
      resources.push({ id: resourceId, definitionId: entry.id, name: text(rule.name) || rule.id, category: text(rule.category) || "Feature", action: text(rule.action) || "Other", uses, ...(die ? { die } : {}), description: text(rule.description) });
      trace[`resources.${resourceId}.max`] = maximumResult.trace;
      trace[`resources.${resourceId}.current`] = { value: current, sources: [{ kind: savedUses.has(resourceId) ? "runtime" : "default", sourceId: savedUses.has(resourceId) ? `runtime.uses.${resourceId}` : `resources.${resourceId}.max`, label: `${text(rule.name) || rule.id} remaining uses`, value: current }] };
    });

    (Array.isArray(entry.rules?.actions) ? entry.rules.actions : []).forEach((rule, ruleIndex) => {
      if (active.level < (finiteInteger(rule.level) || 1)) return;
      const action = ACTION_TYPES.get(normalized(rule.action));
      if (!action || !text(rule.id)) {
        warnings.add({ code: "unsupported-rule-expression", path: `catalog.${entry.id}.rules.actions.${ruleIndex}`, entryId: entry.id, sourceId: entry.id, blocking: true, message: `${entry.name || entry.id} has an invalid action rule.` });
        return;
      }
      const resourceSourceId = text(rule.resourceSourceId) || entry.id;
      const resourceId = text(rule.resourceId) ? `rule-resource:${resourceSourceId}:${rule.resourceId}` : "";
      const resource = resources.find((item) => item.id === resourceId);
      actions.push({
        id: `rule-action:${entry.id}:${rule.id}`,
        definitionId: entry.id,
        name: text(rule.name) || rule.id,
        category: text(rule.category) || "Feature",
        action,
        range: text(rule.range),
        attack: text(rule.attack),
        damage: tableText(rule.damage, active.level),
        healing: tableText(rule.healing, active.level),
        description: text(rule.description),
        ...(resource ? { resourceId, uses: { ...resource.uses }, ...(resource.die ? { die: resource.die } : {}) } : {}),
      });
    });
  });

  actions.sort((left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id));
  resources.sort((left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id));
  trace.actions = { value: actions, sources: actions.map((action) => source(index.get(action.definitionId), action.id)) };
  trace.resources = { value: resources, sources: resources.map((resource) => source(index.get(resource.definitionId), resource.id)) };

  const conditions = runtimeConditions(runtime, warnings);
  const concentration = runtimeConcentration(runtime, warnings);
  const exhaustionNumber = finiteInteger(runtime?.exhaustion);
  if (runtime?.exhaustion !== undefined && (exhaustionNumber === null || exhaustionNumber < 0 || exhaustionNumber > 6)) warnings.add({
    code: "invalid-runtime-state",
    path: "runtime.exhaustion",
    blocking: false,
    message: "Runtime exhaustion must be a whole number from 0 through 6; it was clamped.",
  });
  const exhaustion = Math.max(0, Math.min(6, exhaustionNumber || 0));
  const inspiration = runtime?.inspiration === true;
  trace.conditions = { value: conditions, sources: conditions.map((condition) => ({
    kind: "runtime", sourceId: `runtime.conditions.${condition.id}`, label: condition.name, value: condition.id,
  })) };
  trace.concentration = { value: concentration, sources: concentration ? [{
    kind: "runtime", sourceId: "runtime.concentration", label: concentration.name, value: concentration.id,
  }] : [] };
  trace.exhaustion = { value: exhaustion, sources: exhaustion ? [{
    kind: "runtime", sourceId: "runtime.exhaustion", label: "Exhaustion", value: exhaustion,
  }] : [] };
  trace.inspiration = { value: inspiration, sources: inspiration ? [{
    kind: "runtime", sourceId: "runtime.inspiration", label: "Heroic Inspiration", value: true,
  }] : [] };

  return { actions, resources, conditions, concentration, exhaustion, inspiration, trace, warnings: warnings.sorted() };
}
