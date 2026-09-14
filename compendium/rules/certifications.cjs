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

const skillSelection = (name, values) => ({
  type: "Proficiency",
  name,
  number: 2,
  items: values.map(([id, label]) => skill(id, label)),
});

const asiSelection = (items) => ({
  type: "Feat",
  name: "Level 4 Feat or Ability Score Improvement",
  level: 4,
  number: 1,
  items,
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
  ["ability-score-improvement", "Ability Score Improvement", 4], ["extra-attack", "Extra Attack", 5],
].map(([id, name, level]) => ({ id, name, level }));

const fighterFeatures2024 = [
  ["fighting-style", "Fighting Style", 1], ["second-wind", "Second Wind", 1],
  ["weapon-mastery", "Weapon Mastery", 1], ["action-surge", "Action Surge", 2],
  ["tactical-mind", "Tactical Mind", 2], ["fighter-subclass", "Fighter Subclass", 3],
  ["ability-score-improvement", "Ability Score Improvement", 4], ["extra-attack", "Extra Attack", 5],
  ["tactical-shift", "Tactical Shift", 5],
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
    : { type: "table", values: { 1: 4, 2: 5, 3: 6, 4: 7, 5: 9 } },
  cantrips: { type: "table", values: { 1: 3, 2: 3, 3: 3, 4: 4, 5: 4 } },
  spellbook: { type: "table", values: { 1: 6, 2: 8, 3: 10, 4: 12, 5: 14 } },
  recovery: { id: "arcane-recovery", budget: "half-level-up", maxSlotLevel: 5 },
});

const fighterBase = (ruleset) => ({
  certification: { ruleset, levels: [1, 5], verified: "2026-09-14" },
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
        number: { type: "table", default: 3, values: { 1: 3, 2: 3, 3: 3, 4: 4, 5: 4 } },
        items: masteryItems,
      }] : []),
      asiSelection(asiOptions()),
    ],
    features: ruleset === "5e" ? fighterFeatures2014 : fighterFeatures2024,
    resources: ruleset === "5e" ? [
      { id: "second-wind", name: "Second Wind", max: 1, reset: "short", action: "Bonus Action" },
      { id: "action-surge", name: "Action Surge", level: 2, max: 1, reset: "short" },
    ] : [
      { id: "second-wind", name: "Second Wind", max: { type: "table", values: { 1: 2, 2: 2, 3: 2, 4: 3, 5: 3 } }, reset: "long", recovery: { short: 1, long: "all" }, action: "Bonus Action" },
      { id: "action-surge", name: "Action Surge", level: 2, max: 1, reset: "short" },
    ],
    actions: ruleset === "5e" ? fighterActions : [...fighterActions, {
      id: "tactical-mind",
      name: "Tactical Mind",
      level: 2,
      action: "Reaction",
      resourceId: "second-wind",
      description: "After a failed ability check, add 1d10; refund the use if the check still fails.",
    }],
    combat: { attacksPerAction: { type: "table", values: { 1: 1, 2: 1, 3: 1, 4: 1, 5: 2 } } },
  },
});

const wizardBase = (ruleset) => ({
  certification: { ruleset, levels: [1, 5], verified: "2026-09-14" },
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
      asiSelection(asiOptions()),
    ],
    spellcasting: wizardProfile(ruleset),
    features: (ruleset === "5e" ? [
      ["spellcasting", "Spellcasting", 1], ["arcane-recovery", "Arcane Recovery", 1],
      ["arcane-tradition", "Arcane Tradition", 2], ["ability-score-improvement", "Ability Score Improvement", 4],
    ] : [
      ["spellcasting", "Spellcasting", 1], ["ritual-adept", "Ritual Adept", 1],
      ["arcane-recovery", "Arcane Recovery", 1], ["scholar", "Scholar", 2],
      ["wizard-subclass", "Wizard Subclass", 3], ["ability-score-improvement", "Ability Score Improvement", 4],
      ["memorize-spell", "Memorize Spell", 5],
    ]).map(([id, name, level]) => ({ id, name, level })),
    resources: [{ id: "arcane-recovery", name: "Arcane Recovery", max: 1, reset: "long" }],
  },
});

const subclass = (ruleset, level, features, combat = {}) => ({
  certification: { ruleset, levels: [level, 5], verified: "2026-09-14" },
  requirements: "",
  prerequisite: "",
  rules: {
    grants: [], selections: [], stats: [],
    features: features.map(([id, name]) => ({ id, name, level })),
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
  ID_WOTC_PHB_ARCHETYPE_CHAMPION: subclass("5e", 3, [["improved-critical", "Improved Critical"]], { criticalThreshold: 19 }),
  ID_WOTC_PHB24_ARCHETYPE_FIGHTER_CHAMPION: subclass("5.5e", 3, [["improved-critical", "Improved Critical"], ["remarkable-athlete", "Remarkable Athlete"]], { criticalThreshold: 19 }),
  ID_WOTC_PHB_ARCHETYPE_WIZARD_SCHOOL_OF_EVOCATION: subclass("5e", 2, [["evocation-savant", "Evocation Savant"], ["sculpt-spells", "Sculpt Spells"]]),
  ID_WOTC_PHB24_ARCHETYPE_WIZARD_EVOKER: subclass("5.5e", 3, [["evocation-savant", "Evocation Savant"], ["potent-cantrip", "Potent Cantrip"]]),
  ID_RACE_HUMAN: human2014,
  ID_WOTC_PHB24_RACE_HUMAN: human2024,
  ID_BACKGROUND_SAGE: sage2014,
  ID_WOTC_PHB24_BACKGROUND_SAGE: sage2024,
  ID_BACKGROUND_SOLDIER: soldier2014,
  ID_WOTC_PHB24_BACKGROUND_SOLDIER: soldier2024,
};
