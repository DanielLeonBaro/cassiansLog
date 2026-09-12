// Verifies D&D Beyond URL, API payload, and exported-PDF field conversion.
import assert from "node:assert/strict";
import { dndBeyondCharacterId, mapDndBeyondPayload, mapDndBeyondPdfFields } from "../js/archive/dnd-beyond-import.js";

assert.equal(dndBeyondCharacterId("https://www.dndbeyond.com/characters/123456789/Example"), "123456789");
assert.equal(dndBeyondCharacterId("https://character-service.dndbeyond.com/character/v5/character/42"), "42");
assert.equal(dndBeyondCharacterId("https://example.com/characters/123"), "");
assert.equal(dndBeyondCharacterId("not a page"), "");

const apiCharacter = mapDndBeyondPayload({ data: {
  name: "Mira Beyond",
  decorations: { avatarUrl: "https://example.test/mira.png" },
  classes: [{ level: 3, definition: { name: "Wizard", classFeatures: [{ name: "Arcane Recovery", requiredLevel: 1, description: "<p>Recover spell slots.</p>" }] }, subclassDefinition: { name: "Evoker", classFeatures: [] } }],
  race: { fullName: "High Elf", weightSpeeds: { normal: { walk: 30, fly: 0 } }, racialTraits: [{ definition: { name: "Darkvision", description: "See in darkness." } }] },
  background: { definition: { name: "Sage" } },
  stats: [
    { id: 1, value: 8 }, { id: 2, value: 14 }, { id: 3, value: 12 },
    { id: 4, value: 16 }, { id: 5, value: 10 }, { id: 6, value: 10 },
  ],
  bonusStats: [], overrideStats: [],
  modifiers: {
    race: [{ type: "sense", subType: "darkvision", fixedValue: 60 }],
    class: [{ type: "proficiency", subType: "intelligence-saving-throws" }, { type: "proficiency", subType: "arcana" }],
  },
  baseHitPoints: 17, bonusHitPoints: 0, removedHitPoints: 2, temporaryHitPoints: 3,
  currentXp: 900, alignmentId: 2, gender: "Female", inventory: [], actions: {}, feats: [],
  spells: { class: [{ prepared: true, spellCastingAbilityId: 4, definition: { name: "Fire Bolt", level: 0, school: "Evocation", activation: { activationType: 1 }, range: { origin: "Ranged", rangeValue: 120 }, components: [1, 2], duration: { durationType: "Instantaneous" }, description: "<p>A mote of fire.</p>" } }] },
  classSpells: [], spellSlots: [{ level: 1, available: 4, used: 1 }], pactMagic: [], currencies: { gp: 12 },
} });

assert.equal(apiCharacter.name, "Mira Beyond");
assert.equal(apiCharacter.class, "Wizard");
assert.equal(apiCharacter.subclass, "Evoker");
assert.equal(apiCharacter.level, 3);
assert.deepEqual(apiCharacter.hp, { max: 20, current: 18, temp: 3 });
assert.equal(apiCharacter.stats.int.score, 16);
assert.equal(apiCharacter.stats.int.save, 5);
assert.equal(apiCharacter.stats.int.skills.find((skill) => skill.name === "Arcana").modifier, 5);
assert.equal(apiCharacter.darkvision, 60);
assert.equal(apiCharacter.spells[0].name, "Fire Bolt");
assert.equal(apiCharacter.spellcasting.profiles[0].saveDC, 13);
assert.equal(apiCharacter.spellcasting.profiles[0].attackBonus, 5);
assert.deepEqual(apiCharacter.spellcasting.slots[0], { id: "slot-1-1", profileId: "dnd-beyond-spellcasting", level: 1, current: 3, max: 4, reset: "long" });
assert.equal(apiCharacter.currency.gp, 12);

// Regression: the public API returns base HP and derived modifiers, not the final sheet totals.
const gwendoline = mapDndBeyondPayload({ data: {
  name: "Gwendoline",
  classes: [{
    id: 55,
    level: 6,
    definition: {
      name: "Bard",
      spellCastingAbilityId: 6,
      classFeatures: [],
      spellRules: { multiClassSpellSlotDivisor: 1, levelSpellSlots: [[], [], [], [], [], [], [4, 3, 3]] },
    },
    subclassDefinition: { name: "College of Lore", classFeatures: [] },
  }],
  race: { fullName: "Half-Elf", weightSpeeds: { normal: { walk: 30 } }, racialTraits: [] },
  stats: [
    { id: 1, value: 12 }, { id: 2, value: 14 }, { id: 3, value: 13 },
    { id: 4, value: 8 }, { id: 5, value: 10 }, { id: 6, value: 15 },
  ],
  bonusStats: [], overrideStats: [],
  modifiers: {
    race: [
      { type: "bonus", subType: "dexterity-score", fixedValue: 2 },
      { type: "bonus", subType: "constitution-score", fixedValue: 1 },
      { type: "bonus", subType: "charisma-score", fixedValue: 3 },
      { type: "set-base", subType: "darkvision", fixedValue: 60 },
    ],
    class: [
      { type: "half-proficiency", subType: "ability-checks" },
      { type: "half-proficiency", subType: "initiative" },
      { type: "proficiency", subType: "dexterity-saving-throws" },
      { type: "proficiency", subType: "charisma-saving-throws" },
      { type: "expertise", subType: "acrobatics" },
      { type: "proficiency", subType: "rapier" },
    ],
    item: [
      { type: "bonus", subType: "armor-class", fixedValue: 1, componentId: 10, requiresAttunement: true },
      { type: "bonus", subType: "armor-class", fixedValue: 2, componentId: 11, requiresAttunement: false },
    ],
  },
  inventory: [
    { equipped: true, isAttuned: false, quantity: 1, definition: { id: 10, name: "Cloak of Protection", canAttune: true } },
    { equipped: true, isAttuned: false, quantity: 1, definition: { id: 11, name: "Leather, +2", armorClass: 11, armorTypeId: 1 } },
    { equipped: true, isAttuned: false, quantity: 1, definition: {
      id: 12, name: "Rapier, +3", type: "Rapier", categoryId: 2, attackType: 1,
      damage: { diceString: "1d8" }, damageType: "Piercing", properties: [{ name: "Finesse" }],
      grantedModifiers: [{ type: "bonus", subType: "magic", fixedValue: 3 }],
    } },
  ],
  baseHitPoints: 33, removedHitPoints: 0, temporaryHitPoints: 0,
  currentXp: 18800, alignmentId: 3, gender: "Female", feats: [], currencies: {},
  actions: { class: [{
    name: "Bardic Inspiration", actionType: 3, activation: { activationType: 3 },
    limitedUse: { statModifierUsesId: 6, maxUses: 0, numberUsed: 0, resetType: 1 },
  }] },
  customActions: [], spells: {},
  classSpells: [{ characterClassId: 55, spells: [{ definition: { name: "Vicious Mockery", level: 0, components: [] } }] }],
  spellSlots: [{ level: 1, used: 0, available: 0 }, { level: 2, used: 1, available: 0 }, { level: 3, used: 0, available: 0 }],
  pactMagic: [], traits: { personalityTraits: "I keep my curse private." }, notes: {},
} });

assert.deepEqual(gwendoline.hp, { max: 45, current: 45, temp: 0 });
assert.equal(gwendoline.ac, 16);
assert.equal(gwendoline.initiative, 4);
assert.equal(gwendoline.darkvision, 60);
assert.equal(gwendoline.stats.int.skills.find((skill) => skill.name === "Arcana").modifier, 0);
assert.equal(gwendoline.actions.find((action) => action.name === "Rapier, +3").attack, "+9 vs AC");
assert.equal(gwendoline.actions.find((action) => action.name === "Rapier, +3").damage, "1d8+6 Piercing");
assert.deepEqual(gwendoline.resources.find((resource) => resource.name === "Bardic Inspiration").uses, { current: 4, max: 4, reset: "short" });
assert.equal(gwendoline.spellcasting.profiles[0].ability, "CHA");
assert.equal(gwendoline.spellcasting.profiles[0].saveDC, 15);
assert.deepEqual(gwendoline.spellcasting.slots.map((slot) => [slot.level, slot.current, slot.max]), [[1, 4, 4], [2, 2, 3], [3, 3, 3]]);
assert.equal(gwendoline.features.some((feature) => feature.name === "Personality traits"), true);

const pdfCharacter = mapDndBeyondPdfFields([
  ["CharacterName", "Oskarr Gorunn"], ["CLASS  LEVEL", "Druid 3"], ["RACE", "Gray Dwarf (Duergar)"],
  ["BACKGROUND", "Feylost"], ["STR", "13"], ["STRmod", "+1"], ["DEX", "13"], ["DEXmod ", "+1"],
  ["CON", "16"], ["CONmod", "+3"], ["INT", "10"], ["INTmod", "+0"], ["WIS", "15"], ["WISmod", "+2"],
  ["CHA", "8"], ["CHamod", "-1"], ["ST Strength", "+1"], ["ST Dexterity", "+1"], ["ST Constitution", "+3"],
  ["ST Intelligence", "+0"], ["ST Wisdom", "+4"], ["ST Charisma", "-1"], ["Perception", "+4"], ["PerceptionProf", "P"],
  ["AC", "14"], ["MaxHP", "27"], ["ProfBonus", "+2"], ["Init", "+1"], ["Speed", "25 ft. (Walking)"],
  ["Passive1", "14"], ["AdditionalSenses", "Darkvision 120 ft."], ["Wpn Name", "Quarterstaff"], ["Wpn1 AtkBonus", "+3"],
  ["Wpn1 Damage", "1d6+1 Bludgeoning"], ["FeaturesTraits1", "=== DRUID FEATURES ===\n\n* Wild Shape • PHB 66\nBecome a beast."],
  ["CP", "0"], ["SP", "0"], ["EP", "0"], ["GP", "20"], ["PP", "0"], ["Eq Name0", "Shield"], ["Eq Qty0", "1"],
  ["Eq Weight0", "6 lb."], ["spellCastingAbility0", "WIS"], ["spellSaveDC0", "12"], ["spellAtkBonus0", "+4"],
  ["spellCastingClass0", "Druid"], ["spellHeader0", "=== CANTRIPS ==="], ["spellName0", "Guidance"], ["spellSource0", "Druid"],
  ["spellCastingTime0", "1A"], ["spellRange0", "Touch"], ["spellComponents0", "V,S"], ["spellDuration0", "Concentration, up to 1 minute"],
  ["spellHeader1", "=== 1st LEVEL ==="], ["spellSlotHeader1", "4 Slots OOOO"], ["spellName1", "Healing Word"],
  ["spellSource1", "Druid"], ["spellCastingTime1", "1BA"], ["spellRange1", "60 ft."], ["spellComponents1", "V"], ["spellDuration1", "Instantaneous"],
].map(([name, value]) => ({ name, value })));

assert.equal(pdfCharacter.name, "Oskarr Gorunn");
assert.equal(pdfCharacter.class, "Druid");
assert.equal(pdfCharacter.level, 3);
assert.equal(pdfCharacter.stats.cha.modifier, -1);
assert.equal(pdfCharacter.stats.wis.save, 4);
assert.equal(pdfCharacter.stats.wis.skills.find((skill) => skill.name === "Perception").proficiency, true);
assert.equal(pdfCharacter.darkvision, 120);
assert.equal(pdfCharacter.actions[0].name, "Quarterstaff");
assert.equal(pdfCharacter.inventory[0].name, "Shield");
assert.equal(pdfCharacter.features.some((feature) => feature.name === "Wild Shape"), true);
assert.equal(pdfCharacter.spells.find((spell) => spell.name === "Guidance").level, 0);
assert.equal(pdfCharacter.spells.find((spell) => spell.name === "Healing Word").level, 1);
assert.equal(pdfCharacter.spellcasting.slots[0].max, 4);
assert.equal(pdfCharacter.currency.gp, 20);

console.log("D&D Beyond character import conversion tests passed.");
