// In-memory preview adapter. Domain helpers are shared; persistence and live APIs are absent.
import { planV4ActionUse, consumeV4ActionUse } from "../../js/tracker/v4-actions.js";
import { planV4SpellCast, consumeV4SpellCast } from "../../js/tracker/v4-spells.js";
import { applyDamage, applyHealing, applyTemporaryHitPoints } from "../../js/tracker/hit-points.js";
import { createCombatDeskState } from "../../js/tracker/v6-model.js";
import { previewDocument } from "./fixtures.js";

export function createPreviewAdapter(fixture, readonly = false) {
  const character = previewDocument(fixture, readonly);
  const personal = createCombatDeskState({ canEdit: !readonly });
  character.pins.forEach((key) => personal.togglePin(key));
  const all = () => ["actions", "spells", "features", "resources", "inventory"].flatMap((source) => (character[source] || []).map((item) => ({ source, item, key: `${source}:${item.id}` })));
  const record = (key) => all().find((entry) => entry.key === key);
  const canEdit = !readonly;
  function plan(key, selection = {}) {
    const entry = record(key);
    if (!entry) return { canConfirm: false, message: "This option is no longer available.", options: [] };
    if (entry.source === "spells") return planV4SpellCast(character, entry.item.id, selection);
    if (entry.source === "inventory") return { name: entry.item.name, options: [], canConfirm: Boolean(entry.item.charges?.current > 0), message: entry.item.charges ? `${entry.item.charges.current}/${entry.item.charges.max} charges available.` : "This item has no automatic use. Manage its effect manually." };
    return planV4ActionUse(character, entry.item.id, selection.optionId);
  }
  return {
    character, personal, canEdit, all, record, plan,
    confirm(key, selection = {}) {
      if (!canEdit) return { applied: false, message: "Read-only view." };
      const entry = record(key);
      if (!entry) return { applied: false, message: "Option not found." };
      let result;
      if (entry.source === "spells") result = consumeV4SpellCast(character, entry.item.id, selection);
      else if (entry.source === "inventory") {
        const available = plan(key).canConfirm;
        if (available) entry.item.charges.current--;
        result = { applied: available };
      } else result = consumeV4ActionUse(character, entry.item.id, selection.optionId);
      if (result.applied && selection.mode !== "ritual") personal.recordUse(entry.item, true);
      return { ...result, message: result.applied ? `${entry.item.name} recorded.` : "No resource was spent. Check availability." };
    },
    hp(kind, amount) {
      if (!canEdit || !Number.isFinite(amount) || amount < 0) return false;
      if (kind === "damage") return applyDamage(character, amount);
      if (kind === "heal") return applyHealing(character, amount);
      if (kind === "temp") { applyTemporaryHitPoints(character, amount); return true; }
      return false;
    },
    adjust(kind, id, delta) {
      if (!canEdit) return false;
      const target = kind === "hit-die" ? character.hitDice[Number(id)] : kind === "slot" ? character.spellcasting.slots.find((item) => item.id === id)
        : all().find((entry) => entry.item.id === id)?.item.uses;
      if (!target) return false;
      target.current = Math.max(0, Math.min(target.max, target.current + delta)); return true;
    },
    rest(kind) {
      if (!canEdit) return false;
      // Fixture-only recovery; live integration will delegate to the existing rest controller.
      all().forEach(({ item }) => {
        for (const pool of [item.uses, item.charges]) if (pool && (pool.reset === "short" || kind === "long" && pool.reset === "long")) pool.current = pool.max;
      });
      character.spellcasting.slots.forEach((slot) => { if (kind === "long" || slot.reset === "short") slot.current = slot.max; });
      if (kind === "long") { character.hp.current = character.hp.max; character.hp.temp = 0; }
      return true;
    },
    setPrepared(id, prepared) {
      if (!canEdit) return;
      const spell = character.spells.find((item) => item.id === id);
      if (spell) { spell.prepared = prepared; spell.castable = prepared; }
    },
    toggleTracker(id, active) { if (canEdit) { const tracker = character.trackers.find((item) => item.id === id); if (tracker) tracker.active = active; } },
    toggleFlag(flag) { if (canEdit && ["inspiration", "cinematic"].includes(flag)) character[flag] = character[flag] ? 0 : 1; },
    addCondition(name) { if (canEdit && String(name).trim()) character.conditions.push(String(name).trim()); },
    removeCondition(index) { if (canEdit) character.conditions.splice(index, 1); },
    endConcentration() { if (canEdit) character.concentration = null; },
    toggleDeathSave(kind, index) { if (canEdit && ["successes", "failures"].includes(kind)) character.deathSaves[kind] = character.deathSaves[kind] === index + 1 ? index : index + 1; },
    addNote(title, body) { if (canEdit && String(title).trim() && String(body).trim()) character.notes.push({ title: String(title).trim(), body: String(body).trim() }); },
    editBasics({ name, ac, walk }) { if (canEdit && name.trim() && Number.isFinite(ac) && Number.isFinite(walk)) Object.assign(character, { name: name.trim(), ac: Math.max(0, ac), walk: Math.max(0, walk) }); },
  };
}
