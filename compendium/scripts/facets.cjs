const damageTypes = [
  "Acid",
  "Bludgeoning",
  "Cold",
  "Fire",
  "Force",
  "Lightning",
  "Necrotic",
  "Piercing",
  "Poison",
  "Psychic",
  "Radiant",
  "Slashing",
  "Thunder",
];

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function label(value) {
  return String(value || "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.]+$/, "")
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function identifierLabel(value) {
  const identifier = String(value || "").trim();
  if (!identifier.startsWith("ID_")) return label(identifier);
  const markers = [
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
  for (const marker of markers) {
    const index = identifier.lastIndexOf(marker);
    if (index >= 0) return label(identifier.slice(index + marker.length));
  }
  return label(identifier.replace(/^ID_/, ""));
}

function supportRecords(value) {
  return String(value || "")
    .split(/\s*,\s*/)
    .map((identifier) => identifier.trim())
    .filter(Boolean)
    .map((identifier) => ({ identifier, label: identifierLabel(identifier) }));
}

function normalizeRarity(value) {
  const rarity = label(value);
  const normalized = rarity.toLowerCase();
  if (normalized === "unommon") return "Uncommon";
  if (normalized === "vert rare") return "Very Rare";
  if (normalized === "lgendary") return "Legendary";
  if (normalized.includes("varies")) return "Varies";
  return rarity;
}

function compendiumFacets(entry) {
  const setters = entry.setters || {};
  const supports = supportRecords(entry.supports);
  const kinds = [setters.category, setters.type];
  for (const support of supports) {
    if (
      /_(?:WEAPON_CATEGORY|WEAPON_GROUP|ARMOR_CATEGORY)_/.test(
        support.identifier,
      )
    ) kinds.push(support.label);
  }

  const corpus = [
    entry.supports,
    setters.keywords,
    entry.summary,
    entry.description,
    entry.sheet,
  ].join(" ");
  const foundDamageTypes = damageTypes.filter((damageType) =>
    new RegExp(
      `(?:DAMAGE_TYPE_${damageType.toUpperCase()}|\\b${damageType}\\s+damage\\b|(?:^|[,; ])${damageType}(?:$|[,; ]))`,
      "i",
    ).test(corpus),
  );
  const keywords = String(setters.keywords || "")
    .split(/\s*,\s*/)
    .map(label)
    .filter(Boolean);
  const isItem = entry.category === "items";

  return {
    kinds: unique(kinds.map(label)),
    damageTypes: unique(foundDamageTypes),
    rarity: normalizeRarity(setters.rarity),
    attunement: isItem
      ? String(setters.attunement).toLowerCase() === "true"
        ? "required"
        : "not-required"
      : "",
    spellLevel: entry.type === "Spell" ? String(setters.level || "0") : "",
    school: entry.type === "Spell" ? label(setters.school) : "",
    keywords: unique([...keywords, ...supports.map((support) => support.label)]),
    supports: unique(supports.map((support) => support.label)),
  };
}

module.exports = {
  compendiumFacets,
  identifierLabel,
  normalizeRarity,
};
