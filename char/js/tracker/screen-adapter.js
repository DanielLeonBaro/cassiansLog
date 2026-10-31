// Presents the existing tracker engine without owning spending or persistence.
import { planV4ActionUse } from "./v4-actions.js";
import { planV4SpellCast } from "./v4-spells.js";
import { v4InventoryItemModel } from "./v4-inventory.js";
import { v4ExtraGroups, v4FeatureGroups } from "./v4-content.js";
import { combatRecordKey } from "./v6-model.js";

const list = (value) => Array.isArray(value) ? value : value ? [String(value)] : [];

export function createLiveTrackerAdapter({ character: document, kind, personal, trackerState, notes, canEdit, operations, backHref, visibleFields = [] }) {
  const character = {};
  const visible = (path) => kind !== "npc" || canEdit() || visibleFields.includes(path);
  function refresh() {
    Object.keys(character).forEach((key) => delete character[key]);
    Object.assign(character, document, {
      kind, backHref, backLabel: kind === "npc" ? "Back to NPCs" : "Back to characters",
      name: document.name || (kind === "npc" ? "NPC" : "Character"),
      hp: Object.fromEntries(["current", "max", "temp"].map(key => [key, visible(`hp.${key}`) ? document.hp?.[key] : null])),
      notes: canEdit() ? notes.getNotes() : [],
      conditions: document.conditions || [], trackers: document.trackers || [],
      deathSaves: document.deathSaves || {},
      stats: Object.fromEntries(Object.entries(document.stats || {}).map(([key, stat]) => [key, { ...stat, skills: stat.skills || [] }])),
      defenses: Object.fromEntries(["resistances", "immunities", "vulnerabilities"].map((key) => [key, list(document.defenses?.[key] || document[key])])),
      spellcasting: document.spellcasting || { profiles: [], slots: [] },
      features: v4FeatureGroups(document).flatMap((group) => group.features),
      extras: v4ExtraGroups(document).flatMap((group) => group.extras),
      inventory: (document.inventory || []).map((item, index) => ({ ...v4InventoryItemModel(item, trackerState.getInventoryItemState(index), document.inventory), index })),
    });
    for (const collection of ["actions", "spells", "resources"]) character[collection] = document[collection] || [];
    for (const field of ["ac", "initiative", "walk"]) if (!visible(field)) character[field] = null;
    for (const field of ["portrait", "fly", "swim", "climb", "burrow", "proficiency", "passivePerception", "darkvision"]) if (!visible(field)) delete character[field];
    return character;
  }
  function all() {
    return ["actions", "spells", "features", "resources", "inventory"].flatMap((source) => character[source].map((item, index) => ({ source, item, index, key: combatRecordKey({ source, item, index }) })));
  }
  const record = (key) => all().find((entry) => entry.key === key);
  function plan(key, selection = {}) {
    const entry = record(key);
    if (!entry) return { canConfirm: false, options: [], message: "This option is no longer available." };
    if (entry.source === "spells") return planV4SpellCast(document, entry.item.id, selection);
    if (entry.source === "inventory") {
      if (!entry.item.runtimeManaged || !entry.item.automatic || !entry.item.charges) return null;
      return { canConfirm: entry.item.charges.current > 0, options: [], message: `${entry.item.charges.current}/${entry.item.charges.max} charges available.` };
    }
    if (!entry.item.action && !entry.item.uses && !entry.item.resourceId && !entry.item.slotLevel) return null;
    return planV4ActionUse(document, entry.item.id, selection.optionId);
  }
  function mutate(operation, ...args) {
    if (!canEdit()) return false;
    const result = operations[operation]?.(...args);
    refresh();
    return result !== false;
  }
  refresh();
  return {
    character, personal, all, record, plan, refresh,
    get canEdit() { return canEdit(); },
    canPrepare(spell) { return operations.canPrepare(spell.id); },
    availableInCombat(spell) { return operations.availableInCombat(spell); },
    confirm(key, selection = {}) {
      if (!canEdit()) return { applied: false, message: "Read-only view." };
      refresh();
      const entry = record(key);
      if (!entry || !plan(key, selection)?.canConfirm) return { applied: false, message: "No resource was spent. Check availability." };
      const result = entry.source === "inventory" ? operations.charge(entry.index)
        : entry.source === "spells" ? operations.cast(entry.item.id, selection)
          : operations.use(entry.item.id, selection.optionId);
      if (result.applied && selection.mode !== "ritual") personal.recordUse(entry.item, true);
      refresh();
      return { ...result, message: result.applied ? `${entry.item.name} recorded.` : result.warning?.message || result.warning || "No resource was spent. Check availability." };
    },
    hp(kind, amount) { return Number.isFinite(amount) && amount >= 0 && mutate("hp", kind, amount); },
    adjust(kind, id, delta) { return Number.isFinite(delta) && mutate("adjust", kind, id, delta); },
    rest(kind) { return ["short", "long"].includes(kind) && mutate("rest", kind); },
    restDetails: (kind) => operations.restDetails(kind),
    setPrepared(id, prepared) { const spell = document.spells?.find((item) => item.id === id); if (spell && Boolean(spell.prepared) !== prepared) mutate("prepare", id); },
    toggleTracker: (id, active) => mutate("tracker", id, active),
    toggleFlag: (flag) => mutate("flag", flag),
    addCondition: (name) => mutate("condition", name),
    removeCondition: (index) => mutate("removeCondition", index),
    endConcentration: () => mutate("endConcentration"),
    changeExhaustion: (delta) => mutate("exhaustion", delta),
    toggleDeathSave: (kind, index) => mutate("deathSave", kind, index),
    toggleStable: () => mutate("stable"),
    addNote: (title, body, index) => mutate("note", title, body, index),
    removeNote: (index) => mutate("removeNote", index),
    inventoryChange: (index, changes) => mutate("inventory", index, changes),
    extraHP: (id, delta) => mutate("extraHP", id, delta),
    openEditor: (trigger) => mutate("editor", trigger),
    openConversion: (trigger) => mutate("conversion", trigger),
    roll: (formula, label) => operations.roll(formula, label),
    account: () => operations.account(),
  };
}
