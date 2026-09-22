// Verifies every requested live-preview group is derived from the current evaluated draft.
import assert from "node:assert/strict";
import { characterBuilderPreviewModel } from "../js/builder/preview-model.js";

const document = { name: "Preview Hero", build: { ruleset: "5.5e" } };
const review = {
  document,
  sheet: {
    name: "Preview Hero", class: "Fighter", subclass: "Champion", race: "Human", background: "Soldier", level: 3,
    hp: { max: 28 }, ac: 18, initiative: 2, proficiency: 2,
    stats: {
      str: { score: 16, modifier: 3, save: 5, skills: [{ name: "Athletics", modifier: 5 }] },
      dex: { score: 14, modifier: 2, save: 2, skills: [{ name: "Stealth", modifier: 2 }] },
    },
    actions: [{ name: "Longsword", attackBonus: 5, damage: "1d8+3 slashing" }],
    spells: [{ name: "Light", level: 0 }], spellcasting: { slots: [{ level: 1, max: 2 }] },
    resources: [{ name: "Second Wind", uses: { max: 2 } }],
    proficiencies: ["Heavy armor"], languages: ["Common"],
    inventory: [{ name: "Longsword", quantity: 1 }, { name: "Potion", quantity: 2 }],
  },
  blockers: [],
  pending: [{ code: "required-step", message: "Species choice pending.", impact: "Movement may be missing." }],
  notices: [{ code: "partial", message: "One feature needs manual review." }],
};

const model = characterBuilderPreviewModel(document, [], review);
assert.deepEqual(model.identity, { name: "Preview Hero", details: "Fighter · Champion · Human · Soldier", level: 3, ruleset: "5.5e" });
assert.deepEqual(model.core.map(({ value }) => value), [28, 18, "+2", "+2"]);
assert.deepEqual(model.abilities[0], { label: "STR", score: 16, modifier: "+3" });
assert.deepEqual(model.saves, ["STR +5", "DEX +2"]);
assert.deepEqual(model.skills, ["Athletics +5", "Stealth +2"]);
assert.match(model.attacks[0], /Longsword — \+5 to hit, 1d8\+3 slashing/);
assert.deepEqual(model.spells, ["Light — Cantrip", "Spell slot 1: 2"]);
assert.deepEqual(model.resources, ["Second Wind — 2 uses"]);
assert.deepEqual(model.proficiencies, ["Heavy armor", "Language: Common"]);
assert.deepEqual(model.inventory, ["Longsword", "Potion ×2"]);
assert.equal(model.warnings.length, 2);

console.log("Character Builder live-preview model tests passed.");
