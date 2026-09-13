// Verifies JSON naming, character-to-sheet mapping, and actual PDF form filling.
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import {
  characterExportStem,
  characterPdfData,
  fillCharacterPdf,
} from "../js/editor/character-export.js";

const require = createRequire(import.meta.url);
const pdfLib = require("pdf-lib");
const character = {
  id: "test-character",
  name: "Élaria Moon-Song",
  class: "Bard",
  subclass: "College of Lore",
  race: "Elf",
  level: 5,
  experience: 6500,
  background: "Sage",
  alignment: "Neutral Good",
  ac: 16,
  initiative: 4,
  proficiency: 3,
  walk: 30,
  hp: { max: 45, current: 39, temp: 2 },
  passivePerception: 14,
  stats: {
    str: { score: 8, modifier: -1, save: -1, skills: [{ name: "Athletics", modifier: -1, proficiency: false }] },
    dex: { score: 18, modifier: 4, save: 7, skills: [{ name: "Stealth", modifier: 7, proficiency: true }] },
    con: { score: 14, modifier: 2, save: 2, skills: [] },
    int: { score: 12, modifier: 1, save: 1, skills: [{ name: "History", modifier: 4, proficiency: true }] },
    wis: { score: 14, modifier: 2, save: 2, skills: [{ name: "Perception", modifier: 5, proficiency: true }] },
    cha: { score: 18, modifier: 4, save: 7, skills: [{ name: "Persuasion", modifier: 7, proficiency: true }] },
  },
  actions: [{ name: "Rapier", attack: "+7 vs AC", damage: "1d8+4 piercing", action: "Action" }],
  spellcasting: {
    profiles: [{ name: "Bard", ability: "CHA", saveDC: 15, attackBonus: 7 }],
    slots: [{ level: 1, current: 2, max: 4 }],
  },
  spells: [{ name: "Message", level: 0 }, { name: "Healing Word", level: 1 }],
  currency: { cp: 1, sp: 2, ep: 3, gp: 4, pp: 5 },
  inventory: [{ name: "Lute", quantity: 1, description: "Well traveled" }],
  features: [{ name: "Bardic Inspiration", description: "Grant an inspiration die." }],
};

assert.equal(characterExportStem(character), "elaria-moon-song");
const mapped = characterPdfData(character);
assert.equal(mapped.textFields.CharacterName, character.name);
assert.equal(mapped.textFields.ClassLevel, "Bard Level 5 (College of Lore)");
assert.equal(mapped.textFields.STRmod, "-1");
assert.equal(mapped.textFields["Stealth "], "+7");
assert.equal(mapped.textFields["Wpn Name"], "Rapier");
assert.equal(mapped.textFields["SlotsTotal 19"], "4");
assert.equal(mapped.textFields["Spells 1014"], "Message");
assert.equal(mapped.textFields["Spells 1015"], "Healing Word");
assert.ok(mapped.checkedFields.includes("Check Box 18"), "Dexterity save proficiency should be checked.");
assert.ok(mapped.checkedFields.includes("Check Box 39"), "Stealth proficiency should be checked.");

const template = fs.readFileSync("DnD_5E_CharacterSheet - Form Fillable.pdf");
const portrait = { bytes: fs.readFileSync("char/cassian/portrait.jpg"), type: "image/jpeg" };
const output = await fillCharacterPdf(template, character, pdfLib, portrait);
assert.ok(output.length > template.length / 2, "Filled PDF should remain a complete document.");
const exported = await pdfLib.PDFDocument.load(output);
const form = exported.getForm();
assert.equal(form.getTextField("CharacterName").getText(), character.name);
assert.equal(form.getTextField("HPMax").getText(), "45");
assert.equal(form.getTextField("Spells 1015").getText(), "Healing Word");
assert.equal(form.getCheckBox("Check Box 39").isChecked(), true);

console.log("Character JSON and filled PDF export tests passed.");
