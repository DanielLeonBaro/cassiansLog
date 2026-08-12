import { clone } from "../../shared/js/text.js";

const primitiveTargets = new Set(["class", "subclass", "race", "background"]);

export function hasCompendiumEntry(character, entry) {
  const target = entry.add?.target;
  if (!target) return false;
  if (primitiveTargets.has(target)) return character[target] === entry.add.value;
  return Array.isArray(character[target]) && character[target].some((item) =>
    item._compendiumId === entry.id || item.compendiumId === entry.id || item.id === entry.id,
  );
}

export function addCompendiumEntry(character, entry) {
  if (!entry?.add) return false;
  const target = entry.add.target;
  if (primitiveTargets.has(target)) {
    character[target] = entry.add.value;
    return true;
  }
  if (!Array.isArray(character[target])) character[target] = [];
  const existing = character[target].find((item) =>
    item._compendiumId === entry.id || item.compendiumId === entry.id || item.id === entry.id,
  );
  if (existing) {
    if (target === "inventory") existing.quantity = Number(existing.quantity || 0) + 1;
    return target === "inventory";
  }
  const value = clone(entry.add.value);
  if (target === "spells" && !value.source) {
    value.source = character.spellcasting?.profiles?.[0]?.id || "";
  }
  character[target].push(value);
  return true;
}
