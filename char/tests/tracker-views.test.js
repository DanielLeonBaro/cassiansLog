import assert from "node:assert/strict";
import { createTrackerViews } from "../js/tracker/views.js";

const spells = [{ id: "fire", name: "Fire Bolt", level: 0, source: "wizard" }];
const views = createTrackerViews({
  formatReset: (reset) => reset === "short" ? "Short Rest" : "Long Rest",
  formatSpellLevel: (level) => Number(level) === 0 ? "Cantrip" : `Level ${level}`,
  getPreparedCount: () => 0,
  getSpellcastingProfile: () => ({ name: "Wizard" }),
  getSpells: () => spells,
  isAlwaysPreparedSpell: () => false,
});

assert.match(views.renderResourceCard({
  id: "second-wind",
  name: "Second Wind",
  category: "Feature",
  uses: { current: 0, max: 1, reset: "short" },
}), /data-id="second-wind"[\s\S]*0\/1[\s\S]*Short Rest/);
assert.match(views.renderSpellSlot({ id: "slot-1", level: 1, current: 1, max: 2 }, { name: "Wizard" }), /data-id="slot-1"[\s\S]*1\/2/);
assert.match(views.renderPreparedProfile({ id: "wizard", name: "Wizard", preparedLimit: 2 }), /Fire Bolt[\s\S]*Cantrip · always ready/);
assert.match(views.renderAbilityCard({ name: "Slash", category: "Attack", action: "Action" }), /Search Google for Slash/);

console.log("Character tracker view tests passed.");
