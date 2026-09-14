// Records expressions proven by engine tests and content with reviewed rule overlays.
const { CHARACTER_CERTIFICATIONS } = require("./certifications.cjs");

const SUPPORTED_RULE_EXPRESSIONS = new Set([
  "grant",
  "known",
  "level",
  "prepared",
  "selection",
  "spellcasting",
  "stat",
  "supports",
]);
const CERTIFIED_ORIGINAL_IDS = new Set(Object.keys(CHARACTER_CERTIFICATIONS));

module.exports = {
  CERTIFIED_ORIGINAL_IDS,
  SUPPORTED_RULE_EXPRESSIONS,
};
