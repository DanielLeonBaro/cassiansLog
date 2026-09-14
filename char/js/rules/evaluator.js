// Builds the non-numeric Character rules graph: roots, grants, choices, and validation.
import { normalizeCharacterDocument } from "../model.js";
import { evaluateIdRequirement, evaluatePrerequisite } from "./requirements.js";

const COMPATIBLE_SHARED_RULESETS = new Set(["agnostic"]);

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalized(value) {
  return text(value).toLowerCase();
}

function listFromCatalog(catalog) {
  if (Array.isArray(catalog)) return catalog;
  return Array.isArray(catalog?.entries) ? catalog.entries : [];
}

function positiveInteger(value, fallback = 1) {
  const number = Math.trunc(Number(value));
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function isTrue(value) {
  return value === true || normalized(value) === "true";
}

function selectedValues(value) {
  let values = value;
  if (value && typeof value === "object" && !Array.isArray(value)) {
    values = value.selectedIds ?? value.values ?? value.selected ?? [];
  }
  if (!Array.isArray(values)) values = values === undefined || values === null ? [] : [values];
  return values.map((item) => text(String(item))).filter(Boolean);
}

function createCatalogIndex(catalog) {
  const entries = listFromCatalog(catalog).filter((entry) => entry && typeof entry === "object" && text(entry.id));
  const byId = new Map();
  const byReference = new Map();
  entries.forEach((entry) => {
    if (!byId.has(entry.id)) byId.set(entry.id, entry);
    if (!byReference.has(entry.id)) byReference.set(entry.id, entry);
    if (text(entry.originalId) && !byReference.has(entry.originalId)) byReference.set(entry.originalId, entry);
  });
  return { entries, byId, byReference };
}

function entryAliases(entry) {
  return [text(entry?.id), text(entry?.originalId)].filter(Boolean);
}

function activeAliases(activeIds, byId, extraEntries = []) {
  const aliases = new Set();
  activeIds.forEach((id) => entryAliases(byId.get(id)).forEach((alias) => aliases.add(alias)));
  extraEntries.forEach((entry) => entryAliases(entry).forEach((alias) => aliases.add(alias)));
  return aliases;
}

function automationStatus(entry) {
  const status = entry?.automation?.status;
  return ["rules-ready", "partial", "manual"].includes(status) ? status : "manual";
}

function staticAvailability(entry, build) {
  const entryRuleset = text(entry?.ruleset) || "unknown";
  if (entryRuleset !== "unknown"
    && entryRuleset !== build.ruleset
    && !COMPATIBLE_SHARED_RULESETS.has(entryRuleset)) {
    return { available: false, reason: "ruleset-mismatch" };
  }
  const enabledSources = build.preferences.enabledSources.map(normalized);
  if (enabledSources.length) {
    const sources = [entry.source, entry.publication, entry.publisher].map(normalized).filter(Boolean);
    if (!sources.some((source) => enabledSources.includes(source))) {
      return { available: false, reason: "source-unavailable" };
    }
  }
  return { available: true, reason: entryRuleset === "unknown" ? "unknown-ruleset" : "" };
}

function sourceLevelFor(entry, context, totalLevel) {
  if (["class", "archetype"].includes(normalized(entry?.type))) return context.level;
  return context.classId ? context.level : totalLevel;
}

function supportsTags(entry) {
  return new Set([
    entry.id,
    entry.originalId,
    entry.name,
    entry.type,
    ...text(entry.supports).split(","),
  ].map(normalized).filter(Boolean));
}

function matchesSupportGroup(entry, group) {
  const tags = supportsTags(entry);
  return group
    .replaceAll(/[()]/g, "")
    .split(",")
    .map(text)
    .filter(Boolean)
    .every((token) => token.startsWith("!")
      ? !tags.has(normalized(token.slice(1)))
      : tags.has(normalized(token)));
}

function explicitSupportReferences(value) {
  const cleaned = text(value).replaceAll(/[()]/g, "");
  if (!cleaned || cleaned.includes(",")) return null;
  const references = cleaned.split(/\|+/).map(text).filter(Boolean);
  return references.length && references.every((reference) => /^ID_/i.test(reference))
    ? references
    : null;
}

function optionsForSelection(selection, catalogIndex) {
  if (Array.isArray(selection.items) && selection.items.length) {
    return selection.items
      .map((item) => ({
        id: text(String(item?.id ?? "")),
        label: text(item?.label) || text(String(item?.id ?? "")),
        kind: "list-item",
        available: true,
      }))
      .filter((item) => item.id);
  }

  const explicitReferences = explicitSupportReferences(selection.supports);
  if (explicitReferences) {
    return explicitReferences.map((reference) => {
      const entry = catalogIndex.byReference.get(reference);
      return entry ? {
        id: entry.id,
        originalId: text(entry.originalId),
        label: text(entry.name) || entry.id,
        kind: "entry",
        entry,
        prerequisite: text(entry.prerequisite),
        available: true,
      } : {
        id: reference,
        originalId: reference,
        label: reference,
        kind: "entry",
        entry: null,
        available: false,
        unavailableReason: "unresolved-reference",
      };
    });
  }

  const expectedType = normalized(selection.type);
  const groups = text(selection.supports).split("||").map(text).filter(Boolean);
  return catalogIndex.entries
    .filter((entry) => !expectedType || normalized(entry.type) === expectedType)
    .filter((entry) => !groups.length || groups.some((group) => matchesSupportGroup(entry, group)))
    .map((entry) => ({
      id: entry.id,
      originalId: text(entry.originalId),
      label: text(entry.name) || entry.id,
      kind: "entry",
      entry,
      prerequisite: text(entry.prerequisite),
      available: true,
    }))
    .sort((left, right) => left.label.localeCompare(right.label) || left.id.localeCompare(right.id));
}

function optionLookup(options) {
  const lookup = new Map();
  options.forEach((option) => {
    if (!lookup.has(option.id)) lookup.set(option.id, option);
    if (option.originalId && !lookup.has(option.originalId)) lookup.set(option.originalId, option);
  });
  return lookup;
}

export function characterChoiceKey(entryId, selectionIndex) {
  return `${entryId}:selection:${selectionIndex}`;
}

function warningCollector() {
  const warnings = new Map();
  return {
    add(warning) {
      const key = [warning.code, warning.path, warning.entryId, warning.sourceId, warning.choiceKey].join("|");
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

function addCandidate(candidates, queue, entry, context, via) {
  if (!entry) return;
  const current = candidates.get(entry.id);
  if (!current || context.level > current.context.level) {
    candidates.set(entry.id, { entry, context, via });
    queue.push(entry.id);
  }
}

function classLevelIndex(levels, catalogIndex) {
  const index = new Map();
  levels.forEach((level) => {
    const entry = catalogIndex.byReference.get(level.classId);
    if (!entry) return;
    const current = index.get(entry.id) || 0;
    const combined = current + positiveInteger(level.level);
    [entry.id, entry.originalId, entry.name].map(normalized).filter(Boolean)
      .forEach((key) => index.set(key, combined));
  });
  return index;
}

function dynamicEntryRequirement(entry, context, activeIds, activeEntries, classLevels, enforcePrerequisites = true) {
  const requirements = evaluateIdRequirement(entry.requirements, activeIds);
  if (requirements.status !== "met") return { ...requirements, field: "requirements" };
  if (!enforcePrerequisites) return { status: "met" };
  const prerequisite = evaluatePrerequisite(entry.prerequisite, {
    activeIds,
    activeEntries,
    classLevels,
    level: context.level,
  });
  return prerequisite.status === "met"
    ? { status: "met" }
    : { ...prerequisite, field: "prerequisite" };
}

function choiceDraft(source, selection, selectionIndex, build, catalogIndex, context) {
  const key = characterChoiceKey(source.id, selectionIndex);
  const values = selectedValues(build.selections[key]);
  const options = optionsForSelection(selection, catalogIndex).map((option) => {
    if (!option.entry) return option;
    const availability = staticAvailability(option.entry, build);
    return availability.available ? option : {
      ...option,
      available: false,
      unavailableReason: availability.reason,
    };
  });
  const lookup = optionLookup(options);
  const duplicateValues = [...new Set(values.filter((value, index) => values.indexOf(value) !== index))];
  const uniqueValues = [...new Set(values)];
  const selectedOptions = uniqueValues.map((value) => ({ value, option: lookup.get(value) || null }));
  const invalidValues = selectedOptions.filter(({ option }) => !option?.available).map(({ value }) => value);
  const maximum = positiveInteger(selection.number);
  const minimum = isTrue(selection.optional) ? 0 : maximum;
  const acceptedOptions = selectedOptions
    .filter(({ option }) => option?.available)
    .slice(0, maximum)
    .map(({ option }) => option);
  return {
    key,
    sourceId: source.id,
    sourceOriginalId: text(source.originalId),
    index: selectionIndex,
    name: text(selection.name) || `${text(selection.type) || "Choice"} ${selectionIndex + 1}`,
    type: text(selection.type),
    minimum,
    maximum,
    optional: minimum === 0,
    minimumLevel: positiveInteger(selection.level),
    requirements: text(selection.requirements),
    supports: text(selection.supports),
    context,
    options,
    selectedValues: values,
    selectedOptions,
    acceptedOptions,
    duplicateValues,
    invalidValues,
    overflow: Math.max(0, selectedOptions.filter(({ option }) => option?.available).length - maximum),
  };
}

function buildPotentialGraph(roots, build, catalogIndex, totalLevel) {
  const candidates = new Map();
  const queue = [];
  const grants = [];
  const choices = new Map();
  roots.forEach((root) => {
    if (root.entry) addCandidate(candidates, queue, root.entry, root.context, { kind: "root", path: root.path });
  });

  const processedLevels = new Map();
  while (queue.length) {
    const sourceId = queue.shift();
    const candidate = candidates.get(sourceId);
    if (!candidate || processedLevels.get(sourceId) >= candidate.context.level) continue;
    processedLevels.set(sourceId, candidate.context.level);
    const { entry: source, context } = candidate;
    if (automationStatus(source) !== "rules-ready") continue;
    const rules = source.rules && typeof source.rules === "object" ? source.rules : {};
    const effectiveLevel = sourceLevelFor(source, context, totalLevel);

    (Array.isArray(rules.grants) ? rules.grants : []).forEach((grant, index) => {
      const reference = text(grant?.id);
      const target = catalogIndex.byReference.get(reference) || null;
      const record = {
        key: `${source.id}:grant:${index}`,
        sourceId: source.id,
        sourceOriginalId: text(source.originalId),
        targetId: target?.id || "",
        targetOriginalId: text(target?.originalId) || reference,
        type: text(grant?.type),
        spellcasting: text(grant?.spellcasting),
        known: grant?.known,
        prepared: grant?.prepared,
        ritual: grant?.ritual,
        withoutSlot: grant?.withoutSlot,
        minimumLevel: positiveInteger(grant?.level),
        requirements: text(grant?.requirements),
        context: { ...context, level: effectiveLevel },
      };
      grants.push(record);
      if (target) addCandidate(candidates, queue, target, record.context, { kind: "grant", sourceId: source.id });
    });

    (Array.isArray(rules.selections) ? rules.selections : []).forEach((selection, index) => {
      const choice = choiceDraft(source, selection, index, build, catalogIndex, {
        ...context,
        level: effectiveLevel,
      });
      choices.set(choice.key, choice);
      choice.acceptedOptions.forEach((option) => {
        if (option.entry) addCandidate(candidates, queue, option.entry, choice.context, {
          kind: "selection",
          sourceId: source.id,
          choiceKey: choice.key,
        });
      });
    });
  }
  return { candidates, grants, choices: [...choices.values()] };
}

function edgeRequirement(expression, activeIds) {
  return evaluateIdRequirement(expression, activeIds);
}

function choiceCountState(choice) {
  const acceptedCount = choice.acceptedOptions.length;
  if (choice.invalidValues.length || choice.duplicateValues.length || choice.overflow) return "invalid";
  if (acceptedCount < choice.minimum) return "incomplete";
  return "complete";
}

function calculateActiveSet({ roots, graph, build, catalogIndex, classLevels, totalLevel }) {
  let active = new Set();
  const eligibleRootEntries = roots
    .filter((root) => root.entry && staticAvailability(root.entry, build).available)
    .map((root) => root.entry);
  const seen = new Set();
  let cycled = false;

  for (let iteration = 0; iteration <= graph.candidates.size + 2; iteration += 1) {
    const aliases = activeAliases(active, catalogIndex.byId, eligibleRootEntries);
    const activeEntries = [...active].map((id) => catalogIndex.byId.get(id)).filter(Boolean);
    const next = new Set();

    roots.forEach((root) => {
      if (!root.entry || !staticAvailability(root.entry, build).available) return;
      const requirement = dynamicEntryRequirement(
        root.entry,
        root.context,
        aliases,
        activeEntries,
        classLevels,
        build.preferences.prerequisites,
      );
      if (requirement.status === "met") next.add(root.entry.id);
    });

    graph.grants.forEach((grant) => {
      if (!active.has(grant.sourceId) || grant.context.level < grant.minimumLevel || !grant.targetId) return;
      if (edgeRequirement(grant.requirements, aliases).status !== "met") return;
      const target = catalogIndex.byId.get(grant.targetId);
      if (!target || !staticAvailability(target, build).available) return;
      const targetRequirement = dynamicEntryRequirement(
        target,
        grant.context,
        aliases,
        activeEntries,
        classLevels,
        build.preferences.prerequisites,
      );
      if (targetRequirement.status === "met") next.add(target.id);
    });

    graph.choices.forEach((choice) => {
      if (!active.has(choice.sourceId) || choice.context.level < choice.minimumLevel) return;
      if (edgeRequirement(choice.requirements, aliases).status !== "met") return;
      choice.acceptedOptions.forEach((option) => {
        if (!option.entry) return;
        if (!staticAvailability(option.entry, build).available) return;
        const targetRequirement = dynamicEntryRequirement(
          option.entry,
          choice.context,
          aliases,
          activeEntries,
          classLevels,
          build.preferences.prerequisites,
        );
        if (targetRequirement.status === "met") next.add(option.entry.id);
      });
    });

    const signature = [...next].sort().join("|");
    const previousSignature = [...active].sort().join("|");
    if (signature === previousSignature) return { active, cycled };
    if (seen.has(signature)) {
      cycled = true;
      return { active: next, cycled };
    }
    seen.add(signature);
    active = next;
  }
  return { active, cycled: true };
}

function rootDefinitions(build, catalogIndex) {
  const roots = [];
  build.levels.forEach((level, index) => {
    const context = { level: positiveInteger(level.level), classId: text(level.classId) };
    [["class", level.classId], ["subclass", level.subclassId]].forEach(([kind, reference]) => {
      if (!reference) return;
      roots.push({
        kind,
        path: `build.levels.${index}.${kind}Id`,
        reference,
        entry: catalogIndex.byReference.get(reference) || null,
        context,
      });
    });
  });
  [["species", "build.speciesId", build.speciesId], ["background", "build.backgroundId", build.backgroundId]]
    .forEach(([kind, path, reference]) => {
      if (!reference) return;
      roots.push({
        kind,
        path,
        reference,
        entry: catalogIndex.byReference.get(reference) || null,
        context: { level: 0, classId: "" },
      });
    });
  return roots;
}

function grantStatus(grant, active, aliases, activeEntries, build, catalogIndex, classLevels) {
  if (!active.has(grant.sourceId)) return "source-inactive";
  if (grant.context.level < grant.minimumLevel) return "level-gated";
  const requirement = edgeRequirement(grant.requirements, aliases);
  if (requirement.status === "unsupported") return "requirements-unsupported";
  if (requirement.status === "unmet") return "requirements-unmet";
  if (!grant.targetId) return "unresolved-reference";
  const target = catalogIndex.byId.get(grant.targetId);
  const availability = staticAvailability(target, build);
  if (!availability.available) return availability.reason;
  const targetRequirement = dynamicEntryRequirement(
    target,
    grant.context,
    aliases,
    activeEntries,
    classLevels,
    build.preferences.prerequisites,
  );
  if (targetRequirement.status === "unsupported") return "prerequisite-unsupported";
  if (targetRequirement.status === "unmet") return "prerequisite-unmet";
  return active.has(grant.targetId) ? "applied" : "inactive";
}

function choiceStatus(choice, active, aliases) {
  if (!active.has(choice.sourceId)) return { status: "unavailable", unavailableReason: "source-inactive" };
  if (choice.context.level < choice.minimumLevel) return { status: "unavailable", unavailableReason: "level-gated" };
  const requirement = edgeRequirement(choice.requirements, aliases);
  if (requirement.status === "unsupported") return { status: "unavailable", unavailableReason: "requirements-unsupported" };
  if (requirement.status === "unmet") return { status: "unavailable", unavailableReason: "requirements-unmet" };
  return { status: choiceCountState(choice), unavailableReason: "" };
}

export function evaluateCharacterBuild({ character, catalog } = {}) {
  const document = normalizeCharacterDocument(character);
  const { build } = document;
  const catalogIndex = createCatalogIndex(catalog);
  const warnings = warningCollector();
  if (build.mode !== "rules") {
    return { ruleset: build.ruleset, roots: [], activeEntries: [], grants: [], choices: [], warnings: [] };
  }

  const totalLevel = build.levels.reduce((sum, level) => sum + positiveInteger(level.level), 0);
  const classLevels = classLevelIndex(build.levels, catalogIndex);
  const roots = rootDefinitions(build, catalogIndex).map((root) => ({
    ...root,
    context: { ...root.context, level: root.kind === "class" || root.kind === "subclass" ? root.context.level : totalLevel },
  }));
  const graph = buildPotentialGraph(roots, build, catalogIndex, totalLevel);
  const calculated = calculateActiveSet({ roots, graph, build, catalogIndex, classLevels, totalLevel });
  const { active } = calculated;
  const aliases = activeAliases(active, catalogIndex.byId);
  const activeEntries = [...active].map((id) => catalogIndex.byId.get(id)).filter(Boolean);

  roots.forEach((root) => {
    if (!root.entry) {
      warnings.add({
        code: "unresolved-reference",
        path: root.path,
        entryId: root.reference,
        blocking: true,
        message: `No Compendium entry resolves ${root.reference}.`,
      });
      return;
    }
    const availability = staticAvailability(root.entry, build);
    if (!availability.available) {
      warnings.add({
        code: availability.reason,
        path: root.path,
        entryId: root.entry.id,
        blocking: true,
        message: `${root.entry.name || root.entry.id} is unavailable for this build.`,
      });
      return;
    }
    const requirement = dynamicEntryRequirement(
      root.entry,
      root.context,
      aliases,
      activeEntries,
      classLevels,
      build.preferences.prerequisites,
    );
    if (requirement.status !== "met") {
      warnings.add({
        code: requirement.status === "unsupported" ? "unsupported-rule-expression" : "unmet-prerequisite",
        path: `${root.path}.${requirement.field}`,
        entryId: root.entry.id,
        blocking: true,
        message: requirement.status === "unsupported"
          ? `Prerequisite automation is unsupported for ${root.entry.name || root.entry.id}.`
          : `${root.entry.name || root.entry.id} has an unmet prerequisite.`,
      });
    }
  });

  activeEntries.forEach((entry) => {
    const status = automationStatus(entry);
    if (status !== "rules-ready") {
      warnings.add({
        code: status === "partial" ? "partial-automation" : "manual-automation",
        path: `catalog.${entry.id}`,
        entryId: entry.id,
        blocking: false,
        message: `${entry.name || entry.id} does not have complete rules automation.`,
      });
    }
    if (staticAvailability(entry, build).reason === "unknown-ruleset") {
      warnings.add({
        code: "unknown-ruleset",
        path: `catalog.${entry.id}.ruleset`,
        entryId: entry.id,
        blocking: false,
        message: `${entry.name || entry.id} has no confirmed ruleset.`,
      });
    }
  });

  const grants = graph.grants.map((grant) => {
    const status = grantStatus(grant, active, aliases, activeEntries, build, catalogIndex, classLevels);
    if (status === "unresolved-reference") {
      warnings.add({
        code: "unresolved-reference",
        path: `catalog.${grant.sourceId}.rules.grants`,
        entryId: grant.targetOriginalId,
        sourceId: grant.sourceId,
        blocking: true,
        message: `Grant from ${grant.sourceId} cannot resolve ${grant.targetOriginalId}.`,
      });
    } else if (["requirements-unsupported", "prerequisite-unsupported"].includes(status)) {
      warnings.add({
        code: "unsupported-rule-expression",
        path: `catalog.${grant.sourceId}.rules.grants`,
        entryId: grant.targetId || grant.targetOriginalId,
        sourceId: grant.sourceId,
        blocking: true,
        message: `Grant requirements from ${grant.sourceId} are unsupported.`,
      });
    } else if (status === "prerequisite-unmet") {
      warnings.add({
        code: "unmet-prerequisite",
        path: `catalog.${grant.sourceId}.rules.grants`,
        entryId: grant.targetId,
        sourceId: grant.sourceId,
        blocking: true,
        message: `${grant.targetId} has an unmet prerequisite.`,
      });
    } else if (["ruleset-mismatch", "source-unavailable"].includes(status)) {
      warnings.add({
        code: status,
        path: `catalog.${grant.sourceId}.rules.grants`,
        entryId: grant.targetId,
        sourceId: grant.sourceId,
        blocking: true,
        message: `${grant.targetId} is unavailable for this build.`,
      });
    }
    const { context, ...publicGrant } = grant;
    return { ...publicGrant, status };
  }).sort((left, right) => left.key.localeCompare(right.key));

  const choices = graph.choices.map((choice) => {
    let state = choiceStatus(choice, active, aliases);
    const publicOptions = choice.options.map(({ entry, ...option }) => {
      if (!entry || !option.available) return option;
      const requirement = dynamicEntryRequirement(
        entry,
        choice.context,
        aliases,
        activeEntries,
        classLevels,
        build.preferences.prerequisites,
      );
      if (requirement.status === "met") return option;
      return {
        ...option,
        available: false,
        unavailableReason: requirement.status === "unsupported"
          ? "prerequisite-unsupported"
          : "prerequisite-unmet",
      };
    });
    const publicOptionLookup = optionLookup(publicOptions);
    const hasInvalidPrerequisite = choice.acceptedOptions.some((option) =>
      publicOptionLookup.get(option.id)?.available === false);
    if (state.status !== "unavailable" && hasInvalidPrerequisite) {
      state = { status: "invalid", unavailableReason: "" };
    }
    if (state.status !== "unavailable") {
      if (!choice.options.length) {
        warnings.add({
          code: "unresolved-selection-options",
          path: `catalog.${choice.sourceId}.rules.selections`,
          sourceId: choice.sourceId,
          choiceKey: choice.key,
          blocking: true,
          message: `${choice.name} has no resolvable options in the loaded catalog.`,
        });
      }
      if (choice.acceptedOptions.length < choice.minimum) {
        warnings.add({
          code: "selection-required",
          path: `build.selections.${choice.key}`,
          sourceId: choice.sourceId,
          choiceKey: choice.key,
          blocking: true,
          message: `${choice.name} requires ${choice.minimum} selection${choice.minimum === 1 ? "" : "s"}.`,
        });
      }
      if (choice.overflow) {
        warnings.add({
          code: "selection-count",
          path: `build.selections.${choice.key}`,
          sourceId: choice.sourceId,
          choiceKey: choice.key,
          blocking: true,
          message: `${choice.name} allows at most ${choice.maximum} selection${choice.maximum === 1 ? "" : "s"}.`,
        });
      }
      if (choice.duplicateValues.length) {
        warnings.add({
          code: "selection-duplicate",
          path: `build.selections.${choice.key}`,
          sourceId: choice.sourceId,
          choiceKey: choice.key,
          blocking: true,
          message: `${choice.name} contains duplicate selections.`,
        });
      }
      if (choice.invalidValues.length) {
        warnings.add({
          code: "selection-invalid",
          path: `build.selections.${choice.key}`,
          sourceId: choice.sourceId,
          choiceKey: choice.key,
          blocking: true,
          message: `${choice.name} contains unavailable selections.`,
        });
      }
      choice.selectedOptions.forEach(({ option }) => {
        if (!option || option.available || option.unavailableReason === "unresolved-reference") return;
        warnings.add({
          code: option.unavailableReason,
          path: `build.selections.${choice.key}`,
          entryId: option.id,
          sourceId: choice.sourceId,
          choiceKey: choice.key,
          blocking: true,
          message: `${option.label} is unavailable for this build.`,
        });
      });
      const unresolvedOptions = choice.options.filter((option) => option.unavailableReason === "unresolved-reference");
      unresolvedOptions.forEach((option) => warnings.add({
        code: "unresolved-reference",
        path: `catalog.${choice.sourceId}.rules.selections`,
        entryId: option.originalId || option.id,
        sourceId: choice.sourceId,
        choiceKey: choice.key,
        blocking: true,
        message: `${choice.name} cannot resolve option ${option.originalId || option.id}.`,
      }));
      choice.acceptedOptions.forEach((option) => {
        if (!option.entry) return;
        const requirement = dynamicEntryRequirement(
          option.entry,
          choice.context,
          aliases,
          activeEntries,
          classLevels,
          build.preferences.prerequisites,
        );
        if (requirement.status === "met") return;
        warnings.add({
          code: requirement.status === "unsupported" ? "unsupported-rule-expression" : "unmet-prerequisite",
          path: `build.selections.${choice.key}`,
          entryId: option.entry.id,
          sourceId: choice.sourceId,
          choiceKey: choice.key,
          blocking: true,
          message: requirement.status === "unsupported"
            ? `Prerequisite automation is unsupported for ${option.label}.`
            : `${option.label} has an unmet prerequisite.`,
        });
      });
    }
    const {
      context,
      selectedOptions,
      acceptedOptions,
      duplicateValues,
      invalidValues,
      overflow,
      ...publicChoice
    } = choice;
    return {
      ...publicChoice,
      options: publicOptions,
      selectedIds: acceptedOptions.map((option) => option.id),
      ...state,
    };
  }).sort((left, right) => left.key.localeCompare(right.key));

  const knownChoiceKeys = new Set(choices.map((choice) => choice.key));
  Object.keys(build.selections).sort().forEach((key) => {
    if (knownChoiceKeys.has(key) || !selectedValues(build.selections[key]).length) return;
    warnings.add({
      code: "unresolved-selection",
      path: `build.selections.${key}`,
      choiceKey: key,
      blocking: true,
      message: `Selection ${key} no longer resolves to an available rule choice.`,
    });
  });

  if (calculated.cycled) warnings.add({
    code: "evaluation-cycle",
    path: "build.selections",
    blocking: true,
    message: "Rule requirements did not reach a stable result.",
  });

  return {
    ruleset: build.ruleset,
    roots: roots.map((root) => ({
      kind: root.kind,
      path: root.path,
      requestedId: root.reference,
      entryId: root.entry?.id || "",
      originalId: text(root.entry?.originalId),
      level: root.context.level,
      status: root.entry && active.has(root.entry.id) ? "active" : "unavailable",
    })),
    activeEntries: [...active]
      .map((id) => graph.candidates.get(id))
      .filter(Boolean)
      .map(({ entry, context, via }) => ({
        id: entry.id,
        originalId: text(entry.originalId),
        name: text(entry.name),
        type: text(entry.type),
        level: context.level,
        via: via.kind,
        sourceId: text(via.sourceId),
      }))
      .sort((left, right) => left.id.localeCompare(right.id)),
    grants,
    choices,
    warnings: warnings.sorted(),
  };
}
