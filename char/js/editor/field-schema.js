export const EDITOR_SECTION_DEFINITIONS = [
  { id: "basics", label: "Basics", icon: "bi-person-fill" },
  { id: "combat", label: "Abilities & Combat", icon: "bi-shield-fill" },
  { id: "actions", label: "Actions & Trackers", icon: "bi-lightning-charge-fill" },
  { id: "spellcasting", label: "Spellcasting", icon: "bi-magic" },
  { id: "features", label: "Features & Resources", icon: "bi-stars" },
  { id: "inventory", label: "Inventory & Currency", icon: "bi-backpack-fill" },
  { id: "advanced", label: "Advanced", icon: "bi-sliders" },
];

export const CHARACTER_SECTION_KEYS = new Set([
  "portrait", "name", "class", "subclass", "race", "level", "experience", "background", "alignment", "gender",
  "hp", "ac", "initiative", "proficiency", "walk", "fly", "passivePerception", "darkvision", "stats",
  "actions", "trackers", "spellcasting", "spells", "features", "resources", "inventory", "currency",
  "id", "bundledUpdate", "bundledUpdateVersions", "v1SectionOrder",
]);

export const COLLECTION_KNOWN_FIELDS = {
  trackers: new Set(["id", "name", "active"]),
  profiles: new Set(["id", "name", "ability", "saveDC", "attackBonus", "preparedLimit"]),
  slots: new Set(["id", "profileId", "level", "current", "max", "reset"]),
  skills: new Set(["name", "modifier", "proficiency"]),
  actions: new Set(["id", "name", "category", "action", "range", "attack", "damage", "duration", "uses", "description"]),
  spells: new Set(["id", "name", "category", "action", "level", "school", "source", "spellcasting", "slotLevel", "range", "attack", "damage", "duration", "components", "concentration", "prepared", "uses", "description"]),
  resources: new Set(["id", "name", "category", "action", "uses", "description"]),
  features: new Set(["id", "name", "category", "description"]),
  inventory: new Set(["id", "name", "quantity", "description"]),
};

const FIELD_LABELS = {
  hp: "Hit points", ac: "Armor class", str: "Strength", dex: "Dexterity",
  con: "Constitution", int: "Intelligence", wis: "Wisdom", cha: "Charisma",
  saveDC: "Save DC", attackBonus: "Attack bonus", preparedLimit: "Prepared spell limit",
  passivePerception: "Passive perception", darkvision: "Darkvision range",
  walk: "Walking speed", fly: "Flying speed", profileId: "Spellcasting profile",
};

export function fieldTitle(value) {
  return FIELD_LABELS[value] || String(value)
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[-_]/g, " ")
    .replace(/^./, (character) => character.toUpperCase());
}

export function fieldPathKey(path) {
  return path.join(".");
}

export function isSystemField(path, key) {
  return key === "id" || key.startsWith("_") || (key.endsWith("Id") && key !== "profileId") || (
    path.length === 1 && ["bundledUpdate", "bundledUpdateVersions"].includes(key)
  );
}

export function collectionItemSummary(item, key, index) {
  if (!item || typeof item !== "object") {
    return { name: `${fieldTitle(key)} ${index + 1}`, details: "" };
  }
  return {
    name: item.name || item.label || `${fieldTitle(key)} ${index + 1}`,
    details: [
      item.category,
      item.action,
      item.level !== undefined ? `Level ${item.level}` : "",
    ].filter(Boolean).join(" · "),
  };
}
