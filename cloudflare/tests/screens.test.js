// Verifies per-user Screen and Public Initiative APIs.
import assert from "node:assert/strict";
import { publicInitiativeRoute } from "../routes/public-initiative.js";
import { screenRoute } from "../routes/screens.js";

function database(sessionUser, state = {}) {
  state.screens ||= new Map();
  state.histories ||= [];
  state.historyId ||= 0;
  const key = (userId, kind) => `${userId}:${kind}`;
  const connection = {
    prepare(sql) {
      return {
        bind(...values) {
          return {
            async first() {
              if (sql.includes("FROM user_sessions JOIN users")) return sessionUser;
              if (sql.includes("FROM user_screens")) return state.screens.get(key(values[0], values[1])) || null;
              throw new Error(`Unexpected first SQL: ${sql}`);
            },
            async run() {
              if (sql.startsWith("INSERT INTO user_screens")) {
                state.screens.set(key(values[0], values[1]), { document_json: values[2], updated_at: values[3] });
                return { meta: { changes: 1 } };
              }
              if (sql.startsWith("INSERT INTO screen_calculator_history")) {
                state.historyId += 1;
                state.histories.push({
                  id: state.historyId,
                  user_id: values[0],
                  screen_kind: values[1],
                  widget_id: values[2],
                  expression: values[3],
                  result: values[4],
                  created_at: values[5],
                });
                return { meta: { last_row_id: state.historyId } };
              }
              if (sql.startsWith("DELETE FROM screen_calculator_history")) {
                if (sql.includes("widget_id = ?")) {
                  state.histories = state.histories.filter((row) => !(row.user_id === values[0] && row.screen_kind === values[1] && row.widget_id === values[2]));
                } else if (sql.includes("NOT IN")) {
                  const retainedIds = new Set(values.slice(2));
                  state.histories = state.histories.filter((row) => row.user_id !== values[0] || row.screen_kind !== values[1] || retainedIds.has(row.widget_id));
                } else {
                  state.histories = state.histories.filter((row) => row.user_id !== values[0] || row.screen_kind !== values[1]);
                }
                return { meta: { changes: 1 } };
              }
              throw new Error(`Unexpected run SQL: ${sql}`);
            },
            async all() {
              if (!sql.includes("FROM screen_calculator_history")) throw new Error(`Unexpected all SQL: ${sql}`);
              const before = sql.includes("id < ?") ? values[3] : Infinity;
              const limit = values.at(-1);
              const rows = state.histories.filter((row) => row.user_id === values[0] && row.screen_kind === values[1] && row.widget_id === values[2] && row.id < before)
                .sort((left, right) => right.id - left.id).slice(0, limit);
              return { results: rows };
            },
          };
        },
      };
    },
  };
  connection.state = state;
  return connection;
}

function request(path, options = {}) {
  return new Request(`https://example.test${path}`, {
    ...options,
    headers: { cookie: "cassianslog_session=test", "content-type": "application/json", ...options.headers },
  });
}

const playerRow = { id: "player-1", email: "player@example.com", roles_json: '["player-screen","public-initiative"]' };
const sharedState = {};
const playerEnv = { DB: database(playerRow, sharedState) };
const document = { version: 1, widgets: [{ id: "calculator-1", type: "calculator", expression: "" }] };
const saved = await screenRoute(request("/api/screens/player", { method: "PUT", body: JSON.stringify({ document, userId: "victim" }) }), playerEnv, ["player"]);
assert.equal(saved.status, 200);
assert.equal(sharedState.screens.has("player-1:player"), true);
assert.equal(sharedState.screens.has("victim:player"), false, "Client ownership fields must be ignored.");
assert.deepEqual((await (await screenRoute(request("/api/screens/player"), playerEnv, ["player"])).json()).document, document);
assert.equal((await screenRoute(request("/api/screens/dm"), playerEnv, ["dm"])).status, 403);

const otherRow = { id: "player-2", email: "other@example.com", roles_json: '["player-screen"]' };
const otherEnv = { DB: database(otherRow, sharedState) };
assert.equal((await (await screenRoute(request("/api/screens/player"), otherEnv, ["player"])).json()).document, null, "A second user cannot read the first user's screen.");
await screenRoute(request("/api/screens/player", { method: "PUT", body: JSON.stringify({ document }) }), otherEnv, ["player"]);

const historyPath = "/api/screens/player/calculators/calculator-1/history";
const historyAdded = await screenRoute(request(historyPath, { method: "POST", body: JSON.stringify({ expression: "2+2", result: "4" }) }), playerEnv, ["player", "calculators", "calculator-1", "history"]);
assert.equal(historyAdded.status, 201);
const history = await (await screenRoute(request(historyPath), playerEnv, ["player", "calculators", "calculator-1", "history"])).json();
assert.equal(history.items[0].expression, "2+2");
await screenRoute(request(historyPath, { method: "POST", body: JSON.stringify({ expression: "3+3", result: "6" }) }), otherEnv, ["player", "calculators", "calculator-1", "history"]);
assert.deepEqual((await (await screenRoute(request(historyPath), playerEnv, ["player", "calculators", "calculator-1", "history"])).json()).items.map((item) => item.expression), ["2+2"], "Calculator history must remain account-isolated.");
await screenRoute(request(historyPath, { method: "DELETE" }), playerEnv, ["player", "calculators", "calculator-1", "history"]);
assert.equal((await (await screenRoute(request(historyPath), playerEnv, ["player", "calculators", "calculator-1", "history"])).json()).items.length, 0);

for (let index = 0; index < 51; index += 1) {
  await screenRoute(request(historyPath, { method: "POST", body: JSON.stringify({ expression: `${index}+1`, result: String(index + 1) }) }), playerEnv, ["player", "calculators", "calculator-1", "history"]);
}
const firstHistoryPage = await (await screenRoute(request(historyPath), playerEnv, ["player", "calculators", "calculator-1", "history"])).json();
assert.equal(firstHistoryPage.items.length, 50);
assert.ok(firstHistoryPage.nextCursor);
const secondHistoryPage = await (await screenRoute(request(`${historyPath}?before=${firstHistoryPage.nextCursor}`), playerEnv, ["player", "calculators", "calculator-1", "history"])).json();
assert.equal(secondHistoryPage.items.length, 1);
await screenRoute(request("/api/screens/player", { method: "PUT", body: JSON.stringify({ document: { version: 1, widgets: [] } }) }), playerEnv, ["player"]);
assert.equal(sharedState.histories.some((row) => row.user_id === "player-1" && row.screen_kind === "player"), false, "Removing a Calculator card must clean up its history.");

const tooLarge = { version: 1, widgets: [
  { id: "note-a", type: "note", title: "A", body: "a".repeat(850_000) },
  { id: "note-b", type: "note", title: "B", body: "b".repeat(850_000) },
] };
assert.equal((await screenRoute(request("/api/screens/player", { method: "PUT", body: JSON.stringify({ document: tooLarge }) }), playerEnv, ["player"])).status, 413);

const dmRow = { id: "dm-1", email: "dm@example.com", roles_json: '["player-screen","dm-screen"]' };
const dmEnv = { DB: database(dmRow, sharedState) };
assert.equal((await screenRoute(request("/api/screens/dm"), dmEnv, ["dm"])).status, 200);
await screenRoute(request("/api/screens/dm", { method: "PUT", body: JSON.stringify({ document: { version: 1, widgets: [{ id: "dm-note", type: "note", title: "DM only", body: "" }] } }) }), dmEnv, ["dm"]);
assert.equal((await (await screenRoute(request("/api/screens/player"), dmEnv, ["player"])).json()).document, null, "One user keeps separate Player and DM documents.");

const initiative = await publicInitiativeRoute({
  DB: { prepare: () => ({ first: async () => ({
    draft_json: JSON.stringify({ currentDocument: { tables: [{ type: "initiative", columns: [{ id: "name", role: "character" }], rows: [{ cells: { name: "Cassian" } }, { cells: { name: " " } }] }] } }),
    updated_at: "2026-08-28T00:00:00.000Z",
  }) }) },
});
assert.deepEqual((await initiative.json()).names, ["Cassian"]);

const missingMigration = await screenRoute(request("/api/screens/player"), {
  DB: {
    prepare(sql) {
      if (sql.includes("FROM user_sessions JOIN users")) return { bind: () => ({ first: async () => playerRow }) };
      return { bind: () => ({ first: async () => { throw new Error("no such table: user_screens"); } }) };
    },
  },
}, ["player"]);
assert.equal(missingMigration.status, 503);

console.log("Per-user Screen and Public Initiative API tests passed.");
