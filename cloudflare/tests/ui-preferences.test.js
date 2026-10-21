import assert from "node:assert/strict";
import { uiPreferencesRoute } from "../ui-preferences.js";
import { normalizeUiPreferences } from "../../shared/gc/preferences-model.js";

const saved = new Map();
let identity = "first-user";
let unavailable = false;
const env = { DB: { prepare(sql) {
  let values;
  return { bind(...args) { values = args; return this; },
    async first() {
      if (sql.includes("user_sessions")) return { id: identity, email: `${identity}@example.test`, roles_json: "[]" };
      if (unavailable) throw new Error("no such table");
      return saved.get(values[0]) || null;
    },
    async run() {
      if (unavailable) throw new Error("no such table");
      saved.set(values[0], { preferences_json: values[1], updated_at: values[2] });
    },
  };
} } };
function request(method, body, authenticated = true) {
  return new Request("https://example.test/api/auth/ui-preferences", {
    method, headers: { ...(authenticated ? { cookie: "cassianslog_session=test-session" } : {}), "content-type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
assert.equal((await uiPreferencesRoute(request("GET", null, false), env)).status, 401);
let response = await uiPreferencesRoute(request("GET"), env);
assert.equal((await response.json()).preferences.trackerStyles.character, "v5");
const preferences = normalizeUiPreferences({ density: "compact", pageDensity: { wiki: "comfortable" }, trackerStyles: { character: "v6", npc: "v6" } });
response = await uiPreferencesRoute(request("PUT", preferences), env);
assert.equal(response.status, 200);
assert.equal(saved.size, 1);
response = await uiPreferencesRoute(request("GET"), env);
assert.deepEqual((await response.json()).preferences, preferences);
assert.equal((await uiPreferencesRoute(request("PUT", { ...preferences, userId: "another-user" }), env)).status, 400);
assert.equal((await uiPreferencesRoute(request("DELETE"), env)).status, 405);
identity = "second-user";
response = await uiPreferencesRoute(request("GET"), env);
assert.equal((await response.json()).preferences.density, "comfortable", "Account preferences must not leak.");
await uiPreferencesRoute(request("PUT", normalizeUiPreferences()), env);
assert.equal(saved.size, 2);
unavailable = true;
assert.equal((await uiPreferencesRoute(request("GET"), env)).status, 503);
assert.equal((await uiPreferencesRoute(request("PUT", preferences), env)).status, 503);
console.log("Authenticated UI preferences, user ownership, validation, and missing-migration fallback passed.");
