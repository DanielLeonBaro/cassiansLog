import { clone } from "../../shared/js/text.js";
import { readJSON, writeJSON } from "../../shared/js/storage.js";

export const WIKI_STORAGE_KEY = "dnd-wiki-pages-v1";

export async function loadWikiPages() {
  const saved = readJSON(WIKI_STORAGE_KEY, null);
  if (Array.isArray(saved) && saved.length) return saved;
  const response = await fetch(new URL("../data/pages.json", import.meta.url));
  if (!response.ok) throw new Error(`Could not load the Wiki seed (${response.status}).`);
  return clone(await response.json());
}

export function saveWikiPages(pages) {
  writeJSON(WIKI_STORAGE_KEY, pages);
}
