// Exports safe text helpers and shared tracker class tokens.
export { escapeHTML } from "../../../shared/js/text.js";

export { GC_CARD_CLASSES as trackerUI } from "../../../shared/gc/classes.js";

export function setText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value ?? "—";
}

export function sanitizeIdentifier(value) {
  return String(value ?? "").replace(/[^a-zA-Z0-9_-]/g, "-");
}

export const escapeAttribute = sanitizeIdentifier;
