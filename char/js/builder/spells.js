// Renders builder-time cantrip and levelled-spell repertoire choices.
import { escapeAttribute, escapeHTML } from "../../../shared/js/text.js";
import { builderSpellState } from "./spell-model.js";
import { mountSearchableSelection } from "./searchable-selection.js";

function spellChoices(entries) {
  return entries.map((entry) => {
  const level = Number(entry?.add?.value?.level ?? entry?.setters?.level ?? 0);
    return { ...entry, levelLabel: level ? `Spell level ${level}` : "Cantrip" };
  });
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
  container.innerHTML = `<section class="grid gap-4 rounded-2xl border border-sky-600/30 bg-sky-500/5 p-4" aria-labelledby="builder-spells-title"><div><h4 id="builder-spells-title" class="font-display text-lg font-bold">Spell repertoire</h4><p class="mt-1 text-xs text-stone-500 dark:text-stone-400">Search and add class cantrips and known/spellbook spells. Preparation remains Character runtime state.</p></div>${state.profiles.map((profile, profileIndex) => `<fieldset class="grid gap-3" data-builder-spell-profile="${escapeAttribute(profile.id)}"${disabled ? " disabled" : ""}><legend class="font-bold">${escapeHTML(profile.name)}</legend><div class="grid gap-4 sm:grid-cols-2"><div id="builder-spells-${profileIndex}-cantrips" data-builder-spell-kind="cantrips"></div><div id="builder-spells-${profileIndex}-levelled" data-builder-spell-kind="levelled"></div></div>${profile.errors.length ? `<ul class="list-disc pl-5 text-sm text-amber-700 dark:text-amber-300">${profile.errors.map((error) => `<li>${escapeHTML(error)}</li>`).join("")}</ul>` : '<p class="text-sm text-green-700 dark:text-green-300">Spell repertoire requirements complete.</p>'}<p class="text-xs text-stone-500 dark:text-stone-400">Home filters control available rulesets, sources, and automation coverage.</p></fieldset>`).join("")}</section>`;
  state.profiles.forEach((profile, profileIndex) => {
    const cantripId = `builder-spells-${profileIndex}-cantrips`;
    const levelledId = `builder-spells-${profileIndex}-levelled`;
    mountSearchableSelection(container.querySelector(`#${cantripId}`), {
      id: cantripId,
      label: `Cantrips (${profile.selectedCantripIds.length}/${profile.cantripLimit})`,
      placeholder: "Search cantrips…",
      entries: spellChoices(profile.cantrips),
      selectedIds: profile.selectedCantripIds,
      maxSelected: profile.cantripLimit,
      disabled,
      onChange: (selectedIds) => onChange?.(profile.id, "cantrips", selectedIds, `${cantripId}-search`),
    });
    const target = profile.repertoire === "spellbook" ? `${profile.spellbookMinimum} minimum` : profile.knownLimit ? `${profile.knownLimit}` : "no fixed limit";
    mountSearchableSelection(container.querySelector(`#${levelledId}`), {
      id: levelledId,
      label: `${profile.repertoire === "spellbook" ? "Spellbook" : "Known spells"} (${profile.selectedLevelledIds.length}/${target})`,
      placeholder: "Search levelled spells…",
      entries: spellChoices(profile.levelled),
      selectedIds: profile.selectedLevelledIds,
      maxSelected: profile.repertoire === "spellbook" ? Infinity : profile.knownLimit || Infinity,
      disabled,
      onChange: (selectedIds) => onChange?.(profile.id, "levelled", selectedIds, `${levelledId}-search`),
    });
  });
  return state;
}
