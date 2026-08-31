// Defines Wiki normalization and state transformations without DOM side effects.
export function compactWikiPageId(title) {
  return String(title || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "") || "page";
}

export function normalizeWikiPages(value) {
  if (!Array.isArray(value)) return [];
  const usedIds = new Set();

  return value.map((page) => {
    const baseId = compactWikiPageId(page?.name);
    let id = baseId;
    let suffix = 2;
    while (usedIds.has(id)) id = `${baseId}${suffix++}`;
    usedIds.add(id);

    const legacyIds = [...new Set([
      ...(Array.isArray(page?.legacyIds) ? page.legacyIds : []),
      page?.id,
    ].filter((legacyId) => typeof legacyId === "string" && legacyId && legacyId !== id))];
    const normalized = { ...page, id };
    if (legacyIds.length) normalized.legacyIds = legacyIds;
    else delete normalized.legacyIds;
    return normalized;
  });
}

export function findWikiPageById(pages, id) {
  if (!id) return null;
  return pages.find((page) => page.id === id)
    || pages.find((page) => page.legacyIds?.includes(id))
    || null;
}
