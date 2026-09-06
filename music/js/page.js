// Coordinates Music page state, rendering, persistence, and user events.
import { createTrack, normalizeTags, updateTrack } from "./model.js";
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
import {
  allMusicTags,
  renderMusicTagBadges,
  renderMusicTagFilters,
  renderMusicTagSuggestions,
  renderMusicTrackCards,
  suggestedMusicTags,
  visibleMusicTracks,
} from "./library-view.js";
import { campaignCanManage, currentCampaignSlug } from "../../shared/js/campaign-context.js";

export async function initializeMusic() {
  const canEdit = currentCampaignSlug() ? await campaignCanManage() : true;
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

  function renderTagEntry() {
    tagBadges.innerHTML = renderMusicTagBadges(pendingTags);
    const suggestions = suggestedMusicTags(tracks, pendingTags, tagInput.value);
    tagSuggestions.innerHTML = renderMusicTagSuggestions(suggestions);
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
    form.elements.loopable.checked = track.loopable === true;
    pendingTags = normalizeTags(track.tags);
    tagInput.value = "";
    setTrackFormMode(track);
    renderTagEntry();
    form.scrollIntoView({ behavior: "smooth", block: "start" });
    form.elements.title.focus({ preventScroll: true });
  }

  function render() {
    tagFilters.innerHTML = renderMusicTagFilters(allMusicTags(tracks), activeTag);
    const visible = visibleMusicTracks(tracks, { activeTag, search: search.value });
    empty.classList.toggle("hidden", visible.length > 0);
    list.innerHTML = renderMusicTrackCards(visible, cloudReady && canEdit);
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    try {
      if (tagInput.value.trim()) commitTag();
      const data = new FormData(form);
      const changes = { title: data.get("title"), url: data.get("url"), tags: pendingTags, loopable: data.has("loopable") };
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
    setEditingDisabled(!canEdit);
    render();
  });
}
