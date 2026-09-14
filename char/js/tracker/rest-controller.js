// Coordinates rest confirmation, resource resets, refresh, and save timing.
import { resetDeathSaves } from "./death-saves.js";
import { getRestDetails } from "./rest.js";
import { applyCharacterRest } from "../rules/runtime.js";

export function createRestController({
  character,
  documentRoot = document,
  getAllCharacterItems,
  getSpellSlots,
  refresh,
  save,
  setTimeoutFn = setTimeout,
}) {
  let pendingRest = null;
  let toastTimer = null;

  function rulesRest(kind) {
    const items = getAllCharacterItems();
    const slots = getSpellSlots();
    const itemDefinitions = items.map((item, index) => ({
      ...item,
      id: item.id || `tracker-item-${index}`,
    }));
    const slotDefinitions = slots.map((slot, index) => ({
      ...slot,
      id: slot.id || `tracker-slot-${index}`,
    }));
    const result = applyCharacterRest({
      kind,
      ruleset: character.build.ruleset,
      sheet: {
        hp: character.hp,
        hitDice: character.hitDice || [],
        resources: itemDefinitions,
        spellcasting: { slots: slotDefinitions },
      },
      runtime: {
        hp: character.hp,
        deathSaves: character.deathSaves,
        hitDice: character.hitDice || [],
        uses: itemDefinitions.filter((item) => item.uses).map((item) => ({ id: item.id, current: item.uses.current })),
        slots: slotDefinitions.map((slot) => ({ id: slot.id, current: slot.current })),
        conditions: character.conditions,
        concentration: character.concentration,
        exhaustion: character.exhaustion,
        restEligibility: character.restEligibility,
      },
    });
    if (!result.applied) return false;
    character.hp.current = result.runtime.hp.current;
    character.hp.temp = result.runtime.hp.temp;
    character.deathSaves = result.runtime.deathSaves;
    character.hitDice = result.runtime.hitDice;
    character.conditions = result.runtime.conditions;
    character.concentration = result.runtime.concentration;
    character.exhaustion = result.runtime.exhaustion;
    const uses = new Map(result.runtime.uses.map((item) => [item.id, item.current]));
    itemDefinitions.forEach((definition, index) => {
      if (items[index].uses && uses.has(definition.id)) items[index].uses.current = uses.get(definition.id);
    });
    const restoredSlots = new Map(result.runtime.slots.map((slot) => [slot.id, slot.current]));
    slotDefinitions.forEach((definition, index) => {
      if (restoredSlots.has(definition.id)) slots[index].current = restoredSlots.get(definition.id);
    });
    save();
    refresh();
    return true;
  }

  function shortRest() {
    if (character.build?.mode === "rules") return rulesRest("short");
    getAllCharacterItems()
      .filter((item) => item.uses?.reset === "short")
      .forEach((item) => { item.uses.current = item.uses.max; });
    getSpellSlots()
      .filter((slot) => (slot.reset || "long") === "short")
      .forEach((slot) => { slot.current = slot.max; });
    character.hp.temp = 0;
    resetDeathSaves(character.deathSaves);
    save();
    refresh();
  }

  function longRest() {
    if (character.build?.mode === "rules") return rulesRest("long");
    getAllCharacterItems()
      .filter((item) => item.uses)
      .forEach((item) => { item.uses.current = item.uses.max; });
    getSpellSlots().forEach((slot) => { slot.current = slot.max; });
    character.hp.current = character.hp.max;
    character.hp.temp = 0;
    resetDeathSaves(character.deathSaves);
    save();
    refresh();
  }

  function requestRest(kind) {
    pendingRest = getRestDetails(character, getAllCharacterItems(), getSpellSlots(), kind);
    setText("rest-dialog-title", `Confirm ${pendingRest.title.toLowerCase()}`);
    setText("rest-dialog-duration", pendingRest.duration);
    setText("rest-dialog-description", pendingRest.description);
    const effects = documentRoot.getElementById("rest-dialog-effects");
    effects?.replaceChildren(...pendingRest.effects.map((effect) => {
      const item = documentRoot.createElement("li");
      item.textContent = effect;
      return item;
    }));
    const dialog = documentRoot.getElementById("rest-dialog");
    dialog?.classList.remove("hidden");
    dialog?.classList.add("flex");
    documentRoot.body.classList.add("overflow-hidden");
    documentRoot.getElementById("confirm-rest")?.focus();
  }

  function closeRestDialog() {
    const dialog = documentRoot.getElementById("rest-dialog");
    if (!dialog || dialog.classList.contains("hidden")) return;
    dialog.classList.add("hidden");
    dialog.classList.remove("flex");
    documentRoot.body.classList.remove("overflow-hidden");
    pendingRest = null;
  }

  function showRestToast(message) {
    const toast = documentRoot.getElementById("rest-toast");
    if (!toast) return;
    toast.textContent = message;
    toast.classList.remove("hidden");
    clearTimeout(toastTimer);
    toastTimer = setTimeoutFn(() => toast.classList.add("hidden"), 5000);
  }

  function confirmRest() {
    if (!pendingRest) return;
    const rest = pendingRest;
    const applied = rest.kind === "short" ? shortRest() : longRest();
    closeRestDialog();
    showRestToast(applied === false
      ? "Rest not completed: current HP must be at least 1."
      : rest.toast);
  }

  function setText(id, value) {
    const element = documentRoot.getElementById(id);
    if (element) element.textContent = value ?? "—";
  }

  return { closeRestDialog, confirmRest, longRest, requestRest, shortRest };
}
