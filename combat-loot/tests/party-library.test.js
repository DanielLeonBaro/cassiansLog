// Verifies combat party library.
import assert from "node:assert/strict";
import {
  loadPartyLibrary,
  membersForPartyIds,
  partyCandidatesForCharacters,
  resolvePartyCandidates,
  savePartyLibrary,
  upsertParty,
} from "../js/party-library.js";

function storage() {
  const values = new Map();
  return {
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, value),
  };
}

let parties = upsertParty([], {
  name: "Party 1",
  members: [{ character: "cassian", maxHp: "40", ac: "16" }],
}, { idFactory: () => "party-1" });
parties = upsertParty(parties, {
  name: "Party 2",
  members: [
    { character: "Cassian", maxHp: "50", ac: "18" },
    { character: "Karma", maxHp: "28", ac: "14" },
  ],
}, { idFactory: () => "party-2" });

assert.equal(parties.length, 2);
assert.equal(parties[0].members[0].character, "Cassian");
assert.throws(() => upsertParty(parties, {
  name: "Party 1",
  members: [{ character: "Other", maxHp: "1", ac: "1" }],
}), /already exists/);

assert.deepEqual(membersForPartyIds(parties, ["party-1", "party-2"]), [
  { character: "Cassian", maxHp: "40", ac: "16" },
  { character: "Karma", maxHp: "28", ac: "14" },
]);

const candidates = partyCandidatesForCharacters(parties, ["cassian", "Karma", "Unknown"]);
assert.equal(candidates[0].options.length, 2);
assert.equal(candidates[1].options.length, 1);
assert.deepEqual(resolvePartyCandidates(candidates, { cassian: "party-2" }), [
  { character: "Cassian", maxHp: "50", ac: "18" },
  { character: "Karma", maxHp: "28", ac: "14" },
]);

const local = storage();
const saved = savePartyLibrary(parties, local);
assert.equal(saved.ok, true);
assert.deepEqual(loadPartyLibrary(local), parties);

console.log("Combat party-library tests passed.");
