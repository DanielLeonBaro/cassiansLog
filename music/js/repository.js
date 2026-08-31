// Owns Music serialization, persistence, and fallback precedence.
import { readJSON, writeJSON } from "../../shared/js/storage.js";
import { readCloudJSON, writeCloudJSON } from "../../shared/js/cloud-store.js";
import { DEFAULT_SETTINGS, clampSeconds } from "./model.js";
import { cloneJSON } from "../../shared/js/text.js";

export const TRACKS_KEY = "dnd-music-tracks";
export const SETTINGS_KEY = "dnd-music-settings";
export const LIBRARY_VERSION = 1;

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

export function createMusicLibrary(tracks, settings) {
  return {
    version: LIBRARY_VERSION,
    tracks: cloneJSON(tracks),
    settings: {
      fadeIn: clampSeconds(settings?.fadeIn, DEFAULT_SETTINGS.fadeIn),
      fadeOut: clampSeconds(settings?.fadeOut, DEFAULT_SETTINGS.fadeOut),
    },
  };
}

export async function loadCloudMusicLibrary() {
  const unavailable = { unavailable: true };
  const result = await readCloudJSON("api/music", { fallback: unavailable });
  if (result === unavailable || result?.unavailable) return undefined;
  return result?.library ?? null;
}

export function saveCloudMusicLibrary(library) {
  return writeCloudJSON("api/music", library);
}
