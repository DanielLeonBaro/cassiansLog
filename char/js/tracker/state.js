// Owns mutable tracker state plus local-first and best-effort cloud persistence.
import { readJSON, writeJSON } from "../../../shared/js/storage.js";
import { readCloudJSON, writeCloudJSON } from "../../../shared/js/cloud-store.js";
import { normalizeDeathSaves, resetDeathSaves } from "./death-saves.js";
import { characterStateStorageKey } from "../storage-keys.js";
import { setRuntimeInventoryItem, spendRuntimeItemCharge } from "../rules/runtime.js";

function runtimeApiPath(characterId, tail) {
  const resource = globalThis.document?.body?.dataset.trackerKind === "npc" ? "npcs" : "characters";
  return `api/${resource}/${encodeURIComponent(characterId)}/${tail}`;
}

export function normalizeCharacterFlag(value) {
  return value === true || Number(value) === 1 ? 1 : 0;
}

export function createTrackerState({
  character,
  getAllCharacterItems,
  getSpellSlots,
  findCharacterItem,
  findSpellSlot,
  enforcePreparedLimits,
}) {
  const storageKey = characterStateStorageKey(character.id);
  const inventoryState = new Map();
  let retainedState = {};

  function inventoryItemKey(item, index) {
    if (item?.instanceId) return `instance:${item.instanceId}`;
    if (item?.id) return `id:${item.id}`;
    const name = String(item?.name || "");
    const occurrence = (character.inventory || [])
      .slice(0, index + 1)
      .filter((entry) => String(entry?.name || "") === name)
      .length;
    return `name:${name}:${occurrence}`;
  }

  function getInventoryItemState(index) {
    const item = (character.inventory || [])[index];
    if (!item) return { attuned: false, wearing: false };
    const rulesReady = Boolean(item.instanceId);
    const saved = inventoryState.get(inventoryItemKey(item, index)) || {
      attuned: normalizeCharacterFlag(item.attuned) === 1,
      wearing: normalizeCharacterFlag(item.wearing) === 1,
      ...(rulesReady ? {
        quantity: Math.max(0, Number(item.quantity) || 0),
        containerId: String(item.containerId || ""),
        equipped: Boolean(item.equipped),
        charges: item.charges ? { current: Math.max(0, Number(item.charges.current) || 0) } : undefined,
      } : {}),
    };
    if (rulesReady) return {
      quantity: Math.max(0, Number(saved.quantity ?? item.quantity) || 0),
      containerId: String(saved.containerId ?? item.containerId ?? ""),
      equipped: Boolean(item.canEquip && (saved.equipped ?? item.equipped)),
      attuned: Boolean(item.canAttune && (saved.attuned ?? item.attuned)),
      ...(item.charges ? { charges: { current: Math.max(0, Math.min(Number(item.charges.max) || 0, Number(saved.charges?.current ?? item.charges.current) || 0)) } } : {}),
    };
    return {
      attuned: normalizeCharacterFlag(item.attunement) === 1 && Boolean(saved.attuned),
      wearing: normalizeCharacterFlag(item.wearable) === 1 && Boolean(saved.wearing),
    };
  }

  function toggleInventoryItemState(index, field) {
    const item = (character.inventory || [])[index];
    if (item?.instanceId && ["attuned", "equipped"].includes(field)) {
      return updateInventoryItemState(index, { [field]: !getInventoryItemState(index)[field] }).applied;
    }
    const capability = field === "attuned" ? "attunement"
      : field === "wearing" ? "wearable" : "";
    if (!item || !capability || normalizeCharacterFlag(item[capability]) !== 1) return false;
    const key = inventoryItemKey(item, index);
    const current = getInventoryItemState(index);
    inventoryState.set(key, { ...current, [field]: !current[field] });
    return true;
  }

  function inventoryRuntime() {
    return {
      ...retainedState,
      inventory: (character.inventory || []).flatMap((item, index) => item?.instanceId
        ? [{ instanceId: item.instanceId, ...getInventoryItemState(index) }]
        : []),
    };
  }

  function applyRulesInventory(runtime) {
    const saved = new Map((runtime.inventory || []).map((item) => [item.instanceId, item]));
    (character.inventory || []).forEach((item, index) => {
      if (!item?.instanceId || !saved.has(item.instanceId)) return;
      inventoryState.set(inventoryItemKey(item, index), saved.get(item.instanceId));
    });
  }

  function updateInventoryItemState(index, changes) {
    const item = (character.inventory || [])[index];
    if (!item?.instanceId) return { applied: false, warning: { code: "manual-inventory-item", message: "Edit manual inventory through Edit Inventory." } };
    const result = setRuntimeInventoryItem({ runtime: inventoryRuntime(), sheet: character, instanceId: item.instanceId, changes });
    if (result.applied) applyRulesInventory(result.runtime);
    return result;
  }

  function spendInventoryItemCharge(index, amount = 1) {
    const item = (character.inventory || [])[index];
    if (!item?.instanceId) return { applied: false, warning: { code: "manual-inventory-item", message: "This item has no automatic charge tracker." } };
    const result = spendRuntimeItemCharge({ runtime: inventoryRuntime(), sheet: character, instanceId: item.instanceId, amount });
    if (result.applied) applyRulesInventory(result.runtime);
    return result;
  }

  function apply(state) {
    if (!state) return;
    retainedState = { ...state };
    if (Object.prototype.hasOwnProperty.call(state, "inspiration"))
      character.inspiration = normalizeCharacterFlag(state.inspiration);
    if (Object.prototype.hasOwnProperty.call(state, "cinematic"))
      character.cinematic = normalizeCharacterFlag(state.cinematic);
    if (state.deathSaves)
      character.deathSaves = normalizeDeathSaves(state.deathSaves);
    if (state.hp) {
      character.hp.current = Math.min(character.hp.max, Number(state.hp.current));
      character.hp.temp = Math.max(0, Number(state.hp.temp) || 0);
    }
    if (Array.isArray(state.hitDice)) {
      const savedDice = new Map(state.hitDice.map((item) => [item.die, item]));
      character.hitDice = (character.hitDice || []).map((pool) => ({
        ...pool,
        current: Math.max(0, Math.min(pool.max, Number(savedDice.get(pool.die)?.current ?? pool.current ?? pool.max))),
      }));
    }
    if (Array.isArray(state.conditions)) character.conditions = state.conditions.map((condition) =>
      condition && typeof condition === "object" ? { ...condition } : condition);
    if (Object.prototype.hasOwnProperty.call(state, "concentration"))
      character.concentration = state.concentration && typeof state.concentration === "object"
        ? { ...state.concentration } : state.concentration || null;
    if (Object.prototype.hasOwnProperty.call(state, "exhaustion"))
      character.exhaustion = Math.max(0, Math.min(6, Math.trunc(Number(state.exhaustion) || 0)));
    (state.trackers || []).forEach((saved) => {
      const tracker = (character.trackers || []).find((item) => item.id === saved.id);
      if (tracker) tracker.active = Boolean(saved.active);
    });
    (state.uses || []).forEach((saved) => {
      const item = findCharacterItem(saved.id);
      if (item?.uses)
        item.uses.current = Math.max(0, Math.min(item.uses.max, Number(saved.current)));
    });
    (state.slots || []).forEach((saved) => {
      const slot = findSpellSlot(saved.id);
      if (slot)
        slot.current = Math.max(0, Math.min(slot.max, Number(saved.current)));
    });
    (state.prepared || []).forEach((saved) => {
      const spell = (character.spells || []).find((item) => item.id === saved.id);
      if (spell) spell.prepared = Boolean(saved.prepared);
    });
    (state.extras || []).forEach((saved) => {
      const extra = (character.extras || []).find((item) => item.id === saved.id);
      if (!extra?.hp) return;
      extra.hp.current = Math.max(0, Math.min(Number(extra.hp.max) || 0, Number(saved.hp?.current ?? extra.hp.current) || 0));
      extra.hp.temp = Math.max(0, Number(saved.hp?.temp ?? extra.hp.temp) || 0);
    });
    if (Array.isArray(state.inventory)) {
      inventoryState.clear();
      state.inventory.forEach((saved) => {
        const inventory = character.inventory || [];
        const index = saved.key
          ? inventory.findIndex((item, itemIndex) => inventoryItemKey(item, itemIndex) === saved.key)
          : saved.instanceId
            ? inventory.findIndex((entry) => entry.instanceId === saved.instanceId)
          : saved.id
            ? inventory.findIndex((entry) => entry.id === saved.id)
            : Number(saved.index);
        const item = inventory[index];
        if (!item || index < 0) return;
        inventoryState.set(inventoryItemKey(item, index), {
          ...(saved.instanceId ? saved : {}),
          attuned: normalizeCharacterFlag(saved.attuned) === 1,
          wearing: normalizeCharacterFlag(saved.wearing) === 1,
          ...(item.instanceId ? {
            quantity: Math.max(0, Number(saved.quantity ?? item.quantity) || 0),
            containerId: String(saved.containerId ?? item.containerId ?? ""),
            equipped: Boolean(saved.equipped),
            ...(item.charges ? { charges: { current: Math.max(0, Number(saved.charges?.current ?? saved.charges ?? item.charges.current) || 0) } } : {}),
          } : {}),
        });
      });
    }
    if (character.hp.current > 0) resetDeathSaves(character.deathSaves);
    enforcePreparedLimits();
  }

  function snapshot() {
    const uses = getAllCharacterItems().filter((item) => item.uses).map((item) => ({ id: item.id, current: item.uses.current }));
    const useIds = new Set(uses.map((item) => item.id));
    const slots = getSpellSlots().map((slot) => ({ id: slot.id, current: slot.current }));
    const slotIds = new Set(slots.map((slot) => slot.id));
    const hitDice = (character.hitDice || []).map((pool) => ({ die: pool.die, current: pool.current }));
    const hitDiceIds = new Set(hitDice.map((pool) => pool.die));
    const extras = (character.extras || []).filter((item) => item?.id && item.hp).map((item) => ({
      id: item.id,
      hp: { current: Math.max(0, Number(item.hp.current) || 0), temp: Math.max(0, Number(item.hp.temp) || 0) },
    }));
    const extraIds = new Set(extras.map((item) => item.id));
    return {
      ...retainedState,
      hp: { current: character.hp.current, temp: character.hp.temp },
      inspiration: character.inspiration,
      cinematic: character.cinematic,
      deathSaves: { ...character.deathSaves },
      hitDice: [
        ...hitDice,
        ...(Array.isArray(retainedState.hitDice) ? retainedState.hitDice : [])
          .filter((pool) => !hitDiceIds.has(pool.die)),
      ],
      conditions: (character.conditions || []).map((condition) =>
        condition && typeof condition === "object" ? { ...condition } : condition),
      concentration: character.concentration && typeof character.concentration === "object"
        ? { ...character.concentration } : character.concentration || null,
      exhaustion: Math.max(0, Math.min(6, Math.trunc(Number(character.exhaustion) || 0))),
      trackers: (character.trackers || []).map((tracker) => ({ id: tracker.id, active: tracker.active })),
      uses: [
        ...uses,
        ...(Array.isArray(retainedState.uses) ? retainedState.uses : [])
          .filter((item) => !useIds.has(item.id)),
      ],
      slots: [
        ...slots,
        ...(Array.isArray(retainedState.slots) ? retainedState.slots : [])
          .filter((slot) => !slotIds.has(slot.id)),
      ],
      prepared: (character.spells || []).map((spell) => ({ id: spell.id, prepared: Boolean(spell.prepared) })),
      extras: [
        ...extras,
        ...(Array.isArray(retainedState.extras) ? retainedState.extras : []).filter((item) => !extraIds.has(item.id)),
      ],
      inventory: (character.inventory || []).map((item, index) => ({
        key: inventoryItemKey(item, index),
        ...(item.instanceId ? { instanceId: item.instanceId } : {}),
        ...getInventoryItemState(index),
      })),
    };
  }

  return {
    getInventoryItemState,
    updateInventoryItemState,
    spendInventoryItemCharge,
    toggleInventoryItemState,
    save() {
      const state = snapshot();
      writeJSON(storageKey, state);
      writeCloudJSON(runtimeApiPath(character.id, "state"), { value: state })
        .catch((error) => console.error("Could not save tracker state to D1:", error));
    },
    load() {
      apply(readJSON(storageKey, null));
    },
    async loadCloud() {
      const result = await readCloudJSON(runtimeApiPath(character.id, "state"), { fallback: null });
      if (result?.value) {
        apply(result.value);
        writeJSON(storageKey, result.value);
        return true;
      }
      return false;
    },
  };
}
