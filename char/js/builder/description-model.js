// Owns Character Builder identity and descriptive fields.
import { normalizeCharacterDocument } from "../model.js";

export const BUILDER_DESCRIPTION_FIELDS = Object.freeze([
  Object.freeze({ id: "alignment", label: "Alignment", group: "identity" }),
  Object.freeze({ id: "gender", label: "Gender", group: "identity" }),
  Object.freeze({ id: "faith", label: "Faith", group: "identity" }),
  Object.freeze({ id: "age", label: "Age", group: "appearance" }),
  Object.freeze({ id: "height", label: "Height", group: "appearance" }),
  Object.freeze({ id: "weight", label: "Weight", group: "appearance" }),
  Object.freeze({ id: "eyes", label: "Eyes", group: "appearance" }),
  Object.freeze({ id: "skin", label: "Skin", group: "appearance" }),
  Object.freeze({ id: "hair", label: "Hair", group: "appearance" }),
  Object.freeze({ id: "appearance", label: "Appearance", group: "story", multiline: true }),
  Object.freeze({ id: "personalityTraits", label: "Personality traits", group: "story", multiline: true }),
  Object.freeze({ id: "ideals", label: "Ideals", group: "story", multiline: true }),
  Object.freeze({ id: "bonds", label: "Bonds", group: "story", multiline: true }),
  Object.freeze({ id: "flaws", label: "Flaws", group: "story", multiline: true }),
  Object.freeze({ id: "backstory", label: "Backstory", group: "story", multiline: true }),
  Object.freeze({ id: "allies", label: "Allies and contacts", group: "story", multiline: true }),
  Object.freeze({ id: "organizations", label: "Organizations", group: "story", multiline: true }),
  Object.freeze({ id: "notes", label: "Other notes", group: "story", multiline: true }),
]);

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function builderCharacterId(name) {
  return text(name).toLocaleLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 128) || "character";
}

export function applyBuilderDescription(value, changes = {}) {
  const document = normalizeCharacterDocument(value);
  const previousDerivedId = builderCharacterId(document.name);
  if (changes.name !== undefined) {
    document.name = text(changes.name).slice(0, 80);
    if (!text(document.id) || document.id === previousDerivedId) document.id = builderCharacterId(document.name);
  }
  if (changes.id !== undefined) document.id = text(changes.id).toLocaleLowerCase().slice(0, 128);
  if (changes.status !== undefined) document.status = text(changes.status).slice(0, 32) || "Draft";
  const field = text(changes.field);
  if (field && BUILDER_DESCRIPTION_FIELDS.some(({ id }) => id === field)) {
    document.build.description[field] = typeof changes.value === "string" ? changes.value.slice(0, 10000) : "";
  }
  document.build.status = "incomplete";
  return normalizeCharacterDocument(document);
}

export function descriptionStepValidation(value) {
  const document = normalizeCharacterDocument(value);
  const errors = [];
  if (!text(document.name)) errors.push("Character name is required.");
  if (!/^[a-z0-9][a-z0-9-]{0,127}$/.test(text(document.id))) errors.push("Character ID must use lowercase letters, numbers, and hyphens.");
  const detailCount = BUILDER_DESCRIPTION_FIELDS.filter(({ id }) => text(document.build.description[id])).length;
  return {
    errors,
    detailCount,
    complete: !errors.length,
    status: errors.length ? "incomplete" : detailCount ? "complete" : "warning",
  };
}

export function descriptionLegacyProjection(value) {
  const document = normalizeCharacterDocument(value);
  return Object.fromEntries(BUILDER_DESCRIPTION_FIELDS.flatMap(({ id }) => {
    const candidate = document.build.description[id];
    return typeof candidate === "string" && candidate.length ? [[id, candidate]] : [];
  }));
}
