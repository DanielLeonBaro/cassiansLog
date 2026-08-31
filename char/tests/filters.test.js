// Verifies character tracker filters.
import assert from "node:assert/strict";
import {
  createFilterState,
  itemFilterText,
  itemMatchesFilters,
  matchesFocus,
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
});
assert.match(itemFilterText(fireball), /fireball.*level 3.*spells/);
assert.equal(matchesFocus(fireball, "damage-spell"), true);
assert.equal(matchesFocus(fireball, "healing-spell"), false);
assert.equal(matchesFocus(cure, "healing-spell"), true);
assert.equal(itemMatchesFilters(fireball, { ...createFilterState(), search: "fire damage" }), true);
assert.equal(itemMatchesFilters(fireball, { ...createFilterState(), level: "2" }), false);
assert.equal(itemMatchesFilters(fireball, { ...createFilterState(), source: "features" }), false);

console.log("Character tracker filter tests passed.");
