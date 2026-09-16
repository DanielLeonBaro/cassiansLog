// Verifies character tracker filters.
import assert from "node:assert/strict";
import {
  createFilterState,
  itemFilterText,
  itemMatchesFilters,
  matchesFocus,
  matchesUsage,
} from "../js/tracker/filters.js";

const fireball = {
  source: "spells",
  item: {
    name: "Fireball",
    category: "Evocation",
    action: "Action",
    description: "A bright streak deals fire damage.",
    range: "150 feet",
    damage: "8d6 fire",
    level: 3,
  },
};
const cure = {
  source: "spells",
  item: {
    name: "Cure Wounds",
    description: "A creature regains hit points.",
    range: "Touch",
    level: 1,
  },
};

assert.deepEqual(createFilterState(), {
  search: "",
  source: "",
  focus: "",
  level: "",
  category: "",
  action: "",
  usage: "",
});
assert.match(itemFilterText(fireball), /fireball.*level 3.*spells/);
assert.equal(matchesFocus(fireball, "damage-spell"), true);
assert.equal(matchesFocus(fireball, "healing-spell"), false);
assert.equal(matchesFocus(cure, "healing-spell"), true);
assert.equal(itemMatchesFilters(fireball, { ...createFilterState(), search: "fire damage" }), true);
assert.equal(itemMatchesFilters(fireball, { ...createFilterState(), level: "2" }), false);
assert.equal(itemMatchesFilters(fireball, { ...createFilterState(), source: "features" }), false);
assert.equal(matchesUsage({ attack: "+5", action: "Action" }, "attack"), true);
assert.equal(matchesUsage({ action: "Action" }, "action"), true);
assert.equal(matchesUsage({ action: "Bonus Action" }, "bonus-action"), true);
assert.equal(matchesUsage({ action: "Reaction" }, "reaction"), true);
assert.equal(matchesUsage({ action: "Free Action" }, "other"), true);
assert.equal(matchesUsage({ action: "Action", uses: { current: 1, max: 1 } }, "limited"), true);
assert.equal(itemMatchesFilters(fireball, { ...createFilterState(), usage: "reaction" }), false);

console.log("Character tracker filter tests passed.");
