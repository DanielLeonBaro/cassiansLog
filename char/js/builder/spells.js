// Renders builder-time cantrip and levelled-spell repertoire choices.
import { escapeAttribute, escapeHTML } from "../../../shared/js/text.js";
import { builderSpellState } from "./spell-model.js";

function spellOption(entry, selectedIds) {
  const selected = selectedIds.includes(entry.id) ? " selected" : "";
  const level = Number(entry?.add?.value?.level ?? entry?.setters?.level ?? 0);
  const coverage = entry.automation?.status || "manual";
  return `<option value="${escapeAttribute(entry.id)}"${selected}>${escapeHTML(`${level ? `Level ${level} · ` : ""}${entry.name || entry.id} — ${coverage}`)}</option>`;
}

export function renderCharacterBuilderSpells(container, {
  document,
  entries = [],
  disabled = false,
  onChange,
} = {}) {
  const state = builderSpellState(document, entries);
  if (!state.profiles.length) {
    container.replaceChildren();
    return state;
  }
  container.innerHTML = `<section class="grid gap-4 rounded-2xl border border-sky-600/30 bg-sky-500/5 p-4" aria-labelledby="builder-spells-title"><div><h4 id="builder-spells-title" class="font-display text-lg font-bold">Spell repertoire</h4><p class="mt-1 text-xs text-stone-500 dark:text-stone-400">Choose class cantrips and known/spellbook spells. Preparation remains Character runtime state.</p></div>${state.profiles.map((profile, profileIndex) => `<fieldset class="grid gap-3" data-builder-spell-profile="${escapeAttribute(profile.id)}"${disabled ? " disabled" : ""}><legend class="font-bold">${escapeHTML(profile.name)}</legend><div class="grid gap-3 sm:grid-cols-2"><label><span class="mb-1 block text-sm font-bold">Cantrips (${profile.selectedCantripIds.length}/${profile.cantripLimit})</span><select id="builder-spells-${profileIndex}-cantrips" data-builder-spell-kind="cantrips" multiple size="8" class="w-full rounded-xl border border-stone-300 bg-white/80 px-3 py-2 text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold dark:border-white/15 dark:bg-ink dark:text-white">${profile.cantrips.map((entry) => spellOption(entry, profile.selectedCantripIds)).join("")}</select></label><label><span class="mb-1 block text-sm font-bold">${escapeHTML(profile.repertoire === "spellbook" ? `Spellbook (${profile.selectedLevelledIds.length}/${profile.spellbookMinimum} minimum)` : `Known spells (${profile.selectedLevelledIds.length})`)}</span><select id="builder-spells-${profileIndex}-levelled" data-builder-spell-kind="levelled" multiple size="8" class="w-full rounded-xl border border-stone-300 bg-white/80 px-3 py-2 text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold dark:border-white/15 dark:bg-ink dark:text-white">${profile.levelled.map((entry) => spellOption(entry, profile.selectedLevelledIds)).join("")}</select></label></div>${profile.errors.length ? `<ul class="list-disc pl-5 text-sm text-amber-700 dark:text-amber-300">${profile.errors.map((error) => `<li>${escapeHTML(error)}</li>`).join("")}</ul>` : '<p class="text-sm text-green-700 dark:text-green-300">Spell repertoire requirements complete.</p>'}<p class="text-xs text-stone-500 dark:text-stone-400">Ctrl, Command, or Shift selects multiple spells. Home filters control available rulesets, sources, and automation coverage.</p></fieldset>`).join("")}</section>`;
  container.querySelectorAll("[data-builder-spell-kind]").forEach((control) => control.addEventListener("change", () => {
    const profile = control.closest("[data-builder-spell-profile]");
    onChange?.(profile.dataset.builderSpellProfile, control.dataset.builderSpellKind, [...control.selectedOptions].map(({ value }) => value), control.id);
  }));
  return state;
}
