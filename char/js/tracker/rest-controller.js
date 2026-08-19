import { resetDeathSaves } from "./death-saves.js";
import { getRestDetails } from "./rest.js";

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

  function shortRest() {
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
    if (rest.kind === "short") shortRest();
    else longRest();
    closeRestDialog();
    showRestToast(rest.toast);
  }

  function setText(id, value) {
    const element = documentRoot.getElementById(id);
    if (element) element.textContent = value ?? "—";
  }

  return { closeRestDialog, confirmRest, longRest, requestRest, shortRest };
}
