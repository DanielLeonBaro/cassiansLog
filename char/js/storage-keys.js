export const CHARACTERS_STORAGE_KEY = "dnd-characters";
export const DELETED_CHARACTERS_STORAGE_KEY = "dnd-deleted-characters";
export const PENDING_CHARACTER_STORAGE_KEY = "dnd-new-character";

export function characterStateStorageKey(characterId) {
  return `dnd-${characterId || "character"}-state`;
}

export function characterNotesStorageKey(characterId) {
  return `dnd-${characterId || "character"}-notes`;
}
