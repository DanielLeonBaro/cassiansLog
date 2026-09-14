const CHARACTER_CERTIFICATIONS = require("../rules/certifications.cjs");

function certificationFor(entry) {
  return CHARACTER_CERTIFICATIONS[entry?.originalId] || null;
}

function effectiveCertifiedEntry(entry) {
  const certification = certificationFor(entry);
  if (!certification) return entry;
  return {
    ...entry,
    related: [],
    relatedIds: [],
    rules: certification.rules ?? entry.rules,
    requirements: certification.requirements ?? entry.requirements,
    prerequisite: certification.prerequisite ?? entry.prerequisite,
    setters: { ...(entry.setters || {}), ...(certification.setters || {}) },
    sheetAttributes: { ...(entry.sheetAttributes || {}), ...(certification.sheetAttributes || {}) },
  };
}

module.exports = {
  CHARACTER_CERTIFICATIONS,
  certificationFor,
  effectiveCertifiedEntry,
};
