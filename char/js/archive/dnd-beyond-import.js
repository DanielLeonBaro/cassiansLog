// Converts public D&D Beyond character data and exported PDF fields into Cassian's Log documents.
const ABILITIES = [
  ["str", "Strength", 1],
  ["dex", "Dexterity", 2],
  ["con", "Constitution", 3],
  ["int", "Intelligence", 4],
  ["wis", "Wisdom", 5],
  ["cha", "Charisma", 6],
];

const SKILLS = [
  ["Acrobatics", "dex", "Acrobatics"],
  ["Animal Handling", "wis", "Animal"],
  ["Arcana", "int", "Arcana"],
  ["Athletics", "str", "Athletics"],
  ["Deception", "cha", "Deception"],
  ["History", "int", "History"],
  ["Insight", "wis", "Insight"],
  ["Intimidation", "cha", "Intimidation"],
  ["Investigation", "int", "Investigation"],
  ["Medicine", "wis", "Medicine"],
  ["Nature", "int", "Nature"],
  ["Perception", "wis", "Perception"],
  ["Performance", "cha", "Performance"],
  ["Persuasion", "cha", "Persuasion"],
  ["Religion", "int", "Religion"],
  ["Sleight of Hand", "dex", "SleightofHand"],
  ["Stealth", "dex", "Stealth"],
  ["Survival", "wis", "Survival"],
];

const ACTIVATIONS = {
  1: "Action",
  2: "No Action",
  3: "Bonus Action",
  4: "Reaction",
  6: "Minute",
  7: "Hour",
  8: "Special",
};

const ALIGNMENTS = {
  1: "Lawful Good",
  2: "Neutral Good",
  3: "Chaotic Good",
  4: "Lawful Neutral",
  5: "Neutral",
  6: "Chaotic Neutral",
  7: "Lawful Evil",
  8: "Neutral Evil",
  9: "Chaotic Evil",
};

function number(value, fallback = 0) {
  const cleaned = String(value ?? "").replace(/[^0-9+.-]/g, "");
  if (!cleaned || cleaned === "--") return fallback;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function modifier(score) {
  return Math.floor((number(score, 10) - 10) / 2);
}

function idFor(value, index = 0) {
  const base = String(value || "item").toLowerCase().normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "item";
  return `${base}-${index + 1}`;
}

function htmlText(value) {
  return String(value || "")
    .replace(/<\/?(?:p|div|li|ul|ol|table|tr|h[1-6]|hr)[^>]*>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\[[^\]]+\]([^[]*?)(?:\[[^\]]+\])?/g, "$1")
    .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'").replace(/&ndash;/gi, "–").replace(/&mdash;/gi, "—")
    .replace(/&rsquo;/gi, "’").replace(/&lsquo;/gi, "‘").replace(/&hellip;/gi, "…")
    .replace(/\r/g, "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

function uniqueBy(items, key) {
  const seen = new Set();
  return items.filter((item) => {
    const value = key(item);
    if (!value || seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

function rangeText(value) {
  if (!value) return "";
  const base = value.origin === "Ranged" && value.rangeValue ? `${value.rangeValue} ft` : value.origin || "";
  return value.aoeValue ? `${base}${base ? " / " : ""}${value.aoeValue} ft ${value.aoeType || "area"}` : base;
}

function uses(value) {
  if (!value || number(value.maxUses) <= 0) return undefined;
  const reset = { 1: "short", 2: "long", 3: "day" }[value.resetType] || "long";
  const max = number(value.maxUses);
  return { current: Math.max(0, max - number(value.numberUsed)), max, reset };
}

function apiModifiers(character) {
  return Object.values(character.modifiers || {}).flatMap((items) => Array.isArray(items) ? items : []);
}

function apiStats(character, proficiency) {
  const modifiers = apiModifiers(character);
  const scores = {};
  for (const [key, name, id] of ABILITIES) {
    const base = number(character.stats?.find((stat) => stat.id === id)?.value, 10);
    const bonus = number(character.bonusStats?.find((stat) => stat.id === id)?.value);
    const override = character.overrideStats?.find((stat) => stat.id === id)?.value;
    const scoreBonus = modifiers
      .filter((item) => item.type === "bonus" && item.subType === `${name.toLowerCase()}-score`)
      .reduce((total, item) => total + number(item.fixedValue ?? item.value), 0);
    const score = override == null ? base + bonus + scoreBonus : number(override, base);
    scores[key] = { score, modifier: modifier(score), save: modifier(score), skills: [] };
    if (modifiers.some((item) => item.type === "proficiency" && item.subType === `${name.toLowerCase()}-saving-throws`)) {
      scores[key].save += proficiency;
    }
  }
  for (const [name, ability] of SKILLS) {
    const slug = name.toLowerCase().replaceAll(" ", "-");
    const expertise = modifiers.some((item) => item.type === "expertise" && item.subType === slug);
    const proficient = expertise || modifiers.some((item) => item.type === "proficiency" && item.subType === slug);
    scores[ability].skills.push({
      name,
      modifier: scores[ability].modifier + (expertise ? proficiency * 2 : proficient ? proficiency : 0),
      proficiency: proficient,
    });
  }
  return scores;
}

function apiArmorClass(character, stats) {
  const equipped = (character.inventory || []).filter((item) => item.equipped && item.definition);
  const dexterity = stats.dex.modifier;
  let result = 10 + dexterity;
  for (const item of equipped) {
    const armor = number(item.definition.armorClass, -1);
    const type = number(item.definition.armorTypeId, 0);
    if (armor < 0) continue;
    if (type === 4) result += armor;
    else if (type === 1) result = Math.max(result, armor + dexterity);
    else if (type === 2) result = Math.max(result, armor + Math.min(2, dexterity));
    else if (type === 3) result = Math.max(result, armor);
  }
  for (const item of apiModifiers(character).filter((entry) => entry.subType === "unarmored-armor-class")) {
    const ability = ABILITIES.find((entry) => entry[2] === item.statId)?.[0];
    if (ability) result = Math.max(result, 10 + dexterity + stats[ability].modifier);
  }
  return result;
}

function apiFeatures(character) {
  const features = [];
  for (const classEntry of character.classes || []) {
    const definitions = [
      ...(classEntry.definition?.classFeatures || []),
      ...(classEntry.subclassDefinition?.classFeatures || []),
    ];
    for (const feature of definitions) {
      if (feature.requiredLevel && feature.requiredLevel > classEntry.level) continue;
      features.push({ name: feature.name, category: classEntry.definition?.name || "Class", description: htmlText(feature.description || feature.snippet) });
    }
  }
  for (const trait of character.race?.racialTraits || []) {
    const definition = trait.definition || trait;
    features.push({ name: definition.name, category: "Species", description: htmlText(definition.description || definition.snippet) });
  }
  for (const feat of character.feats || []) {
    const definition = feat.definition || feat;
    features.push({ name: definition.name, category: "Feat", description: htmlText(definition.description || definition.snippet) });
  }
  return uniqueBy(features, (item) => `${item.category}:${item.name}`)
    .map((item, index) => ({ id: idFor(item.name, index), ...item }));
}

function apiActions(character) {
  const entries = Object.entries(character.actions || {}).flatMap(([category, items]) =>
    (items || []).map((item) => ({ category, item })),
  );
  return uniqueBy(entries, ({ item }) => item.name).map(({ category, item }, index) => ({
    id: idFor(item.name, index),
    name: item.name,
    category: category[0].toUpperCase() + category.slice(1),
    action: ACTIVATIONS[item.activation?.activationType || item.actionType] || "Other",
    range: rangeText(item.range),
    attack: item.fixedToHit == null ? "" : `${number(item.fixedToHit) >= 0 ? "+" : ""}${item.fixedToHit} vs AC`,
    damage: [item.dice?.diceString, item.damageType].filter(Boolean).join(" "),
    uses: uses(item.limitedUse),
    description: htmlText(item.snippet || item.description),
  }));
}

function apiSpells(character) {
  const entries = [
    ...Object.entries(character.spells || {}).flatMap(([source, items]) => (items || []).map((item) => ({ source, item }))),
    ...(character.classSpells || []).flatMap((group) => (group.spells || []).map((item) => ({ source: "class", item }))),
  ];
  return uniqueBy(entries, ({ item }) => `${item.definition?.name}:${item.definition?.level}:${item.spellCastingAbilityId || ""}`)
    .map(({ source, item }, index) => {
      const spell = item.definition || {};
      const ability = ABILITIES.find((entry) => entry[2] === item.spellCastingAbilityId)?.[1]?.slice(0, 3).toUpperCase() || "";
      const components = (spell.components || []).map((id) => ({ 1: "V", 2: "S", 3: "M" }[id])).filter(Boolean).join(", ");
      return {
        id: idFor(spell.name, index), name: spell.name, category: spell.level ? "Spell" : "Cantrip",
        action: ACTIVATIONS[(item.activation || spell.activation)?.activationType] || "Other",
        level: number(spell.level), school: spell.school || "", source, spellcasting: ability,
        range: rangeText(item.range || spell.range), duration: spell.duration?.durationType || "",
        components, concentration: Boolean(spell.concentration), prepared: Boolean(item.prepared || item.alwaysPrepared),
        uses: uses(item.limitedUse), description: htmlText(spell.description),
      };
    });
}

export function dndBeyondCharacterId(value) {
  const source = String(value || "").trim();
  if (/^\d{1,12}$/.test(source)) return source;
  try {
    const url = new URL(source);
    if (!/(^|\.)dndbeyond\.com$/i.test(url.hostname)) return "";
    return /\/(?:characters?|character\/v\d+\/character)\/(\d{1,12})(?:\/|$)/i.exec(url.pathname)?.[1] || "";
  } catch {
    return "";
  }
}

export function mapDndBeyondPayload(payload) {
  const character = payload?.data || payload;
  if (!character || typeof character !== "object" || !character.name) throw new Error("D&D Beyond returned no character data.");
  const level = (character.classes || []).reduce((total, entry) => total + number(entry.level), 0) || 1;
  const proficiency = 2 + Math.floor((level - 1) / 4);
  const stats = apiStats(character, proficiency);
  const classNames = (character.classes || []).map((entry) => entry.definition?.name).filter(Boolean);
  const subclassNames = (character.classes || []).map((entry) => entry.subclassDefinition?.name).filter(Boolean);
  const maxHP = number(character.overrideHitPoints ?? character.baseHitPoints) + number(character.bonusHitPoints);
  const actions = apiActions(character);
  const resources = actions.filter((item) => item.uses).map((item, index) => ({
    id: idFor(item.name, index), name: item.name, category: item.category,
    action: item.action, uses: item.uses, description: item.description,
  }));
  const spells = apiSpells(character);
  const spellAbility = spells.find((item) => item.spellcasting)?.spellcasting || "";
  const spellStat = ABILITIES.find((entry) => entry[1].slice(0, 3).toUpperCase() === spellAbility)?.[0];
  const spellModifier = spellStat ? stats[spellStat].modifier : 0;
  const slots = [...(character.spellSlots || []), ...(character.pactMagic || [])]
    .filter((slot) => number(slot.available) > 0)
    .map((slot, index) => ({
      id: `slot-${slot.level}-${index + 1}`, profileId: "dnd-beyond-spellcasting", level: number(slot.level),
      current: Math.max(0, number(slot.available) - number(slot.used)), max: number(slot.available), reset: "long",
    }));
  const perception = stats.wis.skills.find((skill) => skill.name === "Perception")?.modifier ?? stats.wis.modifier;
  const speeds = character.race?.weightSpeeds?.override || character.race?.weightSpeeds?.normal || {};
  const senses = apiModifiers(character).filter((item) => item.type === "sense" && item.subType === "darkvision");
  return {
    name: String(character.name).trim(), status: "Active",
    portrait: character.decorations?.avatarUrl || "",
    class: classNames.join(" / "), subclass: subclassNames.join(" / "),
    race: character.race?.fullName || character.race?.baseRaceName || "", level,
    experience: number(character.currentXp), background: character.background?.definition?.name || "",
    alignment: ALIGNMENTS[character.alignmentId] || "", gender: character.gender || "",
    ac: apiArmorClass(character, stats),
    hp: { max: maxHP, current: Math.max(0, maxHP - number(character.removedHitPoints)), temp: number(character.temporaryHitPoints) },
    initiative: stats.dex.modifier, proficiency, walk: number(speeds.walk, 30), fly: number(speeds.fly),
    passivePerception: 10 + perception,
    darkvision: senses.reduce((maximum, item) => Math.max(maximum, number(item.fixedValue ?? item.value)), 0),
    stats, actions, resources, features: apiFeatures(character), spells,
    spellcasting: {
      enabled: spells.length > 0,
      profiles: spells.length ? [{
        id: "dnd-beyond-spellcasting", name: "D&D Beyond", ability: spellAbility,
        saveDC: 8 + proficiency + spellModifier, attackBonus: proficiency + spellModifier, preparedLimit: 0,
      }] : [],
      slots,
    },
    inventory: (character.inventory || []).map((item, index) => ({
      id: idFor(item.definition?.name, index), name: item.definition?.name || item.customName || "Item",
      quantity: number(item.quantity, 1), description: htmlText(item.definition?.description || item.notes),
      attunement: Boolean(item.isAttuned), wearable: Boolean(item.equipped),
    })),
    currency: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0, ...(character.currencies || {}) },
  };
}

function fieldMap(entries) {
  const fields = new Map();
  for (const entry of entries) {
    const value = Array.isArray(entry.value) ? entry.value.join(", ") : String(entry.value ?? "").trim();
    if (entry.name && value && value !== "Off" && !fields.has(entry.name)) fields.set(entry.name, value);
  }
  return fields;
}

function pdfFeatures(fields) {
  const source = [...fields.entries()]
    .filter(([key]) => /^FeaturesTraits\d*$/i.test(key))
    .sort(([a], [b]) => number(a.match(/\d+$/)?.[0]) - number(b.match(/\d+$/)?.[0]))
    .map(([, value]) => value).join("\n");
  const sections = source.split(/\n\s*\*\s+/).slice(1);
  return sections.map((block, index) => {
    const [heading = "Feature", ...body] = block.split("\n");
    const name = heading.split(" • ")[0].trim();
    return { id: idFor(name, index), name, category: "D&D Beyond", description: body.join("\n").trim() };
  }).filter((item) => item.name);
}

function pdfSpells(entries, fields) {
  let currentLevel = 0;
  const levels = new Map();
  const slots = [];
  for (const entry of entries) {
    if (/^spellHeader\d+$/i.test(entry.name)) {
      const heading = String(entry.value || "");
      currentLevel = /cantrips/i.test(heading) ? 0 : number(heading.match(/(\d+)(?:st|nd|rd|th)/i)?.[1], currentLevel);
    }
    const spellIndex = /^spellName(\d+)$/i.exec(entry.name)?.[1];
    if (spellIndex !== undefined) levels.set(number(spellIndex), currentLevel);
    if (/^spellSlotHeader\d+$/i.test(entry.name) && currentLevel > 0) {
      const max = number(String(entry.value).match(/\d+/)?.[0]);
      if (max > 0) slots.push({ id: `slot-${currentLevel}`, profileId: "dnd-beyond-spellcasting", level: currentLevel, current: max, max, reset: "long" });
    }
  }
  const indexes = [...fields.keys()].map((key) => /^spellName(\d+)$/i.exec(key)?.[1]).filter((value) => value !== undefined).map(number);
  const ability = fields.get("spellCastingAbility0") || "";
  const spells = uniqueBy(indexes.map((index) => ({
    id: idFor(fields.get(`spellName${index}`), index),
    name: fields.get(`spellName${index}`), category: levels.get(index) ? "Spell" : "Cantrip",
    action: String(fields.get(`spellCastingTime${index}`) || "").includes("BA") ? "Bonus Action"
      : String(fields.get(`spellCastingTime${index}`) || "").includes("R") ? "Reaction" : "Action",
    level: levels.get(index) || 0, school: "", source: fields.get(`spellSource${index}`) || "D&D Beyond",
    spellcasting: ability, range: fields.get(`spellRange${index}`) || "",
    attack: fields.get(`spellSaveHit${index}`) || "", duration: fields.get(`spellDuration${index}`) || "",
    components: fields.get(`spellComponents${index}`) || "",
    concentration: /concentration/i.test(fields.get(`spellDuration${index}`) || ""),
    prepared: fields.get(`spellPrepared${index}`) === "P",
    description: [fields.get(`spellNotes${index}`), fields.get(`spellPage${index}`)].filter(Boolean).join(" · "),
  })), (item) => `${item.name}:${item.level}:${item.source}`);
  return { spells, slots, ability };
}

export function mapDndBeyondPdfFields(entries) {
  const fields = fieldMap(entries);
  const name = fields.get("CharacterName") || fields.get("CharacterName2") || fields.get("CharacterName4");
  if (!name) throw new Error("This PDF does not look like a D&D Beyond character export.");
  const classLevel = fields.get("CLASS  LEVEL") || fields.get("CLASS  LEVEL2") || "";
  const classLevels = [...classLevel.matchAll(/(?:^|[/,])\s*([^/,\d]+?)\s+(\d+)/g)];
  const level = classLevels.reduce((total, match) => total + number(match[2]), 0) || number(classLevel.match(/(\d+)\s*$/)?.[1], 1);
  const stats = {};
  for (const [key, title] of ABILITIES) {
    const upper = key.toUpperCase();
    const score = number(fields.get(upper), 10);
    const modifierKeys = {
      str: ["STRmod"], dex: ["DEXmod", "DEXmod "], con: ["CONmod"],
      int: ["INTmod"], wis: ["WISmod"], cha: ["CHamod", "CHAmod"],
    }[key];
    stats[key] = {
      score,
      modifier: number(modifierKeys.map((field) => fields.get(field)).find(Boolean), modifier(score)),
      save: number(fields.get(`ST ${title}`), modifier(score)),
      skills: [],
    };
  }
  for (const [skillName, ability, field] of SKILLS) {
    stats[ability].skills.push({
      name: skillName,
      modifier: number(fields.get(field), stats[ability].modifier),
      proficiency: Boolean(fields.get(`${field}Prof`)),
    });
  }
  const { spells, slots, ability } = pdfSpells(entries, fields);
  const weapons = [1, 2, 3].map((position, index) => {
    const suffix = position === 1 ? "" : ` ${position}`;
    const nameKey = position === 1 ? "Wpn Name" : `Wpn Name${suffix}`;
    const attackKey = position === 1 ? "Wpn1 AtkBonus" : `Wpn${position} AtkBonus${position === 2 ? " " : "  "}`;
    const damageKey = position === 1 ? "Wpn1 Damage" : `Wpn${position} Damage `;
    const weaponName = fields.get(nameKey);
    if (!weaponName) return null;
    return {
      id: idFor(weaponName, index), name: weaponName, category: "Weapon", action: "Action",
      attack: fields.get(attackKey) ? `${fields.get(attackKey)} vs AC` : "",
      damage: fields.get(damageKey) || "", description: fields.get(`Wpn Notes ${position}`) || "",
    };
  }).filter(Boolean);
  const additionalActions = [fields.get("Actions1"), fields.get("Actions2")].filter(Boolean).join("\n").trim();
  const features = pdfFeatures(fields);
  if (additionalActions) features.unshift({ id: "dnd-beyond-actions", name: "Additional actions", category: "D&D Beyond", description: additionalActions });
  for (const [key, label] of [["PersonalityTraits ", "Personality traits"], ["Ideals", "Ideals"], ["Bonds", "Bonds"], ["Flaws", "Flaws"]]) {
    if (fields.get(key)) features.push({ id: idFor(label, features.length), name: label, category: "Background", description: fields.get(key) });
  }
  const inventoryIndexes = [...fields.keys()].map((key) => /^Eq Name(\d+)$/i.exec(key)?.[1]).filter((value) => value !== undefined).map(number);
  const inventory = inventoryIndexes.map((index) => ({
    id: idFor(fields.get(`Eq Name${index}`), index), name: fields.get(`Eq Name${index}`),
    quantity: number(fields.get(`Eq Qty${index}`), 1), description: fields.get(`Eq Weight${index}`) ? `Weight: ${fields.get(`Eq Weight${index}`)}` : "",
  }));
  const speed = fields.get("Speed") || "";
  const senses = fields.get("AdditionalSenses") || "";
  const maxHP = number(fields.get("MaxHP"), 1);
  const saveDC = number(fields.get("spellSaveDC0"));
  const attackBonus = number(fields.get("spellAtkBonus0"));
  return {
    name, status: "Active", class: classLevels.map((match) => match[1].trim()).join(" / ") || classLevel.replace(/\s+\d+(?:\s*$|\s*[/,])/g, "").trim(),
    subclass: "", race: fields.get("RACE") || fields.get("RACE2") || "", level,
    experience: number(fields.get("EXPERIENCE POINTS")), background: fields.get("BACKGROUND") || fields.get("BACKGROUND2") || "",
    alignment: fields.get("ALIGNMENT") || "", gender: fields.get("GENDER") || "",
    ac: number(fields.get("AC"), 10), hp: { max: maxHP, current: number(fields.get("CurrentHP"), maxHP), temp: number(fields.get("TempHP")) },
    initiative: number(fields.get("Init")), proficiency: number(fields.get("ProfBonus"), 2),
    walk: number(speed.match(/(\d+)\s*ft[^\n]*(?:Walk|Walking)/i)?.[1] || speed.match(/(\d+)\s*ft/i)?.[1], 30),
    fly: number(speed.match(/(\d+)\s*ft[^\n]*Fly/i)?.[1]), passivePerception: number(fields.get("Passive1"), 10),
    darkvision: number(senses.match(/Darkvision\s+(\d+)/i)?.[1]), stats, actions: weapons, resources: [], features, spells,
    spellcasting: {
      enabled: spells.length > 0,
      profiles: spells.length ? [{ id: "dnd-beyond-spellcasting", name: fields.get("spellCastingClass0") || "D&D Beyond", ability, saveDC, attackBonus, preparedLimit: 0 }] : [],
      slots,
    },
    inventory,
    currency: Object.fromEntries(["cp", "sp", "ep", "gp", "pp"].map((coin) => [coin, number(fields.get(coin.toUpperCase()))])),
  };
}

export async function importDndBeyondPdf(file) {
  if (!file || (file.type !== "application/pdf" && !/\.pdf$/i.test(file.name || ""))) {
    throw new Error("Choose a PDF exported by D&D Beyond.");
  }
  if (file.size > 20_000_000) throw new Error("The PDF is too large to import (20 MB maximum).");
  const pdfjs = await import("../../../shared/vendor/pdfjs/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = "/shared/vendor/pdfjs/pdf.worker.min.mjs";
  const loadingTask = pdfjs.getDocument({ data: await file.arrayBuffer() });
  const document = await loadingTask.promise;
  const entries = [];
  try {
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const annotations = await page.getAnnotations();
      for (const annotation of annotations) {
        if (annotation.fieldName) entries.push({ name: annotation.fieldName, value: annotation.fieldValue });
      }
      page.cleanup();
    }
  } finally {
    await loadingTask.destroy();
  }
  return mapDndBeyondPdfFields(entries);
}

export async function importDndBeyondPage(value) {
  const characterId = dndBeyondCharacterId(value);
  if (!characterId) throw new Error("Paste a D&D Beyond character page URL.");
  const response = await fetch(`/api/dnd-beyond/characters/${encodeURIComponent(characterId)}`, { headers: { accept: "application/json" } });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || "D&D Beyond could not share that character. Make the sheet public or use its exported PDF.");
  }
  return mapDndBeyondPayload(await response.json());
}
