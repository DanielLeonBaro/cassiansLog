import { readJSON, writeJSON } from "../../../shared/js/storage.js";
import { readCloudJSON, writeCloudJSON } from "../../../shared/js/cloud-store.js";
import { normalizeDeathSaves, resetDeathSaves } from "./death-saves.js";

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
  const storageKey = `dnd-${character.id || "character"}-state`;

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
    };
  }

  return {
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
