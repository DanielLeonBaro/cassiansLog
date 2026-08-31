const abilityScoreNames = new Set([
  "Strength",
  "Dexterity",
  "Constitution",
  "Intelligence",
  "Wisdom",
  "Charisma",
]);
const sizeOptionNames = new Set([
  "Tiny",
  "Small",
  "Medium",
  "Large",
  "Huge",
  "Gargantuan",
]);
const damageTypeOptionNames = new Set([
  "Acid",
  "Cold",
  "Fire",
  "Force",
  "Lightning",
  "Necrotic",
  "Poison",
  "Psychic",
  "Radiant",
  "Thunder",
]);
const alignmentOptionNames = new Set(["Good", "Neutral", "Evil"]);
const lycanthropeSpeedNames = new Set([
  "Werebat Speed",
  "Werebear Speed",
  "Wereboar Speed",
  "Wererat Speed",
  "Wereraven Speed",
  "Weretiger Speed",
  "Werewolf Speed",
]);

function isCompendiumNoise(entry) {
  if (entry.type === "Ability Score Improvement") return true;
  if (entry.category !== "features") return false;
  if (/^Ability Score Improvement(?: \([^)]*\))?$/.test(entry.name)) return true;
  if (entry.name === "Level 4: Ability Score Improvement") return true;
  if (
    /^Ability Score Increase \((Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)\)$/.test(
      entry.name,
    )
  ) return true;
  if (abilityScoreNames.has(entry.name)) return true;
  if (/^[0-9]+ feet$/.test(entry.name)) return true;
  if (sizeOptionNames.has(entry.name)) return true;
  if (lycanthropeSpeedNames.has(entry.name)) return true;
  if (entry.type === "Class Feature" && entry.name === "Feat") return true;
  if (entry.name === "Level 19: Epic Boon") return true;
  if (/^(?:Level [56]: )?Extra Attack$/.test(entry.name)) return true;
  if (alignmentOptionNames.has(entry.name)) return true;
  return damageTypeOptionNames.has(entry.name);
}

function compendiumDuplicateKey(entry) {
  return JSON.stringify([
    entry.type,
    entry.name,
    entry.publication,
    entry.summary,
  ]);
}

function preferenceScore(record) {
  const relative = record.inputPath.replace(/\\/g, "/");
  let score = Math.min(record.description.length / 1000, 15);
  if (!relative.startsWith("AuroraLegacy/")) score += 100;
  if (relative.startsWith("core/")) score += 30;
  if (relative.startsWith("supplements/")) score += 20;
  if (relative.split("/").length <= 3) score += 5;
  return score;
}

function filterCompendiumEntries(entries) {
  const preferredByDuplicateKey = new Map();
  for (const entry of entries) {
    if (isCompendiumNoise(entry)) continue;
    const key = compendiumDuplicateKey(entry);
    const current = preferredByDuplicateKey.get(key);
    if (
      !current ||
      preferenceScore(entry) > preferenceScore(current) ||
      (preferenceScore(entry) === preferenceScore(current) &&
        `${entry.originalId}|${entry.inputPath}`.localeCompare(
          `${current.originalId}|${current.inputPath}`,
        ) < 0)
    ) preferredByDuplicateKey.set(key, entry);
  }

  return entries.filter(
    (entry) =>
      !isCompendiumNoise(entry) &&
      preferredByDuplicateKey.get(compendiumDuplicateKey(entry)) === entry,
  );
}

module.exports = {
  compendiumDuplicateKey,
  filterCompendiumEntries,
  isCompendiumNoise,
  preferenceScore,
};
