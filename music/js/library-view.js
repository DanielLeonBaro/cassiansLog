import { escapeHTML } from "../../shared/js/text.js";
import { formatTag, normalizeTags } from "./model.js";

export function allMusicTags(tracks) {
  return [...new Set(tracks.flatMap((track) => normalizeTags(track.tags)))].sort();
}

export function suggestedMusicTags(tracks, pendingTags, query) {
  const normalizedQuery = String(query || "").trim().toLowerCase();
  return allMusicTags(tracks)
    .filter((tag) => !pendingTags.includes(tag) && (!normalizedQuery || tag.includes(normalizedQuery)))
    .slice(0, 8);
}

export function visibleMusicTracks(tracks, { activeTag = "", search = "" } = {}) {
  const query = search.trim().toLowerCase();
  return tracks.filter((track) => (
    (!activeTag || track.tags.includes(activeTag)) &&
    (!query || `${track.title} ${track.tags.join(" ")}`.toLowerCase().includes(query))
  ));
}

export function renderMusicTagBadges(tags) {
  return tags.map((tag) => `<button type="button" data-entry-tag="${escapeHTML(tag)}" class="inline-flex items-center gap-1 rounded-full bg-stone-200 px-2.5 py-1 text-xs font-bold hover:bg-red-100 hover:text-red-700 dark:bg-white/10 dark:hover:bg-red-950 dark:hover:text-red-200" aria-label="Remove ${escapeHTML(formatTag(tag))}">${escapeHTML(formatTag(tag))}<i class="bi bi-x"></i></button>`).join("");
}

export function renderMusicTagSuggestions(tags) {
  return tags.map((tag) => `<button type="button" data-suggest-tag="${escapeHTML(tag)}" class="rounded-full bg-stone-200 px-2.5 py-1 text-xs font-bold hover:bg-blood-500 hover:text-white dark:bg-white/10">${escapeHTML(formatTag(tag))}</button>`).join("");
}

export function renderMusicTagFilters(tags, activeTag) {
  return [
    `<button type="button" data-tag="" class="rounded-full px-3 py-1.5 text-sm font-bold ${activeTag ? "bg-stone-200 dark:bg-white/10" : "bg-blood-500 text-white"}">All</button>`,
    ...tags.map((tag) => `<button type="button" data-tag="${escapeHTML(tag)}" class="rounded-full px-3 py-1.5 text-sm font-bold ${activeTag === tag ? "bg-blood-500 text-white" : "bg-stone-200 dark:bg-white/10"}">${escapeHTML(formatTag(tag))}</button>`),
  ].join("");
}

export function renderMusicTrackCards(tracks, cloudReady) {
  return tracks.map((track) => `<article class="group rounded-2xl border border-stone-300/80 bg-white/60 p-4 shadow-sm dark:border-white/10 dark:bg-white/5">
      <div class="flex items-start justify-between gap-3"><div class="min-w-0"><p class="text-xs font-bold uppercase tracking-wide text-blood-500">${track.provider}</p><h3 class="truncate font-display text-xl font-bold">${escapeHTML(track.title)}</h3></div><div class="flex shrink-0 gap-1"><button type="button" data-edit="${track.id}" ${cloudReady ? "" : "disabled"} class="rounded-lg p-2 text-stone-400 hover:bg-sky-100 hover:text-sky-600 disabled:cursor-wait disabled:opacity-40 dark:hover:bg-sky-950" aria-label="Edit ${escapeHTML(track.title)}"><i class="bi bi-pencil-fill"></i></button><button type="button" data-remove="${track.id}" ${cloudReady ? "" : "disabled"} class="rounded-lg p-2 text-stone-400 hover:bg-red-100 hover:text-red-600 disabled:cursor-wait disabled:opacity-40 dark:hover:bg-red-950" aria-label="Remove ${escapeHTML(track.title)}"><i class="bi bi-trash-fill"></i></button></div></div>
      <div class="mb-5 mt-3 flex flex-wrap gap-1.5">${track.tags.map((tag) => `<span class="rounded-full bg-stone-200 px-2 py-1 text-xs font-bold dark:bg-white/10">${escapeHTML(formatTag(tag))}</span>`).join("") || '<span class="text-xs text-stone-400">No tags</span>'}</div>
      <button type="button" data-play="${track.id}" class="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blood-500 px-4 py-2.5 font-bold text-white hover:bg-blood-600"><i class="bi bi-play-fill"></i>Play here</button>
    </article>`).join("");
}
