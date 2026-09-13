// Persists bounded, entity-scoped dice roll history in campaign-aware local storage.
import { readJSON, removeStored, writeJSON } from "../storage.js";

export const MAX_DICE_HISTORY = 50;

function normalizePart(part) {
  const tone = ["minimum", "maximum"].includes(part?.tone) ? part.tone : "normal";
  return { text: String(part?.text ?? ""), tone };
}

export function normalizeDiceHistory(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, MAX_DICE_HISTORY).flatMap((entry) => {
    const total = Number(entry?.total);
    if (!entry || !String(entry.formula || "").trim() || !Number.isFinite(total)) return [];
    return [{
      label: String(entry.label || "Dice Roller").trim() || "Dice Roller",
      formula: String(entry.formula).trim(),
      total,
      parts: Array.isArray(entry.parts) ? entry.parts.map(normalizePart) : [],
      rolledAt: String(entry.rolledAt || ""),
    }];
  });
}

export function loadDiceHistory(storageKey) {
  if (!storageKey) return [];
  return normalizeDiceHistory(readJSON(storageKey, []));
}

export function recordDiceHistory(storageKey, entry) {
  if (!storageKey) return normalizeDiceHistory([entry]);
  const history = normalizeDiceHistory([entry, ...loadDiceHistory(storageKey)]);
  writeJSON(storageKey, history);
  return history;
}

export function clearDiceHistory(storageKey) {
  if (storageKey) removeStored(storageKey);
}
