// Renders identity, appearance, personality, and story fields.
import { escapeAttribute, escapeHTML } from "../../../shared/js/text.js";
import { BUILDER_DESCRIPTION_FIELDS, descriptionStepValidation } from "./description-model.js";

function fieldControl(field, value, disabled) {
  const common = `id="builder-description-${field.id}" data-builder-description-field="${field.id}" maxlength="10000" class="w-full rounded-xl border border-stone-300 bg-white/80 px-3 py-2.5 text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold dark:border-white/15 dark:bg-ink dark:text-white"${disabled ? " disabled" : ""}`;
  return `<label class="${field.multiline ? "sm:col-span-2" : ""}"><span class="mb-1 block text-sm font-bold">${escapeHTML(field.label)}</span>${field.multiline ? `<textarea ${common} rows="3">${escapeHTML(value)}</textarea>` : `<input ${common} value="${escapeAttribute(value)}">`}</label>`;
}

export function renderCharacterBuilderDescription(container, {
  document,
  disabled = false,
  entityName = "Character",
  onChange,
} = {}) {
  const validation = descriptionStepValidation(document);
  const description = document.build.description;
  const grouped = (group) => BUILDER_DESCRIPTION_FIELDS.filter((field) => field.group === group)
    .map((field) => fieldControl(field, description[field.id] || "", disabled)).join("");
  container.innerHTML = `<div id="character-builder-description" class="grid gap-5">
    <section class="grid gap-3 sm:grid-cols-2" aria-labelledby="builder-identity-title"><h4 id="builder-identity-title" class="font-display text-lg font-bold sm:col-span-2">Identity</h4><label class="sm:col-span-2"><span class="mb-1 block text-sm font-bold">${escapeHTML(entityName)} name <span class="text-blood-500">*</span></span><input id="builder-character-name" maxlength="80" value="${escapeAttribute(document.name || "")}" class="w-full rounded-xl border border-stone-300 bg-white/80 px-3 py-2.5 text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold dark:border-white/15 dark:bg-ink dark:text-white"${disabled ? " disabled" : ""}></label><label><span class="mb-1 block text-sm font-bold">${escapeHTML(entityName)} ID <span class="text-blood-500">*</span></span><input id="builder-character-id" maxlength="128" pattern="[a-z0-9][a-z0-9-]{0,127}" value="${escapeAttribute(document.id || "")}" aria-describedby="builder-character-id-help" class="w-full rounded-xl border border-stone-300 bg-white/80 px-3 py-2.5 text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold dark:border-white/15 dark:bg-ink dark:text-white"${disabled ? " disabled" : ""}><span id="builder-character-id-help" class="mt-1 block text-xs text-stone-500 dark:text-stone-400">Used in the clean ${escapeHTML(entityName)} URL. Finalization checks collisions.</span></label><label><span class="mb-1 block text-sm font-bold">Status</span><input id="builder-character-status" maxlength="32" list="builder-character-statuses" value="${escapeAttribute(document.status || "Draft")}" class="w-full rounded-xl border border-stone-300 bg-white/80 px-3 py-2.5 text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold dark:border-white/15 dark:bg-ink dark:text-white"${disabled ? " disabled" : ""}><datalist id="builder-character-statuses"><option value="Active"><option value="Paused"><option value="Hiatus"><option value="Draft"><option value="Ended"></datalist></label>${grouped("identity")}</section>
    <section class="grid gap-3 sm:grid-cols-3" aria-labelledby="builder-appearance-title"><h4 id="builder-appearance-title" class="font-display text-lg font-bold sm:col-span-3">Appearance</h4>${grouped("appearance")}</section>
    <section class="grid gap-3 sm:grid-cols-2" aria-labelledby="builder-story-title"><h4 id="builder-story-title" class="font-display text-lg font-bold sm:col-span-2">Personality and story</h4>${grouped("story")}</section>
    <p id="builder-description-status" class="rounded-xl border ${validation.errors.length ? "border-amber-600/40 bg-amber-500/10" : "border-sky-600/30 bg-sky-500/10"} p-3 text-sm" role="status" aria-live="polite">${escapeHTML(validation.errors.join(" ") || (validation.detailCount ? `${validation.detailCount} descriptive fields recorded.` : "Name and ID are valid. Story fields are optional."))}</p>
  </div>`;
  container.querySelector("#builder-character-name")?.addEventListener("change", (event) => onChange?.({ name: event.target.value }, event.target.id));
  container.querySelector("#builder-character-id")?.addEventListener("change", (event) => onChange?.({ id: event.target.value }, event.target.id));
  container.querySelector("#builder-character-status")?.addEventListener("change", (event) => onChange?.({ status: event.target.value }, event.target.id));
  container.querySelectorAll("[data-builder-description-field]").forEach((control) => control.addEventListener("change", () => onChange?.({ field: control.dataset.builderDescriptionField, value: control.value }, control.id)));
  return validation;
}
