// Normalizes mutable Character play state and applies pure resource/rest transitions.
import { cloneJSON } from "../../../shared/js/text.js";

function isRecord(value) {
  return Object.prototype.toString.call(value) === "[object Object]";
}

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function finite(value, fallback = 0) {
  if (value === "" || value === null || value === undefined || typeof value === "boolean") return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function bounded(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, finite(value, minimum)));
}

function slug(value) {
  return text(value).toLowerCase().replaceAll(/[^a-z0-9]+/g, "-").replaceAll(/^-|-$/g, "");
}

function normalizeConditions(value) {
  if (!Array.isArray(value)) return [];
  const conditions = new Map();
  value.forEach((candidate) => {
    const source = isRecord(candidate) ? cloneJSON(candidate) : { name: text(candidate) };
    const name = text(source.name) || text(source.id);
    const id = text(source.id) || slug(name);
    if (!name || !id || conditions.has(id)) return;
    conditions.set(id, {
      ...source,
      id,
      name,
      reset: ["short", "long", "turn", "manual"].includes(source.reset) ? source.reset : "manual",
    });
  });
  return [...conditions.values()].sort((left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id));
}

function normalizeConcentration(value) {
  if (!value) return null;
  const source = isRecord(value) ? cloneJSON(value) : { name: text(value) };
  const name = text(source.name) || text(source.id);
  if (!name) return null;
  return { ...source, id: text(source.id) || slug(name), name };
}

function definitionItems(sheet) {
  const items = [
    ...(Array.isArray(sheet?.resources) ? sheet.resources : []),
    ...(Array.isArray(sheet?.actions) ? sheet.actions
      .filter((item) => item?.uses)
      .map((item) => ({ ...item, id: text(item.resourceId) || item.id })) : []),
  ];
  return [...new Map(items.filter((item) => text(item?.id)).map((item) => [item.id, item])).values()];
}

function normalizedUses(runtime, sheet) {
  const saved = new Map((Array.isArray(runtime?.uses) ? runtime.uses : [])
    .filter((item) => isRecord(item) && text(item.id))
    .map((item) => [item.id, item]));
  const definitions = new Map();
  definitionItems(sheet).forEach((item) => {
    const id = text(item?.id);
    if (id && item.uses && !definitions.has(id)) definitions.set(id, item);
  });
  const known = [...definitions.values()].map((item) => {
    const max = Math.max(0, Math.trunc(finite(item.uses.max)));
    return {
      ...cloneJSON(saved.get(item.id) || {}),
      id: item.id,
      current: bounded(saved.get(item.id)?.current ?? max, 0, max),
    };
  });
  const unknown = [...saved.values()]
    .filter((item) => !definitions.has(item.id))
    .map((item) => ({ ...cloneJSON(item), id: item.id, current: Math.max(0, Math.trunc(finite(item.current))) }));
  return [...known, ...unknown];
}

function normalizedHitDice(runtime, sheet) {
  const saved = new Map((Array.isArray(runtime?.hitDice) ? runtime.hitDice : [])
    .filter((item) => isRecord(item) && /^d\d+$/.test(text(item.die)))
    .map((item) => [item.die, item]));
  const definitions = Array.isArray(sheet?.hitDice) ? sheet.hitDice : [];
  const known = definitions.flatMap((pool) => {
    const die = text(pool?.die);
    const max = Math.max(0, Math.trunc(finite(pool?.max)));
    if (!die || !max) return [];
    return [{
      ...cloneJSON(saved.get(die) || {}),
      die,
      current: bounded(saved.get(die)?.current ?? max, 0, max),
      max,
    }];
  });
  const knownDice = new Set(known.map((pool) => pool.die));
  const unknown = [...saved.values()]
    .filter((pool) => !knownDice.has(pool.die))
    .map((pool) => ({ ...cloneJSON(pool), die: pool.die, current: Math.max(0, Math.trunc(finite(pool.current))) }));
  return [...known, ...unknown];
}

function normalizedSlots(runtime, sheet) {
  const saved = new Map((Array.isArray(runtime?.slots) ? runtime.slots : [])
    .filter((item) => isRecord(item) && text(item.id))
    .map((item) => [item.id, item]));
  const definitions = Array.isArray(sheet?.spellcasting?.slots) ? sheet.spellcasting.slots : [];
  const known = definitions.flatMap((slot) => {
    const id = text(slot?.id);
    const max = Math.max(0, Math.trunc(finite(slot?.max)));
    if (!id) return [];
    return [{ ...cloneJSON(saved.get(id) || {}), id, current: bounded(saved.get(id)?.current ?? max, 0, max) }];
  });
  const knownIds = new Set(known.map((slot) => slot.id));
  const unknown = [...saved.values()]
    .filter((slot) => !knownIds.has(slot.id))
    .map((slot) => ({ ...cloneJSON(slot), id: slot.id, current: Math.max(0, Math.trunc(finite(slot.current))) }));
  return [...known, ...unknown];
}

function normalizedPrepared(runtime, sheet) {
  const saved = new Map((Array.isArray(runtime?.prepared) ? runtime.prepared : [])
    .filter((item) => isRecord(item) && text(item.id))
    .map((item) => [item.id, item]));
  const definitions = Array.isArray(sheet?.spells) ? sheet.spells : [];
  const known = definitions
    .filter((spell) => text(spell?.id))
    .map((spell) => ({
      ...cloneJSON(saved.get(spell.id) || {}),
      id: spell.id,
      prepared: spell.alwaysPrepared || Number(spell.level) === 0 || spell.preparationRequired !== true
        ? Boolean(spell.prepared)
        : Boolean(saved.get(spell.id)?.prepared),
    }));
  const knownIds = new Set(known.map((spell) => spell.id));
  const unknown = [...saved.values()]
    .filter((spell) => !knownIds.has(spell.id))
    .map((spell) => ({ ...cloneJSON(spell), id: spell.id, prepared: Boolean(spell.prepared) }));
  return [...known, ...unknown];
}

function normalizedCurrency(value) {
  const source = isRecord(value) ? value : {};
  return Object.fromEntries(["cp", "sp", "ep", "gp", "pp"].map((coin) => [
    coin,
    Math.max(0, Math.trunc(finite(source[coin]))),
  ]));
}

function normalizedInventory(runtime, sheet) {
  const saved = new Map((Array.isArray(runtime?.inventory) ? runtime.inventory : [])
    .filter((item) => isRecord(item) && text(item.instanceId))
    .map((item) => [item.instanceId, item]));
  const definitions = Array.isArray(sheet?.inventory) ? sheet.inventory : [];
  const known = definitions.filter((item) => text(item?.instanceId)).map((item) => {
    const state = saved.get(item.instanceId) || {};
    const chargesMax = Math.max(0, Math.trunc(finite(item.charges?.max)));
    return {
      ...cloneJSON(state),
      instanceId: item.instanceId,
      quantity: Math.max(0, finite(state.quantity, item.quantity)),
      containerId: text(state.containerId ?? item.containerId),
      equipped: item.canEquip ? Boolean(state.equipped ?? item.equipped) : false,
      attuned: item.canAttune ? Boolean(state.attuned ?? item.attuned) : false,
      ...(item.charges ? { charges: {
        ...(isRecord(state.charges) ? state.charges : {}),
        current: bounded(state.charges?.current ?? state.charges ?? item.charges.current ?? chargesMax, 0, chargesMax),
      } } : {}),
    };
  });
  const knownIds = new Set(known.map((item) => item.instanceId));
  const unknown = [...saved.values()]
    .filter((item) => !knownIds.has(item.instanceId))
    .map((item) => ({ ...cloneJSON(item), instanceId: item.instanceId }));
  return [...known, ...unknown];
}

export function normalizeCharacterRuntime({ runtime, sheet } = {}) {
  const source = isRecord(runtime) ? cloneJSON(runtime) : {};
  const hpMax = Math.max(0, finite(sheet?.hp?.max));
  return {
    ...source,
    hp: {
      ...(isRecord(source.hp) ? source.hp : {}),
      current: bounded(source.hp?.current ?? hpMax, 0, hpMax),
      temp: Math.max(0, finite(source.hp?.temp)),
    },
    deathSaves: {
      failures: bounded(source.deathSaves?.failures, 0, 3),
      successes: bounded(source.deathSaves?.successes, 0, 3),
      stable: source.deathSaves?.stable ? 1 : 0,
    },
    hitDice: normalizedHitDice(source, sheet),
    uses: normalizedUses(source, sheet),
    slots: normalizedSlots(source, sheet),
    prepared: normalizedPrepared(source, sheet),
    inventory: normalizedInventory(source, sheet),
    currency: normalizedCurrency(source.currency ?? sheet?.currency),
    conditions: normalizeConditions(source.conditions),
    concentration: normalizeConcentration(source.concentration),
    inspiration: source.inspiration === true,
    exhaustion: Math.trunc(bounded(source.exhaustion, 0, 6)),
  };
}

function failedInventory(runtime, code, instanceId, message) {
  return { runtime, applied: false, warning: { code, path: `runtime.inventory.${instanceId}`, blocking: false, message } };
}

export function setRuntimeInventoryItem({ runtime, sheet, instanceId, changes = {} } = {}) {
  const next = normalizeCharacterRuntime({ runtime, sheet });
  const id = text(instanceId);
  const definition = (Array.isArray(sheet?.inventory) ? sheet.inventory : []).find((item) => item?.instanceId === id);
  const state = next.inventory.find((item) => item.instanceId === id);
  if (!definition || !state) return failedInventory(next, "unknown-runtime-item", id, `Inventory instance ${id} does not exist.`);
  if (changes.equipped !== undefined) {
    if (changes.equipped && !definition.canEquip) return failedInventory(next, "item-cannot-equip", id, `${definition.name || id} cannot be equipped.`);
    state.equipped = Boolean(changes.equipped);
  }
  if (changes.attuned !== undefined) {
    if (changes.attuned && !definition.canAttune) return failedInventory(next, "item-cannot-attune", id, `${definition.name || id} cannot be attuned.`);
    if (changes.attuned) {
      const definitions = new Map((sheet.inventory || []).map((item) => [item.instanceId, item]));
      const active = next.inventory.filter((item) => item.attuned && item.instanceId !== id);
      if (active.length >= 3) return failedInventory(next, "attunement-limit", id, "A character can attune to no more than three items.");
      if (active.some((item) => definitions.get(item.instanceId)?.definitionId === definition.definitionId)) {
        return failedInventory(next, "duplicate-item-attunement", id, `Only one copy of ${definition.name || id} can be attuned.`);
      }
    }
    state.attuned = Boolean(changes.attuned);
  }
  if (changes.quantity !== undefined) state.quantity = Math.max(0, finite(changes.quantity, state.quantity));
  if (changes.containerId !== undefined) {
    const containerId = text(changes.containerId);
    if (containerId) {
      const container = (sheet.inventory || []).find((item) => item.instanceId === containerId);
      if (!container || container.containerCapacity === null) return failedInventory(next, "invalid-inventory-container", id, `Container ${containerId} does not exist or cannot contain items.`);
      const parents = new Map(next.inventory.map((item) => [item.instanceId, item.containerId]));
      parents.set(id, containerId);
      const visited = new Set([id]);
      let cursor = containerId;
      while (cursor) {
        if (visited.has(cursor)) return failedInventory(next, "inventory-container-cycle", id, "Inventory containers cannot contain themselves.");
        visited.add(cursor);
        cursor = parents.get(cursor);
      }
    }
    state.containerId = containerId;
  }
  return { runtime: next, applied: true, warning: null };
}

export function spendRuntimeItemCharge({ runtime, sheet, instanceId, amount = 1 } = {}) {
  const next = normalizeCharacterRuntime({ runtime, sheet });
  const id = text(instanceId);
  const state = next.inventory.find((item) => item.instanceId === id);
  const definition = (sheet?.inventory || []).find((item) => item.instanceId === id);
  const cost = Math.max(1, Math.trunc(finite(amount, 1)));
  if (!state?.charges || !definition?.charges) return failedInventory(next, "unknown-item-charges", id, `${definition?.name || id} has no tracked charges.`);
  if (state.charges.current < cost) return failedInventory(next, "insufficient-item-charges", id, `${definition.name || id} has insufficient charges.`);
  state.charges.current -= cost;
  return { runtime: next, applied: true, warning: null };
}

export function setRuntimeSpellPrepared({ runtime, sheet, spellId, prepared = true } = {}) {
  const next = normalizeCharacterRuntime({ runtime, sheet });
  const id = text(spellId);
  const spell = (Array.isArray(sheet?.spells) ? sheet.spells : []).find((candidate) => candidate?.id === id);
  if (!spell) return {
    runtime: next,
    applied: false,
    warning: { code: "unknown-runtime-spell", path: `runtime.prepared.${id}`, blocking: false, message: `Spell ${id} does not exist.` },
  };
  if (!spell.preparationRequired || spell.alwaysPrepared || Number(spell.level) === 0) return {
    runtime: next,
    applied: false,
    warning: { code: "fixed-spell-preparation", path: `runtime.prepared.${id}`, blocking: false, message: `${spell.name || id} preparation cannot be changed.` },
  };
  const profile = (sheet.spellcasting?.profiles || []).find((candidate) => candidate.id === spell.source);
  if (!profile) return {
    runtime: next,
    applied: false,
    warning: { code: "unresolved-spellcasting-profile", path: `runtime.prepared.${id}`, blocking: true, message: `${spell.name || id} has no spellcasting profile.` },
  };
  const state = next.prepared.find((item) => item.id === id);
  const current = Boolean(state?.prepared);
  const desired = Boolean(prepared);
  if (current === desired) return { runtime: next, applied: true, warning: null };
  if (desired) {
    const preparedIds = new Set(next.prepared.filter((item) => item.prepared).map((item) => item.id));
    const used = (sheet.spells || []).filter((candidate) =>
      candidate.source === profile.id
      && candidate.preparationRequired
      && preparedIds.has(candidate.id)).length;
    if (profile.preparedLimit > 0 && used >= profile.preparedLimit) return {
      runtime: next,
      applied: false,
      warning: { code: "prepared-spell-limit", path: `runtime.prepared.${profile.id}`, blocking: false, message: `${profile.name} cannot prepare more than ${profile.preparedLimit} spells.` },
    };
  }
  if (state) state.prepared = desired;
  else next.prepared.push({ id, prepared: desired });
  return { runtime: next, applied: true, warning: null };
}

export function castRuntimeSpell({ runtime, sheet, spellId, slotId = "", ritual = false } = {}) {
  const next = normalizeCharacterRuntime({ runtime, sheet });
  const id = text(spellId);
  const spell = (Array.isArray(sheet?.spells) ? sheet.spells : []).find((candidate) => candidate?.id === id);
  const failed = (code, path, message) => ({
    runtime: next,
    applied: false,
    cast: null,
    warning: { code, path, blocking: false, message },
  });
  if (!spell) return failed("unknown-runtime-spell", `runtime.spells.${id}`, `Spell ${id} does not exist.`);
  if (ritual) {
    if (!spell.ritualCastable) return failed("spell-not-ritual-castable", `runtime.spells.${id}`, `${spell.name || id} cannot be cast as a ritual.`);
    if (spell.concentration) next.concentration = { id: spell.id, name: spell.name };
    return {
      runtime: next,
      applied: true,
      cast: { spellId: id, slotId: "", castLevel: Number(spell.level) || 0, upcastBy: 0, ritual: true },
      warning: null,
    };
  }
  if (!spell.castable) return failed("spell-not-castable", `runtime.spells.${id}`, `${spell.name || id} is not available to cast.`);
  const spellLevel = Math.max(0, Math.trunc(Number(spell.level) || 0));
  if (spellLevel === 0 || spell.withoutSlot) {
    if (spell.concentration) next.concentration = { id: spell.id, name: spell.name };
    return {
      runtime: next,
      applied: true,
      cast: { spellId: id, slotId: "", castLevel: spellLevel, upcastBy: 0, ritual: false },
      warning: null,
    };
  }
  const selectedSlotId = text(slotId);
  if (!selectedSlotId) return failed("spell-slot-required", `runtime.spells.${id}`, `${spell.name || id} requires a selected spell slot.`);
  const definition = (sheet.spellcasting?.slots || []).find((slot) => slot.id === selectedSlotId);
  const slot = next.slots.find((candidate) => candidate.id === selectedSlotId);
  if (!definition || !slot) return failed("unknown-runtime-slot", `runtime.slots.${selectedSlotId}`, `Spell slot ${selectedSlotId} does not exist.`);
  if (Number(definition.level) < spellLevel) return failed("spell-slot-too-low", `runtime.slots.${selectedSlotId}`, `${spell.name || id} needs a level ${spellLevel} or higher slot.`);
  if (slot.current < 1) return failed("insufficient-runtime-slot", `runtime.slots.${selectedSlotId}`, `Spell slot ${selectedSlotId} has no uses remaining.`);
  slot.current -= 1;
  if (spell.concentration) next.concentration = { id: spell.id, name: spell.name };
  const castLevel = Number(definition.level);
  return {
    runtime: next,
    applied: true,
    cast: { spellId: id, slotId: selectedSlotId, castLevel, upcastBy: castLevel - spellLevel, ritual: false },
    warning: null,
  };
}

export function recoverRuntimeSpellSlots({ runtime, sheet, profileId, slots = [] } = {}) {
  const next = normalizeCharacterRuntime({ runtime, sheet });
  const profile = (sheet?.spellcasting?.profiles || []).find((candidate) => candidate.id === text(profileId));
  const failed = (code, message) => ({ runtime: next, applied: false, warning: { code, path: `runtime.slots.${text(profileId)}`, blocking: false, message } });
  if (!profile?.slotRecovery) return failed("spell-slot-recovery-unavailable", `Spellcasting profile ${text(profileId)} has no slot recovery feature.`);
  const resource = next.uses.find((use) => use.id === profile.slotRecovery.resourceId);
  if (!resource?.current) return failed("insufficient-runtime-resource", `${profile.name} has no slot recovery use remaining.`);
  const definitions = new Map((sheet.spellcasting?.slots || []).map((slot) => [slot.id, slot]));
  const requested = new Map();
  for (const candidate of Array.isArray(slots) ? slots : []) {
    const id = text(candidate?.id || candidate?.slotId);
    const amount = Math.trunc(finite(candidate?.amount, 0));
    const definition = definitions.get(id);
    const state = next.slots.find((slot) => slot.id === id);
    if (!definition || !state || definition.pool !== "spellcasting" || definition.level > profile.slotRecovery.maxSlotLevel || amount < 1) {
      return failed("invalid-spell-slot-recovery", `Slot recovery request ${id || "unknown"} is invalid.`);
    }
    requested.set(id, (requested.get(id) || 0) + amount);
  }
  if (!requested.size) return failed("invalid-spell-slot-recovery", "Choose at least one expended spell slot to recover.");
  let cost = 0;
  for (const [id, amount] of requested) {
    const definition = definitions.get(id);
    const state = next.slots.find((slot) => slot.id === id);
    if (state.current + amount > definition.max) return failed("spell-slot-recovery-overflow", `${id} cannot recover beyond its maximum.`);
    cost += definition.level * amount;
  }
  if (cost > profile.slotRecovery.budget) return failed("spell-slot-recovery-budget", `${profile.name} can recover ${profile.slotRecovery.budget} total slot levels.`);
  for (const [id, amount] of requested) next.slots.find((slot) => slot.id === id).current += amount;
  resource.current -= 1;
  return { runtime: next, applied: true, warning: null };
}

export function spendRuntimeResource({ runtime, sheet, resourceId, amount = 1 } = {}) {
  const next = normalizeCharacterRuntime({ runtime, sheet });
  const id = text(resourceId);
  const cost = Math.max(1, Math.trunc(finite(amount, 1)));
  const resource = next.uses.find((item) => item.id === id);
  const definition = definitionItems(sheet).find((item) => item?.id === id && item.uses);
  if (!resource || !definition) return {
    runtime: next,
    applied: false,
    warning: { code: "unknown-runtime-resource", path: `runtime.uses.${id}`, blocking: false, message: `Resource ${id} does not exist.` },
  };
  if (resource.current < cost) return {
    runtime: next,
    applied: false,
    warning: { code: "insufficient-runtime-resource", path: `runtime.uses.${id}`, blocking: false, message: `Resource ${id} has insufficient uses.` },
  };
  resource.current -= cost;
  return { runtime: next, applied: true, warning: null };
}

export function setRuntimeCondition(runtime, condition, active = true) {
  const result = isRecord(runtime) ? cloneJSON(runtime) : {};
  const normalized = normalizeConditions([condition])[0];
  if (!normalized) throw new TypeError("Condition needs an ID or name.");
  const conditions = normalizeConditions(result.conditions);
  result.conditions = active
    ? normalizeConditions([...conditions.filter((item) => item.id !== normalized.id), normalized])
    : conditions.filter((item) => item.id !== normalized.id);
  return result;
}

export function setRuntimeConcentration(runtime, concentration) {
  const result = isRecord(runtime) ? cloneJSON(runtime) : {};
  result.concentration = normalizeConcentration(concentration);
  return result;
}

function restEligible(reset = "long", kind) {
  if (kind === "short") return reset === "short";
  return ["short", "long", "day"].includes(reset);
}

function restoreHitDice(runtime, sheet, ruleset, warnings, changes) {
  const sheetPools = Array.isArray(sheet?.hitDice) ? sheet.hitDice : [];
  if (ruleset === "5.5e") {
    runtime.hitDice.forEach((pool) => {
      const definition = sheetPools.find((item) => item.die === pool.die);
      if (!definition) return;
      const maximum = definition.max || 0;
      if (pool.current < maximum) changes.push(`hitDice.${pool.die}`);
      pool.current = maximum;
    });
    return;
  }
  const total = sheetPools.reduce((sum, pool) => sum + pool.max, 0);
  let remaining = Math.max(1, Math.floor(total / 2));
  const spentPools = runtime.hitDice.filter((pool) => {
    const maximum = sheetPools.find((item) => item.die === pool.die)?.max || 0;
    return pool.current < maximum;
  });
  if (spentPools.length > 1) warnings.push({
    code: "default-hit-die-recovery-order",
    path: "runtime.hitDice",
    blocking: false,
    message: "2014 multiclass hit dice recovered in displayed order; UI choice is not available yet.",
  });
  runtime.hitDice.forEach((pool) => {
    const maximum = sheetPools.find((item) => item.die === pool.die)?.max || 0;
    const recovered = Math.min(remaining, Math.max(0, maximum - pool.current));
    if (recovered) changes.push(`hitDice.${pool.die}`);
    pool.current += recovered;
    remaining -= recovered;
  });
}

export function applyCharacterRest({ runtime, sheet, ruleset = "5e", kind } = {}) {
  if (!["short", "long"].includes(kind)) throw new TypeError("Rest kind must be short or long.");
  const next = normalizeCharacterRuntime({ runtime, sheet });
  if (next.hp.current < 1) return {
    runtime: next,
    applied: false,
    changes: [],
    warnings: [{ code: "rest-ineligible", path: "runtime.hp.current", blocking: true, message: "A rest requires at least 1 current hit point." }],
  };
  const changes = [];
  const warnings = [];
  const resources = new Map(definitionItems(sheet).filter((item) => item?.uses).map((item) => [item.id, item]));
  next.uses.forEach((use) => {
    const definition = resources.get(use.id);
    if (!definition) return;
    const maximum = Math.max(0, Math.trunc(finite(definition.uses.max)));
    const recovery = definition.uses.recovery?.[kind];
    if (recovery !== undefined) {
      const recovered = recovery === "all" ? maximum : Math.max(0, Math.trunc(finite(recovery)));
      const nextCurrent = Math.min(maximum, use.current + recovered);
      if (use.current !== nextCurrent) changes.push(`uses.${use.id}`);
      use.current = nextCurrent;
      return;
    }
    if (!restEligible(definition.uses.reset, kind)) return;
    if (use.current !== maximum) changes.push(`uses.${use.id}`);
    use.current = maximum;
  });
  const slots = new Map((sheet?.spellcasting?.slots || []).map((slot) => [slot.id, slot]));
  next.slots.forEach((slot) => {
    const definition = slots.get(slot.id);
    if (!definition || !restEligible(definition.reset || "long", kind)) return;
    const maximum = Math.max(0, Math.trunc(finite(definition.max)));
    if (slot.current !== maximum) changes.push(`slots.${slot.id}`);
    slot.current = maximum;
  });
  const inventory = new Map((sheet?.inventory || []).map((item) => [item.instanceId, item]));
  next.inventory.forEach((item) => {
    const definition = inventory.get(item.instanceId);
    if (!item.charges || !definition?.charges || !restEligible(definition.charges.reset, kind)) return;
    const maximum = Math.max(0, Math.trunc(finite(definition.charges.max)));
    if (item.charges.current !== maximum) changes.push(`inventory.${item.instanceId}.charges`);
    item.charges.current = maximum;
  });
  const beforeConditions = next.conditions.length;
  next.conditions = next.conditions.filter((condition) => !restEligible(condition.reset, kind));
  if (next.conditions.length !== beforeConditions) changes.push("conditions");

  if (kind === "long") {
    if (sheet?.rest?.long?.inspiration === true && !next.inspiration) {
      next.inspiration = true;
      changes.push("inspiration");
    }
    if (next.hp.current !== sheet.hp.max) changes.push("hp.current");
    if (next.hp.temp) changes.push("hp.temp");
    next.hp.current = sheet.hp.max;
    next.hp.temp = 0;
    if (Object.values(next.deathSaves).some(Boolean)) changes.push("deathSaves");
    next.deathSaves = { failures: 0, successes: 0, stable: 0 };
    restoreHitDice(next, sheet, ruleset, warnings, changes);
    if (next.concentration) changes.push("concentration");
    next.concentration = null;
    const exhaustionEligible = ruleset === "5.5e" || next.restEligibility?.foodAndDrink === true;
    if (next.exhaustion && exhaustionEligible) {
      next.exhaustion -= 1;
      changes.push("exhaustion");
    }
  }

  return { runtime: next, applied: true, changes: [...new Set(changes)], warnings };
}
