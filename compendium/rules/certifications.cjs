// Reviewed Character rule overlays. Raw Aurora macros remain untouched.
const skill = (id, name = id) => ({
  id,
  label: name,
  rules: { stats: [{ name: `${name.toLowerCase()}:proficiency`, value: "proficiency", bonus: "proficiency" }] },
});

const language = (id, name) => ({
  id,
  label: name,
  rules: { languages: [name] },
});

const proficiency = (id, name) => ({
  id,
  label: name,
  rules: { proficiencies: [name] },
});

const ability = (id, name) => ({
  id: `${id}-2`,
  label: `${name} +2`,
  rules: { stats: [{ name: id, value: "2" }] },
});

const abilityPair = (first, second) => ({
  id: `${first[0]}-1-${second[0]}-1`,
  label: `${first[1]} +1, ${second[1]} +1`,
  rules: { stats: [first, second].map(([id]) => ({ name: id, value: "1" })) },
});

const abilities = [
  ["strength", "Strength"], ["dexterity", "Dexterity"], ["constitution", "Constitution"],
  ["intelligence", "Intelligence"], ["wisdom", "Wisdom"], ["charisma", "Charisma"],
];
const abilityNames = Object.fromEntries(abilities);
const standardLanguages = [
  ["common", "Common"], ["dwarvish", "Dwarvish"], ["elvish", "Elvish"],
  ["giant", "Giant"], ["gnomish", "Gnomish"], ["goblin", "Goblin"],
  ["halfling", "Halfling"], ["orc", "Orc"],
].map(([id, name]) => language(id, name));
const exoticLanguages = [
  ["abyssal", "Abyssal"], ["celestial", "Celestial"], ["deep-speech", "Deep Speech"],
  ["draconic", "Draconic"], ["infernal", "Infernal"], ["primordial", "Primordial"],
  ["sylvan", "Sylvan"], ["undercommon", "Undercommon"],
].map(([id, name]) => language(id, name));
const allLanguages = [...standardLanguages, ...exoticLanguages];
const allSkills = [
  ["acrobatics", "Acrobatics"], ["animal-handling", "Animal Handling"], ["arcana", "Arcana"],
  ["athletics", "Athletics"], ["deception", "Deception"], ["history", "History"],
  ["insight", "Insight"], ["intimidation", "Intimidation"], ["investigation", "Investigation"],
  ["medicine", "Medicine"], ["nature", "Nature"], ["perception", "Perception"],
  ["performance", "Performance"], ["persuasion", "Persuasion"], ["religion", "Religion"],
  ["sleight-of-hand", "Sleight of Hand"], ["stealth", "Stealth"], ["survival", "Survival"],
];
const gamingSets = [
  ["dice-set", "Dice Set"], ["dragonchess-set", "Dragonchess Set"],
  ["playing-card-set", "Playing Card Set"], ["three-dragon-ante-set", "Three-Dragon Ante Set"],
].map(([id, name]) => proficiency(id, name));

const backgroundAbilityOptions = (ids) => {
  const selected = ids.map((id) => [id, abilityNames[id]]);
  return [
    ...selected.flatMap(([firstId, firstName]) => selected
      .filter(([secondId]) => secondId !== firstId)
      .map(([secondId, secondName]) => ({
        id: `${firstId}-2-${secondId}-1`,
        label: `${firstName} +2, ${secondName} +1`,
        rules: { stats: [{ name: firstId, value: "2" }, { name: secondId, value: "1" }] },
      }))),
    {
      id: ids.map((id) => `${id}-1`).join("-"),
      label: selected.map(([, name]) => `${name} +1`).join(", "),
      rules: { stats: ids.map((id) => ({ name: id, value: "1" })) },
    },
  ];
};
const asiOptions = () => [
  ...abilities.map(([id, name]) => ability(id, name)),
  ...abilities.flatMap((first, index) => abilities.slice(index + 1).map((second) => abilityPair(first, second))),
  { id: "manual-feat", label: "Other qualifying feat (manual automation)" },
];

const skillSelection = (name, values, number = 2, level = 1) => ({
  type: "Proficiency",
  name,
  number,
  ...(level > 1 ? { level } : {}),
  items: values.map(([id, label]) => skill(id, label)),
});

const asiSelection = (level, items = asiOptions(), name = `Level ${level} Feat or Ability Score Improvement`) => ({
  type: "Feat",
  name,
  level,
  number: 1,
  items,
});

const levelTable = (...ranges) => ({
  type: "table",
  values: Object.fromEntries(ranges.flatMap(([first, last, value]) =>
    Array.from({ length: last - first + 1 }, (_, index) => [first + index, value]))),
});

const saveStats = (first, second) => [first, second].map((name) => ({
  name: `${name}:save:proficiency`,
  value: "proficiency",
  bonus: "proficiency",
}));

const fighterSkills2014 = [
  ["acrobatics", "Acrobatics"], ["animal-handling", "Animal Handling"],
  ["athletics", "Athletics"], ["history", "History"], ["insight", "Insight"],
  ["intimidation", "Intimidation"], ["perception", "Perception"], ["survival", "Survival"],
];
const fighterSkills2024 = [...fighterSkills2014, ["persuasion", "Persuasion"]];
const wizardSkills = [
  ["arcana", "Arcana"], ["history", "History"], ["insight", "Insight"],
  ["investigation", "Investigation"], ["medicine", "Medicine"], ["religion", "Religion"],
];
const clericSkills = [
  ["history", "History"], ["insight", "Insight"], ["medicine", "Medicine"],
  ["persuasion", "Persuasion"], ["religion", "Religion"],
];
const paladinSkills = [
  ["athletics", "Athletics"], ["insight", "Insight"], ["intimidation", "Intimidation"],
  ["medicine", "Medicine"], ["persuasion", "Persuasion"], ["religion", "Religion"],
];
const druidSkills = [
  ["arcana", "Arcana"], ["animal-handling", "Animal Handling"], ["insight", "Insight"],
  ["medicine", "Medicine"], ["nature", "Nature"], ["perception", "Perception"],
  ["religion", "Religion"], ["survival", "Survival"],
];
const rangerSkills = [
  ["animal-handling", "Animal Handling"], ["athletics", "Athletics"], ["insight", "Insight"],
  ["investigation", "Investigation"], ["nature", "Nature"], ["perception", "Perception"],
  ["stealth", "Stealth"], ["survival", "Survival"],
];
const sorcererSkills = [
  ["arcana", "Arcana"], ["deception", "Deception"], ["insight", "Insight"],
  ["intimidation", "Intimidation"], ["persuasion", "Persuasion"], ["religion", "Religion"],
];
const warlockSkills = [
  ["arcana", "Arcana"], ["deception", "Deception"], ["history", "History"],
  ["intimidation", "Intimidation"], ["investigation", "Investigation"], ["nature", "Nature"],
  ["religion", "Religion"],
];
const barbarianSkills = [
  ["animal-handling", "Animal Handling"], ["athletics", "Athletics"],
  ["intimidation", "Intimidation"], ["nature", "Nature"],
  ["perception", "Perception"], ["survival", "Survival"],
];
const monkSkills = [
  ["acrobatics", "Acrobatics"], ["athletics", "Athletics"], ["history", "History"],
  ["insight", "Insight"], ["religion", "Religion"], ["stealth", "Stealth"],
];
const rogueSkills2014 = [
  ["acrobatics", "Acrobatics"], ["athletics", "Athletics"], ["deception", "Deception"],
  ["insight", "Insight"], ["intimidation", "Intimidation"], ["investigation", "Investigation"],
  ["perception", "Perception"], ["performance", "Performance"], ["persuasion", "Persuasion"],
  ["sleight-of-hand", "Sleight of Hand"], ["stealth", "Stealth"],
];
const rogueSkills2024 = rogueSkills2014.filter(([id]) => id !== "performance");
const musicalInstruments = ["Bagpipes", "Drum", "Dulcimer", "Flute", "Lute", "Lyre", "Horn", "Pan Flute", "Shawm", "Viol"]
  .map((name) => proficiency(name.toLowerCase().replaceAll(" ", "-"), name));
const artisanTools = [
  "Alchemist's Supplies", "Brewer's Supplies", "Calligrapher's Supplies", "Carpenter's Tools",
  "Cartographer's Tools", "Cobbler's Tools", "Cook's Utensils", "Glassblower's Tools",
  "Jeweler's Tools", "Leatherworker's Tools", "Mason's Tools", "Painter's Supplies",
  "Potter's Tools", "Smith's Tools", "Tinker's Tools", "Weaver's Tools", "Woodcarver's Tools",
].map((name) => proficiency(name.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-"), name));
const monkTools = [...artisanTools, ...musicalInstruments];

const fightingStyles = [
  ["archery", "Archery", "+2 to attack rolls with ranged weapons."],
  ["defense", "Defense", "+1 AC while wearing armor."],
  ["dueling", "Dueling", "+2 damage with one one-handed melee weapon and no other weapon."],
  ["great-weapon-fighting", "Great Weapon Fighting", "Apply the style's damage-die rule to eligible two-handed attacks."],
  ["protection", "Protection", "Use your Reaction with a shield to protect a nearby creature."],
  ["two-weapon-fighting", "Two-Weapon Fighting", "Add the ability modifier to the extra attack's damage."],
].map(([id, label, description]) => ({
  id,
  label,
  rules: {
    features: [{ id: `fighting-style-${id}`, name: `Fighting Style: ${label}`, description }],
    ...(id === "archery" ? { weaponModifiers: [{ attack: 2, attackType: "ranged", label: "Archery" }] } : {}),
    ...(id === "defense" ? { stats: [{ name: "ac:misc", value: "1", equipped: "armor" }] } : {}),
    ...(id === "dueling" ? { weaponModifiers: [{ damage: 2, oneHanded: true, requiresNoOtherWeapon: true, label: "Dueling" }] } : {}),
    ...(id === "great-weapon-fighting" ? { weaponModifiers: [{ propertiesAny: ["two-handed", "versatile"], damageReroll: [1, 2], label: "Great Weapon Fighting" }] } : {}),
    ...(id === "two-weapon-fighting" ? { weaponModifiers: [{ property: "light", offhandAbilityDamage: true, label: "Two-Weapon Fighting" }] } : {}),
    ...(id === "protection" ? { actions: [{ id: "protection", name: "Protection", action: "Reaction", description }] } : {}),
  },
}));

const fightingStyles2024 = [
  ...fightingStyles.map((style) => style.id === "great-weapon-fighting" ? {
    ...style,
    rules: { ...style.rules, weaponModifiers: [{ propertiesAny: ["two-handed", "versatile"], damageDieMinimum: 3, label: "Great Weapon Fighting" }] },
  } : style),
  ...[
    ["blind-fighting", "Blind Fighting"], ["interception", "Interception"],
    ["thrown-weapon-fighting", "Thrown Weapon Fighting"], ["unarmed-fighting", "Unarmed Fighting"],
  ].map(([id, label]) => ({ id, label, rules: { features: [{ id: `fighting-style-${id}`, name: `Fighting Style: ${label}` }] } })),
];

const masteryItems = [
  ["BATTLEAXE_TOPPLE", "Battleaxe (Topple)"], ["BLOWGUN_VEX", "Blowgun (Vex)"],
  ["CLUB_SLOW", "Club (Slow)"], ["DAGGER_NICK", "Dagger (Nick)"], ["DART_VEX", "Dart (Vex)"],
  ["FLAIL_SAP", "Flail (Sap)"], ["GLAIVE_GRAZE", "Glaive (Graze)"], ["GREATAXE_CLEAVE", "Greataxe (Cleave)"],
  ["GREATCLUB_PUSH", "Greatclub (Push)"], ["GREATSWORD_GRAZE", "Greatsword (Graze)"],
  ["HALBERD_CLEAVE", "Halberd (Cleave)"], ["CROSSBOW_HAND_VEX", "Hand Crossbow (Vex)"],
  ["HANDAXE_VEX", "Handaxe (Vex)"], ["CROSSBOW_HEAVY_PUSH", "Heavy Crossbow (Push)"],
  ["JAVELIN_SLOW", "Javelin (Slow)"], ["LANCE_TOPPLE", "Lance (Topple)"],
  ["CROSSBOW_LIGHT_SLOW", "Light Crossbow (Slow)"], ["LIGHT_HAMMER_NICK", "Light Hammer (Nick)"],
  ["LONGBOW_SLOW", "Longbow (Slow)"], ["LONGSWORD_SAP", "Longsword (Sap)"], ["MACE_SAP", "Mace (Sap)"],
  ["MAUL_TOPPLE", "Maul (Topple)"], ["MORNINGSTAR_SAP", "Morningstar (Sap)"], ["MUSKET_SLOW", "Musket (Slow)"],
  ["PIKE_PUSH", "Pike (Push)"], ["PISTOL_VEX", "Pistol (Vex)"], ["QUARTERSTAFF_TOPPLE", "Quarterstaff (Topple)"],
  ["RAPIER_VEX", "Rapier (Vex)"], ["SCIMITAR_NICK", "Scimitar (Nick)"], ["SHORTBOW_VEX", "Shortbow (Vex)"],
  ["SHORTSWORD_VEX", "Shortsword (Vex)"], ["SICKLE_NICK", "Sickle (Nick)"], ["SLING_SLOW", "Sling (Slow)"],
  ["SPEAR_SAP", "Spear (Sap)"], ["TRIDENT_TOPPLE", "Trident (Topple)"], ["WAR_PICK_SAP", "War Pick (Sap)"],
  ["WARHAMMER_PUSH", "Warhammer (Push)"], ["WHIP_SLOW", "Whip (Slow)"],
].map(([id, label]) => ({ id: `ID_WOTC_PHB24_CLASS_FEATURE_MASTERY_PROPERTY_${id}`, label }));

const fighterFeatures2014 = [
  ["fighting-style", "Fighting Style", 1], ["second-wind", "Second Wind", 1],
  ["action-surge", "Action Surge", 2], ["martial-archetype", "Martial Archetype", 3],
  ["ability-score-improvement-4", "Ability Score Improvement", 4], ["extra-attack", "Extra Attack", 5],
  ["ability-score-improvement-6", "Ability Score Improvement", 6],
  ["ability-score-improvement-8", "Ability Score Improvement", 8], ["indomitable", "Indomitable", 9],
  ["extra-attack-2", "Extra Attack (2)", 11], ["ability-score-improvement-12", "Ability Score Improvement", 12],
  ["indomitable-2", "Indomitable (2 uses)", 13], ["ability-score-improvement-14", "Ability Score Improvement", 14],
  ["ability-score-improvement-16", "Ability Score Improvement", 16], ["action-surge-2", "Action Surge (2 uses)", 17],
  ["indomitable-3", "Indomitable (3 uses)", 17], ["ability-score-improvement-19", "Ability Score Improvement", 19],
  ["extra-attack-3", "Extra Attack (3)", 20],
].map(([id, name, level]) => ({ id, name, level }));

const fighterFeatures2024 = [
  ["fighting-style", "Fighting Style", 1], ["second-wind", "Second Wind", 1],
  ["weapon-mastery", "Weapon Mastery", 1], ["action-surge", "Action Surge", 2],
  ["tactical-mind", "Tactical Mind", 2], ["fighter-subclass", "Fighter Subclass", 3],
  ["ability-score-improvement-4", "Ability Score Improvement", 4], ["extra-attack", "Extra Attack", 5],
  ["tactical-shift", "Tactical Shift", 5],
  ["ability-score-improvement-6", "Ability Score Improvement", 6],
  ["ability-score-improvement-8", "Ability Score Improvement", 8], ["indomitable", "Indomitable", 9],
  ["tactical-master", "Tactical Master", 9], ["extra-attack-2", "Extra Attack (2)", 11],
  ["ability-score-improvement-12", "Ability Score Improvement", 12], ["indomitable-2", "Indomitable (2 uses)", 13],
  ["studied-attacks", "Studied Attacks", 13], ["ability-score-improvement-14", "Ability Score Improvement", 14],
  ["ability-score-improvement-16", "Ability Score Improvement", 16], ["action-surge-2", "Action Surge (2 uses)", 17],
  ["indomitable-3", "Indomitable (3 uses)", 17], ["unconquerable", "Unconquerable", 17],
  ["epic-boon", "Epic Boon", 19], ["extra-attack-3", "Extra Attack (3)", 20],
].map(([id, name, level]) => ({ id, name, level }));

const fighterActions = [
  { id: "second-wind", name: "Second Wind", action: "Bonus Action", resourceId: "second-wind", healing: "1d10 + Fighter level" },
  { id: "action-surge", name: "Action Surge", level: 2, action: "Other", resourceId: "action-surge" },
];

const wizardProfile = (ruleset) => ({
  id: "wizard",
  name: "Wizard",
  ability: "intelligence",
  spellList: "Wizard",
  progression: "full",
  repertoire: "spellbook",
  ritual: "spellbook",
  cantripScaling: "character",
  prepared: ruleset === "5e"
    ? { type: "ability-plus-level", minimum: 1 }
    : { type: "table", values: {
      1: 4, 2: 5, 3: 6, 4: 7, 5: 9, 6: 10, 7: 11, 8: 12, 9: 14, 10: 15,
      11: 16, 12: 16, 13: 17, 14: 18, 15: 19, 16: 21, 17: 22, 18: 23, 19: 24, 20: 25,
    } },
  cantrips: levelTable([1, 3, 3], [4, 9, 4], [10, 20, 5]),
  spellbook: { type: "table", values: Object.fromEntries(Array.from({ length: 20 }, (_, index) => [index + 1, 6 + (index * 2)])) },
  recovery: { id: "arcane-recovery", budget: "half-level-up", maxSlotLevel: 5 },
});

const fighterBase = (ruleset) => ({
  certification: { ruleset, levels: [1, 20], verified: "2026-09-15" },
  requirements: "",
  prerequisite: "",
  setters: { hd: "d10" },
  rules: {
    grants: [],
    stats: saveStats("strength", "constitution"),
    proficiencies: ["Light Armor", "Medium Armor", "Heavy Armor", "Shields", "Simple Weapons", "Martial Weapons"],
    subclassLevel: 3,
    selections: [
      skillSelection("Skill Proficiency (Fighter)", ruleset === "5e" ? fighterSkills2014 : fighterSkills2024),
      { type: "Fighting Style", name: "Fighting Style", number: 1, items: ruleset === "5e" ? fightingStyles : fightingStyles2024 },
      ...(ruleset === "5.5e" ? [{
        type: "Weapon Mastery",
        name: "Weapon Mastery",
        number: levelTable([1, 3, 3], [4, 9, 4], [10, 15, 5], [16, 20, 6]),
        items: masteryItems,
      }] : []),
      ...([4, 6, 8, 12, 14, 16].map((level) => asiSelection(level))),
      asiSelection(19, asiOptions(), ruleset === "5.5e" ? "Level 19 Epic Boon" : "Level 19 Feat or Ability Score Improvement"),
    ],
    features: ruleset === "5e" ? fighterFeatures2014 : fighterFeatures2024,
    resources: ruleset === "5e" ? [
      { id: "second-wind", name: "Second Wind", max: 1, reset: "short", action: "Bonus Action" },
      { id: "action-surge", name: "Action Surge", level: 2, max: levelTable([1, 16, 1], [17, 20, 2]), reset: "short" },
      { id: "indomitable", name: "Indomitable", level: 9, max: levelTable([1, 12, 1], [13, 16, 2], [17, 20, 3]), reset: "long" },
    ] : [
      { id: "second-wind", name: "Second Wind", max: levelTable([1, 3, 2], [4, 9, 3], [10, 20, 4]), reset: "long", recovery: { short: 1, long: "all" }, action: "Bonus Action" },
      { id: "action-surge", name: "Action Surge", level: 2, max: levelTable([1, 16, 1], [17, 20, 2]), reset: "short" },
      { id: "indomitable", name: "Indomitable", level: 9, max: levelTable([1, 12, 1], [13, 16, 2], [17, 20, 3]), reset: "long" },
    ],
    actions: ruleset === "5e" ? fighterActions : [...fighterActions, {
      id: "tactical-mind",
      name: "Tactical Mind",
      level: 2,
      action: "Reaction",
      resourceId: "second-wind",
      description: "After a failed ability check, add 1d10; refund the use if the check still fails.",
    }],
    combat: { attacksPerAction: levelTable([1, 4, 1], [5, 10, 2], [11, 19, 3], [20, 20, 4]) },
  },
});

const wizardBase = (ruleset) => ({
  certification: { ruleset, levels: [1, 20], verified: "2026-09-15" },
  requirements: "",
  prerequisite: "",
  setters: { hd: "d6" },
  rules: {
    grants: [],
    stats: saveStats("intelligence", "wisdom"),
    proficiencies: ruleset === "5e" ? ["Daggers", "Darts", "Slings", "Quarterstaffs", "Light Crossbows"] : ["Simple Weapons"],
    subclassLevel: ruleset === "5e" ? 2 : 3,
    selections: [
      skillSelection("Skill Proficiency (Wizard)", wizardSkills),
      ...(ruleset === "5.5e" ? [{
        type: "Expertise",
        name: "Scholar Expertise",
        level: 2,
        number: 1,
        items: ["arcana", "history", "investigation", "medicine", "nature", "religion"].map((id) => ({
          id: `${id}-expertise`,
          label: id[0].toUpperCase() + id.slice(1),
          rules: { stats: [{ name: `${id}:proficiency`, value: "proficiency", bonus: "double" }] },
        })),
      }] : []),
      ...([4, 8, 12, 16].map((level) => asiSelection(level))),
      asiSelection(19, asiOptions(), ruleset === "5.5e" ? "Level 19 Epic Boon" : "Level 19 Feat or Ability Score Improvement"),
    ],
    spellcasting: wizardProfile(ruleset),
    features: (ruleset === "5e" ? [
      ["spellcasting", "Spellcasting", 1], ["arcane-recovery", "Arcane Recovery", 1],
      ["arcane-tradition", "Arcane Tradition", 2], ["ability-score-improvement-4", "Ability Score Improvement", 4],
      ["ability-score-improvement-8", "Ability Score Improvement", 8], ["ability-score-improvement-12", "Ability Score Improvement", 12],
      ["ability-score-improvement-16", "Ability Score Improvement", 16], ["spell-mastery", "Spell Mastery", 18],
      ["ability-score-improvement-19", "Ability Score Improvement", 19], ["signature-spells", "Signature Spells", 20],
    ] : [
      ["spellcasting", "Spellcasting", 1], ["ritual-adept", "Ritual Adept", 1],
      ["arcane-recovery", "Arcane Recovery", 1], ["scholar", "Scholar", 2],
      ["wizard-subclass", "Wizard Subclass", 3], ["ability-score-improvement-4", "Ability Score Improvement", 4],
      ["memorize-spell", "Memorize Spell", 5],
      ["ability-score-improvement-8", "Ability Score Improvement", 8], ["ability-score-improvement-12", "Ability Score Improvement", 12],
      ["ability-score-improvement-16", "Ability Score Improvement", 16], ["spell-mastery", "Spell Mastery", 18],
      ["epic-boon", "Epic Boon", 19], ["signature-spells", "Signature Spells", 20],
    ]).map(([id, name, level]) => ({ id, name, level })),
    resources: [{ id: "arcane-recovery", name: "Arcane Recovery", max: 1, reset: "long" }],
  },
});

const clericProfile = (ruleset) => ({
  id: "cleric",
  name: "Cleric",
  ability: "wisdom",
  spellList: "Cleric",
  progression: "full",
  repertoire: "prepared",
  ritual: "prepared",
  cantripScaling: "character",
  prepared: ruleset === "5e"
    ? { type: "ability-plus-level", minimum: 1 }
    : { type: "table", values: {
      1: 4, 2: 5, 3: 6, 4: 7, 5: 9, 6: 10, 7: 11, 8: 12, 9: 14, 10: 15,
      11: 16, 12: 16, 13: 17, 14: 17, 15: 18, 16: 18, 17: 19, 18: 20, 19: 21, 20: 22,
    } },
  cantrips: levelTable([1, 3, 3], [4, 9, 4], [10, 20, 5]),
});

const paladinProfile = (ruleset) => ({
  id: "paladin",
  name: "Paladin",
  ability: "charisma",
  spellList: "Paladin",
  progression: "half-up",
  ...(ruleset === "5e" ? { minimumLevel: 2, multiclassProgression: "half-down" } : {}),
  repertoire: "prepared",
  ritual: ruleset === "5e" ? "none" : "prepared",
  cantripScaling: "character",
  prepared: ruleset === "5e"
    ? { type: "ability-plus-half-level-down", minimum: 1 }
    : { type: "table", values: {
      1: 2, 2: 3, 3: 4, 4: 5, 5: 6, 6: 6, 7: 7, 8: 7, 9: 9, 10: 9,
      11: 10, 12: 10, 13: 11, 14: 11, 15: 12, 16: 12, 17: 14, 18: 14, 19: 15, 20: 15,
    } },
});

const clericFeatures2014 = [
  ["spellcasting", "Spellcasting", 1], ["divine-domain", "Divine Domain", 1],
  ["channel-divinity", "Channel Divinity", 2], ["turn-undead", "Turn Undead", 2],
  ["ability-score-improvement-4", "Ability Score Improvement", 4], ["destroy-undead-half", "Destroy Undead (CR 1/2)", 5],
  ["channel-divinity-2", "Channel Divinity (2 uses)", 6], ["ability-score-improvement-8", "Ability Score Improvement", 8],
  ["destroy-undead-1", "Destroy Undead (CR 1)", 8], ["divine-intervention", "Divine Intervention", 10],
  ["destroy-undead-2", "Destroy Undead (CR 2)", 11], ["ability-score-improvement-12", "Ability Score Improvement", 12],
  ["destroy-undead-3", "Destroy Undead (CR 3)", 14], ["ability-score-improvement-16", "Ability Score Improvement", 16],
  ["destroy-undead-4", "Destroy Undead (CR 4)", 17], ["channel-divinity-3", "Channel Divinity (3 uses)", 18],
  ["ability-score-improvement-19", "Ability Score Improvement", 19], ["divine-intervention-improvement", "Divine Intervention Improvement", 20],
].map(([id, name, level]) => ({ id, name, level }));

const clericFeatures2024 = [
  ["spellcasting", "Spellcasting", 1], ["divine-order", "Divine Order", 1],
  ["channel-divinity", "Channel Divinity", 2], ["cleric-subclass", "Cleric Subclass", 3],
  ["ability-score-improvement-4", "Ability Score Improvement", 4], ["sear-undead", "Sear Undead", 5],
  ["blessed-strikes", "Blessed Strikes", 7], ["ability-score-improvement-8", "Ability Score Improvement", 8],
  ["divine-intervention", "Divine Intervention", 10], ["ability-score-improvement-12", "Ability Score Improvement", 12],
  ["improved-blessed-strikes", "Improved Blessed Strikes", 14], ["ability-score-improvement-16", "Ability Score Improvement", 16],
  ["epic-boon", "Epic Boon", 19], ["greater-divine-intervention", "Greater Divine Intervention", 20],
].map(([id, name, level]) => ({ id, name, level }));

const clericBase = (ruleset) => ({
  certification: { ruleset, levels: [1, 20], verified: "2026-09-15" },
  requirements: "",
  prerequisite: "",
  setters: { hd: "d8" },
  rules: {
    grants: [],
    stats: saveStats("wisdom", "charisma"),
    proficiencies: ["Light Armor", "Medium Armor", "Shields", "Simple Weapons"],
    subclassLevel: ruleset === "5e" ? 1 : 3,
    selections: [
      skillSelection("Skill Proficiency (Cleric)", clericSkills),
      ...(ruleset === "5.5e" ? [{
        type: "Divine Order", name: "Divine Order", number: 1, items: [
          { id: "protector", label: "Protector", rules: { proficiencies: ["Heavy Armor", "Martial Weapons"], features: [{ id: "divine-order-protector", name: "Divine Order: Protector" }] } },
          { id: "thaumaturge", label: "Thaumaturge", rules: { features: [{ id: "divine-order-thaumaturge", name: "Divine Order: Thaumaturge" }], warnings: [{ code: "manual-automation", path: "build.spells", message: "Thaumaturge's additional Cleric cantrip remains a manual selection." }] } },
        ],
      }, {
        type: "Blessed Strikes", name: "Blessed Strikes", level: 7, number: 1, items: [
          { id: "divine-strike", label: "Divine Strike", rules: { features: [{ id: "blessed-strikes-divine-strike", name: "Blessed Strikes: Divine Strike", level: 7 }] } },
          { id: "potent-spellcasting", label: "Potent Spellcasting", rules: { features: [{ id: "blessed-strikes-potent-spellcasting", name: "Blessed Strikes: Potent Spellcasting", level: 7 }] } },
        ],
      }] : []),
      ...([4, 8, 12, 16].map((level) => asiSelection(level))),
      asiSelection(19, asiOptions(), ruleset === "5.5e" ? "Level 19 Epic Boon" : "Level 19 Feat or Ability Score Improvement"),
    ],
    spellcasting: clericProfile(ruleset),
    features: ruleset === "5e" ? clericFeatures2014 : clericFeatures2024,
    resources: [{
      id: "channel-divinity", name: "Channel Divinity", level: 2,
      max: ruleset === "5e" ? levelTable([1, 5, 1], [6, 17, 2], [18, 20, 3]) : levelTable([1, 5, 2], [6, 17, 3], [18, 20, 4]),
      reset: ruleset === "5e" ? "short" : "long",
      ...(ruleset === "5.5e" ? { recovery: { short: 1, long: "all" } } : {}),
    }],
    actions: ruleset === "5e" ? [
      { id: "turn-undead", name: "Turn Undead", level: 2, action: "Action", resourceId: "channel-divinity" },
    ] : [
      { id: "divine-spark", name: "Divine Spark", level: 2, action: "Action", resourceId: "channel-divinity", range: "30 feet", healing: "1d8 + Wisdom modifier" },
      { id: "turn-undead", name: "Turn Undead", level: 2, action: "Action", resourceId: "channel-divinity" },
    ],
  },
});

const paladinFeatures2014 = [
  ["divine-sense", "Divine Sense", 1], ["lay-on-hands", "Lay on Hands", 1],
  ["fighting-style", "Fighting Style", 2], ["spellcasting", "Spellcasting", 2], ["divine-smite", "Divine Smite", 2],
  ["divine-health", "Divine Health", 3], ["sacred-oath", "Sacred Oath", 3],
  ["ability-score-improvement-4", "Ability Score Improvement", 4], ["extra-attack", "Extra Attack", 5],
  ["aura-of-protection", "Aura of Protection", 6], ["ability-score-improvement-8", "Ability Score Improvement", 8],
  ["aura-of-courage", "Aura of Courage", 10], ["improved-divine-smite", "Improved Divine Smite", 11],
  ["ability-score-improvement-12", "Ability Score Improvement", 12], ["cleansing-touch", "Cleansing Touch", 14],
  ["ability-score-improvement-16", "Ability Score Improvement", 16], ["aura-improvements", "Aura Improvements", 18],
  ["ability-score-improvement-19", "Ability Score Improvement", 19],
].map(([id, name, level]) => ({ id, name, level }));

const paladinFeatures2024 = [
  ["lay-on-hands", "Lay On Hands", 1], ["spellcasting", "Spellcasting", 1], ["weapon-mastery", "Weapon Mastery", 1],
  ["fighting-style", "Fighting Style", 2], ["paladins-smite", "Paladin's Smite", 2],
  ["channel-divinity", "Channel Divinity", 3], ["paladin-subclass", "Paladin Subclass", 3],
  ["ability-score-improvement-4", "Ability Score Improvement", 4], ["extra-attack", "Extra Attack", 5],
  ["faithful-steed", "Faithful Steed", 5], ["aura-of-protection", "Aura of Protection", 6],
  ["ability-score-improvement-8", "Ability Score Improvement", 8], ["abjure-foes", "Abjure Foes", 9],
  ["aura-of-courage", "Aura of Courage", 10], ["radiant-strikes", "Radiant Strikes", 11],
  ["ability-score-improvement-12", "Ability Score Improvement", 12], ["restoring-touch", "Restoring Touch", 14],
  ["ability-score-improvement-16", "Ability Score Improvement", 16], ["aura-expansion", "Aura Expansion", 18],
  ["epic-boon", "Epic Boon", 19],
].map(([id, name, level]) => ({ id, name, level }));

const paladinBase = (ruleset) => ({
  certification: { ruleset, levels: [1, 20], verified: "2026-09-15" },
  requirements: "",
  prerequisite: "",
  setters: { hd: "d10" },
  rules: {
    grants: [],
    stats: saveStats("wisdom", "charisma"),
    proficiencies: ["Light Armor", "Medium Armor", "Heavy Armor", "Shields", "Simple Weapons", "Martial Weapons"],
    subclassLevel: 3,
    selections: [
      skillSelection("Skill Proficiency (Paladin)", paladinSkills),
      ...(ruleset === "5.5e" ? [{ type: "Weapon Mastery", name: "Weapon Mastery", number: 2, items: masteryItems }] : []),
      { type: "Fighting Style", name: "Fighting Style", level: 2, number: 1, items: ruleset === "5e" ? fightingStyles.filter(({ id }) => id !== "archery") : fightingStyles2024 },
      ...([4, 8, 12, 16].map((level) => asiSelection(level))),
      asiSelection(19, asiOptions(), ruleset === "5.5e" ? "Level 19 Epic Boon" : "Level 19 Feat or Ability Score Improvement"),
    ],
    spellcasting: paladinProfile(ruleset),
    features: ruleset === "5e" ? paladinFeatures2014 : paladinFeatures2024,
    resources: [
      { id: "lay-on-hands", name: "Lay On Hands", max: { type: "table", values: Object.fromEntries(Array.from({ length: 20 }, (_, index) => [index + 1, (index + 1) * 5])) }, reset: "long", action: ruleset === "5e" ? "Action" : "Bonus Action" },
      { id: "channel-divinity", name: "Channel Divinity", level: 3, max: ruleset === "5e" ? 1 : levelTable([1, 10, 2], [11, 20, 3]), reset: ruleset === "5e" ? "short" : "long", ...(ruleset === "5.5e" ? { recovery: { short: 1, long: "all" } } : {}) },
    ],
    actions: [
      { id: "lay-on-hands", name: "Lay On Hands", action: ruleset === "5e" ? "Action" : "Bonus Action", resourceId: "lay-on-hands", healing: "Up to remaining pool" },
      ...(ruleset === "5.5e" ? [{ id: "divine-sense", name: "Divine Sense", level: 3, action: "Bonus Action", resourceId: "channel-divinity", range: "60 feet" }] : []),
    ],
    combat: { attacksPerAction: levelTable([1, 4, 1], [5, 20, 2]) },
  },
});

const bardProfile = (ruleset) => ({
  id: "bard",
  name: "Bard",
  ability: "charisma",
  spellList: "Bard",
  progression: "full",
  repertoire: ruleset === "5e" ? "known" : "prepared",
  ritual: ruleset === "5e" ? "known" : "prepared",
  cantripScaling: "character",
  cantrips: levelTable([1, 3, 2], [4, 9, 3], [10, 20, 4]),
  ...(ruleset === "5e" ? {
    known: { type: "table", values: {
      1: 4, 2: 5, 3: 6, 4: 7, 5: 8, 6: 9, 7: 10, 8: 11, 9: 12, 10: 14,
      11: 15, 12: 15, 13: 16, 14: 18, 15: 19, 16: 19, 17: 20, 18: 22, 19: 22, 20: 22,
    } },
    prepared: 0,
  } : {
    prepared: { type: "table", values: {
      1: 4, 2: 5, 3: 6, 4: 7, 5: 9, 6: 10, 7: 11, 8: 12, 9: 14, 10: 15,
      11: 16, 12: 16, 13: 17, 14: 17, 15: 18, 16: 18, 17: 19, 18: 20, 19: 21, 20: 22,
    } },
  }),
});

const sorcererProfile = (ruleset) => ({
  id: "sorcerer",
  name: "Sorcerer",
  ability: "charisma",
  spellList: "Sorcerer",
  progression: "full",
  repertoire: ruleset === "5e" ? "known" : "prepared",
  ritual: "none",
  cantripScaling: "character",
  cantrips: ruleset === "5e" ? levelTable([1, 3, 4], [4, 9, 5], [10, 20, 6])
    : levelTable([1, 3, 4], [4, 9, 5], [10, 20, 6]),
  ...(ruleset === "5e" ? {
    known: { type: "table", values: {
      1: 2, 2: 3, 3: 4, 4: 5, 5: 6, 6: 7, 7: 8, 8: 9, 9: 10, 10: 11,
      11: 12, 12: 12, 13: 13, 14: 13, 15: 14, 16: 14, 17: 15, 18: 15, 19: 15, 20: 15,
    } },
    prepared: 0,
  } : {
    prepared: { type: "table", values: {
      1: 2, 2: 4, 3: 6, 4: 7, 5: 9, 6: 10, 7: 11, 8: 12, 9: 14, 10: 15,
      11: 16, 12: 16, 13: 17, 14: 17, 15: 18, 16: 18, 17: 19, 18: 20, 19: 21, 20: 22,
    } },
  }),
});

const expertiseItems = allSkills.map(([id, name]) => ({
  id: `${id}-expertise`,
  label: name,
  rules: { stats: [{ name: `${name.toLowerCase()}:proficiency`, value: "proficiency", bonus: "double" }] },
}));

const metamagicItems = [
  "Careful Spell", "Distant Spell", "Empowered Spell", "Extended Spell", "Heightened Spell",
  "Quickened Spell", "Seeking Spell", "Subtle Spell", "Transmuted Spell", "Twinned Spell",
].map((name) => ({
  id: name.toLowerCase().replaceAll(" ", "-"),
  label: name,
  rules: { features: [{ id: `metamagic-${name.toLowerCase().replaceAll(" ", "-")}`, name: `Metamagic: ${name}` }] },
}));
const metamagicOptions = (ruleset) => ruleset === "5e"
  ? metamagicItems.filter(({ id }) => !["seeking-spell", "transmuted-spell"].includes(id))
  : metamagicItems;

const manualFeatureChoice = (id, label, { minimumLevel = 1, requiresOptions = [] } = {}) => ({
  id,
  label,
  automation: "manual",
  ...(minimumLevel > 1 ? { minimumLevel } : {}),
  ...(requiresOptions.length ? { requiresOptions } : {}),
  rules: { features: [{ id: `choice-${id}`, name: label }] },
});

const pactInvocationChoices = [
  manualFeatureChoice("pact-of-blade", "Pact of the Blade"),
  manualFeatureChoice("pact-of-chain", "Pact of the Chain"),
  manualFeatureChoice("pact-of-tome", "Pact of the Tome"),
];

const invocationChoices2014 = [
  ["agonizing-blast", "Agonizing Blast"], ["armor-of-shadows", "Armor of Shadows"],
  ["ascendant-step", "Ascendant Step", 9],
  ["beast-speech", "Beast Speech"], ["beguiling-influence", "Beguiling Influence"],
  ["bewitching-whispers", "Bewitching Whispers", 7],
  ["book-of-ancient-secrets", "Book of Ancient Secrets", 2, ["pact-of-tome"]],
  ["chains-of-carceri", "Chains of Carceri", 15, ["pact-of-chain"]],
  ["devils-sight", "Devil's Sight"], ["dreadful-word", "Dreadful Word", 7],
  ["eldritch-sight", "Eldritch Sight"], ["eldritch-spear", "Eldritch Spear"],
  ["eyes-of-the-rune-keeper", "Eyes of the Rune Keeper"], ["fiendish-vigor", "Fiendish Vigor"],
  ["gaze-of-two-minds", "Gaze of Two Minds"], ["lifedrinker", "Lifedrinker", 12, ["pact-of-blade"]],
  ["mask-of-many-faces", "Mask of Many Faces"], ["master-of-myriad-forms", "Master of Myriad Forms", 15],
  ["minions-of-chaos", "Minions of Chaos", 9], ["mire-the-mind", "Mire the Mind", 5],
  ["misty-visions", "Misty Visions"], ["one-with-shadows", "One with Shadows", 5],
  ["otherworldly-leap", "Otherworldly Leap", 9], ["repelling-blast", "Repelling Blast"],
  ["sculptor-of-flesh", "Sculptor of Flesh", 7], ["sign-of-ill-omen", "Sign of Ill Omen", 5],
  ["thief-of-five-fates", "Thief of Five Fates"], ["thirsting-blade", "Thirsting Blade", 5, ["pact-of-blade"]],
  ["visions-of-distant-realms", "Visions of Distant Realms", 15],
  ["voice-of-the-chain-master", "Voice of the Chain Master", 2, ["pact-of-chain"]],
  ["whispers-of-the-grave", "Whispers of the Grave", 9], ["witch-sight", "Witch Sight", 15],
].map(([id, label, minimumLevel, requiresOptions]) => manualFeatureChoice(id, label, { minimumLevel, requiresOptions }));

const invocationChoices2024 = [
  ["agonizing-blast", "Agonizing Blast", 2], ["armor-of-shadows", "Armor of Shadows"],
  ["ascendant-step", "Ascendant Step", 5], ["devils-sight", "Devil's Sight", 2],
  ["devouring-blade", "Devouring Blade", 12, ["thirsting-blade"]], ["eldritch-mind", "Eldritch Mind"],
  ["eldritch-smite", "Eldritch Smite", 5, ["pact-of-blade"]], ["eldritch-spear", "Eldritch Spear", 2],
  ["fiendish-vigor", "Fiendish Vigor", 2], ["gaze-of-two-minds", "Gaze of Two Minds", 5],
  ["gift-of-the-depths", "Gift of the Depths", 5], ["gift-of-the-protectors", "Gift of the Protectors", 9, ["pact-of-tome"]],
  ["investment-of-the-chain-master", "Investment of the Chain Master", 5, ["pact-of-chain"]],
  ["lessons-of-the-first-ones", "Lessons of the First Ones", 2], ["lifedrinker", "Lifedrinker", 9, ["pact-of-blade"]],
  ["mask-of-many-faces", "Mask of Many Faces", 2], ["master-of-myriad-forms", "Master of Myriad Forms", 5],
  ["misty-visions", "Misty Visions", 2], ["one-with-shadows", "One with Shadows", 5],
  ["otherworldly-leap", "Otherworldly Leap", 2], ...pactInvocationChoices,
  ["repelling-blast", "Repelling Blast", 2], ["thirsting-blade", "Thirsting Blade", 5, ["pact-of-blade"]],
  ["visions-of-distant-realms", "Visions of Distant Realms", 9], ["whispers-of-the-grave", "Whispers of the Grave", 7],
  ["witch-sight", "Witch Sight", 15],
].map((item) => typeof item?.id === "string"
  ? item
  : manualFeatureChoice(item[0], item[1], { minimumLevel: item[2], requiresOptions: item[3] }));

const bardFeatures2014 = [
  ["spellcasting", "Spellcasting", 1], ["bardic-inspiration", "Bardic Inspiration (d6)", 1],
  ["jack-of-all-trades", "Jack of All Trades", 2], ["song-of-rest-d6", "Song of Rest (d6)", 2],
  ["bard-college", "Bard College", 3], ["expertise", "Expertise", 3],
  ["ability-score-improvement-4", "Ability Score Improvement", 4], ["font-of-inspiration", "Font of Inspiration", 5],
  ["bardic-inspiration-d8", "Bardic Inspiration (d8)", 5],
  ["countercharm", "Countercharm", 6], ["ability-score-improvement-8", "Ability Score Improvement", 8],
  ["song-of-rest-d8", "Song of Rest (d8)", 9], ["bardic-inspiration-d10", "Bardic Inspiration (d10)", 10],
  ["expertise-10", "Expertise", 10], ["magical-secrets-10", "Magical Secrets", 10],
  ["ability-score-improvement-12", "Ability Score Improvement", 12], ["song-of-rest-d10", "Song of Rest (d10)", 13],
  ["magical-secrets-14", "Magical Secrets", 14], ["bardic-inspiration-d12", "Bardic Inspiration (d12)", 15],
  ["ability-score-improvement-16", "Ability Score Improvement", 16], ["song-of-rest-d12", "Song of Rest (d12)", 17],
  ["magical-secrets-18", "Magical Secrets", 18], ["ability-score-improvement-19", "Ability Score Improvement", 19],
  ["superior-inspiration", "Superior Inspiration", 20],
].map(([id, name, level]) => ({ id, name, level }));

const bardFeatures2024 = [
  ["spellcasting", "Spellcasting", 1], ["bardic-inspiration", "Bardic Inspiration", 1],
  ["expertise", "Expertise", 2], ["jack-of-all-trades", "Jack of All Trades", 2],
  ["bard-subclass", "Bard Subclass", 3], ["ability-score-improvement-4", "Ability Score Improvement", 4],
  ["font-of-inspiration", "Font of Inspiration", 5], ["countercharm", "Countercharm", 7],
  ["ability-score-improvement-8", "Ability Score Improvement", 8], ["expertise-9", "Expertise", 9],
  ["magical-secrets", "Magical Secrets", 10], ["ability-score-improvement-12", "Ability Score Improvement", 12],
  ["ability-score-improvement-16", "Ability Score Improvement", 16], ["superior-inspiration", "Superior Inspiration", 18],
  ["epic-boon", "Epic Boon", 19], ["words-of-creation", "Words of Creation", 20],
].map(([id, name, level]) => ({ id, name, level }));

const bardBase = (ruleset) => ({
  certification: { ruleset, levels: [1, 20], verified: "2026-09-15" },
  requirements: "",
  prerequisite: "",
  setters: { hd: "d8" },
  rules: {
    grants: [],
    stats: [
      ...saveStats("dexterity", "charisma"),
      ...allSkills.map(([, name]) => ({ name: `${name.toLowerCase()}:misc`, value: "proficiency:half", level: 2 })),
      { name: "initiative:misc", value: "proficiency:half", level: 2 },
    ],
    proficiencies: ruleset === "5e"
      ? ["Light Armor", "Simple Weapons", "Hand Crossbows", "Longswords", "Rapiers", "Shortswords"]
      : ["Light Armor", "Simple Weapons"],
    subclassLevel: 3,
    selections: [
      skillSelection("Skill Proficiency (Bard)", allSkills, 3),
      { type: "Proficiency", name: "Musical Instrument (Bard)", number: 3, items: musicalInstruments },
      { type: "Expertise", name: "First Expertise", level: ruleset === "5e" ? 3 : 2, number: 2, items: expertiseItems },
      { type: "Expertise", name: "Second Expertise", level: ruleset === "5e" ? 10 : 9, number: 2, items: expertiseItems },
      ...([4, 8, 12, 16].map((level) => asiSelection(level))),
      asiSelection(19, asiOptions(), ruleset === "5.5e" ? "Level 19 Epic Boon" : "Level 19 Feat or Ability Score Improvement"),
    ],
    spellcasting: bardProfile(ruleset),
    features: ruleset === "5e" ? bardFeatures2014 : bardFeatures2024,
    resources: [{
      id: "bardic-inspiration", name: "Bardic Inspiration",
      max: { type: "ability-modifier", ability: "charisma", minimum: 1 },
      die: levelTable([1, 4, "d6"], [5, 9, "d8"], [10, 14, "d10"], [15, 20, "d12"]),
      reset: levelTable([1, 4, "long"], [5, 20, "short"]),
    }],
    actions: [{ id: "bardic-inspiration", name: "Bardic Inspiration", action: "Bonus Action", resourceId: "bardic-inspiration", range: "60 feet" }],
    warnings: [{ code: "manual-automation", path: "build.spells", level: 10, message: "Magical Secrets spell-list choices remain manual until cross-list validation is certified." }],
  },
});

const sorcererFeatures2014 = [
  ["spellcasting", "Spellcasting", 1], ["sorcerous-origin", "Sorcerous Origin", 1],
  ["font-of-magic", "Font of Magic", 2], ["metamagic", "Metamagic", 3],
  ["ability-score-improvement-4", "Ability Score Improvement", 4], ["ability-score-improvement-8", "Ability Score Improvement", 8],
  ["metamagic-10", "Metamagic", 10], ["ability-score-improvement-12", "Ability Score Improvement", 12],
  ["ability-score-improvement-16", "Ability Score Improvement", 16], ["metamagic-17", "Metamagic", 17],
  ["ability-score-improvement-19", "Ability Score Improvement", 19], ["sorcerous-restoration", "Sorcerous Restoration", 20],
].map(([id, name, level]) => ({ id, name, level }));

const sorcererFeatures2024 = [
  ["spellcasting", "Spellcasting", 1], ["innate-sorcery", "Innate Sorcery", 1],
  ["font-of-magic", "Font of Magic", 2], ["metamagic", "Metamagic", 2],
  ["sorcerer-subclass", "Sorcerer Subclass", 3], ["ability-score-improvement-4", "Ability Score Improvement", 4],
  ["sorcerous-restoration", "Sorcerous Restoration", 5], ["sorcery-incarnate", "Sorcery Incarnate", 7],
  ["ability-score-improvement-8", "Ability Score Improvement", 8], ["metamagic-10", "Metamagic", 10],
  ["ability-score-improvement-12", "Ability Score Improvement", 12], ["ability-score-improvement-16", "Ability Score Improvement", 16],
  ["metamagic-17", "Metamagic", 17], ["epic-boon", "Epic Boon", 19], ["arcane-apotheosis", "Arcane Apotheosis", 20],
].map(([id, name, level]) => ({ id, name, level }));

const sorcererBase = (ruleset) => ({
  certification: { ruleset, levels: [1, 20], verified: "2026-09-15" },
  requirements: "",
  prerequisite: "",
  setters: { hd: "d6" },
  rules: {
    grants: [],
    stats: saveStats("constitution", "charisma"),
    proficiencies: ruleset === "5e" ? ["Daggers", "Darts", "Slings", "Quarterstaffs", "Light Crossbows"] : ["Simple Weapons"],
    subclassLevel: ruleset === "5e" ? 1 : 3,
    selections: [
      skillSelection("Skill Proficiency (Sorcerer)", sorcererSkills),
      { type: "Metamagic", name: "Metamagic", level: ruleset === "5e" ? 3 : 2, number: 2, items: metamagicOptions(ruleset) },
      { type: "Metamagic", name: "Additional Metamagic (Level 10)", level: 10, number: ruleset === "5e" ? 1 : 2, items: metamagicOptions(ruleset) },
      { type: "Metamagic", name: "Additional Metamagic (Level 17)", level: 17, number: ruleset === "5e" ? 1 : 2, items: metamagicOptions(ruleset) },
      ...([4, 8, 12, 16].map((level) => asiSelection(level))),
      asiSelection(19, asiOptions(), ruleset === "5.5e" ? "Level 19 Epic Boon" : "Level 19 Feat or Ability Score Improvement"),
    ],
    spellcasting: sorcererProfile(ruleset),
    features: ruleset === "5e" ? sorcererFeatures2014 : sorcererFeatures2024,
    resources: [
      { id: "sorcery-points", name: "Sorcery Points", level: 2, max: "level", reset: "long" },
      ...(ruleset === "5.5e" ? [{ id: "innate-sorcery", name: "Innate Sorcery", max: 2, reset: "long" }] : []),
    ],
    actions: ruleset === "5.5e" ? [{ id: "innate-sorcery", name: "Innate Sorcery", action: "Bonus Action", resourceId: "innate-sorcery" }] : [],
    warnings: [
      { code: "manual-automation", path: "sheet.spellcasting", level: ruleset === "5e" ? 2 : 2, message: "Sorcery Point spell-slot conversion and Metamagic costs remain explicit manual resource adjustments." },
      ...(ruleset === "5.5e" ? [{ code: "manual-automation", path: "sheet.resources", level: 5, message: "Sorcerous Restoration's once-per-Long-Rest short-rest recovery remains manual." }] : []),
    ],
  },
});

const warlockProfile = (ruleset) => ({
  id: "warlock",
  name: "Warlock",
  ability: "charisma",
  spellList: "Warlock",
  progression: "pact",
  multiclassProgression: "pact",
  repertoire: ruleset === "5e" ? "known" : "prepared",
  ritual: "none",
  cantripScaling: "character",
  cantrips: levelTable([1, 3, 2], [4, 9, 3], [10, 20, 4]),
  ...(ruleset === "5e" ? {
    known: { type: "table", values: {
      1: 2, 2: 3, 3: 4, 4: 5, 5: 6, 6: 7, 7: 8, 8: 9, 9: 10, 10: 10,
      11: 11, 12: 11, 13: 12, 14: 12, 15: 13, 16: 13, 17: 14, 18: 14, 19: 15, 20: 15,
    } },
    prepared: 0,
  } : {
    prepared: { type: "table", values: {
      1: 2, 2: 3, 3: 4, 4: 5, 5: 6, 6: 7, 7: 8, 8: 9, 9: 10, 10: 10,
      11: 11, 12: 11, 13: 12, 14: 12, 15: 13, 16: 13, 17: 14, 18: 14, 19: 15, 20: 15,
    } },
  }),
});

const warlockFeatures2014 = [
  ["otherworldly-patron", "Otherworldly Patron", 1], ["pact-magic", "Pact Magic", 1],
  ["eldritch-invocations", "Eldritch Invocations", 2], ["pact-boon", "Pact Boon", 3],
  ["ability-score-improvement-4", "Ability Score Improvement", 4], ["ability-score-improvement-8", "Ability Score Improvement", 8],
  ["mystic-arcanum-6", "Mystic Arcanum (6th level)", 11], ["ability-score-improvement-12", "Ability Score Improvement", 12],
  ["mystic-arcanum-7", "Mystic Arcanum (7th level)", 13], ["mystic-arcanum-8", "Mystic Arcanum (8th level)", 15],
  ["ability-score-improvement-16", "Ability Score Improvement", 16], ["mystic-arcanum-9", "Mystic Arcanum (9th level)", 17],
  ["ability-score-improvement-19", "Ability Score Improvement", 19], ["eldritch-master", "Eldritch Master", 20],
].map(([id, name, level]) => ({ id, name, level }));

const warlockFeatures2024 = [
  ["eldritch-invocations", "Eldritch Invocations", 1], ["pact-magic", "Pact Magic", 1],
  ["magical-cunning", "Magical Cunning", 2], ["warlock-subclass", "Warlock Subclass", 3],
  ["ability-score-improvement-4", "Ability Score Improvement", 4], ["ability-score-improvement-8", "Ability Score Improvement", 8],
  ["contact-patron", "Contact Patron", 9], ["mystic-arcanum-6", "Mystic Arcanum (6th level)", 11],
  ["ability-score-improvement-12", "Ability Score Improvement", 12], ["mystic-arcanum-7", "Mystic Arcanum (7th level)", 13],
  ["mystic-arcanum-8", "Mystic Arcanum (8th level)", 15], ["ability-score-improvement-16", "Ability Score Improvement", 16],
  ["mystic-arcanum-9", "Mystic Arcanum (9th level)", 17], ["epic-boon", "Epic Boon", 19], ["eldritch-master", "Eldritch Master", 20],
].map(([id, name, level]) => ({ id, name, level }));

const warlockInvocationCount = (ruleset) => ruleset === "5e"
  ? levelTable([1, 1, 0], [2, 4, 2], [5, 6, 3], [7, 8, 4], [9, 11, 5], [12, 14, 6], [15, 17, 7], [18, 20, 8])
  : levelTable([1, 1, 1], [2, 4, 3], [5, 6, 5], [7, 8, 6], [9, 11, 7], [12, 14, 8], [15, 17, 9], [18, 20, 10]);

const warlockBase = (ruleset) => ({
  certification: { ruleset, levels: [1, 20], verified: "2026-09-15" },
  requirements: "",
  prerequisite: "",
  setters: { hd: "d8" },
  rules: {
    grants: [],
    stats: saveStats("wisdom", "charisma"),
    proficiencies: ["Light Armor", "Simple Weapons"],
    subclassLevel: ruleset === "5e" ? 1 : 3,
    selections: [
      skillSelection("Skill Proficiency (Warlock)", warlockSkills),
      ...(ruleset === "5e" ? [{ type: "Pact Boon", name: "Pact Boon", level: 3, number: 1, items: pactInvocationChoices }] : []),
      { type: "Eldritch Invocation", name: "Eldritch Invocations", level: ruleset === "5e" ? 2 : 1, number: warlockInvocationCount(ruleset), items: ruleset === "5e" ? invocationChoices2014 : invocationChoices2024 },
      ...([4, 8, 12, 16].map((level) => asiSelection(level))),
      asiSelection(19, asiOptions(), ruleset === "5.5e" ? "Level 19 Epic Boon" : "Level 19 Feat or Ability Score Improvement"),
    ],
    spellcasting: warlockProfile(ruleset),
    features: ruleset === "5e" ? warlockFeatures2014 : warlockFeatures2024,
    resources: ruleset === "5.5e" ? [
      { id: "magical-cunning", name: "Magical Cunning", level: 2, max: 1, reset: "long" },
      { id: "contact-patron", name: "Contact Patron", level: 9, max: 1, reset: "long" },
    ] : [],
    actions: ruleset === "5.5e" ? [
      { id: "magical-cunning", name: "Magical Cunning", level: 2, action: "Other", resourceId: "magical-cunning" },
      { id: "contact-patron", name: "Contact Patron", level: 9, action: "Other", resourceId: "contact-patron" },
    ] : [],
    warnings: [
      ...(ruleset === "5.5e" ? [
        { code: "manual-automation", path: "sheet.spellcasting", level: 2, message: "Magical Cunning's pact-slot recovery remains a manual adjustment until pact recovery is certified." },
        { code: "manual-automation", path: "build.spells.contactPatron", level: 9, message: "Contact Patron's always-prepared spell remains manual until that spell entry is certified." },
      ] : []),
      { code: "manual-automation", path: "build.spells.mysticArcanum", level: 11, message: "Mystic Arcanum spell choices and once-per-Long-Rest casting remain manual until those spell entries are certified." },
      ...(ruleset === "5e" ? [{ code: "manual-automation", path: "sheet.spellcasting", level: 20, message: "Eldritch Master's pact-slot recovery remains a manual adjustment." }] : []),
    ],
  },
});

const barbarianFeatures2014 = [
  ["rage", "Rage", 1], ["unarmored-defense", "Unarmored Defense", 1],
  ["reckless-attack", "Reckless Attack", 2], ["danger-sense", "Danger Sense", 2],
  ["primal-path", "Primal Path", 3], ["ability-score-improvement-4", "Ability Score Improvement", 4],
  ["extra-attack", "Extra Attack", 5], ["fast-movement", "Fast Movement", 5],
  ["feral-instinct", "Feral Instinct", 7], ["ability-score-improvement-8", "Ability Score Improvement", 8],
  ["brutal-critical-1", "Brutal Critical (1 die)", 9], ["relentless-rage", "Relentless Rage", 11],
  ["ability-score-improvement-12", "Ability Score Improvement", 12], ["brutal-critical-2", "Brutal Critical (2 dice)", 13],
  ["persistent-rage", "Persistent Rage", 15], ["ability-score-improvement-16", "Ability Score Improvement", 16],
  ["brutal-critical-3", "Brutal Critical (3 dice)", 17], ["indomitable-might", "Indomitable Might", 18],
  ["ability-score-improvement-19", "Ability Score Improvement", 19], ["primal-champion", "Primal Champion", 20],
].map(([id, name, level]) => ({ id, name, level }));

const barbarianFeatures2024 = [
  ["rage", "Rage", 1], ["unarmored-defense", "Unarmored Defense", 1], ["weapon-mastery", "Weapon Mastery", 1],
  ["danger-sense", "Danger Sense", 2], ["reckless-attack", "Reckless Attack", 2],
  ["barbarian-subclass", "Barbarian Subclass", 3], ["primal-knowledge", "Primal Knowledge", 3],
  ["ability-score-improvement-4", "Ability Score Improvement", 4], ["extra-attack", "Extra Attack", 5],
  ["fast-movement", "Fast Movement", 5], ["feral-instinct", "Feral Instinct", 7],
  ["instinctive-pounce", "Instinctive Pounce", 7], ["ability-score-improvement-8", "Ability Score Improvement", 8],
  ["brutal-strike", "Brutal Strike", 9], ["relentless-rage", "Relentless Rage", 11],
  ["ability-score-improvement-12", "Ability Score Improvement", 12], ["improved-brutal-strike-options", "Improved Brutal Strike", 13],
  ["persistent-rage", "Persistent Rage", 15], ["ability-score-improvement-16", "Ability Score Improvement", 16],
  ["improved-brutal-strike-damage", "Improved Brutal Strike", 17], ["indomitable-might", "Indomitable Might", 18],
  ["epic-boon", "Epic Boon", 19], ["primal-champion", "Primal Champion", 20],
].map(([id, name, level]) => ({ id, name, level }));

const barbarianRages = levelTable(
  [1, 2, 2], [3, 5, 3], [6, 11, 4], [12, 16, 5], [17, 20, 6],
);
const rageDamage = levelTable([1, 8, "+2 Strength damage"], [9, 15, "+3 Strength damage"], [16, 20, "+4 Strength damage"]);

const barbarianBase = (ruleset) => ({
  certification: { ruleset, levels: [1, 20], verified: "2026-09-15" },
  requirements: "",
  prerequisite: "",
  setters: { hd: "d12" },
  rules: {
    grants: [],
    stats: [
      ...saveStats("strength", "constitution"),
      { name: "ac:misc", value: "constitution:modifier", equipped: "no-body-armor", stackingGroup: "unarmored-defense", stacking: "first" },
      { name: "speed:misc", value: "10", level: 5, equipped: "no-heavy-armor" },
    ],
    proficiencies: ["Light Armor", "Medium Armor", "Shields", "Simple Weapons", "Martial Weapons"],
    subclassLevel: 3,
    selections: [
      skillSelection("Skill Proficiency (Barbarian)", barbarianSkills),
      ...(ruleset === "5.5e" ? [
        { type: "Weapon Mastery", name: "Weapon Mastery", number: levelTable([1, 3, 2], [4, 9, 3], [10, 20, 4]), items: masteryItems },
        skillSelection("Primal Knowledge Skill Proficiency", barbarianSkills, 1, 3),
      ] : []),
      ...([4, 8, 12, 16].map((level) => asiSelection(level))),
      asiSelection(19, asiOptions(), ruleset === "5.5e" ? "Level 19 Epic Boon" : "Level 19 Feat or Ability Score Improvement"),
    ],
    features: ruleset === "5e" ? barbarianFeatures2014 : barbarianFeatures2024,
    resources: [{
      id: "rage", name: "Rage", max: barbarianRages,
      reset: "long",
      ...(ruleset === "5.5e" ? { recovery: { short: 1, long: "all" } } : {}),
      action: "Bonus Action",
    }],
    actions: [
      { id: "rage", name: "Rage", action: "Bonus Action", resourceId: "rage", damage: rageDamage },
      { id: "reckless-attack", name: "Reckless Attack", level: 2, action: "Other" },
      ...(ruleset === "5.5e" ? [{
        id: "brutal-strike", name: "Brutal Strike", level: 9, action: "Other",
        damage: levelTable([1, 16, "1d10 extra damage"], [17, 20, "2d10 extra damage"]),
      }] : []),
    ],
    combat: { attacksPerAction: levelTable([1, 4, 1], [5, 20, 2]) },
    warnings: [
      { code: "manual-automation", path: "runtime.rage", message: "Rage activation, conditional resistance, Strength advantage, concentration limits, and duration remain explicit runtime tracking." },
      ...(ruleset === "5e" ? [
        { code: "manual-automation", path: "sheet.combat.brutalCritical", level: 9, message: "Brutal Critical's conditional extra weapon dice remain manual." },
        { code: "manual-automation", path: "sheet.resources.rage", level: 20, message: "Unlimited level-20 Rage removes practical use tracking; the sheet retains six uses as a visible fallback." },
      ] : [
        { code: "manual-automation", path: "sheet.actions.brutalStrike", level: 9, message: "Brutal Strike target effects remain manual; its extra damage is displayed." },
        { code: "manual-automation", path: "runtime.rageRecovery", level: 15, message: "Persistent Rage's once-per-Long-Rest Initiative recovery remains manual." },
      ]),
      { code: "manual-automation", path: "sheet.stats.primalChampion", level: 20, message: "Primal Champion's ability increases and edition-specific maximums remain manual until capped ability modifiers are certified." },
    ],
  },
});

const monkFeatures2014 = [
  ["unarmored-defense", "Unarmored Defense", 1], ["martial-arts", "Martial Arts", 1],
  ["ki", "Ki", 2], ["unarmored-movement", "Unarmored Movement", 2],
  ["monastic-tradition", "Monastic Tradition", 3], ["deflect-missiles", "Deflect Missiles", 3],
  ["ability-score-improvement-4", "Ability Score Improvement", 4], ["slow-fall", "Slow Fall", 4],
  ["extra-attack", "Extra Attack", 5], ["stunning-strike", "Stunning Strike", 5],
  ["ki-empowered-strikes", "Ki-Empowered Strikes", 6], ["evasion", "Evasion", 7],
  ["stillness-of-mind", "Stillness of Mind", 7], ["ability-score-improvement-8", "Ability Score Improvement", 8],
  ["unarmored-movement-improvement", "Unarmored Movement Improvement", 9], ["purity-of-body", "Purity of Body", 10],
  ["ability-score-improvement-12", "Ability Score Improvement", 12], ["tongue-of-the-sun-and-moon", "Tongue of the Sun and Moon", 13],
  ["diamond-soul", "Diamond Soul", 14], ["timeless-body", "Timeless Body", 15],
  ["ability-score-improvement-16", "Ability Score Improvement", 16], ["empty-body", "Empty Body", 18],
  ["ability-score-improvement-19", "Ability Score Improvement", 19], ["perfect-self", "Perfect Self", 20],
].map(([id, name, level]) => ({ id, name, level }));

const monkFeatures2024 = [
  ["martial-arts", "Martial Arts", 1], ["unarmored-defense", "Unarmored Defense", 1],
  ["monks-focus", "Monk's Focus", 2], ["unarmored-movement", "Unarmored Movement", 2],
  ["uncanny-metabolism", "Uncanny Metabolism", 2], ["deflect-attacks", "Deflect Attacks", 3],
  ["monk-subclass", "Monk Subclass", 3], ["ability-score-improvement-4", "Ability Score Improvement", 4],
  ["slow-fall", "Slow Fall", 4], ["extra-attack", "Extra Attack", 5], ["stunning-strike", "Stunning Strike", 5],
  ["empowered-strikes", "Empowered Strikes", 6], ["evasion", "Evasion", 7],
  ["ability-score-improvement-8", "Ability Score Improvement", 8], ["acrobatic-movement", "Acrobatic Movement", 9],
  ["heightened-focus", "Heightened Focus", 10], ["self-restoration", "Self-Restoration", 10],
  ["ability-score-improvement-12", "Ability Score Improvement", 12], ["deflect-energy", "Deflect Energy", 13],
  ["disciplined-survivor", "Disciplined Survivor", 14], ["perfect-focus", "Perfect Focus", 15],
  ["ability-score-improvement-16", "Ability Score Improvement", 16], ["superior-defense", "Superior Defense", 18],
  ["epic-boon", "Epic Boon", 19], ["body-and-mind", "Body and Mind", 20],
].map(([id, name, level]) => ({ id, name, level }));

const martialArtsDie = (ruleset) => ruleset === "5e"
  ? levelTable([1, 4, "1d4"], [5, 10, "1d6"], [11, 16, "1d8"], [17, 20, "1d10"])
  : levelTable([1, 4, "1d6"], [5, 10, "1d8"], [11, 16, "1d10"], [17, 20, "1d12"]);
const unarmoredMovement = levelTable(
  [1, 1, "0"], [2, 5, "10"], [6, 9, "15"], [10, 13, "20"], [14, 17, "25"], [18, 20, "30"],
);
const martialArtsDamage = (ruleset, strikes = 1) => ({
  type: "table",
  values: Object.fromEntries(Object.entries(martialArtsDie(ruleset).values)
    .map(([level, die]) => [level, `${strikes} × (${die} + ability modifier)`])),
});

const monkBase = (ruleset) => ({
  certification: { ruleset, levels: [1, 20], verified: "2026-09-15" },
  requirements: "",
  prerequisite: "",
  setters: { hd: "d8" },
  rules: {
    grants: [],
    stats: [
      ...saveStats("strength", "dexterity"),
      { name: "ac:misc", value: "wisdom:modifier", equipped: "no-armor", stackingGroup: "unarmored-defense", stacking: "first" },
      { name: "speed:misc", value: unarmoredMovement, level: 2, equipped: "no-armor" },
      ...["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"]
        .flatMap((abilityName) => saveStats(abilityName, abilityName).slice(0, 1).map((rule) => ({ ...rule, level: 14 }))),
    ],
    proficiencies: ruleset === "5e" ? ["Simple Weapons", "Shortswords"] : ["Simple Weapons", "Martial Weapons with the Light property"],
    subclassLevel: 3,
    selections: [
      skillSelection("Skill Proficiency (Monk)", monkSkills),
      { type: "Proficiency", name: "Monk Tool Proficiency", number: 1, items: monkTools },
      ...([4, 8, 12, 16].map((level) => asiSelection(level))),
      asiSelection(19, asiOptions(), ruleset === "5.5e" ? "Level 19 Epic Boon" : "Level 19 Feat or Ability Score Improvement"),
    ],
    features: ruleset === "5e" ? monkFeatures2014 : monkFeatures2024,
    resources: [
      { id: ruleset === "5e" ? "ki" : "focus", name: ruleset === "5e" ? "Ki Points" : "Focus Points", level: 2, max: "level", reset: "short" },
      ...(ruleset === "5.5e" ? [{ id: "uncanny-metabolism", name: "Uncanny Metabolism", level: 2, max: 1, reset: "long" }] : []),
    ],
    actions: [
      { id: "martial-arts", name: "Martial Arts: Bonus Unarmed Strike", action: "Bonus Action", damage: martialArtsDamage(ruleset) },
      { id: "flurry-of-blows", name: "Flurry of Blows", level: 2, action: "Bonus Action", resourceId: ruleset === "5e" ? "ki" : "focus", damage: ruleset === "5.5e"
        ? { type: "table", values: Object.fromEntries(Object.entries(martialArtsDie(ruleset).values).map(([level, die]) => [level, `${Number(level) >= 10 ? 3 : 2} × (${die} + ability modifier)`])) }
        : martialArtsDamage(ruleset, 2) },
      ...(ruleset === "5e" ? [
        { id: "patient-defense", name: "Patient Defense", level: 2, action: "Bonus Action", resourceId: "ki" },
        { id: "step-of-the-wind", name: "Step of the Wind", level: 2, action: "Bonus Action", resourceId: "ki" },
      ] : [
        { id: "patient-defense", name: "Patient Defense", level: 2, action: "Bonus Action" },
        { id: "patient-defense-focused", name: "Patient Defense (Focused)", level: 2, action: "Bonus Action", resourceId: "focus" },
        { id: "step-of-the-wind", name: "Step of the Wind", level: 2, action: "Bonus Action" },
        { id: "step-of-the-wind-focused", name: "Step of the Wind (Focused)", level: 2, action: "Bonus Action", resourceId: "focus" },
        { id: "uncanny-metabolism", name: "Uncanny Metabolism", level: 2, action: "Other", resourceId: "uncanny-metabolism" },
      ]),
      { id: ruleset === "5e" ? "deflect-missiles" : "deflect-attacks", name: ruleset === "5e" ? "Deflect Missiles" : "Deflect Attacks", level: 3, action: "Reaction" },
      { id: "slow-fall", name: "Slow Fall", level: 4, action: "Reaction" },
      { id: "stunning-strike", name: "Stunning Strike", level: 5, action: "Other", resourceId: ruleset === "5e" ? "ki" : "focus" },
      { id: ruleset === "5e" ? "diamond-soul-reroll" : "disciplined-survivor-reroll", name: ruleset === "5e" ? "Diamond Soul Reroll" : "Disciplined Survivor Reroll", level: 14, action: "Reaction", resourceId: ruleset === "5e" ? "ki" : "focus" },
      ...(ruleset === "5.5e" ? [{ id: "superior-defense", name: "Superior Defense", level: 18, action: "Other" }] : []),
    ],
    combat: {
      attacksPerAction: levelTable([1, 4, 1], [5, 20, 2]),
      unarmed: { abilities: ["dexterity", "strength"], damage: martialArtsDie(ruleset) },
    },
    warnings: [
      { code: "manual-automation", path: "sheet.actions.monkWeapons", message: "Monk-weapon eligibility and Dexterity substitution remain manual; Unarmed Strike attack and damage calculate automatically." },
      ...(ruleset === "5e" ? [
        { code: "manual-automation", path: "sheet.defenses.purityOfBody", level: 10, message: "Purity of Body's disease and poison immunities remain manual." },
        { code: "manual-automation", path: "runtime.emptyBody", level: 18, message: "Empty Body's multi-point cost and duration remain manual." },
        { code: "manual-automation", path: "runtime.perfectSelf", level: 20, message: "Perfect Self's Initiative-based Ki recovery remains manual." },
      ] : [
        { code: "manual-automation", path: "runtime.uncannyMetabolism", level: 2, message: "Uncanny Metabolism's Initiative trigger, Focus recovery, and healing remain manual after its once-per-Long-Rest use is spent." },
        { code: "manual-automation", path: "runtime.perfectFocus", level: 15, message: "Perfect Focus's Initiative-based minimum Focus recovery remains manual." },
        { code: "manual-automation", path: "runtime.superiorDefense", level: 18, message: "Superior Defense's three-point cost, duration, and conditional resistance remain manual." },
        { code: "manual-automation", path: "sheet.stats.bodyAndMind", level: 20, message: "Body and Mind's capped ability increases remain manual until capped ability modifiers are certified." },
      ]),
    ],
  },
});

const rogueFeatures2014 = [
  ["expertise", "Expertise", 1], ["sneak-attack", "Sneak Attack", 1],
  ["thieves-cant", "Thieves' Cant", 1], ["cunning-action", "Cunning Action", 2],
  ["roguish-archetype", "Roguish Archetype", 3], ["ability-score-improvement-4", "Ability Score Improvement", 4],
  ["uncanny-dodge", "Uncanny Dodge", 5], ["expertise-6", "Expertise", 6],
  ["evasion", "Evasion", 7], ["ability-score-improvement-8", "Ability Score Improvement", 8],
  ["ability-score-improvement-10", "Ability Score Improvement", 10], ["reliable-talent", "Reliable Talent", 11],
  ["ability-score-improvement-12", "Ability Score Improvement", 12], ["blindsense", "Blindsense", 14],
  ["slippery-mind", "Slippery Mind", 15], ["ability-score-improvement-16", "Ability Score Improvement", 16],
  ["elusive", "Elusive", 18], ["ability-score-improvement-19", "Ability Score Improvement", 19],
  ["stroke-of-luck", "Stroke of Luck", 20],
].map(([id, name, level]) => ({ id, name, level }));

const rogueFeatures2024 = [
  ["expertise", "Expertise", 1], ["sneak-attack", "Sneak Attack", 1],
  ["thieves-cant", "Thieves' Cant", 1], ["weapon-mastery", "Weapon Mastery", 1],
  ["cunning-action", "Cunning Action", 2], ["rogue-subclass", "Rogue Subclass", 3],
  ["steady-aim", "Steady Aim", 3], ["ability-score-improvement-4", "Ability Score Improvement", 4],
  ["cunning-strike", "Cunning Strike", 5], ["uncanny-dodge", "Uncanny Dodge", 5],
  ["expertise-6", "Expertise", 6], ["evasion", "Evasion", 7],
  ["reliable-talent", "Reliable Talent", 7], ["ability-score-improvement-8", "Ability Score Improvement", 8],
  ["ability-score-improvement-10", "Ability Score Improvement", 10], ["improved-cunning-strike", "Improved Cunning Strike", 11],
  ["ability-score-improvement-12", "Ability Score Improvement", 12], ["devious-strikes", "Devious Strikes", 14],
  ["slippery-mind", "Slippery Mind", 15], ["ability-score-improvement-16", "Ability Score Improvement", 16],
  ["elusive", "Elusive", 18], ["epic-boon", "Epic Boon", 19],
  ["stroke-of-luck", "Stroke of Luck", 20],
].map(([id, name, level]) => ({ id, name, level }));

const sneakAttackDamage = levelTable(
  [1, 2, "1d6"], [3, 4, "2d6"], [5, 6, "3d6"], [7, 8, "4d6"], [9, 10, "5d6"],
  [11, 12, "6d6"], [13, 14, "7d6"], [15, 16, "8d6"], [17, 18, "9d6"], [19, 20, "10d6"],
);
const rogueExpertiseItems = rogueSkills2014.map(([id, name]) => ({
  id: `${id}-expertise`,
  label: name,
  rules: { stats: [{ name: `${name.toLowerCase()}:proficiency`, value: "proficiency", bonus: "double" }] },
}));
const rogueMasteryIds = new Set([
  "BLOWGUN_VEX", "CLUB_SLOW", "DAGGER_NICK", "DART_VEX", "GREATCLUB_PUSH", "CROSSBOW_HAND_VEX",
  "HANDAXE_VEX", "JAVELIN_SLOW", "CROSSBOW_LIGHT_SLOW", "LIGHT_HAMMER_NICK", "MACE_SAP",
  "QUARTERSTAFF_TOPPLE", "RAPIER_VEX", "SCIMITAR_NICK", "SHORTBOW_VEX", "SHORTSWORD_VEX",
  "SICKLE_NICK", "SLING_SLOW", "SPEAR_SAP", "WHIP_SLOW",
].map((id) => `ID_WOTC_PHB24_CLASS_FEATURE_MASTERY_PROPERTY_${id}`));
const rogueMasteryItems = masteryItems.filter(({ id }) => rogueMasteryIds.has(id));

const rogueBase = (ruleset) => ({
  certification: { ruleset, levels: [1, 20], verified: "2026-09-15" },
  requirements: "",
  prerequisite: "",
  setters: { hd: "d8" },
  rules: {
    grants: [],
    stats: [
      ...saveStats("dexterity", "intelligence"),
      { name: "wisdom:save:proficiency", value: "proficiency", bonus: "proficiency", level: 15 },
      ...(ruleset === "5.5e" ? [{ name: "charisma:save:proficiency", value: "proficiency", bonus: "proficiency", level: 15 }] : []),
    ],
    proficiencies: ruleset === "5e"
      ? ["Light Armor", "Simple Weapons", "Hand Crossbows", "Longswords", "Rapiers", "Shortswords", "Thieves' Tools"]
      : ["Light Armor", "Simple Weapons", "Martial Weapons with the Finesse or Light property", "Thieves' Tools"],
    languages: ["Thieves' Cant"],
    subclassLevel: 3,
    selections: [
      skillSelection("Skill Proficiency (Rogue)", ruleset === "5e" ? rogueSkills2014 : rogueSkills2024, 4),
      { type: "Expertise", name: "Expertise", number: 2, items: [
        ...rogueExpertiseItems,
        ...(ruleset === "5e" ? [{ id: "thieves-tools-expertise", label: "Thieves' Tools", rules: { features: [{ id: "thieves-tools-expertise", name: "Expertise: Thieves' Tools" }] } }] : []),
      ] },
      ...(ruleset === "5.5e" ? [{ type: "Weapon Mastery", name: "Weapon Mastery", number: 2, items: rogueMasteryItems }] : []),
      { type: "Expertise", name: "Level 6 Expertise", level: 6, number: 2, items: [
        ...rogueExpertiseItems,
        ...(ruleset === "5e" ? [{ id: "thieves-tools-expertise", label: "Thieves' Tools", rules: { features: [{ id: "thieves-tools-expertise", name: "Expertise: Thieves' Tools", level: 6 }] } }] : []),
      ] },
      ...([4, 8, 10, 12, 16].map((level) => asiSelection(level))),
      asiSelection(19, asiOptions(), ruleset === "5.5e" ? "Level 19 Epic Boon" : "Level 19 Feat or Ability Score Improvement"),
    ],
    features: ruleset === "5e" ? rogueFeatures2014 : rogueFeatures2024,
    resources: [{ id: "stroke-of-luck", name: "Stroke of Luck", level: 20, max: 1, reset: "short" }],
    actions: [
      { id: "sneak-attack", name: "Sneak Attack", action: "Other", damage: sneakAttackDamage, description: "Once per turn with an eligible Finesse or ranged weapon attack." },
      { id: "cunning-action-dash", name: "Cunning Action: Dash", level: 2, action: "Bonus Action" },
      { id: "cunning-action-disengage", name: "Cunning Action: Disengage", level: 2, action: "Bonus Action" },
      { id: "cunning-action-hide", name: "Cunning Action: Hide", level: 2, action: "Bonus Action" },
      { id: "uncanny-dodge", name: "Uncanny Dodge", level: 5, action: "Reaction" },
      { id: "stroke-of-luck", name: "Stroke of Luck", level: 20, action: "Other", resourceId: "stroke-of-luck" },
      ...(ruleset === "5.5e" ? [
        { id: "steady-aim", name: "Steady Aim", level: 3, action: "Bonus Action" },
        { id: "cunning-strike-poison", name: "Cunning Strike: Poison (cost 1d6)", level: 5, action: "Other" },
        { id: "cunning-strike-trip", name: "Cunning Strike: Trip (cost 1d6)", level: 5, action: "Other" },
        { id: "cunning-strike-withdraw", name: "Cunning Strike: Withdraw (cost 1d6)", level: 5, action: "Other" },
        { id: "devious-strike-daze", name: "Devious Strike: Daze (cost 2d6)", level: 14, action: "Other" },
        { id: "devious-strike-knock-out", name: "Devious Strike: Knock Out (cost 6d6)", level: 14, action: "Other" },
        { id: "devious-strike-obscure", name: "Devious Strike: Obscure (cost 3d6)", level: 14, action: "Other" },
      ] : []),
    ],
    warnings: [
      { code: "manual-automation", path: "sheet.actions.sneakAttack", message: "Sneak Attack eligibility and once-per-turn timing remain manual; its class-level damage is displayed." },
      { code: "manual-automation", path: "sheet.skills.reliableTalent", level: ruleset === "5e" ? 11 : 7, message: "Reliable Talent's minimum d20 result remains manual during rolls." },
      { code: "manual-automation", path: "sheet.defenses.evasion", level: 7, message: "Evasion and Uncanny Dodge damage adjustments remain manual because target damage is outside tracker scope." },
      { code: "manual-automation", path: "runtime.elusive", level: 18, message: "Elusive's conditional attack-roll protection remains manual." },
      ...(ruleset === "5e" ? [
        { code: "manual-automation", path: "sheet.senses.blindsense", level: 14, message: "Blindsense's conditional awareness remains manual." },
      ] : [
        { code: "manual-automation", path: "sheet.actions.cunningStrike", level: 5, message: "Cunning and Devious Strike die costs, saves, conditions, and target effects remain manual." },
      ]),
    ],
  },
});

const druidProfile = (ruleset) => ({
  id: "druid",
  name: "Druid",
  ability: "wisdom",
  spellList: "Druid",
  progression: "full",
  repertoire: "prepared",
  ritual: "prepared",
  cantripScaling: "character",
  prepared: ruleset === "5e"
    ? { type: "ability-plus-level", minimum: 1 }
    : { type: "table", values: {
      1: 4, 2: 5, 3: 6, 4: 7, 5: 9, 6: 10, 7: 11, 8: 12, 9: 14, 10: 15,
      11: 16, 12: 16, 13: 17, 14: 17, 15: 18, 16: 18, 17: 19, 18: 20, 19: 21, 20: 22,
    } },
  cantrips: levelTable([1, 3, 2], [4, 9, 3], [10, 20, 4]),
});

const rangerProfile = (ruleset) => ({
  id: "ranger",
  name: "Ranger",
  ability: "wisdom",
  spellList: "Ranger",
  progression: "half-up",
  ...(ruleset === "5e" ? { minimumLevel: 2, multiclassProgression: "half-down" } : {}),
  repertoire: ruleset === "5e" ? "known" : "prepared",
  ritual: ruleset === "5e" ? "none" : "prepared",
  cantripScaling: "character",
  ...(ruleset === "5e" ? {
    known: { type: "table", values: {
      1: 0, 2: 2, 3: 3, 4: 3, 5: 4, 6: 4, 7: 5, 8: 5, 9: 6, 10: 6,
      11: 7, 12: 7, 13: 8, 14: 8, 15: 9, 16: 9, 17: 10, 18: 10, 19: 11, 20: 11,
    } },
    prepared: 0,
  } : {
    prepared: { type: "table", values: {
      1: 2, 2: 3, 3: 4, 4: 5, 5: 6, 6: 6, 7: 7, 8: 7, 9: 9, 10: 9,
      11: 10, 12: 10, 13: 11, 14: 11, 15: 12, 16: 12, 17: 14, 18: 14, 19: 15, 20: 15,
    } },
  }),
});

const druidFeatures2014 = [
  ["druidic", "Druidic", 1], ["spellcasting", "Spellcasting", 1],
  ["wild-shape", "Wild Shape", 2], ["druid-circle", "Druid Circle", 2],
  ["wild-shape-improvement-4", "Wild Shape Improvement", 4], ["ability-score-improvement-4", "Ability Score Improvement", 4],
  ["ability-score-improvement-8", "Ability Score Improvement", 8], ["wild-shape-improvement-8", "Wild Shape Improvement", 8],
  ["ability-score-improvement-12", "Ability Score Improvement", 12], ["ability-score-improvement-16", "Ability Score Improvement", 16],
  ["timeless-body", "Timeless Body", 18], ["beast-spells", "Beast Spells", 18],
  ["ability-score-improvement-19", "Ability Score Improvement", 19], ["archdruid", "Archdruid", 20],
].map(([id, name, level]) => ({ id, name, level }));

const druidFeatures2024 = [
  ["spellcasting", "Spellcasting", 1], ["druidic", "Druidic", 1], ["primal-order", "Primal Order", 1],
  ["wild-shape", "Wild Shape", 2], ["wild-companion", "Wild Companion", 2], ["druid-subclass", "Druid Subclass", 3],
  ["ability-score-improvement-4", "Ability Score Improvement", 4], ["wild-resurgence", "Wild Resurgence", 5],
  ["elemental-fury", "Elemental Fury", 7], ["ability-score-improvement-8", "Ability Score Improvement", 8],
  ["ability-score-improvement-12", "Ability Score Improvement", 12], ["improved-elemental-fury", "Improved Elemental Fury", 15],
  ["ability-score-improvement-16", "Ability Score Improvement", 16], ["beast-spells", "Beast Spells", 18],
  ["epic-boon", "Epic Boon", 19], ["archdruid", "Archdruid", 20],
].map(([id, name, level]) => ({ id, name, level }));

const druidBase = (ruleset) => ({
  certification: { ruleset, levels: [1, 20], verified: "2026-09-15" },
  requirements: "",
  prerequisite: "",
  setters: { hd: "d8" },
  rules: {
    grants: [],
    stats: saveStats("intelligence", "wisdom"),
    proficiencies: ruleset === "5e"
      ? ["Light Armor", "Medium Armor", "Shields", "Clubs", "Daggers", "Darts", "Javelins", "Maces", "Quarterstaffs", "Scimitars", "Sickles", "Slings", "Spears", "Herbalism Kit"]
      : ["Light Armor", "Shields", "Simple Weapons", "Herbalism Kit"],
    subclassLevel: ruleset === "5e" ? 2 : 3,
    selections: [
      skillSelection("Skill Proficiency (Druid)", druidSkills),
      ...(ruleset === "5.5e" ? [{
        type: "Primal Order", name: "Primal Order", number: 1, items: [
          { id: "warden", label: "Warden", rules: { proficiencies: ["Medium Armor", "Martial Weapons"], features: [{ id: "primal-order-warden", name: "Primal Order: Warden" }] } },
          { id: "magician", label: "Magician", rules: { features: [{ id: "primal-order-magician", name: "Primal Order: Magician" }], warnings: [{ code: "manual-automation", path: "build.spells", message: "Magician's additional Druid cantrip remains a manual selection." }] } },
        ],
      }, {
        type: "Elemental Fury", name: "Elemental Fury", level: 7, number: 1, items: [
          { id: "potent-spellcasting", label: "Potent Spellcasting", rules: { features: [{ id: "elemental-fury-potent-spellcasting", name: "Elemental Fury: Potent Spellcasting", level: 7 }] } },
          { id: "primal-strike", label: "Primal Strike", rules: { features: [{ id: "elemental-fury-primal-strike", name: "Elemental Fury: Primal Strike", level: 7 }] } },
        ],
      }] : []),
      ...([4, 8, 12, 16].map((level) => asiSelection(level))),
      asiSelection(19, asiOptions(), ruleset === "5.5e" ? "Level 19 Epic Boon" : "Level 19 Feat or Ability Score Improvement"),
    ],
    spellcasting: druidProfile(ruleset),
    features: ruleset === "5e" ? druidFeatures2014 : druidFeatures2024,
    resources: [{
      id: "wild-shape", name: "Wild Shape", level: 2,
      max: ruleset === "5e" ? 2 : levelTable([1, 5, 2], [6, 16, 3], [17, 20, 4]),
      ...(ruleset === "5e" ? { reset: "short", maximumLevel: 19 } : { reset: "long", recovery: { short: 1, long: "all" } }),
    }],
    actions: [{ id: "wild-shape", name: "Wild Shape", level: 2, action: ruleset === "5e" ? "Action" : "Bonus Action", resourceId: "wild-shape" }],
    extras: [{ id: "wild-shape-forms", name: "Wild Shape Forms", type: "wild-shape", level: 2, description: "Record eligible Beast forms here; form statistics stay separate from the character sheet." }],
  },
});

const rangerFeatures2014 = [
  ["favored-enemy", "Favored Enemy", 1], ["natural-explorer", "Natural Explorer", 1],
  ["fighting-style", "Fighting Style", 2], ["spellcasting", "Spellcasting", 2],
  ["ranger-archetype", "Ranger Archetype", 3], ["primeval-awareness", "Primeval Awareness", 3],
  ["ability-score-improvement-4", "Ability Score Improvement", 4], ["extra-attack", "Extra Attack", 5],
  ["favored-enemy-improvement-6", "Favored Enemy Improvement", 6], ["natural-explorer-improvement-6", "Natural Explorer Improvement", 6],
  ["ability-score-improvement-8", "Ability Score Improvement", 8], ["lands-stride", "Land's Stride", 8],
  ["natural-explorer-improvement-10", "Natural Explorer Improvement", 10], ["hide-in-plain-sight", "Hide in Plain Sight", 10],
  ["ability-score-improvement-12", "Ability Score Improvement", 12], ["favored-enemy-improvement-14", "Favored Enemy Improvement", 14],
  ["vanish", "Vanish", 14], ["ability-score-improvement-16", "Ability Score Improvement", 16],
  ["feral-senses", "Feral Senses", 18], ["ability-score-improvement-19", "Ability Score Improvement", 19],
  ["foe-slayer", "Foe Slayer", 20],
].map(([id, name, level]) => ({ id, name, level }));

const rangerFeatures2024 = [
  ["spellcasting", "Spellcasting", 1], ["favored-enemy", "Favored Enemy", 1], ["weapon-mastery", "Weapon Mastery", 1],
  ["deft-explorer", "Deft Explorer", 2], ["fighting-style", "Fighting Style", 2], ["ranger-subclass", "Ranger Subclass", 3],
  ["ability-score-improvement-4", "Ability Score Improvement", 4], ["extra-attack", "Extra Attack", 5],
  ["roving", "Roving", 6], ["ability-score-improvement-8", "Ability Score Improvement", 8],
  ["expertise", "Expertise", 9], ["tireless", "Tireless", 10], ["ability-score-improvement-12", "Ability Score Improvement", 12],
  ["relentless-hunter", "Relentless Hunter", 13], ["natures-veil", "Nature's Veil", 14],
  ["ability-score-improvement-16", "Ability Score Improvement", 16], ["precise-hunter", "Precise Hunter", 17],
  ["feral-senses", "Feral Senses", 18], ["epic-boon", "Epic Boon", 19], ["foe-slayer", "Foe Slayer", 20],
].map(([id, name, level]) => ({ id, name, level }));

const rangerExpertiseItems = rangerSkills.map(([id, name]) => ({
  id: `${id}-expertise`, label: name,
  rules: { stats: [{ name: `${name.toLowerCase()}:proficiency`, value: "proficiency", bonus: "double" }] },
}));

const rangerBase = (ruleset) => ({
  certification: { ruleset, levels: [1, 20], verified: "2026-09-15" },
  requirements: "",
  prerequisite: "",
  setters: { hd: "d10" },
  rules: {
    grants: [],
    stats: [
      ...saveStats("strength", "dexterity"),
      ...(ruleset === "5.5e" ? [
        { name: "speed:misc", value: "10", level: 6 },
        { name: "speed:climb", value: "speed", level: 6, bonus: "base" },
        { name: "speed:swim", value: "speed", level: 6, bonus: "base" },
      ] : []),
    ],
    proficiencies: ["Light Armor", "Medium Armor", "Shields", "Simple Weapons", "Martial Weapons"],
    subclassLevel: 3,
    selections: [
      skillSelection("Skill Proficiency (Ranger)", rangerSkills, 3),
      ...(ruleset === "5e" ? [
        { type: "Favored Enemy", name: "Favored Enemies", number: levelTable([1, 5, 1], [6, 13, 2], [14, 20, 3]), items: ["Aberrations", "Beasts", "Celestials", "Constructs", "Dragons", "Elementals", "Fey", "Fiends", "Giants", "Monstrosities", "Oozes", "Plants", "Undead"].map((name) => ({ id: name.toLowerCase(), label: name, rules: { features: [{ id: `favored-enemy-${name.toLowerCase()}`, name: `Favored Enemy: ${name}` }] } })) },
        { type: "Natural Explorer", name: "Favored Terrains", number: levelTable([1, 5, 1], [6, 9, 2], [10, 20, 3]), items: ["Arctic", "Coast", "Desert", "Forest", "Grassland", "Mountain", "Swamp", "Underdark"].map((name) => ({ id: name.toLowerCase(), label: name, rules: { features: [{ id: `favored-terrain-${name.toLowerCase()}`, name: `Favored Terrain: ${name}` }] } })) },
      ] : [
        { type: "Weapon Mastery", name: "Weapon Mastery", number: 2, items: masteryItems },
        { type: "Expertise", name: "Deft Explorer Expertise", level: 2, number: 1, items: rangerExpertiseItems },
        { type: "Expertise", name: "Level 9 Expertise", level: 9, number: 2, items: rangerExpertiseItems },
      ]),
      { type: "Fighting Style", name: "Fighting Style", level: 2, number: 1, items: ruleset === "5e" ? fightingStyles.filter(({ id }) => ["archery", "defense", "dueling", "two-weapon-fighting"].includes(id)) : fightingStyles2024 },
      ...([4, 8, 12, 16].map((level) => asiSelection(level))),
      asiSelection(19, asiOptions(), ruleset === "5.5e" ? "Level 19 Epic Boon" : "Level 19 Feat or Ability Score Improvement"),
    ],
    spellcasting: rangerProfile(ruleset),
    features: ruleset === "5e" ? rangerFeatures2014 : rangerFeatures2024,
    resources: ruleset === "5.5e" ? [
      { id: "favored-enemy", name: "Favored Enemy", max: levelTable([1, 4, 2], [5, 8, 3], [9, 12, 4], [13, 16, 5], [17, 20, 6]), reset: "long" },
      { id: "natures-veil", name: "Nature's Veil", level: 14, max: "proficiency", reset: "long" },
    ] : [],
    actions: ruleset === "5.5e" ? [
      { id: "favored-enemy", name: "Favored Enemy: Hunter's Mark", action: "Bonus Action", resourceId: "favored-enemy" },
      { id: "natures-veil", name: "Nature's Veil", level: 14, action: "Bonus Action", resourceId: "natures-veil" },
    ] : [],
    combat: { attacksPerAction: levelTable([1, 4, 1], [5, 20, 2]) },
    warnings: ruleset === "5e" ? [{ code: "manual-automation", path: "build.languages", message: "Favored Enemy language choices remain manual." }]
      : [{ code: "manual-automation", path: "build.spells", message: "Favored Enemy's always-prepared Hunter's Mark remains manual until that spell entry is certified." }],
  },
});

const subclass = (ruleset, level, features, combat = {}, selections = [], extraRules = {}) => ({
  certification: { ruleset, levels: [level, 20], verified: "2026-09-15" },
  requirements: "",
  prerequisite: "",
  rules: {
    grants: [], selections, stats: [], ...extraRules,
    features: features.map(([id, name, featureLevel = level]) => ({ id, name, level: featureLevel })),
    ...(Object.keys(combat).length ? { combat } : {}),
  },
});

const originCertification = (ruleset, rules) => ({
  certification: { ruleset, levels: [1, 20], verified: "2026-09-14" },
  requirements: "",
  prerequisite: "",
  rules: { grants: [], stats: [], selections: [], ...rules },
});

const human2014 = originCertification("5e", {
  stats: [
    ...abilities.map(([name]) => ({ name, value: "1" })),
    { name: "innate speed", value: "30", bonus: "base" },
  ],
  languages: ["Common"],
  character: { creatureType: "Humanoid", size: "Medium" },
  selections: [
    { type: "Language", name: "Language (Human)", number: 1, items: allLanguages.filter((item) => item.id !== "common") },
    {
      type: "Race Variant",
      name: "Human Variant",
      number: 1,
      optional: true,
      items: [{ id: "variant-human-manual", label: "Variant Human (manual automation)", automation: "manual" }],
    },
  ],
});

const human2024 = originCertification("5.5e", {
  stats: [{ name: "innate speed", value: "30", bonus: "base" }],
  languages: ["Common"],
  character: { creatureType: "Humanoid" },
  features: [
    { id: "resourceful", name: "Resourceful" },
    { id: "skillful", name: "Skillful" },
    { id: "versatile", name: "Versatile" },
  ],
  rest: { long: { inspiration: true } },
  selections: [
    {
      type: "Size",
      name: "Size (Human)",
      number: 1,
      items: ["Small", "Medium"].map((size) => ({ id: size.toLowerCase(), label: size, rules: { character: { size } } })),
    },
    { type: "Proficiency", name: "Skillful Skill Proficiency", number: 1, items: allSkills.map(([id, name]) => skill(id, name)) },
    {
      type: "Feat",
      name: "Versatile Origin Feat",
      number: 1,
      items: [
        {
          id: "tough",
          label: "Tough",
          rules: {
            stats: [{ name: "additional:hp:max", value: "2", perLevel: true }],
            features: [{ id: "tough", name: "Tough" }],
          },
        },
        { id: "other-origin-feat", label: "Other Origin Feat (manual automation)", automation: "manual" },
      ],
    },
    { type: "Language", name: "Languages (Character Creation)", number: 2, items: standardLanguages.filter((item) => item.id !== "common") },
  ],
});

const sage2014 = originCertification("5e", {
  stats: [skill("arcana", "Arcana").rules.stats[0], skill("history", "History").rules.stats[0]],
  features: [{ id: "researcher", name: "Researcher" }],
  selections: [{ type: "Language", name: "Languages (Sage)", number: 2, items: allLanguages }],
});

const soldier2014 = originCertification("5e", {
  stats: [skill("athletics", "Athletics").rules.stats[0], skill("intimidation", "Intimidation").rules.stats[0]],
  proficiencies: ["Vehicles (Land)"],
  features: [{ id: "military-rank", name: "Military Rank" }],
  selections: [{ type: "Proficiency", name: "Gaming Set", number: 1, items: gamingSets }],
});

const sage2024 = originCertification("5.5e", {
  stats: [skill("arcana", "Arcana").rules.stats[0], skill("history", "History").rules.stats[0]],
  proficiencies: ["Calligrapher’s Supplies"],
  features: [{ id: "magic-initiate-wizard", name: "Magic Initiate (Wizard)" }],
  selections: [{
    type: "Ability Score Improvement",
    name: "Ability Scores (Sage)",
    number: 1,
    items: backgroundAbilityOptions(["constitution", "intelligence", "wisdom"]),
  }],
  warnings: [{
    code: "manual-automation",
    path: "build.spells",
    blocking: false,
    message: "Magic Initiate (Wizard) spell choices remain manual until a rules-ready spell catalog is certified.",
  }],
});

const soldier2024 = originCertification("5.5e", {
  stats: [skill("athletics", "Athletics").rules.stats[0], skill("intimidation", "Intimidation").rules.stats[0]],
  features: [{ id: "savage-attacker", name: "Savage Attacker" }],
  weaponModifiers: [{ damageRollTwice: true, label: "Savage Attacker", oncePerTurn: true }],
  selections: [
    {
      type: "Ability Score Improvement",
      name: "Ability Scores (Soldier)",
      number: 1,
      items: backgroundAbilityOptions(["strength", "dexterity", "constitution"]),
    },
    { type: "Proficiency", name: "Gaming Set (Soldier)", number: 1, items: gamingSets },
  ],
});

module.exports = {
  ID_WOTC_PHB_CLASS_FIGHTER: fighterBase("5e"),
  ID_WOTC_PHB24_CLASS_FIGHTER: fighterBase("5.5e"),
  ID_WOTC_PHB_CLASS_WIZARD: wizardBase("5e"),
  ID_WOTC_PHB24_CLASS_WIZARD: wizardBase("5.5e"),
  ID_WOTC_PHB_CLASS_CLERIC: clericBase("5e"),
  ID_WOTC_PHB24_CLASS_CLERIC: clericBase("5.5e"),
  ID_WOTC_PHB_CLASS_PALADIN: paladinBase("5e"),
  ID_WOTC_PHB24_CLASS_PALADIN: paladinBase("5.5e"),
  ID_WOTC_PHB_CLASS_DRUID: druidBase("5e"),
  ID_WOTC_PHB24_CLASS_DRUID: druidBase("5.5e"),
  ID_WOTC_PHB_CLASS_RANGER: rangerBase("5e"),
  ID_WOTC_PHB24_CLASS_RANGER: rangerBase("5.5e"),
  ID_WOTC_PHB_CLASS_BARD: bardBase("5e"),
  ID_WOTC_PHB24_CLASS_BARD: bardBase("5.5e"),
  ID_WOTC_PHB_CLASS_SORCERER: sorcererBase("5e"),
  ID_WOTC_PHB24_CLASS_SORCERER: sorcererBase("5.5e"),
  ID_WOTC_PHB_CLASS_WARLOCK: warlockBase("5e"),
  ID_WOTC_PHB24_CLASS_WARLOCK: warlockBase("5.5e"),
  ID_WOTC_PHB_CLASS_BARBARIAN: barbarianBase("5e"),
  ID_WOTC_PHB24_CLASS_BARBARIAN: barbarianBase("5.5e"),
  ID_WOTC_PHB_CLASS_MONK: monkBase("5e"),
  ID_WOTC_PHB24_CLASS_MONK: monkBase("5.5e"),
  ID_WOTC_PHB_CLASS_ROGUE: rogueBase("5e"),
  ID_WOTC_PHB24_CLASS_ROGUE: rogueBase("5.5e"),
  ID_WOTC_PHB_ARCHETYPE_CHAMPION: subclass("5e", 3, [
    ["improved-critical", "Improved Critical", 3], ["remarkable-athlete", "Remarkable Athlete", 7],
    ["additional-fighting-style", "Additional Fighting Style", 10], ["superior-critical", "Superior Critical", 15],
    ["survivor", "Survivor", 18],
  ], { criticalThreshold: levelTable([1, 14, 19], [15, 20, 18]) }, [{ type: "Fighting Style", name: "Additional Fighting Style", level: 10, number: 1, items: fightingStyles }]),
  ID_WOTC_PHB24_ARCHETYPE_FIGHTER_CHAMPION: subclass("5.5e", 3, [
    ["improved-critical", "Improved Critical", 3], ["remarkable-athlete", "Remarkable Athlete", 3],
    ["additional-fighting-style", "Additional Fighting Style", 7], ["heroic-warrior", "Heroic Warrior", 10],
    ["superior-critical", "Superior Critical", 15], ["survivor", "Survivor", 18],
  ], { criticalThreshold: levelTable([1, 14, 19], [15, 20, 18]) }, [{ type: "Fighting Style", name: "Additional Fighting Style", level: 7, number: 1, items: fightingStyles2024 }]),
  ID_WOTC_PHB_ARCHETYPE_WIZARD_SCHOOL_OF_EVOCATION: subclass("5e", 2, [
    ["evocation-savant", "Evocation Savant", 2], ["sculpt-spells", "Sculpt Spells", 2],
    ["potent-cantrip", "Potent Cantrip", 6], ["empowered-evocation", "Empowered Evocation", 10],
    ["overchannel", "Overchannel", 14],
  ]),
  ID_WOTC_PHB24_ARCHETYPE_WIZARD_EVOKER: subclass("5.5e", 3, [
    ["evocation-savant", "Evocation Savant", 3], ["potent-cantrip", "Potent Cantrip", 3],
    ["sculpt-spells", "Sculpt Spells", 6], ["empowered-evocation", "Empowered Evocation", 10],
    ["overchannel", "Overchannel", 14],
  ]),
  ID_WOTC_PHB_ARCHETYPE_LIFEDOMAIN: subclass("5e", 1, [
    ["bonus-proficiency", "Bonus Proficiency", 1], ["disciple-of-life", "Disciple of Life", 1],
    ["preserve-life", "Channel Divinity: Preserve Life", 2], ["blessed-healer", "Blessed Healer", 6],
    ["divine-strike", "Divine Strike", 8], ["supreme-healing", "Supreme Healing", 17],
  ], {}, [], {
    proficiencies: ["Heavy Armor"],
    actions: [{ id: "preserve-life", name: "Preserve Life", level: 2, action: "Action", resourceSourceId: "phbClassCleric", resourceId: "channel-divinity", range: "30 feet", healing: "5 × Cleric level" }],
    warnings: [{ code: "manual-automation", path: "build.spells", message: "Life Domain always-prepared spells remain manual until those spell entries are certified." }],
  }),
  ID_WOTC_PHB24_ARCHETYPE_CLERIC_LIFE_DOMAIN: subclass("5.5e", 3, [
    ["disciple-of-life", "Disciple of Life", 3], ["life-domain-spells", "Life Domain Spells", 3],
    ["preserve-life", "Preserve Life", 3], ["blessed-healer", "Blessed Healer", 6],
    ["supreme-healing", "Supreme Healing", 17],
  ], {}, [], {
    actions: [{ id: "preserve-life", name: "Preserve Life", level: 3, action: "Action", resourceSourceId: "phb24ClassCleric", resourceId: "channel-divinity", range: "30 feet", healing: "5 × Cleric level" }],
    warnings: [{ code: "manual-automation", path: "build.spells", message: "Life Domain always-prepared spells remain manual until those spell entries are certified." }],
  }),
  ID_WOTC_PHB_ARCHETYPE_PALADIN_OATH_OF_DEVOTION: subclass("5e", 3, [
    ["oath-spells", "Oath Spells", 3], ["sacred-weapon", "Sacred Weapon", 3],
    ["turn-the-unholy", "Turn the Unholy", 3], ["aura-of-devotion", "Aura of Devotion", 7],
    ["purity-of-spirit", "Purity of Spirit", 15], ["holy-nimbus", "Holy Nimbus", 20],
  ], {}, [], {
    actions: [
      { id: "sacred-weapon", name: "Sacred Weapon", level: 3, action: "Action", resourceSourceId: "phbClassPaladin", resourceId: "channel-divinity" },
      { id: "turn-the-unholy", name: "Turn the Unholy", level: 3, action: "Action", resourceSourceId: "phbClassPaladin", resourceId: "channel-divinity", range: "30 feet" },
      { id: "holy-nimbus", name: "Holy Nimbus", level: 20, action: "Action", resourceId: "holy-nimbus" },
    ],
    resources: [{ id: "holy-nimbus", name: "Holy Nimbus", level: 20, max: 1, reset: "long" }],
    warnings: [{ code: "manual-automation", path: "build.spells", message: "Oath of Devotion always-prepared spells remain manual until those spell entries are certified." }],
  }),
  ID_WOTC_PHB24_ARCHETYPE_PALADIN_OATH_OF_DEVOTION: subclass("5.5e", 3, [
    ["oath-of-devotion-spells", "Oath of Devotion Spells", 3], ["sacred-weapon", "Sacred Weapon", 3],
    ["aura-of-devotion", "Aura of Devotion", 7], ["smite-of-protection", "Smite of Protection", 15],
    ["holy-nimbus", "Holy Nimbus", 20],
  ], {}, [], {
    actions: [
      { id: "sacred-weapon", name: "Sacred Weapon", level: 3, action: "Action", resourceSourceId: "phb24ClassPaladin", resourceId: "channel-divinity" },
      { id: "holy-nimbus", name: "Holy Nimbus", level: 20, action: "Bonus Action", resourceId: "holy-nimbus" },
    ],
    resources: [{ id: "holy-nimbus", name: "Holy Nimbus", level: 20, max: 1, reset: "long" }],
    warnings: [{ code: "manual-automation", path: "build.spells", message: "Oath of Devotion always-prepared spells remain manual until those spell entries are certified." }],
  }),
  ID_WOTC_PHB_ARCHETYPE_CIRCLEOFTHELAND: subclass("5e", 2, [
    ["bonus-cantrip", "Bonus Cantrip", 2], ["natural-recovery", "Natural Recovery", 2],
    ["circle-spells", "Circle Spells", 3], ["lands-stride", "Land's Stride", 6],
    ["natures-ward", "Nature's Ward", 10], ["natures-sanctuary", "Nature's Sanctuary", 14],
  ], {}, [{
    type: "Circle Land", name: "Circle Land", level: 2, number: 1,
    items: ["Arctic", "Coast", "Desert", "Forest", "Grassland", "Mountain", "Swamp", "Underdark"].map((name) => ({ id: name.toLowerCase(), label: name, rules: { features: [{ id: `circle-land-${name.toLowerCase()}`, name: `Circle Land: ${name}`, level: 2 }] } })),
  }], {
    resources: [{ id: "natural-recovery", name: "Natural Recovery", level: 2, max: 1, reset: "long" }],
    actions: [{ id: "natural-recovery", name: "Natural Recovery", level: 2, action: "Other", resourceId: "natural-recovery" }],
    warnings: [{ code: "manual-automation", path: "build.spells", message: "Circle of the Land spells remain manual until those spell entries are certified." }],
  }),
  ID_WOTC_PHB24_ARCHETYPE_DRUID_CIRCLE_OF_THE_LAND: subclass("5.5e", 3, [
    ["circle-of-the-land-spells", "Circle of the Land Spells", 3], ["lands-aid", "Land's Aid", 3],
    ["natural-recovery", "Natural Recovery", 6], ["natures-ward", "Nature's Ward", 10],
    ["natures-sanctuary", "Nature's Sanctuary", 14],
  ], {}, [{
    type: "Circle Land", name: "Circle Land", level: 3, number: 1,
    items: ["Arid", "Polar", "Temperate", "Tropical"].map((name) => ({ id: name.toLowerCase(), label: name, rules: { features: [{ id: `circle-land-${name.toLowerCase()}`, name: `Circle Land: ${name}`, level: 3 }] } })),
  }], {
    resources: [{ id: "natural-recovery", name: "Natural Recovery", level: 6, max: 1, reset: "long" }],
    actions: [
      { id: "lands-aid", name: "Land's Aid", level: 3, action: "Action", resourceSourceId: "phb24ClassDruid", resourceId: "wild-shape", range: "60 feet" },
      { id: "natural-recovery", name: "Natural Recovery", level: 6, action: "Other", resourceId: "natural-recovery" },
    ],
    warnings: [{ code: "manual-automation", path: "build.spells", message: "Circle of the Land spells remain manual until those spell entries are certified." }],
  }),
  ID_WOTC_ARCHETYPE_RANGER_HUNTER: subclass("5e", 3, [
    ["hunters-prey", "Hunter's Prey", 3], ["defensive-tactics", "Defensive Tactics", 7],
    ["multiattack", "Multiattack", 11], ["superior-hunters-defense", "Superior Hunter's Defense", 15],
  ], {}, [
    { type: "Hunter's Prey", name: "Hunter's Prey", level: 3, number: 1, items: ["Colossus Slayer", "Giant Killer", "Horde Breaker"].map((name) => ({ id: name.toLowerCase().replaceAll(" ", "-"), label: name, rules: { features: [{ id: name.toLowerCase().replaceAll(" ", "-"), name, level: 3 }] } })) },
    { type: "Defensive Tactics", name: "Defensive Tactics", level: 7, number: 1, items: ["Escape the Horde", "Multiattack Defense", "Steel Will"].map((name) => ({ id: name.toLowerCase().replaceAll(" ", "-"), label: name, rules: { features: [{ id: name.toLowerCase().replaceAll(" ", "-"), name, level: 7 }] } })) },
    { type: "Multiattack", name: "Multiattack", level: 11, number: 1, items: ["Volley", "Whirlwind Attack"].map((name) => ({ id: name.toLowerCase().replaceAll(" ", "-"), label: name, rules: { features: [{ id: name.toLowerCase().replaceAll(" ", "-"), name, level: 11 }] } })) },
    { type: "Superior Hunter's Defense", name: "Superior Hunter's Defense", level: 15, number: 1, items: ["Evasion", "Stand Against the Tide", "Uncanny Dodge"].map((name) => ({ id: name.toLowerCase().replaceAll(" ", "-"), label: name, rules: { features: [{ id: name.toLowerCase().replaceAll(" ", "-"), name, level: 15 }] } })) },
  ]),
  ID_WOTC_PHB24_ARCHETYPE_RANGER_HUNTER: subclass("5.5e", 3, [
    ["hunters-lore", "Hunter's Lore", 3], ["hunters-prey", "Hunter's Prey", 3],
    ["defensive-tactics", "Defensive Tactics", 7], ["superior-hunters-prey", "Superior Hunter's Prey", 11],
    ["superior-hunters-defense", "Superior Hunter's Defense", 15],
  ], {}, [
    { type: "Hunter's Prey", name: "Hunter's Prey", level: 3, number: 1, items: ["Colossus Slayer", "Horde Breaker"].map((name) => ({ id: name.toLowerCase().replaceAll(" ", "-"), label: name, rules: { features: [{ id: name.toLowerCase().replaceAll(" ", "-"), name, level: 3 }] } })) },
      { type: "Defensive Tactics", name: "Defensive Tactics", level: 7, number: 1, items: ["Escape the Horde", "Multiattack Defense"].map((name) => ({ id: name.toLowerCase().replaceAll(" ", "-"), label: name, rules: { features: [{ id: name.toLowerCase().replaceAll(" ", "-"), name, level: 7 }] } })) },
  ]),
  ID_WOTC_PHB_ARCHETYPE_COLLEGE_OF_LORE: subclass("5e", 3, [
    ["bonus-proficiencies", "Bonus Proficiencies", 3], ["cutting-words", "Cutting Words", 3],
    ["additional-magical-secrets", "Additional Magical Secrets", 6], ["peerless-skill", "Peerless Skill", 14],
  ], {}, [
    { type: "Proficiency", name: "Bonus Proficiencies (College of Lore)", level: 3, number: 3, items: allSkills.map(([id, name]) => skill(id, name)) },
  ], {
    actions: [{ id: "cutting-words", name: "Cutting Words", level: 3, action: "Reaction", resourceSourceId: "phbClassBard", resourceId: "bardic-inspiration", range: "60 feet" }],
    warnings: [{ code: "manual-automation", path: "build.spells", level: 6, message: "Additional Magical Secrets spell choices remain manual until cross-list validation is certified." }],
  }),
  ID_WOTC_PHB24_ARCHETYPE_BARD_COLLEGE_OF_LORE: subclass("5.5e", 3, [
    ["bonus-proficiencies", "Bonus Proficiencies", 3], ["cutting-words", "Cutting Words", 3],
    ["magical-discoveries", "Magical Discoveries", 6], ["peerless-skill", "Peerless Skill", 14],
  ], {}, [
    { type: "Proficiency", name: "Bonus Proficiencies (College of Lore)", level: 3, number: 3, items: allSkills.map(([id, name]) => skill(id, name)) },
  ], {
    actions: [{ id: "cutting-words", name: "Cutting Words", level: 3, action: "Reaction", resourceSourceId: "phb24ClassBard", resourceId: "bardic-inspiration", range: "60 feet" }],
    warnings: [{ code: "manual-automation", path: "build.spells", level: 6, message: "Magical Discoveries spell choices remain manual until cross-list validation is certified." }],
  }),
  ID_WOTC_PHB_ARCHETYPE_DRACONIC_BLOODLINE: subclass("5e", 1, [
    ["dragon-ancestor", "Dragon Ancestor", 1], ["draconic-resilience", "Draconic Resilience", 1],
    ["elemental-affinity", "Elemental Affinity", 6], ["dragon-wings", "Dragon Wings", 14],
    ["draconic-presence", "Draconic Presence", 18],
  ], {}, [{
    type: "Draconic Ancestry", name: "Draconic Ancestry", level: 1, number: 1,
    items: ["Acid", "Cold", "Fire", "Lightning", "Poison"].map((name) => ({ id: name.toLowerCase(), label: name, rules: { features: [{ id: `draconic-ancestry-${name.toLowerCase()}`, name: `Draconic Ancestry: ${name}` }] } })),
  }], {
    languages: ["Draconic"],
    stats: [
      { name: "additional:hp:max", value: "1", perClassLevel: true },
      { name: "ac:misc", value: "3", equipped: "no-armor" },
      { name: "speed:fly", value: "speed", bonus: "base", level: 14 },
    ],
  }),
  ID_WOTC_PHB24_ARCHETYPE_SORCERER_DRACONIC_SORCERY: subclass("5.5e", 3, [
    ["draconic-resilience", "Draconic Resilience", 3], ["draconic-spells", "Draconic Spells", 3],
    ["elemental-affinity", "Elemental Affinity", 6], ["dragon-wings", "Dragon Wings", 14],
    ["dragon-companion", "Dragon Companion", 18],
  ], {}, [{
    type: "Elemental Affinity", name: "Elemental Affinity", level: 6, number: 1,
    items: ["Acid", "Cold", "Fire", "Lightning", "Poison"].map((name) => ({ id: name.toLowerCase(), label: name, rules: { features: [{ id: `elemental-affinity-${name.toLowerCase()}`, name: `Elemental Affinity: ${name}`, level: 6 }] } })),
  }], {
    stats: [
      { name: "additional:hp:max", value: "1", perClassLevel: true },
      { name: "ac:misc", value: "charisma:modifier", equipped: "no-armor" },
    ],
    warnings: [{ code: "manual-automation", path: "build.spells", level: 3, message: "Draconic Spells remain manual until their granted spell entries are certified." }],
  }),
  ID_WOTC_PHB_ARCHETYPE_OTHERWORLDLY_PATRON_FIEND: subclass("5e", 1, [
    ["expanded-spell-list", "Expanded Spell List", 1], ["dark-ones-blessing", "Dark One's Blessing", 1],
    ["dark-ones-own-luck", "Dark One's Own Luck", 6], ["fiendish-resilience", "Fiendish Resilience", 10],
    ["hurl-through-hell", "Hurl Through Hell", 14],
  ], {}, [{
    type: "Damage Type", name: "Fiendish Resilience", level: 10, number: 1,
    items: ["Acid", "Cold", "Fire", "Lightning", "Necrotic", "Poison", "Psychic", "Radiant", "Thunder"].map((name) => manualFeatureChoice(`fiendish-resilience-${name.toLowerCase()}`, name)),
  }], {
    resources: [
      { id: "dark-ones-own-luck", name: "Dark One's Own Luck", level: 6, max: 1, die: "d10", reset: "short" },
      { id: "hurl-through-hell", name: "Hurl Through Hell", level: 14, max: 1, reset: "long" },
    ],
    warnings: [
      { code: "manual-automation", path: "build.spells", level: 1, message: "Fiend expanded-spell eligibility and Dark One's Blessing temporary hit points remain manual until their spell and event effects are certified." },
      { code: "manual-automation", path: "sheet.actions", level: 14, message: "Hurl Through Hell target effects remain manual." },
    ],
  }),
  ID_WOTC_PHB24_ARCHETYPE_WARLOCK_FIEND_PATRON: subclass("5.5e", 3, [
    ["dark-ones-blessing", "Dark One's Blessing", 3], ["fiend-spells", "Fiend Spells", 3],
    ["dark-ones-own-luck", "Dark One's Own Luck", 6], ["fiendish-resilience", "Fiendish Resilience", 10],
    ["hurl-through-hell", "Hurl Through Hell", 14],
  ], {}, [{
    type: "Damage Type", name: "Fiendish Resilience", level: 10, number: 1,
    items: ["Acid", "Cold", "Fire", "Lightning", "Necrotic", "Poison", "Psychic", "Radiant", "Thunder"].map((name) => manualFeatureChoice(`fiendish-resilience-${name.toLowerCase()}`, name)),
  }], {
    resources: [
      { id: "dark-ones-own-luck", name: "Dark One's Own Luck", level: 6, max: { type: "ability-modifier", ability: "charisma", minimum: 1 }, die: "d10", reset: "long" },
      { id: "hurl-through-hell", name: "Hurl Through Hell", level: 14, max: 1, reset: "long" },
    ],
    warnings: [
      { code: "manual-automation", path: "build.spells", level: 3, message: "Fiend always-prepared spells and Dark One's Blessing temporary hit points remain manual until their spell and event effects are certified." },
      { code: "manual-automation", path: "sheet.actions", level: 14, message: "Hurl Through Hell target effects and pact-slot recovery remain manual." },
    ],
  }),
  ID_WOTC_PHB_ARCHETYPE_PATH_OF_THE_BERSERKER: subclass("5e", 3, [
    ["frenzy", "Frenzy", 3], ["mindless-rage", "Mindless Rage", 6],
    ["intimidating-presence", "Intimidating Presence", 10], ["retaliation", "Retaliation", 14],
  ], {}, [], {
    actions: [
      { id: "frenzy", name: "Frenzy Attack", level: 3, action: "Bonus Action" },
      { id: "intimidating-presence", name: "Intimidating Presence", level: 10, action: "Action", range: "30 feet" },
      { id: "retaliation", name: "Retaliation", level: 14, action: "Reaction", range: "5 feet" },
    ],
    warnings: [
      { code: "manual-automation", path: "runtime.frenzy", level: 3, message: "Frenzy's Rage timing and post-Rage Exhaustion remain manual." },
      { code: "manual-automation", path: "sheet.defenses.mindlessRage", level: 6, message: "Mindless Rage's conditional Charmed and Frightened protection remains manual." },
    ],
  }),
  ID_WOTC_PHB24_ARCHETYPE_BARBARIAN_BERSERKER: subclass("5.5e", 3, [
    ["frenzy", "Frenzy", 3], ["mindless-rage", "Mindless Rage", 6],
    ["retaliation", "Retaliation", 10], ["intimidating-presence", "Intimidating Presence", 14],
  ], {}, [], {
    resources: [{ id: "intimidating-presence", name: "Intimidating Presence", level: 14, max: 1, reset: "long" }],
    actions: [
      { id: "retaliation", name: "Retaliation", level: 10, action: "Reaction", range: "5 feet" },
      { id: "intimidating-presence", name: "Intimidating Presence", level: 14, action: "Bonus Action", resourceId: "intimidating-presence", range: "30 feet" },
    ],
    warnings: [
      { code: "manual-automation", path: "runtime.frenzy", level: 3, message: "Frenzy's conditional Rage damage remains manual." },
      { code: "manual-automation", path: "sheet.defenses.mindlessRage", level: 6, message: "Mindless Rage's conditional Charmed and Frightened immunity remains manual." },
      { code: "manual-automation", path: "runtime.intimidatingPresence", level: 14, message: "Intimidating Presence target saves and Rage-use recovery remain manual." },
    ],
  }),
  ID_WOTC_PHB_ARCHETYPE_WAY_OF_THE_OPEN_HAND: subclass("5e", 3, [
    ["open-hand-technique", "Open Hand Technique", 3], ["wholeness-of-body", "Wholeness of Body", 6],
    ["tranquility", "Tranquility", 11], ["quivering-palm", "Quivering Palm", 17],
  ], {}, [], {
    resources: [{ id: "wholeness-of-body", name: "Wholeness of Body", level: 6, max: 1, reset: "long" }],
    actions: [
      { id: "wholeness-of-body", name: "Wholeness of Body", level: 6, action: "Action", resourceId: "wholeness-of-body", healing: "3 × Monk level" },
      { id: "quivering-palm", name: "Quivering Palm", level: 17, action: "Action" },
    ],
    warnings: [
      { code: "manual-automation", path: "sheet.actions.openHandTechnique", level: 3, message: "Open Hand Technique's target effects remain manual." },
      { code: "manual-automation", path: "build.spells.tranquility", level: 11, message: "Tranquility's Sanctuary effect remains manual until that spell entry is certified." },
      { code: "manual-automation", path: "runtime.quiveringPalm", level: 17, message: "Quivering Palm's three-point cost, target, save, and damage remain manual." },
    ],
  }),
  ID_WOTC_PHB24_ARCHETYPE_MONK_WARRIOR_OF_THE_OPEN_HAND: subclass("5.5e", 3, [
    ["open-hand-technique", "Open Hand Technique", 3], ["wholeness-of-body", "Wholeness of Body", 6],
    ["fleet-step", "Fleet Step", 11], ["quivering-palm", "Quivering Palm", 17],
  ], {}, [], {
    resources: [{ id: "wholeness-of-body", name: "Wholeness of Body", level: 6, max: { type: "ability-modifier", ability: "wisdom", minimum: 1 }, reset: "long" }],
    actions: [
      { id: "wholeness-of-body", name: "Wholeness of Body", level: 6, action: "Bonus Action", resourceId: "wholeness-of-body", healing: {
        type: "table",
        values: Object.fromEntries(Object.entries(martialArtsDie("5.5e").values).map(([level, die]) => [level, `${die} + Wisdom modifier`])),
      } },
      { id: "quivering-palm", name: "Quivering Palm", level: 17, action: "Other" },
    ],
    warnings: [
      { code: "manual-automation", path: "sheet.actions.openHandTechnique", level: 3, message: "Open Hand Technique's target effects remain manual." },
      { code: "manual-automation", path: "runtime.quiveringPalm", level: 17, message: "Quivering Palm's four-point cost, target, save, and damage remain manual." },
    ],
  }),
  ID_WOTC_PHB_ARCHETYPE_THIEF: subclass("5e", 3, [
    ["fast-hands", "Fast Hands", 3], ["second-story-work", "Second-Story Work", 3],
    ["supreme-sneak", "Supreme Sneak", 9], ["use-magic-device", "Use Magic Device", 13],
    ["thiefs-reflexes", "Thief's Reflexes", 17],
  ], {}, [], {
    actions: [
      { id: "fast-hands-sleight-of-hand", name: "Fast Hands: Sleight of Hand", level: 3, action: "Bonus Action" },
      { id: "fast-hands-thieves-tools", name: "Fast Hands: Thieves' Tools", level: 3, action: "Bonus Action" },
      { id: "fast-hands-utilize", name: "Fast Hands: Utilize", level: 3, action: "Bonus Action" },
    ],
    warnings: [
      { code: "manual-automation", path: "sheet.movement.secondStoryWork", level: 3, message: "Second-Story Work's climbing and jump-distance adjustments remain manual." },
      { code: "manual-automation", path: "sheet.skills.supremeSneak", level: 9, message: "Supreme Sneak's conditional Stealth advantage remains manual during rolls." },
      { code: "manual-automation", path: "runtime.useMagicDevice", level: 13, message: "Use Magic Device eligibility remains manual for individual magic items." },
      { code: "manual-automation", path: "runtime.thiefsReflexes", level: 17, message: "Thief's Reflexes' extra first-round turn remains manual in initiative." },
    ],
  }),
  ID_WOTC_PHB24_ARCHETYPE_ROGUE_THIEF: subclass("5.5e", 3, [
    ["fast-hands", "Fast Hands", 3], ["second-story-work", "Second-Story Work", 3],
    ["supreme-sneak", "Supreme Sneak", 9], ["use-magic-device", "Use Magic Device", 13],
    ["thiefs-reflexes", "Thief's Reflexes", 17],
  ], {}, [], {
    stats: [{ name: "speed:climb", value: "speed", bonus: "base", level: 3 }],
    actions: [
      { id: "fast-hands-sleight-of-hand", name: "Fast Hands: Sleight of Hand", level: 3, action: "Bonus Action" },
      { id: "fast-hands-utilize", name: "Fast Hands: Utilize or Magic Item", level: 3, action: "Bonus Action" },
      { id: "supreme-sneak", name: "Supreme Sneak: Stealth Attack (cost 1d6)", level: 9, action: "Other" },
    ],
    warnings: [
      { code: "manual-automation", path: "sheet.movement.secondStoryWork", level: 3, message: "Second-Story Work's Dexterity-based jump distance remains manual; Climb Speed calculates automatically." },
      { code: "manual-automation", path: "runtime.supremeSneak", level: 9, message: "Supreme Sneak's Sneak Attack die cost and cover check remain manual." },
      { code: "manual-automation", path: "runtime.useMagicDevice", level: 13, message: "Use Magic Device's four-item attunement limit, charge refund roll, and scroll checks remain manual." },
      { code: "manual-automation", path: "runtime.thiefsReflexes", level: 17, message: "Thief's Reflexes' extra first-round turn remains manual in initiative." },
    ],
  }),
  ID_RACE_HUMAN: human2014,
  ID_WOTC_PHB24_RACE_HUMAN: human2024,
  ID_BACKGROUND_SAGE: sage2014,
  ID_WOTC_PHB24_BACKGROUND_SAGE: sage2024,
  ID_BACKGROUND_SOLDIER: soldier2014,
  ID_WOTC_PHB24_BACKGROUND_SOLDIER: soldier2024,
};
