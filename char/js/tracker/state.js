import { readJSON, writeJSON } from "../../../shared/js/storage.js";
import { readCloudJSON, writeCloudJSON } from "../../../shared/js/cloud-store.js";
import { normalizeDeathSaves, resetDeathSaves } from "./death-saves.js";
import { characterStateStorageKey } from "../storage-keys.js";

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

  function inventoryItemKey(item, index) {
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
    const saved = inventoryState.get(inventoryItemKey(item, index)) || {
      attuned: normalizeCharacterFlag(item.attuned) === 1,
      wearing: normalizeCharacterFlag(item.wearing) === 1,
    };
    return {
      attuned: normalizeCharacterFlag(item.attunement) === 1 && Boolean(saved.attuned),
      wearing: normalizeCharacterFlag(item.wearable) === 1 && Boolean(saved.wearing),
    };
  }

  function toggleInventoryItemState(index, field) {
    const item = (character.inventory || [])[index];
    const capability = field === "attuned" ? "attunement"
      : field === "wearing" ? "wearable" : "";
    if (!item || !capability || normalizeCharacterFlag(item[capability]) !== 1) return false;
    const key = inventoryItemKey(item, index);
    const current = getInventoryItemState(index);
    inventoryState.set(key, { ...current, [field]: !current[field] });
    return true;
  }

  function apply(state) {
    if (!state) return;
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
    if (Array.isArray(state.inventory)) {
      inventoryState.clear();
      state.inventory.forEach((saved) => {
        const inventory = character.inventory || [];
        const index = saved.key
          ? inventory.findIndex((item, itemIndex) => inventoryItemKey(item, itemIndex) === saved.key)
          : saved.id
            ? inventory.findIndex((entry) => entry.id === saved.id)
            : Number(saved.index);
        const item = inventory[index];
        if (!item || index < 0) return;
        inventoryState.set(inventoryItemKey(item, index), {
          attuned: normalizeCharacterFlag(saved.attuned) === 1,
          wearing: normalizeCharacterFlag(saved.wearing) === 1,
        });
      });
    }
    if (character.hp.current > 0) resetDeathSaves(character.deathSaves);
    enforcePreparedLimits();
  }

  function snapshot() {
    return {
      hp: { current: character.hp.current, temp: character.hp.temp },
      inspiration: character.inspiration,
      cinematic: character.cinematic,
      deathSaves: { ...character.deathSaves },
      trackers: (character.trackers || []).map((tracker) => ({ id: tracker.id, active: tracker.active })),
      uses: getAllCharacterItems().filter((item) => item.uses).map((item) => ({ id: item.id, current: item.uses.current })),
      slots: getSpellSlots().map((slot) => ({ id: slot.id, current: slot.current })),
      prepared: (character.spells || []).map((spell) => ({ id: spell.id, prepared: Boolean(spell.prepared) })),
      inventory: (character.inventory || []).map((item, index) => ({
        key: inventoryItemKey(item, index),
        ...getInventoryItemState(index),
      })),
    };
  }

  return {
    getInventoryItemState,
    toggleInventoryItemState,
    save() {
      const state = snapshot();
      writeJSON(storageKey, state);
      writeCloudJSON(`api/characters/${encodeURIComponent(character.id)}/state`, { value: state })
        .catch((error) => console.error("Could not save tracker state to D1:", error));
    },
    load() {
      apply(readJSON(storageKey, null));
    },
    async loadCloud() {
      const result = await readCloudJSON(`api/characters/${encodeURIComponent(character.id)}/state`, { fallback: null });
      if (result?.value) {
        apply(result.value);
        writeJSON(storageKey, result.value);
        return true;
      }
      return false;
    },
  };
}
