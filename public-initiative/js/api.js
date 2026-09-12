// Exposes campaign-scoped local initiative names to shared integrations.
import { readJSON } from "../../shared/js/storage.js";
import { initiativeEntriesFromSnapshot, initiativeNamesFromSnapshot } from "./model.js";

const COMBAT_DRAFT_STORAGE_KEY = "dnd-combat-loot-draft-v1";

export function localInitiativeNames() {
  return initiativeNamesFromSnapshot({ draft: readJSON(COMBAT_DRAFT_STORAGE_KEY, null) });
}

export function localInitiativeEntries() {
  return initiativeEntriesFromSnapshot({ draft: readJSON(COMBAT_DRAFT_STORAGE_KEY, null) });
}

export { initiativeEntriesFromSnapshot, initiativeNamesFromSnapshot } from "./model.js";
