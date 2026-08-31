// Normalizes Compendium search text and ranks matching entries.
import { normalizeText } from "../../shared/js/text.js";

export function facetValues(entries, name) {
  return [...new Set(entries.flatMap((entry) => {
    const value = entry.facets?.[name];
    return Array.isArray(value) ? value : value ? [value] : [];
  }))].sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));
}

export function filterCompendiumEntries(entries, {
  query = "",
  category = "",
  publication = "",
  type = "",
  kind = "",
  damageType = "",
  rarity = "",
  attunement = "",
  spellLevel = "",
  school = "",
} = {}) {
  const normalizedQuery = normalizeText(query);
  return entries
    .filter((entry) => {
      if (category && entry.category !== category) return false;
      if (publication && entry.publication !== publication) return false;
      if (type && entry.type !== type) return false;
      if (kind && !entry.facets?.kinds?.includes(kind)) return false;
      if (damageType && !entry.facets?.damageTypes?.includes(damageType)) return false;
      if (rarity && entry.facets?.rarity !== rarity) return false;
      if (attunement && entry.facets?.attunement !== attunement) return false;
      if (spellLevel && entry.facets?.spellLevel !== spellLevel) return false;
      if (school && entry.facets?.school !== school) return false;
      if (!normalizedQuery) return true;
      return normalizeText([
        entry.name, entry.type, entry.publication, entry.summary,
        entry.supports, entry.prerequisite,
        ...(entry.facets?.kinds || []),
        ...(entry.facets?.damageTypes || []),
        ...(entry.facets?.keywords || []),
        entry.facets?.rarity,
        entry.facets?.school,
      ].join(" ")).includes(normalizedQuery);
    })
    .sort((left, right) => {
      if (normalizedQuery) {
        const rank = (entry) => {
          const name = normalizeText(entry.name);
          return name === normalizedQuery ? 0 : name.startsWith(normalizedQuery) ? 1 : 2;
        };
        const difference = rank(left) - rank(right);
        if (difference) return difference;
      }
      return left.name.localeCompare(right.name) || left.publication.localeCompare(right.publication);
    });
}
