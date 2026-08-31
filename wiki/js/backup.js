// Builds deterministic downloadable Wiki backups.
export function createWikiBackup(pages, now = () => new Date()) {
  return {
    version: 1,
    exportedAt: now().toISOString(),
    pages,
  };
}

export function wikiBackupFilename(now = () => new Date()) {
  return `breugaire-wiki-${now().toISOString().slice(0, 10)}.json`;
}

export function parseWikiBackup(source) {
  const value = JSON.parse(String(source || ""));
  const pages = Array.isArray(value) ? value : value.pages;
  if (!Array.isArray(pages) || !pages.every((page) => page?.id && page?.name)) {
    throw new TypeError("This file does not contain wiki pages.");
  }
  return pages;
}
