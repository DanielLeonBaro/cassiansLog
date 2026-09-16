// Renders the four supported ability-generation methods.
import { escapeHTML } from "../../../shared/js/text.js";
import { BUILDER_ABILITIES, STANDARD_ARRAY, abilityScoreValidation } from "./ability-model.js";

function selected(value, current) {
  return value === current ? " selected" : "";
}

function checked(value) {
  return value ? " checked" : "";
}

export function renderCharacterBuilderAbilities(container, {
  document,
  disabled = false,
  onMethodChange,
  onScoreChange,
  onRoll,
} = {}) {
  const validation = abilityScoreValidation(document);
  const method = validation.method;
  const controls = BUILDER_ABILITIES.map(({ id, label }) => {
    const value = validation.scores[id] ?? "";
    if (method === "standard") return `<label><span class="mb-1 block text-sm font-bold">${label}</span><select id="builder-ability-${id}" data-builder-ability="${id}" class="w-full rounded-xl border border-stone-300 bg-white/80 px-3 py-2.5 text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold dark:border-white/15 dark:bg-ink dark:text-white"${disabled ? " disabled" : ""}><option value=""${value === "" ? " selected" : ""} disabled>Assign score…</option>${STANDARD_ARRAY.map((score) => `<option value="${score}"${selected(score, value)}>${score}</option>`).join("")}</select></label>`;
    const limits = method === "point-buy" ? { min: 8, max: 15 } : method === "rolled" ? { min: 3, max: 18 } : { min: 1, max: 30 };
    return `<label><span class="mb-1 block text-sm font-bold">${label}</span><input id="builder-ability-${id}" data-builder-ability="${id}" type="number" min="${limits.min}" max="${limits.max}" step="1" value="${value}" class="w-full rounded-xl border border-stone-300 bg-white/80 px-3 py-2.5 text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold dark:border-white/15 dark:bg-ink dark:text-white"${disabled ? " disabled" : ""}></label>`;
  }).join("");
  const status = validation.errors.length
    ? validation.errors.join(" ")
    : method === "point-buy"
      ? `${validation.remaining} of 27 points remaining${validation.remaining ? "; unspent points are allowed" : ""}.`
      : method === "standard"
        ? "Each standard-array score is assigned once."
        : method === "rolled"
          ? "Rolled results are stored in this draft. You can adjust them from 3 to 18."
          : "Manual scores accept whole numbers from 1 to 30.";

  container.innerHTML = `<div id="character-builder-abilities" class="grid gap-5">
    <fieldset class="grid gap-3"${disabled ? " disabled" : ""}><legend class="font-display text-lg font-bold">Generation method</legend><div class="grid gap-3 sm:grid-cols-2">${[
      ["standard", "Standard array", "Assign 15, 14, 13, 12, 10, and 8 once each."],
      ["point-buy", "27-point buy", "Buy scores from 8 to 15."],
      ["manual", "Manual entry", "Enter reviewed values directly."],
      ["rolled", "Rolled scores", "Store six 4d6-drop-lowest results."],
    ].map(([id, label, description]) => `<label class="flex gap-3 rounded-xl border border-stone-300 p-3 has-[:checked]:border-blood-500 has-[:checked]:ring-1 has-[:checked]:ring-blood-500 dark:border-white/15"><input id="builder-ability-method-${id}" type="radio" name="builder-ability-method" value="${id}" class="mt-1 h-4 w-4 accent-red-700"${checked(method === id)}><span><strong class="block text-sm">${label}</strong><span class="block text-xs text-stone-500 dark:text-stone-400">${description}</span></span></label>`).join("")}</div></fieldset>
    ${method === "rolled" ? '<button id="builder-roll-abilities" type="button" class="justify-self-start rounded-xl border border-blood-500 px-4 py-2 text-sm font-bold text-blood-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold">Roll all six scores</button>' : ""}
    <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">${controls}</div>
    <p id="builder-ability-status" class="rounded-xl border ${validation.errors.length ? "border-amber-600/40 bg-amber-500/10" : "border-sky-600/30 bg-sky-500/10"} p-3 text-sm" role="status" aria-live="polite">${escapeHTML(status)}</p>
  </div>`;
  container.querySelectorAll('[name="builder-ability-method"]').forEach((control) => control.addEventListener("change", () => onMethodChange?.(control.value, control.id)));
  container.querySelectorAll("[data-builder-ability]").forEach((control) => control.addEventListener("change", () => onScoreChange?.(control.dataset.builderAbility, control.value, control.id)));
  container.querySelector("#builder-roll-abilities")?.addEventListener("click", (event) => onRoll?.(event.currentTarget.id));
  return validation;
}
