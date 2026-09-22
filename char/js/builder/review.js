// Renders unresolved structure, automation notices, overrides, and safe finalization.
import { escapeHTML } from "../../../shared/js/text.js";
import { reviewCharacterBuild } from "./review-model.js";

function messages(title, items, tone) {
  if (!items.length) return "";
  return `<section class="rounded-2xl border ${tone === "danger" ? "border-amber-600/40 bg-amber-500/10" : "border-sky-600/30 bg-sky-500/10"} p-4"><h4 class="font-display text-lg font-bold">${escapeHTML(title)}</h4><ul class="mt-2 list-disc space-y-2 pl-5 text-sm">${items.map((item) => `<li><strong>${escapeHTML(item.message)}</strong>${item.impact ? `<span class="mt-0.5 block text-xs text-stone-600 dark:text-stone-300">${escapeHTML(item.impact)}</span>` : ""}</li>`).join("")}</ul></section>`;
}

export function renderCharacterBuilderReview(container, {
  document,
  entries = [],
  disabled = false,
  finalizing = false,
  finalizeError = "",
  confirmingIncomplete = false,
  entityName = "Character",
  onFinish,
  onConfirmIncomplete,
  onCancelIncomplete,
} = {}) {
  const review = reviewCharacterBuild(document, entries);
  const summary = review.summary;
  container.innerHTML = `<div id="character-builder-review" class="grid gap-5">
    <section class="rounded-2xl border border-stone-300/80 p-4 dark:border-white/15" aria-labelledby="builder-review-summary-title"><h4 id="builder-review-summary-title" class="font-display text-lg font-bold">${escapeHTML(entityName)} summary</h4><dl class="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4"><div><dt class="text-xs font-bold uppercase text-stone-500">Class</dt><dd>${escapeHTML(`${summary.class}${summary.subclass !== "—" ? ` · ${summary.subclass}` : ""}`)}</dd></div><div><dt class="text-xs font-bold uppercase text-stone-500">Level</dt><dd>${summary.level}</dd></div><div><dt class="text-xs font-bold uppercase text-stone-500">Species/Race</dt><dd>${escapeHTML(summary.species)}</dd></div><div><dt class="text-xs font-bold uppercase text-stone-500">Background</dt><dd>${escapeHTML(summary.background)}</dd></div><div><dt class="text-xs font-bold uppercase text-stone-500">Inventory</dt><dd>${summary.inventory} instances</dd></div><div><dt class="text-xs font-bold uppercase text-stone-500">Spell repertoire</dt><dd>${summary.spells} spells</dd></div></dl></section>
    ${messages("Identity required before Finish", review.blockers, "danger")}
    ${messages("Pending choices and calculation impact", review.pending, "danger")}
    ${messages("Automation and review notices", review.notices, "info")}
    <section class="rounded-2xl border border-stone-300/80 p-4 dark:border-white/15" aria-labelledby="builder-review-overrides-title"><h4 id="builder-review-overrides-title" class="font-display text-lg font-bold">Overrides</h4>${review.overrides.length ? `<ul class="mt-2 list-disc space-y-1 pl-5 text-sm">${review.overrides.map((override) => `<li>${escapeHTML(override.path)}: ${escapeHTML(String(override.value))} — ${escapeHTML(override.reason || "Missing reason")}</li>`).join("")}</ul>` : '<p class="mt-2 text-sm text-stone-500 dark:text-stone-400">No overrides.</p>'}</section>
    <section class="rounded-2xl border ${review.requiresConfirmation ? "border-amber-600/40 bg-amber-500/10" : review.canFinish ? "border-green-600/30 bg-green-500/10" : "border-amber-600/40 bg-amber-500/10"} p-4" aria-labelledby="builder-finish-title"><h4 id="builder-finish-title" class="font-display text-lg font-bold">Finish</h4><p class="mt-2 text-sm">${!review.canFinish ? "Add a valid name and Character ID before Finish." : review.requiresConfirmation ? `You may finish now. Pending choices remain saved, but listed calculations and important features may be missing until you resume this build.` : `Required structure is complete. Finish materializes the automatic sheet and creates the ${escapeHTML(entityName)} without overwriting an existing ID.`}</p>${finalizeError ? `<p id="builder-finalize-error" class="mt-3 text-sm font-bold text-amber-800 dark:text-amber-200" role="alert" tabindex="-1">${escapeHTML(finalizeError)} The draft remains saved; correct the issue or retry.</p>` : ""}<button id="builder-finish" type="button" class="mt-4 rounded-xl bg-blood-500 px-4 py-2.5 text-sm font-bold text-on-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold disabled:cursor-not-allowed disabled:opacity-50"${disabled || finalizing || !review.canFinish || confirmingIncomplete ? " disabled" : ""}>${finalizing ? "Finishing…" : finalizeError ? "Retry Finish" : `Finish ${escapeHTML(entityName.toLowerCase())}`}</button></section>
    ${confirmingIncomplete ? `<section id="builder-finish-confirmation" class="rounded-2xl border border-amber-600/50 bg-amber-500/15 p-4" role="alertdialog" aria-modal="true" aria-labelledby="builder-finish-confirm-title" aria-describedby="builder-finish-confirm-description"><h4 id="builder-finish-confirm-title" class="font-display text-lg font-bold" tabindex="-1">Finish with pending choices?</h4><p id="builder-finish-confirm-description" class="mt-2 text-sm">${review.pending.length} pending ${review.pending.length === 1 ? "item remains" : "items remain"}. You may not see this information, and listed calculations or important features may not be calculated.</p><ul class="mt-3 list-disc space-y-2 pl-5 text-sm">${review.pending.map((item) => `<li><strong>${escapeHTML(item.message)}</strong><span class="block text-xs">${escapeHTML(item.impact)}</span></li>`).join("")}</ul><div class="mt-4 flex flex-wrap justify-end gap-2"><button id="builder-finish-confirm-cancel" type="button" class="rounded-xl border border-stone-400 px-4 py-2 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold">Keep building</button><button id="builder-finish-confirm" type="button" class="rounded-xl bg-blood-500 px-4 py-2 text-sm font-bold text-on-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold">Finish anyway</button></div></section>` : ""}
  </div>`;
  container.querySelector("#builder-finish")?.addEventListener("click", () => onFinish?.());
  container.querySelector("#builder-finish-confirm")?.addEventListener("click", () => onConfirmIncomplete?.());
  container.querySelector("#builder-finish-confirm-cancel")?.addEventListener("click", () => onCancelIncomplete?.());
  return review;
}
