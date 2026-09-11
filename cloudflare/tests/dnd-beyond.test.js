// Verifies the bounded, fixed-host D&D Beyond proxy route.
import assert from "node:assert/strict";
import { dndBeyondCharacterRoute, dndBeyondCharacterURL } from "../routes/dnd-beyond.js";

assert.equal(
  dndBeyondCharacterURL("123456789"),
  "https://character-service.dndbeyond.com/character/v5/character/123456789?includeCustomItems=true",
);
assert.equal(dndBeyondCharacterURL("../../secret"), null);

const originalFetch = globalThis.fetch;
let fetchedURL = "";
globalThis.fetch = async (url) => {
  fetchedURL = String(url);
  return new Response('{"success":true,"data":{"name":"Mira"}}', { headers: { "content-type": "application/json" } });
};

try {
  let response = await dndBeyondCharacterRoute(new Request("https://example.test/api/dnd-beyond/characters/123456789"), "123456789");
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(fetchedURL, dndBeyondCharacterURL("123456789"));
  assert.equal((await response.json()).data.name, "Mira");

  response = await dndBeyondCharacterRoute(new Request("https://example.test/api/dnd-beyond/characters/bad"), "bad");
  assert.equal(response.status, 400);

  response = await dndBeyondCharacterRoute(new Request("https://example.test/api/dnd-beyond/characters/1", { method: "POST" }), "1");
  assert.equal(response.status, 405);
} finally {
  globalThis.fetch = originalFetch;
}

console.log("D&D Beyond Worker proxy tests passed.");
