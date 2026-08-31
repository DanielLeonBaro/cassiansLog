const identifierMarkers = [
  "WEAPON_CATEGORY_",
  "DAMAGE_TYPE_",
  "WEAPON_PROPERTY_",
  "WEAPON_GROUP_",
  "ARMOR_CATEGORY_",
  "MAGIC_ITEM_",
  "RACIAL_TRAIT_",
  "CLASS_FEATURE_",
  "ARCHETYPE_FEATURE_",
  "FEAT_FEATURE_",
  "PROFICIENCY_",
  "WEAPON_",
  "ARMOR_",
  "SPELL_",
  "ITEM_",
];

export function title(value) {
  return String(value || "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function humanizeIdentifier(value) {
  const identifier = String(value || "").trim();
  if (!identifier.startsWith("ID_")) return title(identifier);
  for (const marker of identifierMarkers) {
    const index = identifier.lastIndexOf(marker);
    if (index >= 0) return title(identifier.slice(index + marker.length).toLowerCase());
  }
  return title(identifier.replace(/^ID_/, "").toLowerCase());
}

export function friendlyMetadataValue(value) {
  if (Array.isArray(value)) return value.map(friendlyMetadataValue).join(", ");
  if (value === true || value === "true") return "Yes";
  if (value === false || value === "false") return "No";
  return String(value ?? "").replace(/ID_[A-Z0-9_]+/g, humanizeIdentifier);
}

export function supportLabels(entry) {
  if (entry.facets?.supports?.length) return entry.facets.supports;
  return String(entry.supports || "")
    .split(/\s*,\s*/)
    .map(humanizeIdentifier)
    .filter(Boolean);
}

export function spellLevelLabel(value) {
  const level = String(value);
  if (level === "0") return "Cantrip";
  return `Level ${level}`;
}
