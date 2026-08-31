// Extracts an ordered public combatant list from a shared initiative snapshot.
export function initiativeNamesFromSnapshot(snapshot) {
  const tables = snapshot?.draft?.currentDocument?.tables;
  if (!Array.isArray(tables)) return [];

  const initiative = tables.find((table) => table?.type === "initiative");
  if (!initiative || !Array.isArray(initiative.columns) || !Array.isArray(initiative.rows)) {
    return [];
  }

  const characterColumn = initiative.columns.find((column) => column?.role === "character");
  if (!characterColumn?.id) return [];

  return initiative.rows
    .map((row) => row?.cells?.[characterColumn.id])
    .filter((name) => typeof name === "string")
    .map((name) => name.trim())
    .filter(Boolean);
}
