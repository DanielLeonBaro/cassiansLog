// Owns compatibility-sensitive character localStorage keys and key builders.
export const CHARACTERS_STORAGE_KEY = "dnd-characters";
export const DELETED_CHARACTERS_STORAGE_KEY = "dnd-deleted-characters";
export const PENDING_CHARACTER_STORAGE_KEY = "dnd-new-character";
export const CHARACTER_BUILD_DRAFTS_STORAGE_KEY = "dnd-character-build-drafts-v1";
export const NPCS_STORAGE_KEY = "dnd-npcs";
export const PENDING_NPC_STORAGE_KEY = "dnd-new-npc";
export const NPC_BUILD_DRAFTS_STORAGE_KEY = "dnd-npc-build-drafts-v1";

export function entityDocumentsStorageKey(kind = globalThis.document?.body?.dataset.trackerKind) {
  return kind === "npc" ? NPCS_STORAGE_KEY : CHARACTERS_STORAGE_KEY;
}

export function characterStateStorageKey(characterId) {
  if (globalThis.document?.body?.dataset.trackerKind === "npc") return `dnd-npc-${characterId || "character"}-state`;
  return `dnd-${characterId || "character"}-state`;
}

export function characterNotesStorageKey(characterId) {
  if (globalThis.document?.body?.dataset.trackerKind === "npc") return `dnd-npc-${characterId || "character"}-notes`;
  return `dnd-${characterId || "character"}-notes`;
}

export function diceHistoryStorageKey(characterId) {
  if (globalThis.document?.body?.dataset.trackerKind === "npc") return `dnd-npc-${characterId || "character"}-roll-history`;
  return `dnd-${characterId || "character"}-roll-history`;
}
