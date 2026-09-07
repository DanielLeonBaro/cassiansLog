// Exposes campaign-scoped local initiative names to shared integrations.
import { readJSON } from "../../shared/js/storage.js";
import { initiativeNamesFromSnapshot } from "./model.js";

const COMBAT_DRAFT_STORAGE_KEY = "dnd-combat-loot-draft-v1";

export function localInitiativeNames() {
  return initiativeNamesFromSnapshot({ draft: readJSON(COMBAT_DRAFT_STORAGE_KEY, null) });
}

export { initiativeNamesFromSnapshot } from "./model.js";
