// Verifies campaign-scoped NPC drafts, manager-only finalization, collision safety, and hidden defaults.
import assert from "node:assert/strict";
import { createCharacterBuildDraft } from "../../char/js/builder/model.js";
import { prepareCharacterBuildFinalization } from "../../char/js/builder/review-model.js";
import { applyCharacterRest } from "../../char/js/rules/runtime.js";
import {
  deleteNpcBuildDraft,
  finalizeNpcBuildDraft,
  saveNpcBuildDraft,
  storedNpcBuildDrafts,
} from "../js/builder-draft-repository.js";
import { createBuiltNpc, storedNpcRecords } from "../js/repository.js";

class MemoryStorage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}

globalThis.localStorage = new MemoryStorage();
globalThis.location = { pathname: "/c/alpha/npc/", hostname: "example.test", protocol: "https:" };

function completeDraft(draftId = "draft-npc") {
  const draft = createCharacterBuildDraft({ draftId, now: "2026-09-16T00:00:00.000Z" });
  draft.document.id = "rules-npc";
  draft.document.name = "Rules NPC";
  draft.document.build.status = "complete";
  draft.currentStep = "review";
  return draft;
}

const engineDraft = createCharacterBuildDraft({ draftId: "engine-draft" });
engineDraft.document.id = "engine-npc";
engineDraft.document.name = "Engine NPC";
engineDraft.document.build.levels = [{ classId: "npcClass", subclassId: "", level: 1, hitPointRolls: [] }];
engineDraft.document.build.speciesId = "npcSpecies";
engineDraft.document.build.backgroundId = "npcBackground";
engineDraft.document.build.abilityScores.method = "manual";
engineDraft.document.build.abilityScores.base = { str: 16, dex: 14, con: 14, int: 10, wis: 12, cha: 8 };
const catalog = [
  { id: "npcClass", name: "Fighter", type: "Class", ruleset: "5e", automation: { status: "rules-ready" }, setters: { hd: "d10" }, rules: { grants: [], stats: [], selections: [], features: [], resources: [{ id: "second-wind", name: "Second Wind", max: 1, reset: "short" }] } },
  { id: "npcSpecies", name: "Human", type: "Race", ruleset: "5e", automation: { status: "rules-ready" }, rules: { grants: [], stats: [], selections: [] } },
  { id: "npcBackground", name: "Soldier", type: "Background", ruleset: "5e", automation: { status: "rules-ready" }, rules: { grants: [], stats: [], selections: [] } },
];
const prepared = prepareCharacterBuildFinalization(engineDraft.document, catalog);
assert.equal(prepared.finalized, true, "rules-built NPCs use the shared Character finalization engine");
assert.equal(prepared.document.hp.max, 12);
assert.equal(prepared.document.class, "Fighter");
assert.equal(prepared.document.build.status, "complete");
const secondWind = prepared.document.resources.find(({ name }) => name === "Second Wind");
const rested = applyCharacterRest({ runtime: { hp: { current: 1 }, uses: [{ id: secondWind.id, current: 0 }] }, sheet: prepared.document, ruleset: "5e", kind: "short" });
assert.equal(rested.runtime.uses.find(({ id }) => id === secondWind.id).current, 1, "rules-built NPC runtime uses shared rest behavior");

const saved = await saveNpcBuildDraft(completeDraft(), { now: () => "2026-09-16T01:00:00.000Z" });
assert.equal(saved.draft.sync.state, "saved");
assert.equal(storedNpcBuildDrafts()["draft-npc"].document.build.mode, "rules");
assert.ok(localStorage.getItem("dnd-npc-build-drafts-v1:campaign:alpha"));

globalThis.location.pathname = "/c/bravo/npc/";
assert.deepEqual(storedNpcBuildDrafts(), {}, "NPC drafts must not cross campaign storage scopes");
globalThis.location.pathname = "/c/alpha/npc/";

await assert.rejects(
  () => createBuiltNpc(saved.draft.document, { canManage: async () => false, localOnly: true }),
  /Campaign DM access required/,
);

const finalized = await finalizeNpcBuildDraft("draft-npc", {
  createNpc: (document) => createBuiltNpc(document, { canManage: async () => true, localOnly: true }),
});
assert.equal(finalized.id, "rules-npc");
assert.equal(finalized.document.build.mode, "rules");
assert.equal(finalized.document.build.status, "complete");
assert.equal(finalized.record.playerVisible, false);
assert.deepEqual(finalized.record.visibility, { $default: true });
assert.equal(storedNpcBuildDrafts()["draft-npc"], undefined);
assert.equal(storedNpcRecords()["rules-npc"].document.name, "Rules NPC");

await assert.rejects(
  () => createBuiltNpc(finalized.document, { canManage: async () => true, localOnly: true }),
  /already exists in this campaign/,
);

const recovery = completeDraft("recovery-draft");
recovery.document.id = "offline-npc";
await saveNpcBuildDraft(recovery);
const offline = await finalizeNpcBuildDraft("recovery-draft", {
  createNpc: (document) => createBuiltNpc(document, {
    canManage: async () => true,
    localOnly: false,
    cloudWrite: async () => { throw new Error("offline"); },
  }),
});
assert.equal(offline.cloudSaved, false);
assert.equal(storedNpcRecords()["offline-npc"].document.build.mode, "rules");

const collision = completeDraft("collision-draft");
collision.document.id = "cloud-collision";
await saveNpcBuildDraft(collision);
await assert.rejects(
  () => finalizeNpcBuildDraft("collision-draft", {
    createNpc: (document) => createBuiltNpc(document, {
      canManage: async () => true,
      localOnly: false,
      cloudWrite: async () => { const error = new Error("collision"); error.status = 409; throw error; },
    }),
  }),
  /collision/,
);
assert.equal(storedNpcRecords()["cloud-collision"], undefined, "cloud collisions must remove the tentative local NPC");
assert.ok(storedNpcBuildDrafts()["collision-draft"], "failed finalization keeps its draft");
assert.equal(deleteNpcBuildDraft("collision-draft"), true);

console.log("Rules-built NPC draft, role, persistence, collision, and privacy tests passed.");
