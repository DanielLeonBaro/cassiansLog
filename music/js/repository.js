import { readJSON, writeJSON } from "../../shared/js/storage.js";
import { DEFAULT_SETTINGS, clampSeconds } from "./model.js";

export const TRACKS_KEY = "dnd-music-tracks";
export const SETTINGS_KEY = "dnd-music-settings";

export function loadTracks() {
  const value = readJSON(TRACKS_KEY, []);
  return Array.isArray(value) ? value : [];
}

export function saveTracks(tracks) {
  writeJSON(TRACKS_KEY, tracks);
}

export function loadSettings() {
  const value = readJSON(SETTINGS_KEY, DEFAULT_SETTINGS) || {};
  return {
    fadeIn: clampSeconds(value.fadeIn, DEFAULT_SETTINGS.fadeIn),
    fadeOut: clampSeconds(value.fadeOut, DEFAULT_SETTINGS.fadeOut),
  };
}

export function saveSettings(settings) {
  writeJSON(SETTINGS_KEY, settings);
}
