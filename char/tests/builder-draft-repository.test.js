// Verifies local-first draft saves, cloud retry state, recovery, deletion, and finalization.
import assert from "node:assert/strict";
import {
  CharacterBuildDraftError,
  deleteCharacterBuildDraft,
  finalizeCharacterBuildDraft,
  loadCharacterBuildDraft,
  localCharacterBuildDraft,
  normalizeCharacterBuildDraft,
  saveCharacterBuildDraft,
  storedCharacterBuildDrafts,
} from "../js/builder/draft-repository.js";
import { CHARACTER_BUILD_DRAFTS_STORAGE_KEY, CHARACTERS_STORAGE_KEY } from "../js/storage-keys.js";

class MemoryStorage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
  clear() { this.values.clear(); }
}

globalThis.localStorage = new MemoryStorage();
globalThis.location = { pathname: "/char/", hostname: "example.test" };

function document(id, status = "incomplete") {
  return {
    id,
    name: id,
    characterSchemaVersion: 2,
    build: {
      version: 1,
      mode: "rules",
      status,
      ruleset: "5e",
      preferences: {},
      levels: [],
      speciesId: "",
      backgroundId: "",
      abilityScores: { method: "standard", base: {} },
      selections: {},
      spells: { knownIds: [], spellbookIds: [] },
      inventory: [],
      description: {},
      overrides: {},
    },
  };
}

const normalized = normalizeCharacterBuildDraft({ draftId: "draft-one", document: document("hero"), currentStep: "class", future: { kept: true } }, {
  now: "2026-09-14T01:00:00.000Z",
});
assert.equal(normalized.currentStep, "class");
assert.equal(normalized.status, "incomplete");
assert.deepEqual(normalized.future, { kept: true });
assert.throws(() => normalizeCharacterBuildDraft({ draftId: "bad_id", document: document("hero") }), /ID is invalid/);

let releaseCloud;
const pendingCloud = new Promise((resolve) => { releaseCloud = resolve; });
const pendingSave = saveCharacterBuildDraft(normalized, {
  now: () => "2026-09-14T01:01:00.000Z",
  cloudWrite: async () => pendingCloud,
});
assert.equal(localCharacterBuildDraft("draft-one").sync.state, "pending", "Local write happens before cloud completion.");
releaseCloud({ draft: { ...normalized, updatedAt: "2026-09-14T01:02:00.000Z" } });
let result = await pendingSave;
assert.equal(result.cloudSaved, true);
assert.equal(result.draft.sync.state, "saved");

result = await saveCharacterBuildDraft({ ...result.draft, currentStep: "background" }, {
  now: () => "2026-09-14T01:03:00.000Z",
  cloudWrite: async () => { throw new Error("offline"); },
});
assert.equal(result.cloudSaved, false);
assert.equal(localCharacterBuildDraft("draft-one").currentStep, "background");
assert.equal(localCharacterBuildDraft("draft-one").sync.state, "failed");
assert.equal(localCharacterBuildDraft("draft-one").sync.error, "offline");

result = await saveCharacterBuildDraft(result.draft, {
  now: () => "2026-09-14T01:04:00.000Z",
  cloudWrite: async (path, body) => ({ draft: { draftId: "draft-one", document: body.document, currentStep: body.currentStep,
    status: body.document.build.status, version: 1, createdAt: normalized.createdAt, updatedAt: "2026-09-14T01:04:00.000Z" } }),
});
assert.equal(result.draft.sync.state, "saved", "Retry clears failed state.");

let cloudReads = 0;
assert.equal((await loadCharacterBuildDraft("draft-one", { cloudRead: async () => { cloudReads += 1; } })).source, "local");
assert.equal(cloudReads, 0);

result = await deleteCharacterBuildDraft("draft-one", {
  localOnly: false,
  now: () => "2026-09-14T01:05:00.000Z",
  cloudWrite: async () => { throw new Error("delete offline"); },
});
assert.equal(result.deleted, false);
assert.equal(localCharacterBuildDraft("draft-one").pendingDelete, true);
assert.equal(localCharacterBuildDraft("draft-one").sync.state, "failed", "Failed delete preserves recovery draft.");
result = await deleteCharacterBuildDraft("draft-one", { localOnly: false, cloudWrite: async () => ({ deleted: true }) });
assert.equal(result.deleted, true);
assert.equal(localCharacterBuildDraft("draft-one"), null);

const cloudDraft = { draftId: "cloud-one", document: document("cloud-hero"), currentStep: "abilities", status: "incomplete", version: 1,
  createdAt: "2026-09-14T02:00:00.000Z", updatedAt: "2026-09-14T02:01:00.000Z" };
result = await loadCharacterBuildDraft("cloud-one", { cloudRead: async () => ({ draft: cloudDraft }) });
assert.equal(result.source, "cloud");
assert.equal(localCharacterBuildDraft("cloud-one").sync.state, "saved");
await deleteCharacterBuildDraft("cloud-one", { localOnly: true });

await saveCharacterBuildDraft({ draftId: "finish-one", document: document("finished-hero", "complete"), currentStep: "review" }, {
  cloudWrite: async (path, body) => ({ draft: { draftId: "finish-one", document: body.document, currentStep: "review",
    status: "complete", version: 1, createdAt: "2026-09-14T03:00:00.000Z", updatedAt: "2026-09-14T03:00:00.000Z" } }),
});
await assert.rejects(
  finalizeCharacterBuildDraft("finish-one", { localOnly: false, cloudWrite: async () => { throw Object.assign(new Error("finalize offline"), { status: 503 }); } }),
  (error) => error instanceof CharacterBuildDraftError && error.status === 503,
);
assert.equal(localCharacterBuildDraft("finish-one").sync.operation, "finalize");
assert.equal(localCharacterBuildDraft("finish-one").document.id, "finished-hero");

result = await finalizeCharacterBuildDraft("finish-one", {
  localOnly: false,
  cloudWrite: async (path, body, options) => {
    assert.equal(path, "api/character-build-drafts/finish-one/finalize");
    assert.equal(body, undefined);
    assert.deepEqual(options, { method: "POST" });
    return { ok: true, id: "finished-hero", document: document("finished-hero", "complete") };
  },
});
assert.equal(result.cloudSaved, true);
assert.equal(localCharacterBuildDraft("finish-one"), null);
assert.equal(JSON.parse(localStorage.getItem(CHARACTERS_STORAGE_KEY))["finished-hero"].name, "finished-hero");

await saveCharacterBuildDraft({ draftId: "local-finish", document: document("local-hero", "complete"), currentStep: "review" }, {
  cloudWrite: async (path, body) => ({ draft: { draftId: "local-finish", document: body.document, currentStep: "review",
    status: "complete", version: 1, createdAt: "2026-09-14T04:00:00.000Z", updatedAt: "2026-09-14T04:00:00.000Z" } }),
});
result = await finalizeCharacterBuildDraft("local-finish", { localOnly: true, characterList: async () => [] });
assert.equal(result.local, true);
assert.equal(localCharacterBuildDraft("local-finish"), null);
assert.equal(JSON.parse(localStorage.getItem(CHARACTERS_STORAGE_KEY))["local-hero"].id, "local-hero");

await saveCharacterBuildDraft({ draftId: "collision", document: document("finished-hero", "complete"), currentStep: "review" }, {
  cloudWrite: async (path, body) => ({ draft: { draftId: "collision", document: body.document, currentStep: "review",
    status: "complete", version: 1, createdAt: "2026-09-14T05:00:00.000Z", updatedAt: "2026-09-14T05:00:00.000Z" } }),
});
await assert.rejects(finalizeCharacterBuildDraft("collision", { localOnly: false }), (error) => error.status === 409);
assert.ok(localCharacterBuildDraft("collision"), "Local collision preserves draft.");

globalThis.location.pathname = "/c/aotr/char/";
await saveCharacterBuildDraft({ draftId: "scoped", document: document("scoped-hero"), currentStep: "home" }, {
  cloudWrite: async (path, body) => ({ draft: { draftId: "scoped", document: body.document, currentStep: "home",
    status: "incomplete", version: 1, createdAt: "2026-09-14T06:00:00.000Z", updatedAt: "2026-09-14T06:00:00.000Z" } }),
});
assert.ok(localStorage.getItem(`${CHARACTER_BUILD_DRAFTS_STORAGE_KEY}:campaign:aotr`), "Campaign drafts use isolated browser key.");
assert.ok(storedCharacterBuildDrafts().scoped);
assert.ok(storedCharacterBuildDrafts().collision, "AOTR compatibility copies existing unscoped recovery drafts once.");

console.log("Character Builder local-first draft persistence tests passed.");
