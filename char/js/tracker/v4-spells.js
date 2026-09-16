// Owns V4 spell filtering and rules-aware casting plans.
import { castRuntimeSpell } from "../rules/runtime.js";

function text(value) {
  return String(value ?? "").trim();
}

function profileFor(character, spell) {
  return (character.spellcasting?.profiles || []).find((profile) => profile.id === spell.source);
}

function repertoireValues(spell) {
  const values = new Set(Array.isArray(spell.repertoire) ? spell.repertoire : []);
  if (spell.known) values.add("known");
  if (spell.spellbook) values.add("spellbook");
  if (spell.granted) values.add("granted");
  return values;
}

export function spellRepertoireLabels(spell = {}) {
  const values = repertoireValues(spell);
  const labels = [];
  if (values.has("known")) labels.push("Known");
  if (values.has("spellbook")) labels.push("Spellbook");
  if (values.has("granted")) labels.push("Granted");
  if (!labels.length) labels.push("Manual entry");
  return labels;
}

export function createV4SpellFilterState() {
  return { search: "", level: "", preparation: "", repertoire: "" };
}

export function spellMatchesV4Filters(spell = {}, filters = createV4SpellFilterState()) {
  if (filters.level !== "" && Number(spell.level) !== Number(filters.level)) return false;
  if (filters.preparation === "prepared" && !spell.prepared && !spell.alwaysPrepared && Number(spell.level) > 0) return false;
  if (filters.preparation === "unprepared" && (spell.prepared || spell.alwaysPrepared || Number(spell.level) === 0)) return false;
  if (filters.repertoire && !repertoireValues(spell).has(filters.repertoire)) return false;
  const terms = text(filters.search).toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return true;
  const haystack = [spell.name, spell.school, spell.category, spell.action, spell.range, spell.description]
    .map((value) => text(value).toLowerCase()).join(" ");
  return terms.every((term) => haystack.includes(term));
}

function legacyCastable(character, spell) {
  if (spell.preparationRequired) {
    if (spell.rulesetCompatible === false) return false;
    if (spell.automation && spell.automation !== "rules-ready") return false;
    return Boolean(spell.prepared || spell.alwaysPrepared);
  }
  if (typeof spell.castable === "boolean") return spell.castable;
  if (spell.rulesetCompatible === false) return false;
  if (Number(spell.level) === 0 || spell.withoutSlot || spell.uses) return true;
  const profile = profileFor(character, spell);
  return !profile?.preparedLimit || spell.prepared || spell.alwaysPrepared;
}

function ritualCastable(spell) {
  return typeof spell.ritualCastable === "boolean" ? spell.ritualCastable : spell.ritual === true;
}

function resourceOption(spell) {
  const current = Math.max(0, Number(spell.uses?.current) || 0);
  const max = Math.max(0, Number(spell.uses?.max) || 0);
  return { id: `resource:${spell.id}`, kind: "resource", targetId: spell.id, label: spell.name, current, max };
}

function slotOptions(character, spell) {
  const allowed = Array.isArray(spell.slotOptions) ? new Set(spell.slotOptions) : null;
  const minimum = Math.max(1, Number(spell.slotLevel) || Number(spell.level) || 1);
  const slots = (character.spellcasting?.slots || []).filter((slot) => {
    if (allowed) return allowed.has(slot.id);
    if (Number(slot.level) < minimum) return false;
    return !spell.source || !slot.profileId || slot.profileId === spell.source;
  });
  return slots.map((slot) => ({
    id: `slot:${slot.id}`,
    kind: "slot",
    targetId: slot.id,
    label: `${slot.pool === "pact" ? "Pact " : ""}Level ${slot.level} slot`,
    level: Number(slot.level),
    current: Math.max(0, Number(slot.current) || 0),
    max: Math.max(0, Number(slot.max) || 0),
  }));
}

export function planV4SpellCast(character = {}, spellId, { mode = "", optionId = "" } = {}) {
  const spell = (character.spells || []).find((candidate) => candidate?.id === spellId);
  if (!spell) return { spell: null, name: "Unknown spell", mode: "standard", options: [], selectedId: "", canConfirm: false, ritualAvailable: false, message: "This spell is no longer available." };
  const standardAvailable = legacyCastable(character, spell);
  const ritualAvailable = ritualCastable(spell);
  const selectedMode = mode === "ritual" && ritualAvailable ? "ritual"
    : mode === "standard" ? "standard"
      : !standardAvailable && ritualAvailable ? "ritual" : "standard";
  let options = [];
  if (selectedMode === "standard" && spell.uses) options = [resourceOption(spell)];
  else if (selectedMode === "standard" && Number(spell.level) > 0 && !spell.withoutSlot) options = slotOptions(character, spell);
  const selected = options.find((option) => option.id === optionId)
    || options.find((option) => option.current > 0)
    || options[0]
    || null;
  const needsResource = selectedMode === "standard" && (Boolean(spell.uses) || (Number(spell.level) > 0 && !spell.withoutSlot));
  const canConfirm = selectedMode === "ritual"
    ? ritualAvailable
    : standardAvailable && (!needsResource || Boolean(selected && selected.current > 0));
  const message = selectedMode === "ritual"
    ? "Ritual cast. No spell slot will be consumed."
    : !standardAvailable
      ? "This spell is not currently available to cast."
      : !needsResource
        ? "No spell slot will be consumed."
        : !selected
          ? "No compatible spell slot or use is available."
          : selected.current > 0
            ? `${selected.label}: ${selected.current}/${selected.max} available.`
            : `${selected.label} has no uses remaining.`;
  return {
    spell,
    name: text(spell.name) || "Unnamed spell",
    mode: selectedMode,
    options,
    selectedId: selected?.id || "",
    canConfirm,
    ritualAvailable,
    message,
  };
}

function runtimeSnapshot(character) {
  const items = [...(character.actions || []), ...(character.spells || []), ...(character.features || []), ...(character.resources || [])];
  return {
    hp: character.hp,
    deathSaves: character.deathSaves,
    hitDice: character.hitDice,
    uses: items.filter((item) => item.uses).map((item) => ({ id: item.id, current: item.uses.current })),
    slots: (character.spellcasting?.slots || []).map((slot) => ({ id: slot.id, current: slot.current })),
    prepared: (character.spells || []).map((spell) => ({ id: spell.id, prepared: Boolean(spell.prepared) })),
    conditions: character.conditions,
    concentration: character.concentration,
    exhaustion: character.exhaustion,
  };
}

function castSheet(character, spell) {
  return {
    ...character,
    spells: (character.spells || []).map((candidate) => candidate.id === spell.id ? {
      ...candidate,
      castable: legacyCastable(character, candidate),
      ritualCastable: ritualCastable(candidate),
      withoutSlot: Boolean(candidate.withoutSlot || Number(candidate.level) === 0),
    } : candidate),
  };
}

export function consumeV4SpellCast(character = {}, spellId, selection = {}) {
  const plan = planV4SpellCast(character, spellId, selection);
  if (!plan.canConfirm) return { applied: false, cast: null, warning: plan.message, plan };
  const consumed = plan.options.find((option) => option.id === plan.selectedId) || null;
  if (plan.mode === "standard" && plan.spell.uses) {
    plan.spell.uses.current = Math.max(0, Number(plan.spell.uses.current) - 1);
    if (plan.spell.concentration) character.concentration = { id: plan.spell.id, name: plan.name };
    return { applied: true, cast: { spellId, slotId: "", castLevel: Number(plan.spell.level) || 0, upcastBy: 0, ritual: false }, consumed, warning: null, plan: planV4SpellCast(character, spellId, selection) };
  }
  const slotId = plan.selectedId.startsWith("slot:") ? plan.selectedId.slice(5) : "";
  const result = castRuntimeSpell({
    runtime: runtimeSnapshot(character),
    sheet: castSheet(character, plan.spell),
    spellId,
    slotId,
    ritual: plan.mode === "ritual",
  });
  if (!result.applied) return { applied: false, cast: null, consumed: null, warning: result.warning?.message || plan.message, plan };
  const slots = new Map(result.runtime.slots.map((slot) => [slot.id, slot.current]));
  (character.spellcasting?.slots || []).forEach((slot) => {
    if (slots.has(slot.id)) slot.current = slots.get(slot.id);
  });
  character.concentration = result.runtime.concentration;
  return { applied: true, cast: result.cast, consumed, warning: null, plan: planV4SpellCast(character, spellId, selection) };
}
