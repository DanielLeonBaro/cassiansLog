// Exports the current character draft as its source JSON or a filled 5e PDF.
const PDF_TEMPLATE_URL = new URL("../../../DnD_5E_CharacterSheet%20-%20Form%20Fillable.pdf", import.meta.url);
const PDF_LIB_URL = new URL("../../../shared/vendor/pdf-lib/pdf-lib.min.js", import.meta.url);

const ABILITIES = ["str", "dex", "con", "int", "wis", "cha"];
const SAVE_FIELDS = {
  str: ["ST Strength", "Check Box 11"],
  dex: ["ST Dexterity", "Check Box 18"],
  con: ["ST Constitution", "Check Box 19"],
  int: ["ST Intelligence", "Check Box 20"],
  wis: ["ST Wisdom", "Check Box 21"],
  cha: ["ST Charisma", "Check Box 22"],
};
const SKILL_FIELDS = {
  acrobatics: ["Acrobatics", "Check Box 23"],
  "animal handling": ["Animal", "Check Box 24"],
  arcana: ["Arcana", "Check Box 25"],
  athletics: ["Athletics", "Check Box 26"],
  deception: ["Deception ", "Check Box 27"],
  history: ["History ", "Check Box 28"],
  insight: ["Insight", "Check Box 29"],
  intimidation: ["Intimidation", "Check Box 30"],
  investigation: ["Investigation ", "Check Box 31"],
  medicine: ["Medicine", "Check Box 32"],
  nature: ["Nature", "Check Box 33"],
  perception: ["Perception ", "Check Box 34"],
  performance: ["Performance", "Check Box 35"],
  persuasion: ["Persuasion", "Check Box 36"],
  religion: ["Religion", "Check Box 37"],
  "sleight of hand": ["SleightofHand", "Check Box 38"],
  stealth: ["Stealth ", "Check Box 39"],
  survival: ["Survival", "Check Box 40"],
};
const WEAPON_FIELDS = [
  ["Wpn Name", "Wpn1 AtkBonus", "Wpn1 Damage"],
  ["Wpn Name 2", "Wpn2 AtkBonus ", "Wpn2 Damage "],
  ["Wpn Name 3", "Wpn3 AtkBonus  ", "Wpn3 Damage "],
];
const SPELL_FIELDS = {
  0: ["Spells 1014", "Spells 1016", "Spells 1017", "Spells 1018", "Spells 1019", "Spells 1020", "Spells 1021", "Spells 1022"],
  1: ["Spells 1015", "Spells 1023", "Spells 1024", "Spells 1025", "Spells 1026", "Spells 1027", "Spells 1028", "Spells 1029", "Spells 1030", "Spells 1031", "Spells 1032", "Spells 1033"],
  2: ["Spells 1046", "Spells 1034", "Spells 1035", "Spells 1036", "Spells 1037", "Spells 1038", "Spells 1039", "Spells 1040", "Spells 1041", "Spells 1042", "Spells 1043", "Spells 1044", "Spells 1045"],
  3: ["Spells 1048", "Spells 1047", "Spells 1049", "Spells 1050", "Spells 1051", "Spells 1052", "Spells 1053", "Spells 1054", "Spells 1055", "Spells 1056", "Spells 1057", "Spells 1058", "Spells 1059"],
  4: ["Spells 1061", "Spells 1060", "Spells 1062", "Spells 1063", "Spells 1064", "Spells 1065", "Spells 1066", "Spells 1067", "Spells 1068", "Spells 1069", "Spells 1070", "Spells 1071", "Spells 1072"],
  5: ["Spells 1074", "Spells 1073", "Spells 1075", "Spells 1076", "Spells 1077", "Spells 1078", "Spells 1079", "Spells 1080", "Spells 1081"],
  6: ["Spells 1083", "Spells 1082", "Spells 1084", "Spells 1085", "Spells 1086", "Spells 1087", "Spells 1088", "Spells 1089", "Spells 1090"],
  7: ["Spells 1092", "Spells 1091", "Spells 1093", "Spells 1094", "Spells 1095", "Spells 1096", "Spells 1097", "Spells 1098", "Spells 1099"],
  8: ["Spells 10101", "Spells 10100", "Spells 10102", "Spells 10103", "Spells 10104", "Spells 10105", "Spells 10106"],
  9: ["Spells 10108", "Spells 10107", "Spells 10109", "Spells 101010", "Spells 101011", "Spells 101012", "Spells 101013"],
};

let pdfLibPromise;

function value(value) {
  return value === undefined || value === null ? "" : String(value);
}

function listValue(source) {
  if (!Array.isArray(source)) return value(source);
  return source.map((item) => typeof item === "object" ? item?.name || item?.label || "" : value(item)).filter(Boolean).join(", ");
}

function signed(valueToFormat) {
  const number = Number(valueToFormat);
  if (!Number.isFinite(number)) return value(valueToFormat);
  return number >= 0 ? `+${number}` : String(number);
}

function lines(items, formatter) {
  return (Array.isArray(items) ? items : []).map(formatter).filter(Boolean).join("\n");
}

function usesText(item) {
  if (!item?.uses) return "";
  const reset = item.uses.reset && item.uses.reset !== "none" ? ` / ${item.uses.reset} rest` : "";
  return ` (${value(item.uses.current)}/${value(item.uses.max)}${reset})`;
}

function entryText(item) {
  if (!item) return "";
  const heading = `${value(item.name)}${usesText(item)}`.trim();
  return [heading, value(item.description)].filter(Boolean).join(heading && item.description ? ": " : "");
}

function inventoryText(item) {
  if (!item) return "";
  const quantity = Number(item.quantity);
  const heading = `${Number.isFinite(quantity) && quantity !== 1 ? `${quantity}x ` : ""}${value(item.name)}`.trim();
  return [heading, value(item.description)].filter(Boolean).join(heading && item.description ? " — " : "");
}

function actionText(action) {
  if (!action) return "";
  const details = [action.action, action.attack, action.damage, action.range].filter(Boolean).join("; ");
  return `${value(action.name)}${details ? ` (${details})` : ""}${action.description ? `: ${action.description}` : ""}`.trim();
}

function attackBonus(action) {
  const match = value(action?.attack).match(/[+-]\d+/);
  return match?.[0] || value(action?.attack);
}

function classLevel(character) {
  const base = [character.class, character.level && `Level ${character.level}`].filter(Boolean).join(" ");
  return character.subclass ? `${base} (${character.subclass})` : base;
}

function movement(character) {
  const speeds = [];
  if (character.walk !== undefined && character.walk !== "") speeds.push(`${character.walk} ft`);
  if (Number(character.fly) > 0) speeds.push(`Fly ${character.fly} ft`);
  return speeds.join(", ");
}

function saveIsProficient(stat, proficiency) {
  if (typeof stat?.saveProficient === "boolean") return stat.saveProficient;
  const difference = Number(stat?.save) - Number(stat?.modifier);
  return Number.isFinite(difference) && Number(proficiency) > 0 && difference >= Number(proficiency);
}

export function characterExportStem(character = {}) {
  const source = value(character.name || character.id || "character").normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
  return source.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "character";
}

export function characterPdfData(character = {}) {
  const textFields = {
    "CharacterName": value(character.name),
    "CharacterName 2": value(character.name),
    "ClassLevel": classLevel(character),
    "Background": value(character.background),
    "PlayerName": value(character.playerName),
    "Race ": value(character.race),
    "Alignment": value(character.alignment),
    "XP": value(character.experience),
    "Inspiration": character.inspiration ? "Yes" : "",
    "ProfBonus": signed(character.proficiency),
    "AC": value(character.ac),
    "Initiative": signed(character.initiative),
    "Speed": movement(character),
    "HPMax": value(character.hp?.max),
    "HPCurrent": value(character.hp?.current),
    "HPTemp": value(character.hp?.temp),
    "Passive": value(character.passivePerception),
    "PersonalityTraits ": value(character.personalityTraits || character.personality),
    "Ideals": value(character.ideals),
    "Bonds": value(character.bonds),
    "Flaws": value(character.flaws),
    "ProficienciesLang": listValue(character.proficienciesAndLanguages || character.proficiencies || character.languages),
    "CP": value(character.currency?.cp),
    "SP": value(character.currency?.sp),
    "EP": value(character.currency?.ep),
    "GP": value(character.currency?.gp),
    "PP": value(character.currency?.pp),
    "Equipment": lines(character.inventory, inventoryText),
    "Features and Traits": [
      lines(character.features, entryText),
      lines(character.resources, entryText),
      lines(character.trackers, entryText),
    ].filter(Boolean).join("\n\n"),
    "AttacksSpellcasting": lines(character.actions, actionText),
    "Age": value(character.age),
    "Height": value(character.height),
    "Weight": value(character.weight),
    "Eyes": value(character.eyes),
    "Skin": value(character.skin),
    "Hair": value(character.hair),
    "Allies": listValue(character.allies),
    "FactionName": value(character.factionName || character.faction),
    "Backstory": value(character.backstory || character.description),
    "Feat+Traits": lines(character.features, entryText),
    "Treasure": value(character.treasure),
  };
  const checkedFields = [];

  ABILITIES.forEach((ability) => {
    const stat = character.stats?.[ability] || {};
    const [saveField, saveCheckbox] = SAVE_FIELDS[ability];
    const scoreField = ability === "cha" ? "CHA" : ability.toUpperCase();
    const modifierField = ability === "dex" ? "DEXmod " : ability === "cha" ? "CHamod" : `${ability.toUpperCase()}mod`;
    textFields[scoreField] = value(stat.score);
    textFields[modifierField] = signed(stat.modifier);
    textFields[saveField] = signed(stat.save);
    if (saveIsProficient(stat, character.proficiency)) checkedFields.push(saveCheckbox);
    (Array.isArray(stat.skills) ? stat.skills : []).forEach((skill) => {
      const fields = SKILL_FIELDS[value(skill.name).trim().toLowerCase()];
      if (!fields) return;
      textFields[fields[0]] = signed(skill.modifier);
      if (skill.proficiency) checkedFields.push(fields[1]);
    });
  });

  (Array.isArray(character.actions) ? character.actions : []).filter((action) => action.attack || action.damage).slice(0, 3).forEach((action, index) => {
    const [nameField, attackField, damageField] = WEAPON_FIELDS[index];
    textFields[nameField] = value(action.name);
    textFields[attackField] = attackBonus(action);
    textFields[damageField] = value(action.damage);
  });

  const profiles = Array.isArray(character.spellcasting?.profiles) ? character.spellcasting.profiles : [];
  const primaryProfile = profiles[0] || {};
  textFields["Spellcasting Class 2"] = profiles.map((profile) => profile.name).filter(Boolean).join(", ") || value(character.class);
  textFields["SpellcastingAbility 2"] = value(primaryProfile.ability);
  textFields["SpellSaveDC  2"] = value(primaryProfile.saveDC);
  textFields["SpellAtkBonus 2"] = signed(primaryProfile.attackBonus);

  for (let level = 1; level <= 9; level += 1) {
    const slots = (Array.isArray(character.spellcasting?.slots) ? character.spellcasting.slots : []).filter((slot) => Number(slot.level) === level);
    const total = slots.reduce((sum, slot) => sum + (Number(slot.max) || 0), 0);
    const remaining = slots.reduce((sum, slot) => sum + (Number(slot.current) || 0), 0);
    textFields[`SlotsTotal ${18 + level}`] = total ? value(total) : "";
    textFields[`SlotsRemaining ${18 + level}`] = total ? value(remaining) : "";
  }

  const spellsByLevel = new Map();
  (Array.isArray(character.spells) ? character.spells : []).forEach((spell) => {
    const level = Math.max(0, Math.min(9, Number(spell.level ?? spell.slotLevel) || 0));
    if (!spellsByLevel.has(level)) spellsByLevel.set(level, []);
    spellsByLevel.get(level).push(value(spell.name));
  });
  Object.entries(SPELL_FIELDS).forEach(([level, fields]) => {
    (spellsByLevel.get(Number(level)) || []).slice(0, fields.length).forEach((spell, index) => {
      textFields[fields[index]] = spell;
    });
  });

  return { textFields, checkedFields };
}

function pdfSafeText(text, font) {
  return [...value(text)].map((character) => {
    try {
      font.encodeText(character);
      return character;
    } catch {
      return "?";
    }
  }).join("");
}

export async function fillCharacterPdf(templateBytes, character, pdfLib, portrait = null) {
  const { PDFDocument, StandardFonts } = pdfLib;
  const pdfDocument = await PDFDocument.load(templateBytes);
  const form = pdfDocument.getForm();
  const font = await pdfDocument.embedFont(StandardFonts.Helvetica);
  const fields = new Map(form.getFields().map((field) => [field.getName(), field]));
  const { textFields, checkedFields } = characterPdfData(character);

  Object.entries(textFields).forEach(([name, fieldValue]) => {
    const field = fields.get(name);
    if (!field || typeof field.setText !== "function") return;
    const safeValue = pdfSafeText(fieldValue, font);
    const maxLength = typeof field.getMaxLength === "function" ? field.getMaxLength() : undefined;
    field.setText(maxLength ? safeValue.slice(0, maxLength) : safeValue);
  });
  checkedFields.forEach((name) => fields.get(name)?.check?.());
  if (portrait?.bytes && /(?:png|jpe?g)/i.test(portrait.type || "")) {
    const image = /png/i.test(portrait.type)
      ? await pdfDocument.embedPng(portrait.bytes)
      : await pdfDocument.embedJpg(portrait.bytes);
    fields.get("CHARACTER IMAGE")?.setImage?.(image);
  }
  form.updateFieldAppearances(font);
  return pdfDocument.save({ updateFieldAppearances: false });
}

function loadPdfLib() {
  if (globalThis.PDFLib) return Promise.resolve(globalThis.PDFLib);
  if (pdfLibPromise) return pdfLibPromise;
  pdfLibPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = PDF_LIB_URL.href;
    script.onload = () => {
      if (globalThis.PDFLib) resolve(globalThis.PDFLib);
      else {
        pdfLibPromise = null;
        reject(new Error("The PDF exporter did not initialize."));
      }
    };
    script.onerror = () => {
      pdfLibPromise = null;
      reject(new Error("Could not load the PDF exporter."));
    };
    document.head.appendChild(script);
  });
  return pdfLibPromise;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

async function loadCharacterPortrait(portrait) {
  if (!portrait) return null;
  try {
    const url = portrait.startsWith("data:") || portrait.startsWith("/")
      ? portrait
      : new URL(`/${portrait}`, location.origin).href;
    const response = await fetch(url);
    if (!response.ok) return null;
    const type = response.headers.get("content-type") || "";
    if (!/(?:png|jpe?g)/i.test(type)) return null;
    return { bytes: await response.arrayBuffer(), type };
  } catch {
    return null;
  }
}

export function downloadCharacterJson(character) {
  const json = `${JSON.stringify(character, null, 2)}\n`;
  downloadBlob(new Blob([json], { type: "application/json" }), `${characterExportStem(character)}.json`);
}

export async function downloadCharacterPdf(character) {
  const [response, pdfLib, portrait] = await Promise.all([
    fetch(PDF_TEMPLATE_URL),
    loadPdfLib(),
    loadCharacterPortrait(character.portrait),
  ]);
  if (!response.ok) throw new Error(`Could not load the character sheet PDF (${response.status}).`);
  const bytes = await fillCharacterPdf(await response.arrayBuffer(), character, pdfLib, portrait);
  downloadBlob(new Blob([bytes], { type: "application/pdf" }), `${characterExportStem(character)}.pdf`);
}
