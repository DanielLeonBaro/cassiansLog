// Supplies compact Character and NPC choices to Combat & Loot.
import { listCharacters } from "../../char/js/archive/api.js";
import { listNpcs } from "../../npc/js/api.js";

export async function loadCombatEntityOptions({
  loadCharacters = listCharacters,
  loadNpcs = listNpcs,
} = {}) {
  const [characters, npcResult] = await Promise.all([loadCharacters(), loadNpcs()]);
  return [
    ...characters.map((character) => ({
      kind: "character",
      id: character.id,
      name: character.name || character.id,
    })),
    ...npcResult.npcs.map((record) => ({
      kind: "npc",
      id: record.id,
      name: record.document?.name || record.id,
    })),
  ];
}
