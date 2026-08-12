export function hasActiveFilters(state) {
  return Object.values(state).some((value) => String(value).trim());
}

export function uniqueValues(values) {
  return [...new Set(values.filter(Boolean).map(String))]
    .sort((left, right) => left.localeCompare(right));
}

export function normalizeFilterText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}
