// Adapts the public Character archive list for campaign management.
import { listCharacters } from "../../char/js/archive/api.js";

export async function loadCampaignCharacterRecords() {
  return (await listCharacters()).map((character) => ({
    id: character.id,
    document: character,
    canEdit: character.canEdit,
    canManage: character.canManage,
  }));
}
