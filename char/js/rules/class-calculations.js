// Projects level-gated class and subclass features from certified declarative rules.
import { activeRuleEntries } from "./active-rules.js";

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function levelValue(value, level, fallback) {
  if (Number.isFinite(Number(value))) return Number(value);
  if (value?.type === "table") return Number(value.values?.[level] ?? fallback);
  return fallback;
}

export function calculateClassCharacterValues({ graph, catalog }) {
  const features = [];
  const sources = [];
  const characterSources = { size: [], creatureType: [] };
  const warnings = [];
  const character = {};
  const rest = {};
  let attacksPerAction = 1;
  let criticalThreshold = 20;

  activeRuleEntries(graph, catalog).forEach(({ entry, active }) => {
    (Array.isArray(entry.rules?.features) ? entry.rules.features : []).forEach((feature) => {
      if (active.level < (Number(feature.level) || 1)) return;
      const value = {
        id: text(feature.id) || `${entry.id}:feature:${features.length}`,
        name: text(feature.name) || text(feature.id),
        sourceId: entry.id,
        source: text(entry.name) || entry.id,
        type: text(feature.type) || text(entry.type) || "Feature",
        description: text(feature.description),
        level: Number(feature.level) || 1,
      };
      features.push(value);
      sources.push({ kind: "rules", sourceId: entry.id, originalId: text(entry.originalId), label: value.name, value: value.id });
    });
    const characterRule = entry.rules?.character;
    if (characterRule && typeof characterRule === "object") {
      ["size", "creatureType"].forEach((key) => {
        const value = text(characterRule[key]);
        if (!value) return;
        character[key] = value;
        characterSources[key].push({ kind: "rules", sourceId: entry.id, originalId: text(entry.originalId), label: text(entry.name) || entry.id, value });
      });
    }
    const restRule = entry.rules?.rest;
    if (restRule && typeof restRule === "object") {
      ["short", "long"].forEach((kind) => {
        if (restRule[kind] && typeof restRule[kind] === "object") rest[kind] = { ...(rest[kind] || {}), ...restRule[kind] };
      });
    }
    (Array.isArray(entry.rules?.warnings) ? entry.rules.warnings : []).forEach((warning, warningIndex) => {
      if (!warning || typeof warning !== "object") return;
      warnings.push({
        code: text(warning.code) || "manual-automation",
        path: text(warning.path) || `catalog.${entry.id}.rules.warnings.${warningIndex}`,
        entryId: entry.id,
        sourceId: entry.id,
        blocking: warning.blocking === true,
        message: text(warning.message) || `${entry.name || entry.id} requires manual handling.`,
      });
    });
    const combat = entry.rules?.combat;
    if (!combat || typeof combat !== "object") return;
    attacksPerAction = Math.max(attacksPerAction, levelValue(combat.attacksPerAction, active.level, 1));
    criticalThreshold = Math.min(criticalThreshold, levelValue(combat.criticalThreshold, active.level, 20));
  });

  features.sort((left, right) => left.level - right.level || left.name.localeCompare(right.name) || left.id.localeCompare(right.id));
  const combat = { attacksPerAction, criticalThreshold };
  return {
    features,
    combat,
    character,
    rest,
    trace: {
      features: { value: features, sources },
      size: { value: character.size || "", sources: characterSources.size },
      creatureType: { value: character.creatureType || "", sources: characterSources.creatureType },
      "combat.attacksPerAction": { value: attacksPerAction, sources: sources.filter((source) => /extra attack/i.test(source.label)) },
      "combat.criticalThreshold": { value: criticalThreshold, sources: sources.filter((source) => /critical/i.test(source.label)) },
    },
    warnings,
  };
}
