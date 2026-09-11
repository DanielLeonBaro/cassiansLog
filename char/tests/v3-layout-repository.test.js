// Verifies scoped localhost persistence and pending-cloud retry for personal V3 layouts.
import assert from "node:assert/strict";
import {
  loadV3Layout,
  saveV3Layout,
  v3LayoutStorageKey,
} from "../js/tracker/v3-layout-repository.js";
import { DEFAULT_V3_LAYOUT, normalizeV3Layout } from "../../shared/js/v3-layout.js";

const values = new Map();
const storage = {
  getItem: (key) => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, value),
};

globalThis.localStorage = storage;
globalThis.location = { hostname: "localhost", pathname: "/c/aotr/char/hero/" };
const localLayout = normalizeV3Layout({ ...DEFAULT_V3_LAYOUT, columns: 3 });
await saveV3Layout({ userId: "alice", characterId: "hero", layout: localLayout, storage });
assert.match(v3LayoutStorageKey("alice", "hero", storage), /alice:hero:campaign:aotr$/);
assert.equal((await loadV3Layout({ userId: "alice", characterId: "hero", storage })).columns, 3);
assert.equal((await loadV3Layout({ userId: "bob", characterId: "hero", storage })).columns, 2, "Local layouts are isolated by user.");

globalThis.location = { hostname: "example.test", pathname: "/c/aotr/char/hero/" };
let requests = [];
globalThis.fetch = async (url, options = {}) => {
  requests.push({ url, options });
  if (requests.length === 1) throw new Error("offline");
  return {
    ok: true,
    json: async () => ({ layout: localLayout, updatedAt: "2026-09-09T00:00:00.000Z" }),
  };
};
await assert.rejects(saveV3Layout({ userId: "alice", characterId: "hero", layout: localLayout, storage }), /offline/);
assert.equal(JSON.parse(values.get(v3LayoutStorageKey("alice", "hero", storage))).pending, true);
const retried = await loadV3Layout({ userId: "alice", characterId: "hero", storage });
assert.equal(retried.columns, 3);
assert.equal(requests[1].options.method, "PUT", "A pending layout should retry before reading cloud state.");
assert.equal(requests[1].url, "/api/campaigns/aotr/characters/hero/layout");
assert.equal(JSON.parse(values.get(v3LayoutStorageKey("alice", "hero", storage))).pending, false);

const requestCount = requests.length;
assert.equal((await loadV3Layout({ userId: "viewer", characterId: "hero", canEdit: false, storage })).columns, 2);
assert.equal(requests.length, requestCount, "Read-only viewers should use the default without loading private layout state.");

delete globalThis.fetch;
delete globalThis.location;
delete globalThis.localStorage;
console.log("V3 local persistence and pending cloud retry tests passed.");
