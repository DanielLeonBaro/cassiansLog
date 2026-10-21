import assert from "node:assert/strict";
import { combatTiming, combatDeskStorageKey, combatRecordKey, createCombatDeskState, partitionCombatRecords } from "../js/tracker/v6-model.js";
import { consumeV4ActionUse, planV4ActionUse } from "../js/tracker/v4-actions.js";
import { normalizeUiPreferences, validUiPreferences } from "../../shared/gc/preferences-model.js";
import { CHARACTER_SHEET_STYLES } from "../../cloudflare/settings.js";

const storage = () => { const entries = new Map(); return { getItem: (key) => entries.get(key), setItem: (key, value) => entries.set(key, value) }; };
const local = storage(), session = storage();
const identity = { userId: "alice", campaign: "aotr", kind: "character", entityId: "hero" };
const desk = createCombatDeskState({ ...identity, local, session });
for (const [action, expected] of [["Action", "action"], ["1 action", "action"], [" Bonus   Action ", "bonus"], ["1 Reaction", "reaction"], ["Free Action", "other"], ["Legendary Action", "other"], ["2 actions", "other"], ["1 minute", "other"], [undefined, "other"]]) assert.equal(combatTiming({ action }), expected);
assert.equal(desk.guidance, true);
assert.deepEqual(desk.turn, { action: false, bonus: false, reaction: false });

const character = { actions: [{ id: "strike", name: "Strike", action: "Action" }, { id: "surge", name: "Surge", action: "Bonus Action", uses: { current: 1, max: 1, reset: "short" } }], resources: [] };
planV4ActionUse(character, "surge"); // Opening and cancelling confirmation does not mark or spend.
assert.equal(character.actions[1].uses.current, 1);
assert.equal(desk.turn.bonus, false);
let result = consumeV4ActionUse(character, "surge");
assert.equal(desk.recordUse(character.actions[1], result.applied), true);
assert.equal(desk.turn.bonus, true);
assert.equal(character.actions[1].uses.current, 0);
desk.toggleTurn("bonus");
result = consumeV4ActionUse(character, "surge");
assert.equal(desk.recordUse(character.actions[1], result.applied), false);
assert.equal(desk.turn.bonus, false, "A failed or second confirmation must not mark a turn.");
for (let i = 0; i < 2; i++) assert.equal(desk.recordUse(character.actions[0], consumeV4ActionUse(character, "strike").applied), true);
assert.equal(desk.turn.action, true, "Repeated attacks remain legal to record.");
desk.recordUse({ action: "Free Action" }, true);
desk.recordUse({ action: "Reaction" }, false);
assert.equal(desk.turn.reaction, false);
assert.equal(createCombatDeskState({ ...identity, local, session }).turn.action, true, "Refresh restores turn in same session.");
desk.startTurn();
assert.deepEqual(desk.turn, { action: false, bonus: false, reaction: false });
assert.equal(character.actions[1].uses.current, 0, "Start turn never restores resources.");

const first = { source: "actions", item: character.actions[0] }, second = { source: "spells", item: { id: "strike", action: "Reaction" } };
desk.togglePin(combatRecordKey(first)); desk.toggleGuidance();
const restored = createCombatDeskState({ ...identity, local, session });
assert.equal(restored.guidance, false);
assert.equal(restored.pins.has(combatRecordKey(first)), true);
assert.deepEqual(partitionCombatRecords([first, second, first], desk.pins), { pinned: [first], remaining: [second] });
assert.deepEqual(partitionCombatRecords([first, second], desk.pins, "reaction"), { pinned: [], remaining: [second] });
assert.deepEqual(partitionCombatRecords([], desk.pins), { pinned: [], remaining: [] }, "Stale pins never create records.");
for (const change of [{ userId: "bob" }, { campaign: "other" }, { kind: "npc" }, { entityId: "other" }]) {
  const other = createCombatDeskState({ ...identity, ...change, local, session });
  assert.equal(other.pins.size, 0); assert.equal(other.guidance, true);
  assert.notEqual(combatDeskStorageKey(identity), combatDeskStorageKey({ ...identity, ...change }));
}
const reader = createCombatDeskState({ ...identity, local, session, canEdit: false });
assert.equal(reader.toggleTurn("action"), false); assert.equal(reader.startTurn(), false);
assert.equal(reader.recordUse({ action: "Reaction" }, true), false);
reader.togglePin("inventory:wand"); assert.equal(reader.pins.has("inventory:wand"), true);
const denied = { getItem() { throw Error("denied"); }, setItem() { throw Error("denied"); } };
const memory = createCombatDeskState({ local: denied, session: denied });
memory.togglePin("actions:a"); memory.toggleTurn("reaction");
assert.equal(memory.pins.has("actions:a"), true); assert.equal(memory.turn.reaction, true);
const corrupt = createCombatDeskState({ local: { getItem: () => '{bad' }, session: { getItem: () => '{"action":"true"}' } });
assert.equal(corrupt.turn.action, false); assert.equal(corrupt.pins.size, 0);

const preferences = normalizeUiPreferences({ trackerStyles: { character: "v6", npc: "v6" } });
assert.equal(validUiPreferences(preferences), true); assert.equal(CHARACTER_SHEET_STYLES.has("v6"), true);
assert.equal(normalizeUiPreferences().trackerStyles.character, "v5", "V6 is opt-in.");
console.log("V6 Combat Desk confirmed uses, advisory turns, pins, storage isolation, read-only access, and style compatibility passed.");
