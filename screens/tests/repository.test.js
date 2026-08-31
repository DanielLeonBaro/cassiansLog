// Verifies screen repository.
import assert from "node:assert/strict";
import {
  addCalculatorHistory,
  calculatorHistoryStorageKey,
  clearCalculatorHistory,
  loadCalculatorHistory,
  loadScreen,
  saveScreen,
  screenStorageKey,
} from "../js/repository.js";

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}

const storage = memoryStorage();
const document = { version: 1, widgets: [{ id: "note-1", type: "note", title: "Mine", body: "Private" }] };
await saveScreen({ userId: "user-a", kind: "player", document, local: true, storage });
assert.equal((await loadScreen({ userId: "user-a", kind: "player", local: true, storage })).widgets[0].title, "Mine");
assert.equal((await loadScreen({ userId: "user-b", kind: "player", local: true, storage })).widgets.length, 0);
assert.notEqual(screenStorageKey("user-a", "player"), screenStorageKey("user-a", "dm"));

const originalFetch = globalThis.fetch;
let requests = [];
globalThis.fetch = async (url, options = {}) => {
  requests.push({ url, method: options.method || "GET" });
  throw new Error("offline");
};
await assert.rejects(saveScreen({ userId: "cloud-user", kind: "player", document, storage }), /offline/);
assert.equal(JSON.parse(storage.getItem(screenStorageKey("cloud-user", "player"))).pending, true);

globalThis.fetch = async (url, options = {}) => {
  requests.push({ url, method: options.method || "GET" });
  return new Response(JSON.stringify(options.method === "PUT"
    ? { ok: true, updatedAt: "2026-08-28T00:00:00.000Z" }
    : { document: { version: 1, widgets: [] }, updatedAt: "2026-08-27T00:00:00.000Z" }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
};
requests = [];
const recovered = await loadScreen({ userId: "cloud-user", kind: "player", storage });
assert.equal(recovered.widgets[0].title, "Mine", "A pending local document must win over older cloud data.");
assert.deepEqual(requests.map((entry) => entry.method), ["PUT"], "Pending data must retry before any cloud GET.");
assert.equal(JSON.parse(storage.getItem(screenStorageKey("cloud-user", "player"))).pending, false);
globalThis.fetch = originalFetch;

for (let index = 0; index < 51; index += 1) {
  await addCalculatorHistory({ userId: "user-a", kind: "player", widgetId: "calc", expression: `${index}+1`, result: String(index + 1), local: true, storage });
}
const firstPage = await loadCalculatorHistory({ userId: "user-a", kind: "player", widgetId: "calc", local: true, storage });
assert.equal(firstPage.items.length, 50);
assert.ok(firstPage.nextCursor);
assert.equal((await loadCalculatorHistory({ userId: "user-a", kind: "player", widgetId: "calc", before: firstPage.nextCursor, local: true, storage })).items.length, 1);
assert.equal((await loadCalculatorHistory({ userId: "user-b", kind: "player", widgetId: "calc", local: true, storage })).items.length, 0);
await clearCalculatorHistory({ userId: "user-a", kind: "player", widgetId: "calc", local: true, storage });
assert.equal(storage.getItem(calculatorHistoryStorageKey("user-a", "player", "calc")), null);

await assert.rejects(
  saveScreen({
    userId: "user-a",
    kind: "player",
    local: true,
    storage,
    document: { version: 1, widgets: [
      { id: "large-a", type: "note", title: "A", body: "a".repeat(850_000) },
      { id: "large-b", type: "note", title: "B", body: "b".repeat(850_000) },
    ] },
  }),
  /too large/i,
);

console.log("Screen repository tests passed.");
