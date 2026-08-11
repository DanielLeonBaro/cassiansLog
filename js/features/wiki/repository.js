import { clone } from "../../shared/text.js";
import { readJSON, writeJSON } from "../../shared/storage.js";

export const WIKI_STORAGE_KEY = "dnd-wiki-pages-v1";

export function loadWikiPages(seed) {
  const saved = readJSON(WIKI_STORAGE_KEY, null);
  return Array.isArray(saved) && saved.length ? saved : clone(seed);
}

export function saveWikiPages(pages) {
  writeJSON(WIKI_STORAGE_KEY, pages);
}
