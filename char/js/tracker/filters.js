// Defines combat and possibility filter defaults, labels, and matching rules.
import { normalizeFilterText } from "./filter-utilities.js";

export const FILTER_FOCUS_OPTIONS = [
  { value: "", label: "Any focus" },
  { value: "damage-spell", label: "Damage spells" },
  { value: "healing-spell", label: "Healing spells" },
  { value: "utility-spell", label: "Utility spells" },
  { value: "melee-spell", label: "Melee spells" },
  { value: "melee-attack", label: "Melee attacks" },
  { value: "ranged-attack", label: "Ranged attacks" },
  { value: "feat", label: "Feats" },
  { value: "feature", label: "Features" },
  { value: "resource", label: "Resources" },
];

export function createFilterState() {
  return {
    search: "",
    source: "",
    focus: "",
    level: "",
    category: "",
    action: "",
  };
}

export function itemMatchesFilters(record, state) {
  const { item, source } = record;
  if (state.source && source !== state.source) return false;
  if (
    state.level !== "" &&
    (item.level === undefined || Number(item.level) !== Number(state.level))
  ) return false;
  if (state.category && item.category !== state.category) return false;
  if (state.action && item.action !== state.action) return false;
  if (state.focus && !matchesFocus(record, state.focus)) return false;
  const terms = normalizeFilterText(state.search).split(/\s+/).filter(Boolean);
  if (!terms.length) return true;
  const haystack = itemFilterText(record);
  return terms.every((term) => haystack.includes(term));
}

export function matchesFocus(record, focus) {
  const { item, source } = record;
  const text = itemFilterText(record);
  const spell = source === "spells";
  const healing =
    /\b(heal|healing|cure|stabiliz)/.test(text) ||
    /\b(regain|restore)[a-z ]{0,24}\bhit points?\b/.test(text);
  const damaging = Boolean(item.damage) || /\bdeals?\b.{0,32}\bdamage\b/.test(text);
  const rangeText = normalizeFilterText(item.range);
  const description = normalizeFilterText(item.description);
  const distances = [...String(item.range || "").matchAll(/\d+/g)].map(
    (match) => Number(match[0]),
  );
  const attack =
    Boolean(item.attack) ||
    /\battack\b/.test(normalizeFilterText(`${item.name} ${item.description}`));
  const melee =
    /\b(melee|touch|adjacent)\b/.test(`${rangeText} ${description}`) ||
    (attack && distances.length > 0 && Math.min(...distances) <= 5);
  const ranged =
    /\b(ranged|thrown)\b/.test(description) ||
    (attack && distances.some((distance) => distance > 5));

  switch (focus) {
    case "damage-spell": return spell && damaging;
    case "healing-spell": return spell && healing;
    case "utility-spell": return spell && !damaging && !healing;
    case "melee-spell": return spell && melee;
    case "melee-attack": return attack && melee;
    case "ranged-attack": return attack && ranged;
    case "feat": return /\bfeat\b/.test(normalizeFilterText(`${item.name} ${item.category}`));
    case "feature": return source === "features" || /\b(feature|trait)\b/.test(text);
    case "resource": return source === "resources";
    default: return true;
  }
}

export function itemFilterText({ item, source }) {
  return normalizeFilterText([
    item.name,
    item.category,
    item.action,
    item.description,
    item.school,
    item.range,
    item.attack,
    item.damage,
    item.duration,
    item.components,
    item.level !== undefined ? formatSpellLevel(item.level) : "",
    source,
  ].join(" "));
}

function formatSpellLevel(level) {
  return Number(level) === 0 ? "Cantrip" : `Level ${level}`;
}
