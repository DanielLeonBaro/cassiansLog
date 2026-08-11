import { readJSON, writeJSON } from "../../shared/storage.js";

export const CHARACTERS_KEY = "dnd-characters";
export const DELETED_KEY = "dnd-deleted-characters";
export const PENDING_KEY = "dnd-new-character";

export function storedCharacters() {
  const value = readJSON(CHARACTERS_KEY, {});
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

export function characterDescription(character) {
  const ancestryAndClass = [character.race, character.class, character.subclass]
    .filter(Boolean)
    .join(" · ");
  return `Level ${character.level ?? "—"} ${ancestryAndClass}`.trim();
}

export async function listCharacters() {
  const response = await fetch("data/characters.json");
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const bundled = await response.json();
  const saved = storedCharacters();
  const deleted = new Set(readJSON(DELETED_KEY, []));
  const bundledIds = new Set(bundled.map((character) => character.id));
  const characters = bundled
    .filter((character) => !deleted.has(character.id))
    .map((character) => {
      const override = saved[character.id];
      return override ? {
        ...character,
        name: override.name,
        portrait: override.portrait,
        description: characterDescription(override),
      } : character;
    });
  Object.values(saved).forEach((character) => {
    if (!bundledIds.has(character.id)) {
      characters.push({ ...character, custom: true, description: characterDescription(character) });
    }
  });
  return characters;
}

export function removeCharacter(character) {
  const stored = storedCharacters();
  delete stored[character.id];
  writeJSON(CHARACTERS_KEY, stored);
  if (!character.custom) {
    const deleted = new Set(readJSON(DELETED_KEY, []));
    deleted.add(character.id);
    writeJSON(DELETED_KEY, [...deleted]);
  }
}

export function createCharacterId(name) {
  const base = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "character";
  const occupied = new Set([...Object.keys(storedCharacters()), "cassian", "template"]);
  let id = base;
  let suffix = 2;
  while (occupied.has(id)) id = `${base}-${suffix++}`;
  return id;
}
