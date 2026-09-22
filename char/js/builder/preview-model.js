// Shapes evaluated builder data into a compact live-preview contract.
import { reviewCharacterBuild } from "./review-model.js";

const ABILITY_LABELS = { str: "STR", dex: "DEX", con: "CON", int: "INT", wis: "WIS", cha: "CHA" };

function list(value) {
  return Array.isArray(value) ? value : [];
}

function number(value, fallback = "—") {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function signed(value) {
  const amount = number(value, null);
  return amount === null ? "—" : `${amount >= 0 ? "+" : ""}${amount}`;
}

function named(item, fallback = "Unnamed") {
  if (typeof item === "string") return item;
  return String(item?.name || item?.label || item?.id || fallback);
}

function actionLabel(action) {
  const details = [];
  if (action.attackBonus !== undefined) details.push(`${signed(action.attackBonus)} to hit`);
  else if (action.attack) details.push(String(action.attack));
  if (action.damage) details.push(String(action.damage));
  return `${named(action)}${details.length ? ` — ${details.join(", ")}` : ""}`;
}

function resourceLabel(resource) {
  const maximum = resource?.uses?.max ?? resource?.max;
  return `${named(resource)}${maximum === undefined ? "" : ` — ${maximum} uses`}`;
}

export function characterBuilderPreviewModel(value, entries = [], preparedReview = null) {
  const review = preparedReview || reviewCharacterBuild(value, entries);
  const { document, sheet } = review;
  const stats = Object.entries(sheet.stats || {});
  const spells = list(sheet.spells);
  const slots = list(sheet.spellcasting?.slots);
  const warnings = [...review.blockers, ...review.pending, ...review.notices];
  return {
    identity: {
      name: String(sheet.name || document.name || "Unnamed character"),
      details: [sheet.class, sheet.subclass, sheet.race, sheet.background].filter(Boolean).join(" · ") || "Choices pending",
      level: number(sheet.level, 0),
      ruleset: document.build.ruleset,
    },
    core: [
      { label: "HP", value: number(sheet.hp?.max) },
      { label: "AC", value: number(sheet.ac) },
      { label: "Initiative", value: signed(sheet.initiative) },
      { label: "Proficiency", value: signed(sheet.proficiency) },
    ],
    abilities: stats.map(([id, stat]) => ({ label: ABILITY_LABELS[id] || id.toUpperCase(), score: number(stat.score), modifier: signed(stat.modifier) })),
    saves: stats.map(([id, stat]) => `${ABILITY_LABELS[id] || id.toUpperCase()} ${signed(stat.save)}`),
    skills: stats.flatMap(([, stat]) => list(stat.skills).map((skill) => `${named(skill)} ${signed(skill.modifier)}`)),
    attacks: list(sheet.actions).map(actionLabel),
    spells: [
      ...spells.map((spell) => `${named(spell)}${spell.level === 0 ? " — Cantrip" : spell.level ? ` — Level ${spell.level}` : ""}`),
      ...slots.map((slot) => `${slot.pool === "pact" ? "Pact" : "Spell"} slot ${slot.level}: ${slot.max}`),
    ],
    resources: list(sheet.resources).map(resourceLabel),
    proficiencies: [...new Set([...list(sheet.proficiencies).map(named), ...list(sheet.languages).map((language) => `Language: ${named(language)}`)])],
    inventory: list(sheet.inventory).map((item) => `${named(item)}${Number(item.quantity) > 1 ? ` ×${item.quantity}` : ""}`),
    warnings: warnings.map((warning) => ({ code: warning.code || "warning", message: warning.message || "Unresolved builder warning.", impact: warning.impact || "" })),
  };
}
