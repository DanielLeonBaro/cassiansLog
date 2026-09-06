// Provides defensive JSON localStorage reads, writes, removal, and campaign isolation.
import { campaignStorageKey } from "./campaign-context.js";
export function readJSON(key, fallback) {
  try {
    const value = localStorage.getItem(campaignStorageKey(key));
    return value === null ? fallback : JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function writeJSON(key, value) {
  localStorage.setItem(campaignStorageKey(key), JSON.stringify(value));
}

export function removeStored(key) {
  localStorage.removeItem(campaignStorageKey(key));
}
