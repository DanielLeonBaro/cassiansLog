// Personal Combat Desk preferences and advisory turns never mutate character runtime.
export function combatTiming(item = {}) {
  const value = String(item.action || "").trim().toLowerCase().replace(/^1\s+/, "").replace(/\s+/g, " ");
  return ({ action: "action", "bonus action": "bonus", reaction: "reaction" })[value] || "other";
}

export function combatRecordKey({ source, item, index }) {
  return `${source}:${item.instanceId || item.id || `${index}:${item.name}`}`;
}

export function combatDeskStorageKey({ userId, campaign, kind, entityId }) {
  return `cassianslog-combat-desk-v1:${[userId || "anonymous", campaign || "unscoped", kind || "character", entityId || "template"].map(encodeURIComponent).join(":")}`;
}

export function createCombatDeskState({ local, session, canEdit = true, ...identity } = {}) {
  const key = combatDeskStorageKey(identity);
  function read(storage) {
    try { return JSON.parse(storage?.getItem(key) || "null") || {}; } catch { return {}; }
  }
  function write(storage, value) {
    try { storage?.setItem(key, JSON.stringify(value)); } catch { /* In-memory state still works. */ }
  }
  const preferences = read(local);
  const savedTurn = read(session);
  const pins = new Set(Array.isArray(preferences.pins) ? preferences.pins.filter((id) => typeof id === "string") : []);
  let guidance = preferences.guidance !== false;
  const turn = Object.fromEntries(["action", "bonus", "reaction"].map((id) => [id, savedTurn[id] === true]));
  const savePreferences = () => write(local, { pins: [...pins], guidance });
  const saveTurn = () => write(session, turn);
  return {
    pins, turn,
    get guidance() { return guidance; },
    togglePin(id) { pins.has(id) ? pins.delete(id) : pins.add(id); savePreferences(); },
    toggleGuidance() { guidance = !guidance; savePreferences(); },
    toggleTurn(id) {
      if (!canEdit || !Object.hasOwn(turn, id)) return false;
      turn[id] = !turn[id]; saveTurn(); return true;
    },
    startTurn() {
      if (!canEdit) return false;
      Object.keys(turn).forEach((id) => { turn[id] = false; }); saveTurn(); return true;
    },
    recordUse(item, applied) {
      const id = combatTiming(item);
      if (!canEdit || !applied || id === "other") return false;
      turn[id] = true; saveTurn(); return true;
    },
  };
}

export function partitionCombatRecords(records, pins, timing = "") {
  const unique = [...new Map(records.filter((record) => !timing || combatTiming(record.item) === timing)
    .map((record) => [combatRecordKey(record), record])).values()];
  return { pinned: unique.filter((record) => pins.has(combatRecordKey(record))), remaining: unique.filter((record) => !pins.has(combatRecordKey(record))) };
}
