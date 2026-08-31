// Owns Wiki serialization, persistence, and fallback precedence.
import { cloneJSON } from "../../shared/js/text.js";
import { readJSON, writeJSON } from "../../shared/js/storage.js";
import { readCloudJSON, writeCloudJSON } from "../../shared/js/cloud-store.js";
import { normalizeWikiPages } from "./model.js";

export const WIKI_STORAGE_KEY = "dnd-wiki-pages-v1";

export async function loadWikiPages() {
  const cloud = await readCloudJSON("api/wiki", { fallback: null });
  if (Array.isArray(cloud?.pages)) {
    const pages = normalizeWikiPages(cloud.pages);
    writeJSON(WIKI_STORAGE_KEY, pages);
    return cloneJSON(pages);
  }
  const saved = readJSON(WIKI_STORAGE_KEY, null);
  if (Array.isArray(saved) && saved.length) {
    const pages = normalizeWikiPages(saved);
    writeJSON(WIKI_STORAGE_KEY, pages);
    return pages;
  }
  const response = await fetch(new URL("../data/pages.json", import.meta.url));
  if (!response.ok) throw new Error(`Could not load the Wiki seed (${response.status}).`);
  return cloneJSON(normalizeWikiPages(await response.json()));
}

export async function saveWikiPages(pages) {
  const normalized = normalizeWikiPages(pages);
  writeJSON(WIKI_STORAGE_KEY, normalized);
  await writeCloudJSON("api/wiki", { pages: normalized });
}
