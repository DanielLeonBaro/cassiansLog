// Verifies character storage keys.
import assert from "node:assert/strict";
import {
  CHARACTERS_STORAGE_KEY,
  DELETED_CHARACTERS_STORAGE_KEY,
  PENDING_CHARACTER_STORAGE_KEY,
  characterNotesStorageKey,
  characterStateStorageKey,
} from "../js/storage-keys.js";

assert.equal(CHARACTERS_STORAGE_KEY, "dnd-characters");
assert.equal(DELETED_CHARACTERS_STORAGE_KEY, "dnd-deleted-characters");
assert.equal(PENDING_CHARACTER_STORAGE_KEY, "dnd-new-character");
assert.equal(characterStateStorageKey("cassian"), "dnd-cassian-state");
assert.equal(characterStateStorageKey(""), "dnd-character-state");
assert.equal(characterNotesStorageKey("cassian"), "dnd-cassian-notes");
assert.equal(characterNotesStorageKey(), "dnd-character-notes");

console.log("Character storage-key tests passed.");
