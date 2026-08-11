import { normalizeText } from "../../shared/text.js";

export function filterCompendiumEntries(entries, { query = "", category = "", publication = "" } = {}) {
  const normalizedQuery = normalizeText(query);
  return entries
    .filter((entry) => {
      if (category && entry.category !== category) return false;
      if (publication && entry.publication !== publication) return false;
      if (!normalizedQuery) return true;
      return normalizeText([
        entry.name, entry.type, entry.publication, entry.summary,
        entry.supports, entry.prerequisite,
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
