// Extracts an ordered public combatant list from a shared initiative snapshot.
import { normalizeTrackerLink } from "../../shared/js/tracker-link.js";

export function initiativeEntriesFromSnapshot(snapshot) {
  const tables = snapshot?.draft?.currentDocument?.tables;
  if (!Array.isArray(tables)) return [];

  const initiative = tables.find((table) => table?.type === "initiative");
  if (!initiative || !Array.isArray(initiative.columns) || !Array.isArray(initiative.rows)) {
    return [];
  }

  const characterColumn = initiative.columns.find((column) => column?.role === "character");
  if (!characterColumn?.id) return [];

  return initiative.rows.reduce((entries, row) => {
    const name = typeof row?.cells?.[characterColumn.id] === "string"
      ? row.cells[characterColumn.id].trim()
      : "";
    if (!name) return entries;
    const characterLink = normalizeTrackerLink(row.characterLink);
    entries.push({ name, ...(characterLink ? { characterLink } : {}) });
    return entries;
  }, []);
}

export function initiativeNamesFromSnapshot(snapshot) {
  return initiativeEntriesFromSnapshot(snapshot).map((entry) => entry.name);
}
