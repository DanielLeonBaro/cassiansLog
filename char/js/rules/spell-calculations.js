// Projects declarative spellcasting rules, repertoire, shared slots, and casting options.
const STANDARD_SLOT_TABLE = Object.freeze([
  [],
  [2],
  [3],
  [4, 2],
  [4, 3],
  [4, 3, 2],
  [4, 3, 3],
  [4, 3, 3, 1],
  [4, 3, 3, 2],
  [4, 3, 3, 3, 1],
  [4, 3, 3, 3, 2],
  [4, 3, 3, 3, 2, 1],
  [4, 3, 3, 3, 2, 1],
  [4, 3, 3, 3, 2, 1, 1],
  [4, 3, 3, 3, 2, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 2, 1, 1],
]);

const PACT_SLOT_TABLE = Object.freeze([
  null,
  [1, 1], [2, 1], [2, 2], [2, 2], [2, 3], [2, 3], [2, 4], [2, 4], [2, 5], [2, 5],
  [3, 5], [3, 5], [3, 5], [3, 5], [3, 5], [3, 5], [4, 5], [4, 5], [4, 5], [4, 5],
]);

const ABILITY_ALIASES = Object.freeze({
  strength: "str", dexterity: "dex", constitution: "con",
  intelligence: "int", wisdom: "wis", charisma: "cha",
  str: "str", dex: "dex", con: "con", int: "int", wis: "wis", cha: "cha",
});

const PROGRESSIONS = new Set(["full", "half-down", "half-up", "third-down", "pact", "none"]);
const REPERTOIRES = new Set(["known", "prepared", "spellbook"]);
const RITUAL_MODES = new Set(["none", "known", "prepared", "spellbook", "all"]);
const CANTRIP_SCALING = new Set(["character", "none"]);

function isRecord(value) {
  return Object.prototype.toString.call(value) === "[object Object]";
}

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalized(value) {
  return text(value).toLowerCase().replaceAll(/\s+/g, " ");
}

function integer(value) {
  if (value === "" || value === null || value === undefined || typeof value === "boolean") return null;
  const number = Number(value);
  return Number.isInteger(number) ? number : null;
}

function truthy(value) {
  return value === true || normalized(value) === "true";
}

function catalogEntries(catalog) {
  return Array.isArray(catalog) ? catalog : Array.isArray(catalog?.entries) ? catalog.entries : [];
}

function catalogIndex(catalog) {
  const byId = new Map();
  const byReference = new Map();
  catalogEntries(catalog).forEach((entry) => {
    if (!entry || !text(entry.id)) return;
    if (!byId.has(entry.id)) byId.set(entry.id, entry);
    if (!byReference.has(entry.id)) byReference.set(entry.id, entry);
    if (text(entry.originalId) && !byReference.has(entry.originalId)) byReference.set(entry.originalId, entry);
  });
  return { byId, byReference };
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

function ruleSource(entry, value, details = {}) {
  return {
    kind: "rules",
    sourceId: entry.id,
    originalId: text(entry.originalId),
    label: text(entry.name) || entry.id,
    value,
    ...details,
  };
}

function profileRules(entry) {
  const value = entry?.rules?.spellcasting;
  if (Array.isArray(value)) return value;
  return isRecord(value) ? [value] : [];
}

function preparedLimit(rule, profile, core, warnings, entry, ruleIndex) {
  const configuration = rule.prepared;
  if (profile.repertoire === "known") return {
    value: 0,
    sources: [ruleSource(entry, 0, { ruleIndex, reason: "known-spell repertoire" })],
  };
  if (integer(configuration) !== null) {
    const value = Math.max(0, integer(configuration));
    return { value, sources: [ruleSource(entry, value, { ruleIndex })] };
  }
  if (!isRecord(configuration)) {
    warnings.add({
      code: "unsupported-rule-expression",
      path: `catalog.${entry.id}.rules.spellcasting.prepared`,
      entryId: entry.id,
      sourceId: entry.id,
      blocking: true,
      message: `${profile.name} needs declarative prepared-spell rules.`,
    });
    return { value: 0, sources: [] };
  }
  const minimum = Math.max(0, integer(configuration.minimum) ?? 0);
  if (configuration.type === "ability-plus-level") {
    const abilityModifier = core.stats[profile.ability]?.modifier || 0;
    return {
      value: Math.max(minimum, abilityModifier + profile.level),
      sources: [
        { kind: "ability", sourceId: `stats.${profile.ability}.modifier`, label: `${profile.name} spellcasting ability`, value: abilityModifier },
        { kind: "class-level", sourceId: entry.id, originalId: text(entry.originalId), label: `${profile.name} level`, value: profile.level },
      ],
    };
  }
  if (configuration.type === "fixed") {
    const value = Math.max(minimum, integer(configuration.value) ?? 0);
    return { value, sources: [ruleSource(entry, value, { ruleIndex })] };
  }
  if (configuration.type === "table") {
    const values = configuration.values;
    const value = Array.isArray(values) ? values[profile.level] : isRecord(values) ? values[profile.level] : null;
    const result = integer(value);
    if (result !== null) {
      const final = Math.max(minimum, result);
      return { value: final, sources: [ruleSource(entry, final, { ruleIndex, classLevel: profile.level })] };
    }
  }
  warnings.add({
    code: "unsupported-rule-expression",
    path: `catalog.${entry.id}.rules.spellcasting.prepared`,
    entryId: entry.id,
    sourceId: entry.id,
    blocking: true,
    message: `${profile.name} has unsupported prepared-spell rules.`,
  });
  return { value: 0, sources: [] };
}

function collectProfiles(graph, catalog, core, overrideResolver, warnings, trace) {
  const index = catalogIndex(catalog).byId;
  const profiles = [];
  const ids = new Set();
  graph.activeEntries.forEach((active) => {
    const entry = index.get(active.id);
    if (!entry || entry.automation?.status !== "rules-ready") return;
    profileRules(entry).forEach((rule, ruleIndex) => {
      const id = text(rule.id);
      const ability = ABILITY_ALIASES[normalized(rule.ability)];
      const progression = normalized(rule.progression);
      const repertoire = normalized(rule.repertoire);
      const ritual = normalized(rule.ritual || "none");
      const cantripScaling = normalized(rule.cantripScaling || "character");
      if (!id || !ability || !PROGRESSIONS.has(progression) || !REPERTOIRES.has(repertoire)
        || !RITUAL_MODES.has(ritual) || !CANTRIP_SCALING.has(cantripScaling)) {
        warnings.add({
          code: "unsupported-rule-expression",
          path: `catalog.${entry.id}.rules.spellcasting.${ruleIndex}`,
          entryId: entry.id,
          sourceId: entry.id,
          blocking: true,
          message: `${entry.name || entry.id} has an invalid spellcasting profile.`,
        });
        return;
      }
      if (ids.has(id)) {
        warnings.add({
          code: "duplicate-spellcasting-profile",
          path: `catalog.${entry.id}.rules.spellcasting.${ruleIndex}.id`,
          entryId: entry.id,
          sourceId: id,
          blocking: true,
          message: `Spellcasting profile ${id} is defined more than once.`,
        });
        return;
      }
      ids.add(id);
      const level = Math.max(1, Math.min(20, integer(active.level) ?? 1));
      const profile = {
        id,
        name: text(rule.name) || text(entry.name) || id,
        ability,
        spellList: text(rule.spellList) || text(rule.name) || text(entry.name) || id,
        level,
        progression,
        repertoire,
        ritual,
        cantripScaling,
        sourceId: entry.id,
      };
      const abilityModifier = core.stats[ability].modifier;
      const proficiencySource = { kind: "proficiency", sourceId: "proficiency", label: "Proficiency bonus", value: core.proficiency };
      const abilitySource = { kind: "ability", sourceId: `stats.${ability}.modifier`, label: `${profile.name} spellcasting ability`, value: abilityModifier };
      const saveSources = [
        { kind: "base", sourceId: "spell-save-dc.base", label: "Spell save DC base", value: 8 },
        proficiencySource,
        abilitySource,
      ];
      const attackSources = [proficiencySource, abilitySource];
      const limit = preparedLimit(rule, profile, core, warnings, entry, ruleIndex);
      const save = overrideResolver.number(`spellcasting.profiles.${id}.saveDC`, 8 + core.proficiency + core.stats[ability].modifier, saveSources, { integer: true });
      const attack = overrideResolver.number(`spellcasting.profiles.${id}.attackBonus`, core.proficiency + core.stats[ability].modifier, attackSources, { integer: true });
      const prepared = overrideResolver.number(`spellcasting.profiles.${id}.preparedLimit`, limit.value, limit.sources, { integer: true, minimum: 0 });
      profiles.push({
        ...profile,
        ability: ability.toUpperCase(),
        abilityId: ability,
        saveDC: save.value,
        attackBonus: attack.value,
        preparedLimit: prepared.value,
      });
      trace[`spellcasting.profiles.${id}.saveDC`] = save.trace;
      trace[`spellcasting.profiles.${id}.attackBonus`] = attack.trace;
      trace[`spellcasting.profiles.${id}.preparedLimit`] = prepared.trace;
    });
  });
  return profiles.sort((left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id));
}

export function standardSpellSlots(casterLevel) {
  const level = Math.max(0, Math.min(20, integer(casterLevel) ?? 0));
  return [...STANDARD_SLOT_TABLE[level]];
}

export function pactSpellSlots(classLevel) {
  const level = Math.max(0, Math.min(20, integer(classLevel) ?? 0));
  const row = PACT_SLOT_TABLE[level];
  return row ? { count: row[0], level: row[1] } : { count: 0, level: 0 };
}

function casterLevelContribution(profile) {
  if (profile.progression === "full") return profile.level;
  if (profile.progression === "half-down") return Math.floor(profile.level / 2);
  if (profile.progression === "half-up") return Math.ceil(profile.level / 2);
  if (profile.progression === "third-down") return Math.floor(profile.level / 3);
  return 0;
}

function runtimeSlots(runtime) {
  return new Map((Array.isArray(runtime?.slots) ? runtime.slots : [])
    .filter((slot) => isRecord(slot) && text(slot.id))
    .map((slot) => [slot.id, slot]));
}

function slotCurrent(saved, maximum) {
  const current = integer(saved?.current);
  return current === null ? maximum : Math.max(0, Math.min(maximum, current));
}

function calculateSlots(profiles, runtime, overrideResolver, trace) {
  const saved = runtimeSlots(runtime);
  const slots = [];
  const standardProfiles = profiles.filter((profile) => !["pact", "none"].includes(profile.progression));
  const casterLevel = Math.min(20, standardProfiles.reduce((sum, profile) => sum + casterLevelContribution(profile), 0));
  const sharedProfileIds = standardProfiles.map((profile) => profile.id);
  standardSpellSlots(casterLevel).forEach((automaticMaximum, index) => {
    if (!automaticMaximum) return;
    const level = index + 1;
    const id = `spell-slot:${level}`;
    const sources = standardProfiles.map((profile) => ({
      kind: "class-level",
      sourceId: profile.sourceId,
      label: `${profile.name} spellcasting progression`,
      value: casterLevelContribution(profile),
    }));
    const maximum = overrideResolver.number(`spellcasting.slots.${id}.max`, automaticMaximum, sources, { integer: true, minimum: 0 });
    const current = slotCurrent(saved.get(id), maximum.value);
    slots.push({
      id,
      profileId: sharedProfileIds[0] || "",
      profileIds: sharedProfileIds,
      pool: "spellcasting",
      level,
      current,
      max: maximum.value,
      reset: "long",
    });
    trace[`spellcasting.slots.${id}.max`] = maximum.trace;
    trace[`spellcasting.slots.${id}.current`] = {
      value: current,
      sources: [{
        kind: saved.has(id) ? "runtime" : "default",
        sourceId: saved.has(id) ? `runtime.slots.${id}` : `spellcasting.slots.${id}.max`,
        label: `Level ${level} spell slots remaining`,
        value: current,
      }],
    };
  });
  profiles.filter((profile) => profile.progression === "pact").forEach((profile) => {
    const pact = pactSpellSlots(profile.level);
    if (!pact.count) return;
    const id = `pact-slot:${profile.id}:${pact.level}`;
    const sources = [{
      kind: "class-level",
      sourceId: profile.sourceId,
      label: `${profile.name} Pact Magic progression`,
      value: profile.level,
    }];
    const maximum = overrideResolver.number(`spellcasting.slots.${id}.max`, pact.count, sources, { integer: true, minimum: 0 });
    const current = slotCurrent(saved.get(id), maximum.value);
    slots.push({
      id,
      profileId: profile.id,
      profileIds: [profile.id],
      pool: "pact",
      level: pact.level,
      current,
      max: maximum.value,
      reset: "short",
    });
    trace[`spellcasting.slots.${id}.max`] = maximum.trace;
    trace[`spellcasting.slots.${id}.current`] = {
      value: current,
      sources: [{
        kind: saved.has(id) ? "runtime" : "default",
        sourceId: saved.has(id) ? `runtime.slots.${id}` : `spellcasting.slots.${id}.max`,
        label: `${profile.name} Pact Magic slots remaining`,
        value: current,
      }],
    };
  });
  return { casterLevel, slots };
}

function supportTags(entry) {
  return new Set(text(entry?.supports).split(",").map(normalized).filter(Boolean));
}

function assignmentFor(document, reference, entry) {
  return document.build.spells.assignments?.[reference]
    || document.build.spells.assignments?.[entry?.id]
    || document.build.spells.assignments?.[entry?.originalId]
    || {};
}

function profileForSpell(profiles, entry, assignment, requestedProfile, warnings, path) {
  const explicit = text(requestedProfile) || text(assignment.profileId);
  if (explicit) {
    const profile = profiles.find((candidate) => candidate.id === explicit || normalized(candidate.name) === normalized(explicit));
    if (profile) return profile;
    warnings.add({
      code: "unresolved-spellcasting-profile",
      path,
      entryId: entry.id,
      sourceId: explicit,
      blocking: true,
      message: `${entry.name || entry.id} references unavailable spellcasting profile ${explicit}.`,
    });
    return null;
  }
  const supports = supportTags(entry);
  const matches = profiles.filter((profile) => supports.has(normalized(profile.spellList)) || supports.has(normalized(profile.name)));
  if (matches.length === 1) return matches[0];
  if (!matches.length && profiles.length === 1) return profiles[0];
  warnings.add({
    code: matches.length ? "ambiguous-spellcasting-profile" : "unresolved-spellcasting-profile",
    path,
    entryId: entry.id,
    blocking: true,
    message: `${entry.name || entry.id} needs an explicit spellcasting profile assignment.`,
  });
  return null;
}

function spellDefinition(entry) {
  const added = isRecord(entry?.add?.value) ? entry.add.value : {};
  const setters = isRecord(entry?.setters) ? entry.setters : {};
  const level = integer(added.level ?? setters.level) ?? 0;
  return {
    ...added,
    id: entry.id,
    definitionId: entry.id,
    name: text(added.name) || text(entry.name) || entry.id,
    category: text(added.category) || (level ? `${level}-level Spell` : "Cantrip"),
    action: text(added.action) || text(setters.time) || "Action",
    level: Math.max(0, Math.min(9, level)),
    school: text(added.school) || text(setters.school),
    range: text(added.range) || text(setters.range),
    duration: text(added.duration) || text(setters.duration),
    components: text(added.components),
    concentration: added.concentration === true || truthy(setters.isConcentration),
    ritual: added.ritual === true || truthy(setters.isRitual),
    description: text(added.description) || text(entry.summary) || text(entry.description),
    publication: text(added.publication) || text(entry.publication),
  };
}

function runtimePrepared(runtime) {
  return new Map((Array.isArray(runtime?.prepared) ? runtime.prepared : [])
    .filter((item) => isRecord(item) && text(item.id))
    .map((item) => [item.id, Boolean(item.prepared)]));
}

export function cantripScalingTier(characterLevel) {
  if (characterLevel >= 17) return 4;
  if (characterLevel >= 11) return 3;
  if (characterLevel >= 5) return 2;
  return 1;
}

function ritualAvailable(profile, spell) {
  if (!spell.ritual || !profile) return false;
  if (profile.ritual === "all") return true;
  if (profile.ritual === "known") return spell.known;
  if (profile.ritual === "prepared") return spell.prepared;
  if (profile.ritual === "spellbook") return spell.spellbook;
  return false;
}

function selectedSpellRecords(document, graph, index) {
  const records = [];
  document.build.spells.knownIds.forEach((reference) => records.push({ reference, repertoire: "known", path: "build.spells.knownIds" }));
  document.build.spells.spellbookIds.forEach((reference) => records.push({ reference, repertoire: "spellbook", path: "build.spells.spellbookIds" }));
  graph.grants.filter((grant) => normalized(grant.type) === "spell" && grant.status === "applied").forEach((grant) => {
    records.push({
      reference: grant.targetId || grant.targetOriginalId,
      repertoire: truthy(grant.known) ? "known" : "granted",
      path: `catalog.${grant.sourceId}.rules.grants`,
      profileId: grant.spellcasting,
      granted: true,
      alwaysPrepared: truthy(grant.prepared),
      ritual: truthy(grant.ritual),
      withoutSlot: truthy(grant.withoutSlot),
    });
  });
  const combined = new Map();
  records.forEach((record) => {
    const entry = index.byReference.get(record.reference);
    const key = entry?.id || record.reference;
    const current = combined.get(key) || { ...record, entry, repertoires: new Set() };
    current.entry ||= entry;
    current.repertoires.add(record.repertoire);
    current.granted ||= record.granted;
    current.alwaysPrepared ||= record.alwaysPrepared;
    current.ritual ||= record.ritual;
    current.withoutSlot ||= record.withoutSlot;
    current.profileId ||= record.profileId;
    combined.set(key, current);
  });
  return [...combined.values()];
}

function calculateSpells(document, graph, catalog, profiles, slots, core, runtime, warnings, trace) {
  const index = catalogIndex(catalog);
  const preparedState = runtimePrepared(runtime);
  const spells = [];
  selectedSpellRecords(document, graph, index).forEach((record) => {
    if (!record.entry) {
      warnings.add({
        code: "unresolved-reference",
        path: record.path,
        entryId: record.reference,
        blocking: true,
        message: `No Compendium spell resolves ${record.reference}.`,
      });
      return;
    }
    const entry = record.entry;
    const automation = entry.automation?.status || "manual";
    const compatible = [document.build.ruleset, "agnostic"].includes(entry.ruleset);
    if (!compatible) warnings.add({
      code: "ruleset-mismatch",
      path: record.path,
      entryId: entry.id,
      blocking: true,
      message: `${entry.name || entry.id} does not match ${document.build.ruleset}.`,
    });
    if (automation !== "rules-ready") warnings.add({
      code: automation === "partial" ? "partial-automation" : "manual-automation",
      path: `catalog.${entry.id}`,
      entryId: entry.id,
      blocking: false,
      message: `${entry.name || entry.id} is selectable but spell automation is incomplete.`,
    });
    const assignment = assignmentFor(document, record.reference, entry);
    const profile = profileForSpell(profiles, entry, assignment, record.profileId, warnings, record.path);
    const definition = spellDefinition(entry);
    const repertoires = new Set(record.repertoires);
    if (REPERTOIRES.has(normalized(assignment.repertoire))) repertoires.add(normalized(assignment.repertoire));
    const known = repertoires.has("known") || record.granted;
    const spellbook = repertoires.has("spellbook");
    const cantrip = definition.level === 0;
    const alwaysPrepared = Boolean(record.alwaysPrepared || truthy(assignment.alwaysPrepared));
    const preparationRequired = profile && ["prepared", "spellbook"].includes(profile.repertoire) && !cantrip && !alwaysPrepared;
    const prepared = cantrip || alwaysPrepared || profile?.repertoire === "known" || (!preparationRequired ? known : preparedState.get(entry.id) === true);
    const spell = {
      ...definition,
      source: profile?.id || "",
      spellcasting: profile?.ability || "",
      repertoire: [...repertoires].sort(),
      known,
      spellbook,
      granted: Boolean(record.granted),
      alwaysPrepared,
      prepared,
      preparationRequired: Boolean(preparationRequired),
      automation,
      rulesetCompatible: compatible,
      withoutSlot: Boolean(record.withoutSlot),
      cantripScale: cantrip ? (profile?.cantripScaling === "none" ? 1 : cantripScalingTier(core.level)) : 0,
    };
    spell.ritualCastable = compatible
      && automation === "rules-ready"
      && Boolean(record.ritual || ritualAvailable(profile, spell));
    spell.slotOptions = profile && definition.level > 0
      ? slots.filter((slot) => slot.level >= definition.level).map((slot) => slot.id)
      : [];
    spell.castable = compatible
      && automation === "rules-ready"
      && ((Boolean(profile) && prepared) || spell.withoutSlot);
    spells.push(spell);
    trace[`spells.${entry.id}`] = {
      value: spell,
      sources: [ruleSource(entry, entry.id, { profileId: profile?.id || "", repertoire: spell.repertoire })],
    };
    if (cantrip) trace[`spells.${entry.id}.cantripScale`] = {
      value: spell.cantripScale,
      sources: [{ kind: "character-level", sourceId: "level", label: "Total character level", value: core.level }],
    };
  });
  spells.sort((left, right) => left.level - right.level || left.name.localeCompare(right.name) || left.id.localeCompare(right.id));

  profiles.forEach((profile) => {
    if (!profile.preparedLimit) return;
    const prepared = spells.filter((spell) => spell.source === profile.id && spell.preparationRequired && spell.prepared);
    if (prepared.length > profile.preparedLimit) warnings.add({
      code: "prepared-spell-limit",
      path: `runtime.prepared.${profile.id}`,
      sourceId: profile.id,
      blocking: true,
      message: `${profile.name} has ${prepared.length} prepared spells but allows ${profile.preparedLimit}.`,
    });
  });
  return spells;
}

export function calculateSpellcastingCharacterValues({ document, graph, catalog, core, runtime, overrideResolver }) {
  const warnings = warningCollector();
  const trace = {};
  const profiles = collectProfiles(graph, catalog, core, overrideResolver, warnings, trace);
  const { casterLevel, slots } = calculateSlots(profiles, runtime, overrideResolver, trace);
  const spells = calculateSpells(document, graph, catalog, profiles, slots, core, runtime, warnings, trace);
  trace["spellcasting.casterLevel"] = {
    value: casterLevel,
    sources: profiles.filter((profile) => !["pact", "none"].includes(profile.progression)).map((profile) => ({
      kind: "class-level",
      sourceId: profile.sourceId,
      label: `${profile.name} caster-level contribution`,
      value: casterLevelContribution(profile),
    })),
  };
  trace.spells = { value: spells, sources: spells.map((spell) => ({
    kind: "rules", sourceId: spell.definitionId, label: spell.name, value: spell.id,
  })) };
  return {
    spellcasting: { enabled: profiles.length > 0, casterLevel, profiles, slots },
    spells,
    trace,
    warnings: warnings.sorted(),
  };
}
