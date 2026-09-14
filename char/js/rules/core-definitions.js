// Canonical D&D ability and skill ownership used by rules-mode calculations.
export const ABILITIES = Object.freeze([
  Object.freeze({ id: "str", name: "Strength" }),
  Object.freeze({ id: "dex", name: "Dexterity" }),
  Object.freeze({ id: "con", name: "Constitution" }),
  Object.freeze({ id: "int", name: "Intelligence" }),
  Object.freeze({ id: "wis", name: "Wisdom" }),
  Object.freeze({ id: "cha", name: "Charisma" }),
]);

export const SKILLS = Object.freeze([
  Object.freeze({ id: "acrobatics", name: "Acrobatics", ability: "dex" }),
  Object.freeze({ id: "animal-handling", ruleName: "animal handling", name: "Animal Handling", ability: "wis" }),
  Object.freeze({ id: "arcana", name: "Arcana", ability: "int" }),
  Object.freeze({ id: "athletics", name: "Athletics", ability: "str" }),
  Object.freeze({ id: "deception", name: "Deception", ability: "cha" }),
  Object.freeze({ id: "history", name: "History", ability: "int" }),
  Object.freeze({ id: "insight", name: "Insight", ability: "wis" }),
  Object.freeze({ id: "intimidation", name: "Intimidation", ability: "cha" }),
  Object.freeze({ id: "investigation", name: "Investigation", ability: "int" }),
  Object.freeze({ id: "medicine", name: "Medicine", ability: "wis" }),
  Object.freeze({ id: "nature", name: "Nature", ability: "int" }),
  Object.freeze({ id: "perception", name: "Perception", ability: "wis" }),
  Object.freeze({ id: "performance", name: "Performance", ability: "cha" }),
  Object.freeze({ id: "persuasion", name: "Persuasion", ability: "cha" }),
  Object.freeze({ id: "religion", name: "Religion", ability: "int" }),
  Object.freeze({ id: "sleight-of-hand", ruleName: "sleight of hand", name: "Sleight of Hand", ability: "dex" }),
  Object.freeze({ id: "stealth", name: "Stealth", ability: "dex" }),
  Object.freeze({ id: "survival", name: "Survival", ability: "wis" }),
].map((skill) => Object.freeze({ ...skill, ruleName: skill.ruleName || skill.name.toLowerCase() })));

export const PASSIVE_SKILLS = Object.freeze([
  Object.freeze({ skillId: "perception", sheetPath: "passivePerception" }),
  Object.freeze({ skillId: "investigation", sheetPath: "passiveInvestigation" }),
  Object.freeze({ skillId: "insight", sheetPath: "passiveInsight" }),
]);
