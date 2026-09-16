// Renders unresolved structure, automation notices, overrides, and safe finalization.
import { escapeHTML } from "../../../shared/js/text.js";
import { reviewCharacterBuild } from "./review-model.js";

function messages(title, items, tone) {
  if (!items.length) return "";
  return `<section class="rounded-2xl border ${tone === "danger" ? "border-amber-600/40 bg-amber-500/10" : "border-sky-600/30 bg-sky-500/10"} p-4"><h4 class="font-display text-lg font-bold">${escapeHTML(title)}</h4><ul class="mt-2 list-disc space-y-1 pl-5 text-sm">${items.map((item) => `<li>${escapeHTML(item.message)}</li>`).join("")}</ul></section>`;
}

export function renderCharacterBuilderReview(container, {
  document,
  entries = [],
  disabled = false,
  finalizing = false,
  finalizeError = "",
  entityName = "Character",
  onFinish,
} = {}) {
  const review = reviewCharacterBuild(document, entries);
  const summary = review.summary;
  container.innerHTML = `<div id="character-builder-review" class="grid gap-5">
    <section class="rounded-2xl border border-stone-300/80 p-4 dark:border-white/15" aria-labelledby="builder-review-summary-title"><h4 id="builder-review-summary-title" class="font-display text-lg font-bold">${escapeHTML(entityName)} summary</h4><dl class="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4"><div><dt class="text-xs font-bold uppercase text-stone-500">Class</dt><dd>${escapeHTML(`${summary.class}${summary.subclass !== "—" ? ` · ${summary.subclass}` : ""}`)}</dd></div><div><dt class="text-xs font-bold uppercase text-stone-500">Level</dt><dd>${summary.level}</dd></div><div><dt class="text-xs font-bold uppercase text-stone-500">Species/Race</dt><dd>${escapeHTML(summary.species)}</dd></div><div><dt class="text-xs font-bold uppercase text-stone-500">Background</dt><dd>${escapeHTML(summary.background)}</dd></div><div><dt class="text-xs font-bold uppercase text-stone-500">Inventory</dt><dd>${summary.inventory} instances</dd></div><div><dt class="text-xs font-bold uppercase text-stone-500">Spell repertoire</dt><dd>${summary.spells} spells</dd></div></dl></section>
    ${messages("Required before Finish", review.blockers, "danger")}
    ${messages("Automation and review notices", review.notices, "info")}
    <section class="rounded-2xl border border-stone-300/80 p-4 dark:border-white/15" aria-labelledby="builder-review-overrides-title"><h4 id="builder-review-overrides-title" class="font-display text-lg font-bold">Overrides</h4>${review.overrides.length ? `<ul class="mt-2 list-disc space-y-1 pl-5 text-sm">${review.overrides.map((override) => `<li>${escapeHTML(override.path)}: ${escapeHTML(String(override.value))} — ${escapeHTML(override.reason || "Missing reason")}</li>`).join("")}</ul>` : '<p class="mt-2 text-sm text-stone-500 dark:text-stone-400">No overrides.</p>'}</section>
    <section class="rounded-2xl border ${review.canFinish ? "border-green-600/30 bg-green-500/10" : "border-amber-600/40 bg-amber-500/10"} p-4" aria-labelledby="builder-finish-title"><h4 id="builder-finish-title" class="font-display text-lg font-bold">Finish</h4><p class="mt-2 text-sm">${review.canFinish ? `Required structure is complete. Finish materializes the automatic sheet and creates the ${escapeHTML(entityName)} without overwriting an existing ID.` : "Resolve the required items above. Optional equipment, story fields, and non-blocking manual notices do not prevent Finish."}</p>${finalizeError ? `<p id="builder-finalize-error" class="mt-3 text-sm font-bold text-amber-800 dark:text-amber-200" role="alert" tabindex="-1">${escapeHTML(finalizeError)} The draft remains saved; correct the issue or retry.</p>` : ""}<button id="builder-finish" type="button" class="mt-4 rounded-xl bg-blood-500 px-4 py-2.5 text-sm font-bold text-on-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold disabled:cursor-not-allowed disabled:opacity-50"${disabled || finalizing || !review.canFinish ? " disabled" : ""}>${finalizing ? "Finishing…" : finalizeError ? "Retry Finish" : `Finish ${escapeHTML(entityName.toLowerCase())}`}</button></section>
  </div>`;
  container.querySelector("#builder-finish")?.addEventListener("click", () => onFinish?.());
  return review;
}
