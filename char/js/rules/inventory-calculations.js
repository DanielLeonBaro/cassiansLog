// Resolves rules-ready equipment instances and calculates inventory-derived sheet values.
import { evaluateIdRequirement } from "./requirements.js";
import { activeRuleEntries } from "./active-rules.js";

const COIN_VALUES = Object.freeze({ cp: 1, sp: 10, ep: 50, gp: 100, pp: 1000 });
const SIZE_MULTIPLIERS = Object.freeze({ tiny: 0.5, small: 1, medium: 1, large: 2, huge: 4, gargantuan: 8 });

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalized(value) {
  return text(value).toLowerCase().replaceAll(/\s+/g, " ");
}

function finite(value, fallback = null) {
  if (value === "" || value === null || value === undefined || typeof value === "boolean") return fallback;
  if (typeof value === "number") return Number.isFinite(value) ? value : fallback;
  const source = String(value).trim().replace(/^[$£€]\s*/, "");
  const mixed = source.match(/^([+-]?\d+)\s+(\d+)\/(\d+)/);
  if (mixed && Number(mixed[3])) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
  const fraction = source.match(/^([+-]?\d+)\/(\d+)/);
  if (fraction && Number(fraction[2])) return Number(fraction[1]) / Number(fraction[2]);
  const match = source.match(/^[+-]?\d+(?:\.\d+)?/);
  const number = match ? Number(match[0]) : NaN;
  return Number.isFinite(number) ? number : fallback;
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

function collector() {
  const values = new Map();
  return {
    add(value) {
      const key = [value.code, value.path, value.entryId, value.sourceId].join("|");
      if (!values.has(key)) values.set(key, value);
    },
    sorted() {
      return [...values.values()].sort((left, right) =>
        left.code.localeCompare(right.code)
        || text(left.path).localeCompare(text(right.path))
        || text(left.entryId).localeCompare(text(right.entryId)));
    },
  };
}

function activeAliases(graph) {
  const aliases = new Set();
  (graph?.activeEntries || []).forEach((entry) => {
    [entry.id, entry.originalId, normalized(entry.name)].filter(Boolean).forEach((alias) => aliases.add(alias));
  });
  (graph?.choices || []).filter((choice) => choice.status === "complete").forEach((choice) => {
    (choice.selectedIds || []).forEach((id) => aliases.add(id));
  });
  return aliases;
}

function currency(value) {
  const source = value && typeof value === "object" ? value : {};
  return Object.fromEntries(Object.keys(COIN_VALUES).map((coin) => [coin, Math.max(0, Math.trunc(finite(source[coin], 0)))]));
}

function cost(value) {
  const source = value && typeof value === "object" ? value : {};
  return Object.fromEntries(Object.keys(COIN_VALUES).map((coin) => [coin, Math.max(0, finite(source[coin], 0))]));
}

function propertyNames(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => text(typeof item === "object" ? item.name : item)).filter(Boolean))];
}

function itemProfile(entry) {
  const explicit = entry.rules?.inventory && typeof entry.rules.inventory === "object" ? entry.rules.inventory : {};
  const setters = entry.setters && typeof entry.setters === "object" ? entry.setters : {};
  const type = normalized(explicit.kind || entry.type);
  const weaponSource = explicit.weapon && typeof explicit.weapon === "object" ? explicit.weapon : null;
  const armorSource = explicit.armor && typeof explicit.armor === "object" ? explicit.armor : null;
  const damage = text(weaponSource?.damage || setters.damage);
  const armorClass = text(armorSource?.armorClass ?? setters.armorClass);
  const shield = normalized(armorSource?.type || setters.armor || setters.type) === "shield" || /^\+/.test(armorClass);
  const armorBase = finite(armorSource?.base ?? (!shield ? armorClass : null));
  const armorBonus = finite(armorSource?.bonus ?? (shield ? armorClass : null), 0);
  const weapon = weaponSource || damage ? {
    ability: normalized(weaponSource?.ability),
    attackType: normalized(weaponSource?.attackType || (type === "ranged weapon" ? "ranged" : "melee")),
    damage,
    damageType: text(weaponSource?.damageType),
    versatile: text(weaponSource?.versatile || setters.versatile),
    range: text(weaponSource?.range),
    properties: propertyNames(weaponSource?.properties),
    proficiency: text(weaponSource?.proficiency || setters.proficiency),
    proficient: weaponSource?.proficient === true,
    bonus: finite(weaponSource?.bonus, 0),
    mastery: text(weaponSource?.mastery),
    masteryId: text(weaponSource?.masteryId),
  } : null;
  const armor = armorSource || armorBase !== null || shield ? {
    type: shield ? "shield" : normalized(armorSource?.type || setters.type || setters.armor || "armor"),
    base: armorBase,
    bonus: armorBonus,
    dexterity: normalized(armorSource?.dexterity || (normalized(armorSource?.type || setters.type).includes("medium") ? "max-2" : normalized(armorSource?.type || setters.type).includes("heavy") ? "none" : "full")),
  } : null;
  const charges = explicit.charges && typeof explicit.charges === "object" ? {
    max: Math.max(0, Math.trunc(finite(explicit.charges.max, 0))),
    reset: ["short", "long", "day", "manual"].includes(explicit.charges.reset) ? explicit.charges.reset : "manual",
  } : null;
  const equippable = explicit.equippable === true || Boolean(weapon || armor);
  return {
    kind: type || (weapon ? "weapon" : armor ? "armor" : "item"),
    weight: Math.max(0, finite(explicit.weight ?? setters.weight, 0)),
    cost: cost(typeof explicit.cost === "object" ? explicit.cost : { gp: explicit.cost ?? setters.cost }),
    container: explicit.container && typeof explicit.container === "object" ? {
      capacityWeight: Math.max(0, finite(explicit.container.capacityWeight, 0)),
      contentsWeightMultiplier: Math.max(0, finite(explicit.container.contentsWeightMultiplier, 1)),
    } : null,
    activation: ["carried", "equipped"].includes(explicit.activation)
      ? explicit.activation
      : equippable ? "equipped" : "carried",
    equippable,
    canAttune: explicit.canAttune === true || explicit.attunementRequired === true,
    attunementRequired: explicit.attunementRequired === true,
    charges,
    weapon,
    armor,
  };
}

function runtimeInventory(runtime, warnings) {
  const result = new Map();
  (Array.isArray(runtime?.inventory) ? runtime.inventory : []).forEach((item, index) => {
    const instanceId = text(item?.instanceId);
    if (!instanceId) return;
    if (result.has(instanceId)) {
      warnings.add({ code: "duplicate-runtime-inventory-instance", path: `runtime.inventory.${index}.instanceId`, sourceId: instanceId, blocking: true, message: `Runtime inventory instance ${instanceId} is duplicated.` });
      return;
    }
    result.set(instanceId, item);
  });
  return result;
}

function validContainerIds(instances, warnings) {
  const byId = new Map(instances.filter((item) => item.validIdentity).map((item) => [item.instanceId, item]));
  const parents = new Map();
  instances.forEach((item) => {
    const parentId = text(item.containerId);
    if (!parentId) return;
    const parent = byId.get(parentId);
    if (!parent || !parent.profile?.container) {
      warnings.add({
        code: "invalid-inventory-container",
        path: `build.inventory.${item.index}.containerId`,
        entryId: item.definitionId,
        sourceId: item.instanceId,
        blocking: true,
        message: `${item.name} references a missing or non-container inventory instance.`,
      });
      return;
    }
    parents.set(item.instanceId, parentId);
  });
  instances.forEach((item) => {
    if (!item.validIdentity || !parents.has(item.instanceId)) return;
    const visited = new Set([item.instanceId]);
    let cursor = parents.get(item.instanceId);
    while (cursor) {
      if (visited.has(cursor)) {
        warnings.add({
          code: "inventory-container-cycle",
          path: `build.inventory.${item.index}.containerId`,
          entryId: item.definitionId,
          sourceId: item.instanceId,
          blocking: true,
          message: `${item.name} creates an inventory container cycle.`,
        });
        parents.delete(item.instanceId);
        break;
      }
      visited.add(cursor);
      cursor = parents.get(cursor);
    }
  });
  return parents;
}

function attunement(instances, warnings) {
  const activeDefinitions = new Set();
  let activeCount = 0;
  instances.forEach((item) => {
    item.attuned = false;
    if (!item.requestedAttuned) return;
    if (!item.profile?.canAttune) {
      warnings.add({ code: "item-cannot-attune", path: `runtime.inventory.${item.instanceId}.attuned`, entryId: item.definitionId, sourceId: item.instanceId, blocking: false, message: `${item.name} cannot be attuned.` });
      return;
    }
    if (activeDefinitions.has(item.definitionId)) {
      warnings.add({ code: "duplicate-item-attunement", path: `runtime.inventory.${item.instanceId}.attuned`, entryId: item.definitionId, sourceId: item.instanceId, blocking: false, message: `Only one copy of ${item.name} can be attuned.` });
      return;
    }
    if (activeCount >= 3) {
      warnings.add({ code: "attunement-limit", path: `runtime.inventory.${item.instanceId}.attuned`, entryId: item.definitionId, sourceId: item.instanceId, blocking: false, message: `${item.name} exceeds the three-item attunement limit.` });
      return;
    }
    item.attuned = true;
    activeDefinitions.add(item.definitionId);
    activeCount += 1;
  });
}

function resolveInstances({ document, catalog, graph, runtime, warnings }) {
  const index = catalogIndex(catalog);
  const runtimeById = runtimeInventory(runtime, warnings);
  const seen = new Set();
  const instances = document.build.inventory.map((source, itemIndex) => {
    const instanceId = text(source.instanceId);
    const definitionId = text(source.definitionId);
    const entry = index.get(definitionId);
    const validIdentity = Boolean(instanceId) && !seen.has(instanceId);
    if (!instanceId || !validIdentity) warnings.add({
      code: instanceId ? "duplicate-inventory-instance-id" : "missing-inventory-instance-id",
      path: `build.inventory.${itemIndex}.instanceId`,
      entryId: definitionId,
      sourceId: instanceId,
      blocking: true,
      message: instanceId ? `Inventory instance ${instanceId} is duplicated.` : "Inventory instances require stable IDs.",
    });
    if (instanceId) seen.add(instanceId);
    if (!entry) warnings.add({ code: "unresolved-inventory-definition", path: `build.inventory.${itemIndex}.definitionId`, entryId: definitionId, sourceId: instanceId, blocking: true, message: `Inventory definition ${definitionId || "(missing)"} could not be resolved.` });
    const compatible = entry && ["agnostic", document.build.ruleset].includes(entry.ruleset || "agnostic");
    if (entry && !compatible) warnings.add({ code: "ruleset-mismatch", path: `build.inventory.${itemIndex}.definitionId`, entryId: entry.id, sourceId: instanceId, blocking: true, message: `${entry.name} does not match the ${document.build.ruleset} ruleset.` });
    const automatic = compatible && entry?.automation?.status === "rules-ready";
    if (entry && !automatic) warnings.add({ code: entry.automation?.status === "partial" ? "partial-automation" : "manual-automation", path: `build.inventory.${itemIndex}.definitionId`, entryId: entry.id, sourceId: instanceId, blocking: false, message: `${entry.name} remains selectable, but its inventory rules are not automatic.` });
    const state = validIdentity ? runtimeById.get(instanceId) || {} : {};
    const profile = automatic ? itemProfile(entry) : null;
    const equipped = Boolean(state.equipped) && Boolean(profile?.equippable);
    if (state.equipped && !profile?.equippable) warnings.add({ code: "item-cannot-equip", path: `runtime.inventory.${instanceId}.equipped`, entryId: definitionId, sourceId: instanceId, blocking: false, message: `${entry?.name || definitionId || "Item"} cannot be equipped automatically.` });
    const quantity = Math.max(0, finite(state.quantity, source.quantity));
    const containerId = text(state.containerId ?? source.containerId);
    const chargesMax = profile?.charges?.max || 0;
    return {
      index: itemIndex,
      instanceId,
      definitionId: entry?.id || definitionId,
      name: text(entry?.name) || definitionId || "Unresolved item",
      quantity,
      containerId,
      validIdentity,
      automatic,
      entry,
      profile,
      equipped,
      requestedAttuned: Boolean(state.attuned),
      charges: profile?.charges ? {
        current: Math.max(0, Math.min(chargesMax, Math.trunc(finite(state.charges?.current ?? state.charges, chargesMax)))),
        max: chargesMax,
        reset: profile.charges.reset,
      } : null,
    };
  });
  const parents = validContainerIds(instances, warnings);
  instances.forEach((item) => { item.containerId = parents.get(item.instanceId) || ""; });
  attunement(instances, warnings);
  instances.forEach((item) => {
    item.active = Boolean(item.automatic)
      && (item.profile.activation === "carried" || item.equipped)
      && (!item.profile.attunementRequired || item.attuned);
    if (item.profile?.attunementRequired && item.equipped && !item.attuned) warnings.add({ code: "attunement-required", path: `runtime.inventory.${item.instanceId}.attuned`, entryId: item.definitionId, sourceId: item.instanceId, blocking: false, message: `${item.name} needs attunement before its effects apply.` });
  });
  return instances;
}

function itemStatRecords(instances, graph, warnings) {
  const aliases = activeAliases(graph);
  instances.filter((item) => item.active).forEach((item) => {
    aliases.add(item.definitionId);
    if (text(item.entry?.originalId)) aliases.add(item.entry.originalId);
  });
  const level = (graph?.roots || []).filter((root) => root.kind === "class").reduce((sum, root) => sum + Number(root.level || 0), 0);
  return instances.flatMap((item) => {
    if (!item.active) return [];
    return (Array.isArray(item.entry?.rules?.stats) ? item.entry.rules.stats : []).flatMap((rule, ruleIndex) => {
      const requirement = evaluateIdRequirement(rule?.requirements, aliases);
      if (requirement.status === "unmet") return [];
      if (requirement.status === "unsupported") {
        warnings.add({ code: "unsupported-rule-expression", path: `catalog.${item.definitionId}.rules.stats.${ruleIndex}.requirements`, entryId: item.definitionId, sourceId: item.instanceId, blocking: true, message: `${item.name} has unsupported item modifier requirements.` });
        return [];
      }
      if (["ac:armor", "ac:shield"].includes(normalized(rule?.name))) return [];
      return [{
        entry: { ...item.entry, id: `inventory:${item.instanceId}`, name: item.name },
        active: { id: `inventory:${item.instanceId}`, originalId: item.entry.originalId, name: item.name, level },
        rule,
        ruleIndex,
        equipmentResolved: true,
      }];
    });
  });
}

export function prepareCharacterInventory({ document, catalog, graph, runtime } = {}) {
  const warnings = collector();
  const instances = resolveInstances({ document, catalog, graph, runtime, warnings });
  return {
    instances,
    statRecords: itemStatRecords(instances, graph, warnings),
    currency: currency(runtime?.currency ?? document.currency),
    warnings: warnings.sorted(),
  };
}

function armorClass(instances, core, warnings) {
  const armor = instances.filter((item) => item.active && item.profile.armor && item.profile.armor.type !== "shield" && item.profile.armor.base !== null);
  const shields = instances.filter((item) => item.active && item.profile.armor?.type === "shield");
  if (armor.length > 1) warnings.add({ code: "multiple-equipped-armor", path: "runtime.inventory", blocking: false, message: `Only ${armor[0].name} supplies the armor base.` });
  if (shields.length > 1) warnings.add({ code: "multiple-equipped-shields", path: "runtime.inventory", blocking: false, message: `Only ${shields[0].name} supplies a shield bonus.` });
  const selected = armor[0];
  const shield = shields[0];
  const dex = core.stats.dex.modifier;
  const sources = selected ? [{ kind: "equipment", sourceId: selected.instanceId, label: `${selected.name} armor base`, value: selected.profile.armor.base }] : [
    { kind: "base", sourceId: "rules.ac", label: "Unarmored AC base", value: 10 },
  ];
  const dexterity = selected?.profile.armor.dexterity || "full";
  const dexValue = dexterity === "none" ? 0 : dexterity === "max-2" ? Math.min(2, dex) : dex;
  if (dexterity !== "none") sources.push({ kind: "ability", sourceId: "stats.dex.modifier", label: "Dexterity modifier", value: dexValue });
  if (shield) sources.push({ kind: "equipment", sourceId: shield.instanceId, label: `${shield.name} shield bonus`, value: shield.profile.armor.bonus });
  return { value: sources.reduce((sum, source) => sum + source.value, 0), sources };
}

function characterSize(document, graph, catalog) {
  const direct = text(document.build.description?.size || document.size);
  if (direct) return direct;
  const selected = activeRuleEntries(graph, catalog)
    .map(({ entry }) => text(entry.rules?.character?.size))
    .find(Boolean);
  if (selected) return selected;
  const index = catalogIndex(catalog);
  const speciesRoot = (graph?.roots || []).find((root) => root.kind === "species" && root.status === "active");
  const species = speciesRoot ? index.get(speciesRoot.entryId) : null;
  return text(species?.rules?.character?.size || species?.setters?.size);
}

function encumbrance(document, graph, catalog, core, weight, warnings) {
  const requestedMode = document.build.preferences.encumbrance;
  const size = characterSize(document, graph, catalog);
  if (requestedMode === "none") return { mode: "none", requestedMode, size: size || "", weight, capacity: null, pushDragLift: null, status: "ignored", speedPenalty: 0, speedMaximum: null };
  if (weight === 0 && !size) return { mode: requestedMode, requestedMode, size: "", weight, capacity: null, pushDragLift: null, status: "normal", speedPenalty: 0, speedMaximum: null };
  const multiplier = SIZE_MULTIPLIERS[normalized(size)];
  if (!multiplier) {
    warnings.add({ code: "missing-character-size", path: "build.description.size", blocking: true, message: "Character size is required for automatic carrying capacity." });
    return { mode: requestedMode, requestedMode, size: size || "", weight, capacity: null, pushDragLift: null, status: "unknown", speedPenalty: 0, speedMaximum: null };
  }
  let mode = requestedMode;
  if (mode === "variant" && document.build.ruleset !== "5e") {
    warnings.add({ code: "unsupported-encumbrance-variant", path: "build.preferences.encumbrance", blocking: false, message: "Variant encumbrance is a 2014 option; standard 2024 carrying capacity is shown." });
    mode = "standard";
  }
  const strength = core.stats.str.score;
  const capacity = strength * 15 * multiplier;
  const pushDragLift = capacity * 2;
  let status = weight > capacity ? "over-capacity" : "normal";
  let speedPenalty = 0;
  if (mode === "variant") {
    if (weight > strength * 10 * multiplier) { status = weight > capacity ? "over-capacity" : "heavily-encumbered"; speedPenalty = 20; }
    else if (weight > strength * 5 * multiplier) { status = "encumbered"; speedPenalty = 10; }
  }
  return { mode, requestedMode, size, weight, capacity, pushDragLift, status, speedPenalty, speedMaximum: status === "over-capacity" ? 5 : null };
}

function formatBonus(value) {
  return `${value >= 0 ? "+" : ""}${value}`;
}

function weaponActions(instances, graph, catalog, core, trace, ruleset) {
  const aliases = activeAliases(graph);
  const styleRules = activeRuleEntries(graph, catalog).flatMap(({ entry }) =>
    (Array.isArray(entry.rules?.weaponModifiers) ? entry.rules.weaponModifiers : []).map((rule) => ({ entry, rule })));
  const activeWeapons = instances.filter((item) => item.active && item.profile.weapon);
  const actions = activeWeapons.map((item) => {
    const weapon = item.profile.weapon;
    const properties = weapon.properties;
    const finesse = properties.some((property) => normalized(property) === "finesse");
    const abilityId = weapon.ability || (weapon.attackType === "ranged" ? "dex" : finesse ? (core.stats.dex.modifier > core.stats.str.modifier ? "dex" : "str") : "str");
    const ability = core.stats[abilityId] || core.stats.str;
    const proficiencyAliases = [weapon.proficiency, normalized(weapon.proficiency)].filter(Boolean);
    const proficient = weapon.proficient || proficiencyAliases.some((alias) => aliases.has(alias));
    const modifiers = styleRules.filter(({ rule }) => {
      if (rule.attackType && normalized(rule.attackType) !== weapon.attackType) return false;
      if (rule.property && !properties.some((property) => normalized(property) === normalized(rule.property))) return false;
      if (Array.isArray(rule.propertiesAny) && !rule.propertiesAny.some((required) => properties.some((property) => normalized(property) === normalized(required)))) return false;
      if (rule.oneHanded && properties.some((property) => normalized(property) === "two-handed")) return false;
      if (rule.requiresNoOtherWeapon && activeWeapons.length !== 1) return false;
      return true;
    });
    const styleAttack = modifiers.reduce((sum, { rule }) => sum + finite(rule.attack, 0), 0);
    const styleDamage = modifiers.reduce((sum, { rule }) => sum + finite(rule.damage, 0), 0);
    const attackBonus = ability.modifier + (proficient ? core.proficiency : 0) + weapon.bonus + styleAttack;
    const damageBonus = ability.modifier + weapon.bonus + styleDamage;
    const damage = `${weapon.damage}${damageBonus ? formatBonus(damageBonus) : ""}${weapon.damageType ? ` ${weapon.damageType}` : ""}`.trim();
    const masteryActive = Boolean(weapon.mastery && weapon.masteryId && aliases.has(weapon.masteryId));
    const id = `weapon:${item.instanceId}`;
    trace[`actions.${id}.attack`] = { value: attackBonus, sources: [
      { kind: "ability", sourceId: `stats.${abilityId}.modifier`, label: `${abilityId.toUpperCase()} modifier`, value: ability.modifier },
      ...(proficient ? [{ kind: "proficiency", sourceId: weapon.proficiency || "weapon.proficiency", label: "Weapon proficiency", value: core.proficiency }] : []),
      ...(weapon.bonus ? [{ kind: "equipment", sourceId: item.instanceId, label: `${item.name} bonus`, value: weapon.bonus }] : []),
      ...modifiers.filter(({ rule }) => finite(rule.attack, 0)).map(({ entry, rule }) => ({ kind: "rules", sourceId: entry.id, label: text(rule.label) || entry.name, value: finite(rule.attack, 0) })),
    ] };
    trace[`actions.${id}.damage`] = { value: damage, sources: [{ kind: "equipment", sourceId: item.instanceId, label: item.name, value: weapon.damage }, { kind: "ability", sourceId: `stats.${abilityId}.modifier`, label: `${abilityId.toUpperCase()} modifier`, value: ability.modifier }, ...modifiers.filter(({ rule }) => finite(rule.damage, 0)).map(({ entry, rule }) => ({ kind: "rules", sourceId: entry.id, label: text(rule.label) || entry.name, value: finite(rule.damage, 0) }))] };
    return {
      id,
      instanceId: item.instanceId,
      name: item.name,
      category: "Weapon",
      action: "Action",
      range: weapon.range || (weapon.attackType === "ranged" ? "Ranged" : "Melee"),
      attack: `${formatBonus(attackBonus)} vs AC`,
      attackBonus,
      damage,
      versatileDamage: weapon.versatile ? `${weapon.versatile}${damageBonus ? formatBonus(damageBonus) : ""}${weapon.damageType ? ` ${weapon.damageType}` : ""}`.trim() : "",
      properties,
      mastery: weapon.mastery,
      masteryActive,
      proficient,
      styleEffects: modifiers.flatMap(({ rule }) => [
        ...(rule.damageReroll ? [{ kind: "damage-reroll", values: rule.damageReroll }] : []),
        ...(rule.damageDieMinimum ? [{ kind: "damage-die-minimum", value: rule.damageDieMinimum }] : []),
        ...(rule.offhandAbilityDamage ? [{ kind: "offhand-ability-damage", value: true }] : []),
        ...(rule.damageRollTwice ? [{ kind: "damage-roll-twice", oncePerTurn: rule.oncePerTurn === true }] : []),
      ]),
    };
  });
  const attackBonus = core.stats.str.modifier + core.proficiency;
  const damageValue = Math.max(1, 1 + core.stats.str.modifier);
  const unarmed = {
    id: "unarmed-strike", name: "Unarmed Strike", category: "Weapon", action: "Action", range: "Melee",
    attack: `${formatBonus(attackBonus)} vs AC`, attackBonus, damage: `${damageValue} Bludgeoning`, properties: [], mastery: "", masteryActive: false, proficient: true,
    effects: ruleset === "5.5e" ? ["Damage", "Grapple", "Shove"] : ["Damage"],
  };
  trace["actions.unarmed-strike.attack"] = { value: attackBonus, sources: [{ kind: "ability", sourceId: "stats.str.modifier", label: "STR modifier", value: core.stats.str.modifier }, { kind: "proficiency", sourceId: "proficiency", label: "Proficiency", value: core.proficiency }] };
  return [...actions, unarmed];
}

function containerWeights(instances, warnings) {
  const children = new Map();
  instances.forEach((item) => {
    if (!item.containerId) return;
    if (!children.has(item.containerId)) children.set(item.containerId, []);
    children.get(item.containerId).push(item);
  });
  const totalFor = (item) => {
    if (!item.profile) return 0;
    const contents = (children.get(item.instanceId) || []).reduce((sum, child) => sum + totalFor(child), 0);
    return item.profile.weight * item.quantity + contents * (item.profile.container?.contentsWeightMultiplier ?? 1);
  };
  const contentWeights = new Map();
  instances.filter((item) => item.profile?.container).forEach((item) => {
    const contents = (children.get(item.instanceId) || []).reduce((sum, child) => sum + totalFor(child), 0);
    contentWeights.set(item.instanceId, contents);
    if (item.profile.container.capacityWeight && contents > item.profile.container.capacityWeight) warnings.add({ code: "container-over-capacity", path: `inventory.${item.instanceId}.contentsWeight`, entryId: item.definitionId, sourceId: item.instanceId, blocking: false, message: `${item.name} exceeds its ${item.profile.container.capacityWeight} lb. capacity.` });
  });
  const equipmentWeight = instances.filter((item) => !item.containerId)
    .reduce((sum, item) => sum + totalFor(item), 0);
  return { contentWeights, equipmentWeight };
}

export function calculateInventoryCharacterValues({ document, graph, catalog, core, prepared } = {}) {
  const warnings = collector();
  (prepared?.warnings || []).forEach((warning) => warnings.add(warning));
  const instances = prepared?.instances || [];
  const trace = {};
  const weights = containerWeights(instances, warnings);
  const sheetInventory = instances.map((item) => ({
    instanceId: item.instanceId,
    definitionId: item.definitionId,
    name: item.name,
    quantity: item.quantity,
    containerId: item.containerId,
    automatic: item.automatic,
    equipped: item.equipped,
    canEquip: Boolean(item.profile?.equippable),
    attuned: item.attuned,
    canAttune: Boolean(item.profile?.canAttune),
    attunementRequired: Boolean(item.profile?.attunementRequired),
    active: item.active,
    weight: item.profile ? item.profile.weight * item.quantity : null,
    unitWeight: item.profile?.weight ?? null,
    cost: item.profile ? Object.fromEntries(Object.entries(item.profile.cost).map(([coin, amount]) => [coin, amount * item.quantity])) : null,
    contentsWeight: item.profile?.container ? weights.contentWeights.get(item.instanceId) || 0 : null,
    containerCapacity: item.profile?.container?.capacityWeight ?? null,
    charges: item.charges,
  }));
  const carriedWeight = weights.equipmentWeight;
  const coins = prepared?.currency || currency(document.currency);
  const coinCount = Object.values(coins).reduce((sum, value) => sum + value, 0);
  const coinWeight = document.build.preferences.coinWeight ? coinCount / 50 : 0;
  const totalWeight = carriedWeight + coinWeight;
  const money = {
    ...coins,
    totalCopper: Object.entries(coins).reduce((sum, [coin, amount]) => sum + amount * COIN_VALUES[coin], 0),
    weight: coinWeight,
  };
  const inventoryCost = Object.fromEntries(Object.keys(COIN_VALUES).map((coin) => [coin,
    sheetInventory.reduce((sum, item) => sum + (item.cost?.[coin] || 0), 0),
  ]));
  const burden = encumbrance(document, graph, catalog, core, totalWeight, warnings);
  const armor = armorClass(instances, core, warnings);
  const actions = weaponActions(instances, graph, catalog, core, trace, document.build.ruleset);
  trace.inventoryWeight = { value: totalWeight, sources: [
    ...sheetInventory.filter((item) => item.weight !== null).map((item) => ({ kind: "equipment", sourceId: item.instanceId, label: item.name, value: item.weight })),
    ...(coinWeight ? [{ kind: "currency", sourceId: "currency", label: "Coin weight", value: coinWeight }] : []),
  ] };
  trace.currency = { value: money, sources: Object.entries(coins).map(([coin, amount]) => ({ kind: "currency", sourceId: `currency.${coin}`, label: coin.toUpperCase(), value: amount })) };
  trace.inventoryCost = { value: inventoryCost, sources: sheetInventory.flatMap((item) => Object.entries(item.cost || {}).filter(([, amount]) => amount).map(([coin, amount]) => ({ kind: "equipment", sourceId: item.instanceId, label: `${item.name} (${coin.toUpperCase()})`, value: amount }))) };
  trace.encumbrance = { value: burden, sources: [{ kind: "ability", sourceId: "stats.str.score", label: "Strength score", value: core.stats.str.score }, { kind: "size", sourceId: "build.description.size", label: burden.size || "Unknown size", value: SIZE_MULTIPLIERS[normalized(burden.size)] ?? null }, { kind: "weight", sourceId: "inventoryWeight", label: "Carried weight", value: totalWeight }] };
  return { inventory: sheetInventory, currency: money, inventoryCost, inventoryWeight: totalWeight, encumbrance: burden, armor, actions, trace, warnings: warnings.sorted() };
}
