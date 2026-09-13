// Derives tracker roll formulas and renders safe, clickable roll controls.
import { parseDiceFormula } from "../../../shared/js/dice/formula.js";
import { escapeAttribute, escapeHTML } from "../../../shared/js/text.js";

export const rollButtonClasses = "inline-flex items-center gap-1.5 rounded-full border border-stone-500 bg-stone-800 px-2.5 py-1 text-center text-xs font-bold leading-tight text-white transition hover:border-gold hover:text-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold";

function validFormula(formula) {
  const normalized = String(formula || "").replace(/\s+/g, "").trim();
  if (!normalized) return "";
  try {
    parseDiceFormula(normalized);
    return normalized;
  } catch {
    return "";
  }
}

export function modifierRollFormula(modifier) {
  if (modifier === null || modifier === undefined || String(modifier).trim() === "") return "";
  const value = Number(modifier);
  if (!Number.isFinite(value)) return "";
  return `1d20${value >= 0 ? `+${value}` : value}`;
}

export function formulaFromRollCall(value) {
  const match = String(value || "").match(/\broll\s*\(\s*([^()]+?)\s*\)/i);
  return match ? validFormula(match[1]) : "";
}

function diceFormulaFromText(value) {
  const text = String(value || "");
  const start = text.search(/(?:\d+)?d\d+/i);
  if (start < 0) return "";
  const candidate = text.slice(start).match(/^[\ddD+\-*/()\s]+/)?.[0] || "";
  const trimmed = candidate.replace(/[+\-*/\s]+$/, "");
  return validFormula(trimmed);
}

export function attackRollFormula(value) {
  const explicit = formulaFromRollCall(value) || diceFormulaFromText(value);
  if (explicit) return explicit;
  const modifier = String(value || "").match(/[+\-]\s*\d+/)?.[0]?.replace(/\s+/g, "");
  if (modifier) return modifierRollFormula(Number(modifier));
  const plain = String(value || "").trim().match(/^\d+$/)?.[0];
  return plain ? modifierRollFormula(Number(plain)) : "";
}

export function damageRollFormula(value) {
  const explicit = formulaFromRollCall(value) || diceFormulaFromText(value);
  if (explicit) return explicit;
  return validFormula(String(value || "").trim().match(/^[+\-]?\d+/)?.[0]);
}

export function renderRollButton({ formula, label, text, content = "", className = rollButtonClasses }) {
  const normalized = validFormula(formula);
  if (!normalized) return content || escapeHTML(text);
  const safeLabel = String(label || `Dice Roller ${normalized}`).trim();
  const buttonContent = content || `<i class="bi bi-dice-6-fill" aria-hidden="true"></i>${escapeHTML(text)}`;
  return `<button type="button" data-roll-formula="${escapeAttribute(normalized)}" data-roll-label="${escapeAttribute(safeLabel)}" class="${className}" aria-label="Roll ${escapeAttribute(safeLabel)}" title="Roll ${escapeAttribute(safeLabel)}">${buttonContent}</button>`;
}

export function renderRollableText(value) {
  const text = String(value || "");
  const expression = /\broll\s*\(\s*([^()]+?)\s*\)/gi;
  let output = "";
  let lastIndex = 0;
  let match;
  while ((match = expression.exec(text))) {
    output += escapeHTML(text.slice(lastIndex, match.index));
    const formula = validFormula(match[1]);
    output += formula
      ? renderRollButton({ formula, label: `Dice Roller ${formula}`, text: `roll(${formula})` })
      : escapeHTML(match[0]);
    lastIndex = expression.lastIndex;
  }
  return output + escapeHTML(text.slice(lastIndex));
}
