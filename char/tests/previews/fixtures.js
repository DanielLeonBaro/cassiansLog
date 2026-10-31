// Disposable demo documents. These never enter character storage or connected APIs.
const abilities = (values, saves) => Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map((key, index) => [key, { score: values[index], modifier: Math.floor((values[index] - 10) / 2), save: saves[index], skills: [] }]));
const shared = {
  ac: 18, initiative: 2, proficiency: 3, walk: 30, fly: 30, passivePerception: 13, darkvision: 60, conditions: [], concentration: null,
  deathSaves: { failures: 0, successes: 0, stable: 0 }, inspiration: 0, cinematic: 0,
  defenses: { resistances: [], immunities: [], vulnerabilities: [] },
  features: [], extras: [], resources: [], spells: [], trackers: [],
  spellcasting: { profiles: [], slots: [] },
  inventory: [
    { id: "potion", name: "Potion of Healing", quantity: 2, description: "A small vial of red liquid. Record its effect with HP controls; this preview does not apply healing automatically." },
    { id: "pack", name: "Explorer's Pack", quantity: 1, description: "Bedroll, mess kit, tinderbox, torches, rations, waterskin, and rope." },
    { id: "rope", name: "Hempen Rope", quantity: 1, description: "50 feet of rope.", weight: 10 },
  ],
  notes: [{ title: "Next session", body: "Meet the party at the old bridge. Ask about the missing caravan." }],
};

const fighter = {
  ...structuredClone(shared), id: "preview-fighter", name: "Rowan Ashford", kind: "character", class: "Fighter", subclass: "Battle Master", level: 5, race: "Human", background: "Soldier",
  hp: { current: 38, max: 44, temp: 0 }, hitDice: [{ die: "d10", current: 4, max: 5 }],
  stats: abilities([18, 14, 16, 10, 12, 8], [7, 2, 6, 0, 1, -1]),
  actions: [
    { id: "longsword", name: "Longsword", action: "Action", category: "Weapon", range: "5 ft", attack: "+7", damage: "1d8+4", description: "Make a melee weapon attack. You can make two attacks when you take the Attack action. Rolling dice does not spend an action or a resource." },
    { id: "second-wind", name: "Second Wind", action: "Bonus Action", uses: { current: 1, max: 1, reset: "short" }, description: "Recover 1d10 + 5 hit points. Confirming records the use; apply the healing separately through HP." },
    { id: "sweep", name: "Sweeping Attack", action: "Action", resourceId: "superiority", attack: "+7", damage: "1d8", range: "5 ft", description: "Spend a superiority die to sweep through a nearby foe. This records the die spent, not target damage." },
    { id: "crossbow", name: "Light Crossbow", action: "Action", category: "Weapon", range: "80/320 ft", attack: "+5", damage: "1d8+2", description: "A ranged weapon attack. Ammunition is managed separately." },
    { id: "parry", name: "Parry", action: "Reaction", resourceId: "superiority", description: "Use a superiority die to reduce damage from a melee attack. Damage changes remain manual." },
    { id: "surge", name: "Action Surge", action: "Free Action", uses: { current: 1, max: 1, reset: "short" }, description: "Take an additional action on your turn. The advisory turn checklist never blocks additional actions." },
  ],
  resources: [{ id: "superiority", name: "Superiority Dice", die: "d8", uses: { current: 3, max: 4, reset: "short" } }],
  features: [{ id: "extra-attack", name: "Extra Attack", description: "You can attack twice when you take the Attack action on your turn." }, { id: "fighting-style", name: "Dueling", description: "Your recorded weapon damage includes your chosen fighting style." }],
  trackers: [{ id: "torch", name: "Torch lit", active: false }],
  pins: ["actions:longsword", "actions:second-wind", "actions:sweep"],
};
fighter.stats.str.skills = [{ name: "Athletics", modifier: 7, proficiency: true }];
fighter.stats.dex.skills = [{ name: "Acrobatics", modifier: 2 }, { name: "Stealth", modifier: 2 }];
fighter.stats.wis.skills = [{ name: "Insight", modifier: 4, proficiency: true }, { name: "Perception", modifier: 4, proficiency: true }, { name: "Survival", modifier: 1 }];
fighter.stats.cha.skills = [{ name: "Intimidation", modifier: 2, proficiency: true }, { name: "Persuasion", modifier: -1 }];

const caster = {
  ...structuredClone(shared), id: "preview-caster", name: "Mira Voss", kind: "character", class: "Wizard", subclass: "School of Abjuration", race: "Elf", background: "Sage", level: 5, ac: 15, initiative: 3,
  hp: { current: 24, max: 32, temp: 4 }, hitDice: [{ die: "d6", current: 3, max: 5 }],
  stats: abilities([8, 16, 14, 18, 12, 10], [-1, 3, 2, 7, 4, 0]),
  actions: [{ id: "staff", name: "Quarterstaff", action: "Action", category: "Weapon", range: "5 ft", attack: "+2", damage: "1d6-1", description: "A simple melee weapon attack." }],
  spellcasting: {
    profiles: [{ id: "wizard", name: "Wizard", ability: "int", preparedLimit: 9, attackBonus: 7, saveDC: 15 }],
    slots: [{ id: "level-1", profileId: "wizard", level: 1, current: 3, max: 4, reset: "long" }, { id: "level-2", profileId: "wizard", level: 2, current: 2, max: 3, reset: "long" }, { id: "level-3", profileId: "wizard", level: 3, current: 1, max: 2, reset: "long" }],
  },
  spells: [
    { id: "fire-bolt", name: "Fire Bolt", level: 0, action: "Action", category: "Cantrip", school: "Evocation", attack: "+7", damage: "2d10", range: "120 ft", known: true, prepared: true, castable: true, source: "wizard", description: "Make a ranged spell attack. A hit deals the recorded fire damage." },
    { id: "missile", name: "Magic Missile", level: 1, action: "Action", school: "Evocation", damage: "1d4+1", range: "120 ft", spellbook: true, prepared: true, castable: true, source: "wizard", slotOptions: ["level-1", "level-2", "level-3"], description: "Create three darts of magical force. Choose a higher-level slot to upcast. Target damage remains manual." },
    { id: "shield", name: "Shield", level: 1, action: "Reaction", school: "Abjuration", range: "Self", duration: "1 round", spellbook: true, prepared: true, castable: true, source: "wizard", slotOptions: ["level-1", "level-2", "level-3"], description: "A magical barrier protects you. Record the effect with a condition or adjust AC manually if needed." },
    { id: "web", name: "Web", level: 2, action: "Action", school: "Conjuration", range: "60 ft", save: "DEX 15", concentration: true, duration: "1 hour", spellbook: true, prepared: true, castable: true, source: "wizard", slotOptions: ["level-2", "level-3"], description: "Fill an area with sticky webbing. Casting spends the selected slot and records concentration." },
    { id: "misty-step", name: "Misty Step", level: 2, action: "Bonus Action", school: "Conjuration", range: "Self", spellbook: true, prepared: true, castable: true, source: "wizard", slotOptions: ["level-2", "level-3"], description: "Teleport to an unoccupied space you can see. Movement on the battlefield is not automated." },
    { id: "detect", name: "Detect Magic", level: 1, action: "Action", school: "Divination", range: "Self", ritual: true, ritualCastable: true, spellbook: true, prepared: false, castable: false, source: "wizard", slotOptions: ["level-1", "level-2", "level-3"], description: "Sense nearby magic. This unprepared spell can be cast as a ritual without spending a slot." },
  ],
  resources: [{ id: "recovery", name: "Arcane Recovery", uses: { current: 1, max: 1, reset: "long" } }],
  features: [{ id: "ward", name: "Arcane Ward", description: "Your ward absorbs damage. Its current strength can be recorded in a custom tracker." }],
  extras: [{ id: "familiar", name: "Pip", type: "Familiar", description: "An owl familiar. AC 11; HP 1; fly speed 60 ft." }],
  pins: ["spells:fire-bolt", "spells:missile", "spells:shield"],
};
caster.stats.int.skills = [{ name: "Arcana", modifier: 7, proficiency: true }, { name: "History", modifier: 7, proficiency: true }, { name: "Investigation", modifier: 7, proficiency: true }, { name: "Nature", modifier: 4 }, { name: "Religion", modifier: 4 }];
caster.stats.wis.skills = [{ name: "Insight", modifier: 1 }, { name: "Perception", modifier: 4, proficiency: true }];
caster.inventory.push({ id: "wand", name: "Wand of Magic Detection", quantity: 1, charges: { current: 2, max: 3, reset: "long" }, description: "Spend a recorded charge to detect magic. No other effect is applied automatically." });

const npc = {
  ...structuredClone(shared), id: "preview-npc", name: "Grave Sentinel", kind: "npc", type: "Medium undead", challenge: "5", alignment: "Lawful neutral", ac: 17, initiative: 1, walk: 30,
  hp: { current: 61, max: 75, temp: 0 }, hitDice: [{ die: "d8", current: 10, max: 10 }],
  stats: abilities([18, 12, 16, 9, 14, 10], [7, 1, 6, -1, 5, 0]),
  defenses: { resistances: ["Necrotic"], immunities: ["Poison", "Poisoned"], vulnerabilities: ["Radiant"] },
  actions: [
    { id: "glaive", name: "Sentinel's Glaive", action: "Action", range: "10 ft", attack: "+7", damage: "1d10+4", description: "Make a melee weapon attack with the sentinel's glaive." },
    { id: "multiattack", name: "Multiattack", action: "Action", description: "The sentinel makes two glaive attacks. Each attack can be rolled separately." },
    { id: "breath", name: "Grave Breath", action: "Action", range: "15-ft cone", save: "CON 14", damage: "4d6", recharge: "Recharge 5–6", uses: { current: 1, max: 1, reset: "manual" }, description: "Exhale chilling grave dust. Record use here; determine recharge and target outcomes manually." },
    { id: "guard", name: "Unyielding Guard", action: "Reaction", description: "Interpose the glaive to protect a nearby ally. Apply the effect manually." },
  ],
  features: [{ id: "vigil", name: "Eternal Vigil", description: "The sentinel does not need to eat, drink, or sleep." }, { id: "secret", name: "DM notes", description: "The sentinel recognizes the lost heir's signet. This information is hidden in player view." }],
  inventory: [{ id: "glaive-item", name: "Ancient Glaive", quantity: 1, description: "A weathered ceremonial weapon." }],
  notes: [{ title: "Encounter", body: "Watches the eastern crypt. Becomes peaceful when shown the signet." }],
  pins: ["actions:multiattack", "actions:glaive", "actions:breath"],
};
npc.stats.wis.skills = [{ name: "Insight", modifier: 5, proficiency: true }, { name: "Perception", modifier: 5, proficiency: true }];

export const PREVIEW_FIXTURES = { fighter, caster, npc };
export function previewDocument(id = "fighter", readonly = false) {
  const document = structuredClone(PREVIEW_FIXTURES[id] || fighter);
  if (readonly && document.kind === "npc") { document.features = document.features.filter((item) => item.id !== "secret"); document.notes = []; }
  return document;
}
