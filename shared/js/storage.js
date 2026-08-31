// Provides defensive JSON localStorage reads, writes, and removal.
export function readJSON(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function writeJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function removeStored(key) {
  localStorage.removeItem(key);
}
