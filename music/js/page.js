import { createTrack, formatTag, normalizeTags, updateTrack } from "./model.js";
import {
  createMusicLibrary,
  loadCloudMusicLibrary,
  loadSettings,
  loadTracks,
  saveCloudMusicLibrary,
  saveSettings,
  saveTracks,
} from "./repository.js";
import { createMusicPlayer } from "./player.js";

const escapeHTML = (value) => String(value).replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);

export function initializeMusic() {
  const form = document.getElementById("track-form");
  const list = document.getElementById("track-list");
  const empty = document.getElementById("empty-library");
  const search = document.getElementById("track-search");
  const tagFilters = document.getElementById("tag-filters");
  const tagInput = document.getElementById("tag-input");
  const tagBadges = document.getElementById("tag-entry-badges");
  const tagSuggestions = document.getElementById("tag-suggestions");
  const formTitle = document.getElementById("track-form-title");
  const formSubmit = document.getElementById("track-form-submit");
  const formCancel = document.getElementById("track-form-cancel");
  const notice = document.getElementById("music-notice");
  const settingsForm = document.getElementById("fade-settings");
  const player = createMusicPlayer(document.getElementById("player-frame"), document.getElementById("player-status"));
  let tracks = loadTracks();
  let settings = loadSettings();
  let activeTag = "";
  let pendingTags = [];
  let editingTrackId = "";
  let cloudWrite = Promise.resolve();
  let cloudReady = false;

  settingsForm.elements.fadeIn.value = settings.fadeIn;
  settingsForm.elements.fadeOut.value = settings.fadeOut;

  function showNotice(message, error = false) {
    notice.textContent = message;
    notice.className = `mt-3 text-sm font-bold ${error ? "text-red-600 dark:text-red-300" : "text-emerald-700 dark:text-emerald-300"}`;
  }

  function cacheLibrary() {
    saveTracks(tracks);
    saveSettings(settings);
  }

  function setEditingDisabled(disabled) {
    [...form.elements, ...settingsForm.elements].forEach((element) => {
      element.disabled = disabled;
    });
  }

  function persistLibrary(successMessage) {
    const snapshot = createMusicLibrary(tracks, settings);
    showNotice("Saving to D1…");
    const operation = cloudWrite
      .catch(() => undefined)
      .then(() => saveCloudMusicLibrary(snapshot));
    cloudWrite = operation;
    operation
      .then(() => showNotice(successMessage))
      .catch((error) => {
        console.error("Could not save Music data to D1:", error);
        showNotice("Saved in this browser, but the D1 update failed.", true);
      });
  }

  async function restoreCloudLibrary() {
    const cloud = await loadCloudMusicLibrary();
    if (cloud === undefined) throw new Error("The Music cloud library is unavailable.");
    if (cloud === null) {
      await saveCloudMusicLibrary(createMusicLibrary(tracks, settings));
      showNotice("Existing Music data copied to D1.");
      return;
    }
    if (!Array.isArray(cloud.tracks) || !cloud.settings) throw new Error("The Music cloud library is invalid.");
    tracks = cloud.tracks;
    settings = cloud.settings;
    cacheLibrary();
    settingsForm.elements.fadeIn.value = settings.fadeIn;
    settingsForm.elements.fadeOut.value = settings.fadeOut;
    render();
    renderTagEntry();
    showNotice("Music library loaded from D1.");
  }

  function allTags() {
    return [...new Set(tracks.flatMap((track) => normalizeTags(track.tags)))].sort();
  }

  function renderTagEntry() {
    tagBadges.innerHTML = pendingTags.map((tag) => `<button type="button" data-entry-tag="${escapeHTML(tag)}" class="inline-flex items-center gap-1 rounded-full bg-stone-200 px-2.5 py-1 text-xs font-bold hover:bg-red-100 hover:text-red-700 dark:bg-white/10 dark:hover:bg-red-950 dark:hover:text-red-200" aria-label="Remove ${escapeHTML(formatTag(tag))}">${escapeHTML(formatTag(tag))}<i class="bi bi-x"></i></button>`).join("");
    const query = tagInput.value.trim().toLowerCase();
    const suggestions = allTags().filter((tag) => !pendingTags.includes(tag) && (!query || tag.includes(query))).slice(0, 8);
    tagSuggestions.innerHTML = suggestions.map((tag) => `<button type="button" data-suggest-tag="${escapeHTML(tag)}" class="rounded-full bg-stone-200 px-2.5 py-1 text-xs font-bold hover:bg-blood-500 hover:text-white dark:bg-white/10">${escapeHTML(formatTag(tag))}</button>`).join("");
    const showSuggestions = suggestions.length > 0 && document.activeElement === tagInput;
    tagSuggestions.classList.toggle("hidden", !showSuggestions);
    tagSuggestions.classList.toggle("flex", showSuggestions);
  }

  function commitTag(value = tagInput.value) {
    const additions = normalizeTags(value);
    pendingTags = [...new Set([...pendingTags, ...additions])];
    tagInput.value = "";
    renderTagEntry();
  }

  function setTrackFormMode(track = null) {
    editingTrackId = track?.id || "";
    formTitle.textContent = track ? "Edit track" : "Add a new track";
    formSubmit.innerHTML = track
      ? '<i class="bi bi-check-lg"></i><span>Save changes</span>'
      : '<i class="bi bi-plus-lg"></i><span>Save track</span>';
    formCancel.classList.toggle("hidden", !track);
  }

  function resetTrackForm() {
    form.reset();
    pendingTags = [];
    setTrackFormMode();
    renderTagEntry();
  }

  function editTrack(trackId) {
    const track = tracks.find((candidate) => candidate.id === trackId);
    if (!track) return;
    form.elements.title.value = track.title;
    form.elements.url.value = track.url;
    pendingTags = normalizeTags(track.tags);
    tagInput.value = "";
    setTrackFormMode(track);
    renderTagEntry();
    form.scrollIntoView({ behavior: "smooth", block: "start" });
    form.elements.title.focus({ preventScroll: true });
  }

  function render() {
    const query = search.value.trim().toLowerCase();
    const tags = allTags();
    tagFilters.innerHTML = [`<button type="button" data-tag="" class="rounded-full px-3 py-1.5 text-sm font-bold ${activeTag ? "bg-stone-200 dark:bg-white/10" : "bg-blood-500 text-white"}">All</button>`, ...tags.map((tag) => `<button type="button" data-tag="${escapeHTML(tag)}" class="rounded-full px-3 py-1.5 text-sm font-bold ${activeTag === tag ? "bg-blood-500 text-white" : "bg-stone-200 dark:bg-white/10"}">${escapeHTML(formatTag(tag))}</button>`)].join("");
    const visible = tracks.filter((track) => (!activeTag || track.tags.includes(activeTag)) && (!query || `${track.title} ${track.tags.join(" ")}`.toLowerCase().includes(query)));
    empty.classList.toggle("hidden", visible.length > 0);
    list.innerHTML = visible.map((track) => `<article class="group rounded-2xl border border-stone-300/80 bg-white/60 p-4 shadow-sm dark:border-white/10 dark:bg-white/5">
      <div class="flex items-start justify-between gap-3"><div class="min-w-0"><p class="text-xs font-bold uppercase tracking-wide text-blood-500">${track.provider}</p><h3 class="truncate font-display text-xl font-bold">${escapeHTML(track.title)}</h3></div><div class="flex shrink-0 gap-1"><button type="button" data-edit="${track.id}" ${cloudReady ? "" : "disabled"} class="rounded-lg p-2 text-stone-400 hover:bg-sky-100 hover:text-sky-600 disabled:cursor-wait disabled:opacity-40 dark:hover:bg-sky-950" aria-label="Edit ${escapeHTML(track.title)}"><i class="bi bi-pencil-fill"></i></button><button type="button" data-remove="${track.id}" ${cloudReady ? "" : "disabled"} class="rounded-lg p-2 text-stone-400 hover:bg-red-100 hover:text-red-600 disabled:cursor-wait disabled:opacity-40 dark:hover:bg-red-950" aria-label="Remove ${escapeHTML(track.title)}"><i class="bi bi-trash-fill"></i></button></div></div>
      <div class="mb-5 mt-3 flex flex-wrap gap-1.5">${track.tags.map((tag) => `<span class="rounded-full bg-stone-200 px-2 py-1 text-xs font-bold dark:bg-white/10">${escapeHTML(formatTag(tag))}</span>`).join("") || '<span class="text-xs text-stone-400">No tags</span>'}</div>
      <button type="button" data-play="${track.id}" class="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blood-500 px-4 py-2.5 font-bold text-white hover:bg-blood-600"><i class="bi bi-play-fill"></i>Play here</button>
    </article>`).join("");
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    try {
      if (tagInput.value.trim()) commitTag();
      const data = new FormData(form);
      const changes = { title: data.get("title"), url: data.get("url"), tags: pendingTags };
      const editingIndex = tracks.findIndex((track) => track.id === editingTrackId);
      if (editingIndex >= 0) tracks[editingIndex] = updateTrack(tracks[editingIndex], changes);
      else tracks.unshift(createTrack(changes));
      cacheLibrary();
      const successMessage = editingIndex >= 0 ? "Track updated in D1." : "Track saved to D1.";
      resetTrackForm();
      render();
      persistLibrary(successMessage);
    } catch (error) {
      showNotice(error.message, true);
    }
  });
  tagInput.addEventListener("input", () => {
    if (tagInput.value.includes(",")) commitTag(tagInput.value);
    else renderTagEntry();
  });
  tagInput.addEventListener("focus", renderTagEntry);
  tagInput.addEventListener("blur", () => setTimeout(() => {
    tagSuggestions.classList.add("hidden");
    tagSuggestions.classList.remove("flex");
  }, 100));
  tagInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && tagInput.value.trim()) {
      event.preventDefault();
      commitTag();
    } else if (event.key === "Backspace" && !tagInput.value && pendingTags.length) {
      pendingTags.pop();
      renderTagEntry();
    }
  });
  tagBadges.addEventListener("click", (event) => {
    const button = event.target.closest("[data-entry-tag]");
    if (!button) return;
    pendingTags = pendingTags.filter((tag) => tag !== button.dataset.entryTag);
    renderTagEntry();
    tagInput.focus();
  });
  tagSuggestions.addEventListener("mousedown", (event) => {
    const button = event.target.closest("[data-suggest-tag]");
    if (!button) return;
    event.preventDefault();
    commitTag(button.dataset.suggestTag);
    tagInput.focus();
  });
  formCancel.addEventListener("click", resetTrackForm);
  settingsForm.addEventListener("submit", (event) => {
    event.preventDefault();
    settings = { fadeIn: Math.min(30, Math.max(0, Number(settingsForm.elements.fadeIn.value))), fadeOut: Math.min(30, Math.max(0, Number(settingsForm.elements.fadeOut.value))) };
    cacheLibrary();
    persistLibrary("Fade settings saved to D1.");
  });
  search.addEventListener("input", render);
  tagFilters.addEventListener("click", (event) => {
    const button = event.target.closest("[data-tag]");
    if (!button) return;
    activeTag = button.dataset.tag;
    render();
  });
  list.addEventListener("click", (event) => {
    const playButton = event.target.closest("[data-play]");
    const editButton = event.target.closest("[data-edit]");
    const removeButton = event.target.closest("[data-remove]");
    if (playButton) player.play(tracks.find((track) => track.id === playButton.dataset.play), settings);
    if (editButton) editTrack(editButton.dataset.edit);
    if (removeButton && confirm("Remove this track from your library?")) {
      if (editingTrackId === removeButton.dataset.remove) resetTrackForm();
      tracks = tracks.filter((track) => track.id !== removeButton.dataset.remove);
      cacheLibrary();
      render();
      persistLibrary("Track removed from D1.");
    }
  });
  render();
  renderTagEntry();
  setTrackFormMode();
  setEditingDisabled(true);
  showNotice("Loading Music library from D1…");
  restoreCloudLibrary().catch((error) => {
    console.error("Could not restore Music data from D1:", error);
    showNotice("Using this browser's Music data because D1 could not be reached.", true);
  }).finally(() => {
    cloudReady = true;
    setEditingDisabled(false);
    render();
  });
}
