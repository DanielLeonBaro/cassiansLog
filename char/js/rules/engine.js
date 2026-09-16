// Composes pure Character rule stages into the flat compatibility sheet contract.
import {
  normalizeCharacterDocument,
  projectManualCharacterSheet,
} from "../model.js";
import { calculateCoreCharacterValues } from "./core-calculations.js";
import {
  calculateDurabilityCharacterValues,
  isDurabilityStatRule,
} from "./durability-calculations.js";
import { evaluateCharacterBuild } from "./evaluator.js";
import { createOverrideResolver } from "./overrides.js";
import { calculatePlayCharacterValues, isPlayStatRule } from "./play-calculations.js";
import { calculateSpellcastingCharacterValues } from "./spell-calculations.js";
import {
  calculateInventoryCharacterValues,
  prepareCharacterInventory,
} from "./inventory-calculations.js";
import { calculateClassCharacterValues } from "./class-calculations.js";

function catalogEntries(catalog) {
  if (Array.isArray(catalog)) return catalog;
  return Array.isArray(catalog?.entries) ? catalog.entries : [];
}

function activeRootNames(graph, catalog, kind) {
  const entries = new Map(catalogEntries(catalog).map((entry) => [entry.id, entry]));
  return graph.roots
    .filter((root) => root.kind === kind && root.status === "active")
    .map((root) => entries.get(root.entryId)?.name)
    .filter(Boolean);
}

function rulesSheet(document, graph, core, durability, play, magic, equipment, classRules, catalog) {
  const { characterSchemaVersion, build, ...legacy } = document;
  const classes = activeRootNames(graph, catalog, "class");
  const subclasses = activeRootNames(graph, catalog, "subclass");
  const species = activeRootNames(graph, catalog, "species");
  const backgrounds = activeRootNames(graph, catalog, "background");
  const legacyExtras = Array.isArray(legacy.extras) ? legacy.extras : [];
  const legacyExtraIds = new Set(legacyExtras.map((extra) => extra?.id).filter(Boolean));
  return {
    ...legacy,
    class: classes.join(" / "),
    subclass: subclasses.join(" / "),
    race: species.join(" / "),
    background: backgrounds.join(" / "),
    level: core.level,
    proficiency: core.proficiency,
    ...core.passives,
    stats: core.stats,
    hp: durability.hp,
    hitDice: durability.hitDice,
    ac: durability.ac,
    initiative: durability.initiative,
    movement: durability.movement,
    walk: durability.movement.walk,
    fly: durability.movement.fly,
    senses: durability.senses,
    darkvision: durability.senses.darkvision,
    languages: durability.languages,
    proficiencies: durability.proficiencies,
    defenses: durability.defenses,
    actions: [...equipment.actions, ...play.actions],
    resources: play.resources,
    features: classRules.features,
    extras: [...legacyExtras, ...classRules.extras.filter((extra) => !legacyExtraIds.has(extra.id))],
    combat: classRules.combat,
    size: classRules.character.size || legacy.size || "",
    creatureType: classRules.character.creatureType || legacy.creatureType || "",
    rest: classRules.rest,
    inspiration: play.inspiration,
    conditions: play.conditions,
    concentration: play.concentration,
    exhaustion: play.exhaustion,
    spellcasting: magic.spellcasting,
    spells: magic.spells,
    inventory: equipment.inventory,
    currency: equipment.currency,
    inventoryWeight: equipment.inventoryWeight,
    inventoryCost: equipment.inventoryCost,
    encumbrance: equipment.encumbrance,
  };
}

function mergedWarnings(...groups) {
  const warnings = new Map();
  groups.flat().forEach((warning) => {
    const key = [warning.code, warning.path, warning.entryId, warning.sourceId].join("|");
    if (!warnings.has(key)) warnings.set(key, warning);
  });
  return [...warnings.values()].sort((left, right) =>
    left.code.localeCompare(right.code)
    || String(left.path || "").localeCompare(String(right.path || ""))
    || String(left.entryId || "").localeCompare(String(right.entryId || "")));
}

export function evaluateCharacter({ character, catalog, runtime } = {}) {
  const document = normalizeCharacterDocument(character);
  if (document.build.mode === "manual") {
    return {
      sheet: projectManualCharacterSheet(document),
      trace: {},
      warnings: [],
    };
  }
  const graph = evaluateCharacterBuild({ character: document, catalog });
  const overrideResolver = createOverrideResolver(document.build.overrides);
  const preparedInventory = prepareCharacterInventory({ document, graph, catalog, runtime });
  const core = calculateCoreCharacterValues({
    document,
    graph,
    catalog,
    overrideResolver,
    deferRule: (record) => isDurabilityStatRule(record) || isPlayStatRule(record),
    extraStatRecords: preparedInventory.statRecords,
  });
  const equipment = calculateInventoryCharacterValues({
    document,
    graph,
    catalog,
    core,
    prepared: preparedInventory,
  });
  const durability = calculateDurabilityCharacterValues({
    document,
    graph,
    catalog,
    core,
    runtime,
    overrideResolver,
    inventory: equipment,
    extraStatRecords: preparedInventory.statRecords,
  });
  const play = calculatePlayCharacterValues({
    document,
    graph,
    catalog,
    core,
    runtime,
    overrideResolver,
  });
  const magic = calculateSpellcastingCharacterValues({
    document,
    graph,
    catalog,
    core,
    runtime,
    overrideResolver,
  });
  const classes = calculateClassCharacterValues({ graph, catalog });
  durability.trace.walk = {
    value: durability.movement.walk,
    sources: [{ kind: "projection", sourceId: "movement.walk", label: "Walking speed", value: durability.movement.walk }],
  };
  durability.trace.fly = {
    value: durability.movement.fly,
    sources: [{ kind: "projection", sourceId: "movement.fly", label: "Flying speed", value: durability.movement.fly }],
  };
  durability.trace.darkvision = {
    value: durability.senses.darkvision,
    sources: [{ kind: "projection", sourceId: "senses.darkvision", label: "Darkvision range", value: durability.senses.darkvision }],
  };
  return {
    sheet: rulesSheet(document, graph, core, durability, play, magic, equipment, classes, catalog),
    trace: { ...core.trace, ...durability.trace, ...play.trace, ...magic.trace, ...equipment.trace, ...classes.trace },
    warnings: mergedWarnings(core.warnings, durability.warnings, play.warnings, magic.warnings, equipment.warnings, classes.warnings, overrideResolver.finish()),
  };
}
