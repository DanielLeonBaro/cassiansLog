// Owns builder-time spell repertoire selection; preparation remains runtime state.
import { normalizeCharacterDocument } from "../model.js";
import { evaluateCharacter } from "../rules/engine.js";
import { filterBuilderCatalogEntries } from "./home-model.js";

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function spellLevel(entry) {
  const level = Number(entry?.add?.value?.level ?? entry?.setters?.level ?? 0);
  return Number.isFinite(level) ? Math.max(0, Math.min(9, Math.trunc(level))) : 0;
}

function spellEntry(entry) {
  return entry?.category === "spells" || text(entry?.type).toLocaleLowerCase() === "spell";
}

function supportTags(entry) {
  return new Set(text(entry?.supports).split(",").map((value) => value.trim().toLocaleLowerCase()).filter(Boolean));
}

function supportsProfile(entry, profile) {
  const supports = supportTags(entry);
  return !supports.size || supports.has(text(profile.spellList).toLocaleLowerCase()) || supports.has(text(profile.name).toLocaleLowerCase());
}

function entryIndex(entries) {
  const index = new Map();
  (Array.isArray(entries) ? entries : []).forEach((entry) => {
    if (text(entry?.id)) index.set(entry.id, entry);
    if (text(entry?.originalId)) index.set(entry.originalId, entry);
  });
  return index;
}

export function builderSpellState(value, entries = []) {
  const document = normalizeCharacterDocument(value);
  const result = evaluateCharacter({ character: document, catalog: entries });
  const profiles = result.sheet.spellcasting?.profiles || [];
  const maximumSpellLevel = Math.max(0, ...(result.sheet.spellcasting?.slots || []).map(({ level }) => Number(level) || 0));
  const selectedReferences = new Set([...document.build.spells.knownIds, ...document.build.spells.spellbookIds]);
  const filtered = filterBuilderCatalogEntries(entries, document).filter(spellEntry);
  const index = entryIndex(entries);
  selectedReferences.forEach((id) => {
    const entry = index.get(id);
    if (entry && spellEntry(entry) && [document.build.ruleset, "agnostic"].includes(entry.ruleset || "agnostic")) filtered.push(entry);
  });
  const unique = new Map(filtered.map((entry) => [entry.id, entry]));
  const profileStates = profiles.map((profile) => {
    const available = [...unique.values()].filter((entry) => supportsProfile(entry, profile));
    const cantrips = available.filter((entry) => spellLevel(entry) === 0)
      .sort((left, right) => text(left.name).localeCompare(text(right.name)) || left.id.localeCompare(right.id));
    const levelled = available.filter((entry) => spellLevel(entry) > 0 && spellLevel(entry) <= maximumSpellLevel)
      .sort((left, right) => spellLevel(left) - spellLevel(right) || text(left.name).localeCompare(text(right.name)) || left.id.localeCompare(right.id));
    const selectedCantripIds = document.build.spells.knownIds.filter((id) => {
      const entry = index.get(id);
      return entry && spellLevel(entry) === 0 && supportsProfile(entry, profile);
    }).map((id) => index.get(id).id);
    const repertoireField = profile.repertoire === "spellbook" ? "spellbookIds" : "knownIds";
    const selectedLevelledIds = document.build.spells[repertoireField].filter((id) => {
      const entry = index.get(id);
      return entry && spellLevel(entry) > 0 && supportsProfile(entry, profile);
    }).map((id) => index.get(id).id);
    const errors = [];
    if (selectedCantripIds.length < profile.cantripLimit) errors.push(`${profile.name} needs ${profile.cantripLimit} cantrips.`);
    if (selectedCantripIds.length > profile.cantripLimit) errors.push(`${profile.name} allows ${profile.cantripLimit} cantrips.`);
    if (profile.repertoire === "spellbook" && selectedLevelledIds.length < profile.spellbookMinimum) {
      errors.push(`${profile.name} spellbook needs at least ${profile.spellbookMinimum} spells.`);
    }
    return { ...profile, maximumSpellLevel, cantrips, levelled, selectedCantripIds, selectedLevelledIds, repertoireField, errors };
  });
  return {
    profiles: profileStates,
    errors: profileStates.flatMap(({ errors }) => errors),
    complete: profileStates.every(({ errors }) => !errors.length),
    warnings: result.warnings.filter((warning) => String(warning.path || "").startsWith("build.spells")),
  };
}

export function applyBuilderSpellSelection(value, entries, profileId, kind, selectedIds) {
  const document = normalizeCharacterDocument(value);
  const state = builderSpellState(document, entries);
  const profile = state.profiles.find(({ id }) => id === profileId);
  if (!profile || !["cantrips", "levelled"].includes(kind)) return document;
  const options = kind === "cantrips" ? profile.cantrips : profile.levelled;
  const allowed = new Set(options.map(({ id }) => id));
  const values = [...new Set((Array.isArray(selectedIds) ? selectedIds : []).map(text).filter(Boolean))];
  if (values.some((id) => !allowed.has(id)) || (kind === "cantrips" && values.length > profile.cantripLimit)) return document;
  const index = entryIndex(entries);
  const field = kind === "cantrips" ? "knownIds" : profile.repertoireField;
  const preserved = document.build.spells[field].filter((id) => {
    if (document.build.spells.assignments[id]?.profileId !== profile.id) return true;
    const level = spellLevel(index.get(id));
    return kind === "cantrips" ? level > 0 : level === 0;
  });
  document.build.spells[field] = [...new Set([...preserved, ...values])];
  Object.entries(document.build.spells.assignments).forEach(([id, assignment]) => {
    if (assignment?.profileId === profile.id && !document.build.spells.knownIds.includes(id) && !document.build.spells.spellbookIds.includes(id)) {
      delete document.build.spells.assignments[id];
    }
  });
  values.forEach((id) => {
    const canonical = index.get(id)?.id || id;
    document.build.spells.assignments[canonical] = {
      profileId: profile.id,
      repertoire: kind === "cantrips" ? "known" : profile.repertoire,
    };
  });
  document.build.status = "incomplete";
  return normalizeCharacterDocument(document);
}
