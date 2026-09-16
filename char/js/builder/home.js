// Renders accessible Character Builder Home preferences and catalog filters.
import { escapeAttribute, escapeHTML } from "../../../shared/js/text.js";
import { builderCatalogFilterState } from "./home-model.js";

function selected(value, current) {
  return value === current ? " selected" : "";
}

function checked(value) {
  return value ? " checked" : "";
}

function option(value, label, current = "", disabled = false) {
  return `<option value="${escapeAttribute(value)}"${selected(value, current)}${disabled ? " disabled" : ""}>${escapeHTML(label)}</option>`;
}

function rulesetLabel(value) {
  return value === "5.5e" ? "2024 rules (5.5e)" : "2014 rules (5e)";
}

export function renderCharacterBuilderHome(container, {
  document,
  entries = [],
  loading = false,
  error = "",
  disabled = false,
  pendingRuleset = null,
  onChange,
  onRequestRulesetChange,
  onConfirmRulesetChange,
  onCancelRulesetChange,
} = {}) {
  const preferences = document.build.preferences;
  const state = builderCatalogFilterState(entries, document);
  const locked = disabled || Boolean(pendingRuleset);
  const catalogLocked = locked || loading || Boolean(error);
  const sourceOptions = state.publications.map((source) => (
    `<option value="${escapeAttribute(source)}"${preferences.enabledSources.includes(source) ? " selected" : ""}>${escapeHTML(source)}</option>`
  )).join("");
  const incompatible = pendingRuleset?.incompatible || [];
  const visibleIncompatible = incompatible.slice(0, 8);

  container.innerHTML = `
    <div id="character-builder-home" class="grid gap-5">
      <fieldset id="builder-ruleset-and-filters" class="grid gap-4"${catalogLocked ? " disabled" : ""}>
        <legend class="font-display text-lg font-bold">Rules and content</legend>
        <div class="grid gap-3 sm:grid-cols-2">
          <label class="flex gap-3 rounded-xl border border-stone-300 bg-white/70 p-3 has-[:checked]:border-blood-500 has-[:checked]:ring-1 has-[:checked]:ring-blood-500 dark:border-white/15 dark:bg-white/5">
            <input id="builder-ruleset-5e" type="radio" name="builder-ruleset" value="5e" class="mt-1 h-4 w-4 accent-red-700"${checked(document.build.ruleset === "5e")}>
            <span><strong class="block">2014 rules</strong><span class="block text-xs text-stone-500 dark:text-stone-400">5e character options.</span></span>
          </label>
          <label class="flex gap-3 rounded-xl border border-stone-300 bg-white/70 p-3 has-[:checked]:border-blood-500 has-[:checked]:ring-1 has-[:checked]:ring-blood-500 dark:border-white/15 dark:bg-white/5">
            <input id="builder-ruleset-5-5e" type="radio" name="builder-ruleset" value="5.5e" class="mt-1 h-4 w-4 accent-red-700"${checked(document.build.ruleset === "5.5e")}>
            <span><strong class="block">2024 rules</strong><span class="block text-xs text-stone-500 dark:text-stone-400">5.5e character options.</span></span>
          </label>
        </div>
        <div class="grid gap-3 sm:grid-cols-2">
          <label>
            <span class="mb-1 block text-sm font-bold">Publisher</span>
            <select id="builder-filter-publisher" class="w-full rounded-xl border border-stone-300 bg-white/80 px-3 py-2.5 text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold dark:border-white/15 dark:bg-ink dark:text-white">
              ${option("", "All compatible publishers", state.publisher)}
              ${state.publishers.map((publisher) => option(publisher, publisher, state.publisher)).join("")}
            </select>
          </label>
          <label>
            <span class="mb-1 block text-sm font-bold">Automation coverage</span>
            <select id="builder-filter-automation" class="w-full rounded-xl border border-stone-300 bg-white/80 px-3 py-2.5 text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold dark:border-white/15 dark:bg-ink dark:text-white">
              ${option("", `All coverage (${state.publisherCount.toLocaleString()})`, state.automation)}
              ${option("rules-ready", `Rules-ready (${state.coverageCounts["rules-ready"].toLocaleString()})`, state.automation, state.coverageCounts["rules-ready"] === 0)}
              ${option("partial", `Partial (${state.coverageCounts.partial.toLocaleString()})`, state.automation, state.coverageCounts.partial === 0)}
              ${option("manual", `Manual (${state.coverageCounts.manual.toLocaleString()})`, state.automation, state.coverageCounts.manual === 0)}
            </select>
          </label>
        </div>
        <label>
          <span class="mb-1 block text-sm font-bold">Enabled publications/sources</span>
          <select id="builder-filter-sources" multiple size="6" aria-describedby="builder-filter-sources-help" class="w-full rounded-xl border border-stone-300 bg-white/80 px-3 py-2 text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold dark:border-white/15 dark:bg-ink dark:text-white">${sourceOptions}</select>
          <span id="builder-filter-sources-help" class="mt-1 block text-xs text-stone-500 dark:text-stone-400">No selection enables every publication shown. Use Ctrl, Command, or Shift for multiple sources.</span>
        </label>
        <button id="builder-filter-sources-all" type="button" class="justify-self-start rounded-xl border border-stone-400 px-3 py-2 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold">Enable all shown sources</button>
        <p id="builder-filter-summary" class="rounded-xl border border-sky-600/30 bg-sky-500/10 p-3 text-sm text-sky-700 dark:text-sky-300" role="status" aria-live="polite">
          ${loading ? "Loading Compendium filters…" : error ? escapeHTML(error) : `${state.filteredCount.toLocaleString()} compatible entries available for ${rulesetLabel(state.ruleset)}.`}
        </p>
      </fieldset>

      <fieldset id="builder-home-preferences" class="grid gap-4"${locked ? " disabled" : ""}>
        <legend class="font-display text-lg font-bold">Character preferences</legend>
        <div class="grid gap-3 sm:grid-cols-3">
          <label><span class="mb-1 block text-sm font-bold">Progression</span><select id="builder-preference-progression" class="w-full rounded-xl border border-stone-300 bg-white/80 px-3 py-2.5 text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold dark:border-white/15 dark:bg-ink dark:text-white">${option("xp", "Experience points", preferences.progression, false)}${option("milestone", "Milestone", preferences.progression, false)}</select></label>
          <label><span class="mb-1 block text-sm font-bold">Hit points</span><select id="builder-preference-hit-points" class="w-full rounded-xl border border-stone-300 bg-white/80 px-3 py-2.5 text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold dark:border-white/15 dark:bg-ink dark:text-white">${option("fixed", "Fixed average", preferences.hitPoints, false)}${option("manual", "Manual rolls", preferences.hitPoints, false)}</select></label>
          <label><span class="mb-1 block text-sm font-bold">Encumbrance</span><select id="builder-preference-encumbrance" class="w-full rounded-xl border border-stone-300 bg-white/80 px-3 py-2.5 text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold dark:border-white/15 dark:bg-ink dark:text-white">${option("none", "None", preferences.encumbrance, false)}${option("standard", "Standard", preferences.encumbrance, false)}${option("variant", "2014 variant", preferences.encumbrance, document.build.ruleset === "5.5e")}</select></label>
        </div>
        <div class="grid gap-3 sm:grid-cols-2">
          <label class="flex gap-3 rounded-xl border border-stone-300 p-3 dark:border-white/15"><input id="builder-preference-coin-weight" type="checkbox" class="mt-1 h-4 w-4 accent-red-700"${checked(preferences.coinWeight)}><span><strong class="block text-sm">Count coin weight</strong><span class="block text-xs text-stone-500 dark:text-stone-400">50 coins weigh 1 lb.</span></span></label>
          <label class="flex gap-3 rounded-xl border border-stone-300 p-3 dark:border-white/15"><input id="builder-preference-prerequisites" type="checkbox" class="mt-1 h-4 w-4 accent-red-700"${checked(preferences.prerequisites)}><span><strong class="block text-sm">Enforce prerequisites</strong><span class="block text-xs text-stone-500 dark:text-stone-400">Unavailable choices explain what is missing.</span></span></label>
        </div>
      </fieldset>

      <section id="builder-ruleset-change-preview"${pendingRuleset ? "" : " hidden"} class="rounded-2xl border border-amber-600/40 bg-amber-500/10 p-4" aria-labelledby="builder-ruleset-change-title">
        <h4 id="builder-ruleset-change-title" tabindex="-1" class="font-display text-lg font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold">Switch to ${rulesetLabel(pendingRuleset?.to)}?</h4>
        <p class="mt-2 text-sm">Rulesets never mix. ${incompatible.length ? `${incompatible.length} incompatible ${incompatible.length === 1 ? "choice" : "choices"} will be cleared:` : "No incompatible choices need clearing."}</p>
        ${visibleIncompatible.length ? `<ul class="mt-3 list-disc space-y-1 pl-5 text-sm">${visibleIncompatible.map((item) => `<li>${escapeHTML(item.label)}</li>`).join("")}</ul>` : ""}
        ${incompatible.length > visibleIncompatible.length ? `<p class="mt-2 text-xs">Plus ${(incompatible.length - visibleIncompatible.length).toLocaleString()} more.</p>` : ""}
        <div class="mt-4 flex flex-wrap justify-end gap-2">
          <button id="builder-ruleset-change-cancel" type="button" class="rounded-xl border border-stone-400 px-3 py-2 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold">Keep ${rulesetLabel(pendingRuleset?.from)}</button>
          <button id="builder-ruleset-change-confirm" type="button" class="rounded-xl bg-blood-500 px-3 py-2 text-sm font-bold text-on-accent hover:bg-blood-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold">Confirm change</button>
        </div>
      </section>
    </div>`;

  container.querySelectorAll('[name="builder-ruleset"]').forEach((control) => {
    control.addEventListener("change", () => onRequestRulesetChange?.(control.value, control.id));
  });
  container.querySelector("#builder-filter-publisher")?.addEventListener("change", (event) => onChange?.({ publisher: event.target.value }, event.target.id));
  container.querySelector("#builder-filter-automation")?.addEventListener("change", (event) => onChange?.({ automation: event.target.value }, event.target.id));
  container.querySelector("#builder-filter-sources")?.addEventListener("change", (event) => onChange?.({
    enabledSources: [...event.target.selectedOptions].map(({ value }) => value),
  }, event.target.id));
  container.querySelector("#builder-filter-sources-all")?.addEventListener("click", (event) => onChange?.({ enabledSources: [] }, event.currentTarget.id));
  for (const [id, name] of [
    ["builder-preference-progression", "progression"],
    ["builder-preference-hit-points", "hitPoints"],
    ["builder-preference-encumbrance", "encumbrance"],
  ]) container.querySelector(`#${id}`)?.addEventListener("change", (event) => onChange?.({ [name]: event.target.value }, id));
  for (const [id, name] of [
    ["builder-preference-coin-weight", "coinWeight"],
    ["builder-preference-prerequisites", "prerequisites"],
  ]) container.querySelector(`#${id}`)?.addEventListener("change", (event) => onChange?.({ [name]: event.target.checked }, id));
  container.querySelector("#builder-ruleset-change-confirm")?.addEventListener("click", () => onConfirmRulesetChange?.());
  container.querySelector("#builder-ruleset-change-cancel")?.addEventListener("click", () => onCancelRulesetChange?.());
  return state;
}
