const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const modelCode = fs.readFileSync("js/features/tracker/spellcasting-model.js", "utf8")
  .replace(/export /g, "");
const storageCode = fs.readFileSync("js/shared/storage.js", "utf8")
  .replace(/export /g, "");
const hitPointCode = fs.readFileSync("js/features/tracker/hit-points.js", "utf8")
  .replace(/export /g, "");
const filterCode = fs.readFileSync("js/features/tracker/filter-utilities.js", "utf8")
  .replace(/export /g, "");
const deathSaveCode = fs.readFileSync("js/features/tracker/death-saves.js", "utf8")
  .replace(/export /g, "");
const restCode = fs.readFileSync("js/features/tracker/rest.js", "utf8")
  .replace(/export /g, "");
const appCode = fs.readFileSync("js/script.js", "utf8")
  .replace(/^import .*\n/gm, "")
  .replace(/export \{[\s\S]*?\};\s*export function initializeTracker/, "function initializeTracker");

function loadCharacter(source) {
  const storage = new Map();
  const context = {
    console,
    localStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
    },
    document: {
      readyState: "loading",
      title: "",
      addEventListener() {},
      getElementById() {
        return null;
      },
      querySelector() {
        return null;
      },
      querySelectorAll() {
        return [];
      },
      documentElement: {
        getAttribute() {
          return "dark";
        },
        setAttribute() {},
      },
    },
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(
    `${source}\n${modelCode}\n${storageCode}\n${hitPointCode}\n${filterCode}\n${deathSaveCode}\n${restCode}\n${appCode}\nglobalThis.testAPI = { character, getPreparedCount, togglePreparedSpell, toggleCharacterFlag, isAlwaysPreparedSpell, isSpellAvailableInCombat, getCombatItemRecords, renderAbilityCard, saveState, loadState, applyDamage, applyTemporaryHitPoints, toggleDeathSave, toggleStable, healHP, shortRest, longRest, getRestDetails };`,
    context,
  );
  return { ...context.testAPI, storage };
}

const karmaSource = fs.readFileSync("data/characters/karma.js", "utf8");
const karma = loadCharacter(karmaSource);
const shortRestDetails = karma.getRestDetails(
  karma.character,
  [
    { name: "Second Wind", uses: { reset: "short" } },
    { name: "Daily Feature", uses: { reset: "long" } },
  ],
  [
    { reset: "short" },
    { reset: "long" },
  ],
  "short",
);
assert.equal(shortRestDetails.duration, "At least 1 hour");
assert.match(shortRestDetails.effects.join(" "), /Second Wind/);
assert.doesNotMatch(shortRestDetails.effects.join(" "), /Daily Feature/);
assert.match(shortRestDetails.toast, /1 resource and 1 spell-slot group/);
const longRestDetails = karma.getRestDetails(
  karma.character,
  [
    { name: "Second Wind", uses: { reset: "short" } },
    { name: "Daily Feature", uses: { reset: "long" } },
  ],
  [{ reset: "short" }, { reset: "long" }],
  "long",
);
assert.equal(longRestDetails.duration, "At least 8 hours");
assert.match(longRestDetails.effects.join(" "), /Current HP returns/);
assert.match(longRestDetails.toast, /2 resources and 2 spell-slot groups/);
assert.equal(karma.character.inspiration, 0);
assert.equal(karma.character.cinematic, 0);
assert.equal(karma.toggleCharacterFlag("inspiration"), true);
assert.equal(karma.toggleCharacterFlag("cinematic"), true);
assert.equal(karma.character.inspiration, 1);
assert.equal(karma.character.cinematic, 1);
assert.deepEqual(
  JSON.parse(JSON.stringify(karma.character.deathSaves)),
  { failures: 0, successes: 0, stable: 0 },
);
karma.character.hp.current = 0;
karma.toggleDeathSave(karma.character.deathSaves, "failures", 1);
karma.toggleDeathSave(karma.character.deathSaves, "successes", 2);
karma.toggleStable(karma.character.deathSaves);
karma.saveState();
let savedDeathSaves = JSON.parse(karma.storage.get("dnd-karma-state")).deathSaves;
assert.deepEqual(savedDeathSaves, { failures: 2, successes: 3, stable: 1 });
karma.character.deathSaves = { failures: 0, successes: 0, stable: 0 };
karma.loadState();
assert.deepEqual(
  JSON.parse(JSON.stringify(karma.character.deathSaves)),
  { failures: 2, successes: 3, stable: 1 },
);
let savedFlags = JSON.parse(karma.storage.get("dnd-karma-state"));
assert.equal(savedFlags.inspiration, 1);
assert.equal(savedFlags.cinematic, 1);
karma.character.inspiration = 0;
karma.character.cinematic = 0;
karma.loadState();
assert.equal(karma.character.inspiration, 1);
assert.equal(karma.character.cinematic, 1);
karma.applyDamage(
  karma.character,
  karma.character.hp.current + karma.character.hp.temp + 5,
);
assert.equal(karma.character.hp.current, -5);
karma.saveState();
karma.character.hp.current = karma.character.hp.max;
karma.loadState();
assert.equal(karma.character.hp.current, -5);
karma.applyTemporaryHitPoints(karma.character, 3);
assert.equal(karma.character.hp.current, -2);
assert.equal(karma.character.hp.temp, 0);
karma.applyTemporaryHitPoints(karma.character, 5);
assert.equal(karma.character.hp.current, 0);
assert.equal(karma.character.hp.temp, 3);
karma.healHP(1);
assert.deepEqual(
  JSON.parse(JSON.stringify(karma.character.deathSaves)),
  { failures: 0, successes: 0, stable: 0 },
);
karma.character.deathSaves = { failures: 1, successes: 2, stable: 1 };
karma.shortRest();
assert.deepEqual(
  JSON.parse(JSON.stringify(karma.character.deathSaves)),
  { failures: 0, successes: 0, stable: 0 },
);
karma.character.deathSaves = { failures: 3, successes: 1, stable: 1 };
karma.longRest();
assert.deepEqual(
  JSON.parse(JSON.stringify(karma.character.deathSaves)),
  { failures: 0, successes: 0, stable: 0 },
);

const cleric = karma.character.spellcasting.profiles.find(
  (profile) => profile.id === "cleric",
);

const googleCard = karma.renderAbilityCard({
  id: "friends",
  name: "Friends",
  category: "Cantrip",
  description: "A spell.",
});
assert.match(
  googleCard,
  /https:\/\/www\.google\.com\/search\?q=Friends%20D%26D%205e/,
);
assert.match(googleCard, /target="_blank"/);

assert.equal(cleric.preparedLimit, 8);
assert.ok(karma.character.spells.every((spell) => spell.source));
assert.ok(
  karma.character.spellcasting.slots.every(
    (slot) => slot.profileId === "cleric",
  ),
);
assert.equal(karma.getPreparedCount("cleric"), 8);
assert.ok(
  karma
    .getCombatItemRecords()
    .some((record) => record.item.id === "bane"),
);
assert.ok(
  !karma
    .getCombatItemRecords()
    .some((record) => record.item.id === "healing-word"),
);
assert.equal(
  karma.isAlwaysPreparedSpell(
    karma.character.spells.find((spell) => spell.id === "false-life"),
  ),
  true,
);

karma.togglePreparedSpell("healing-word");
assert.equal(
  karma.character.spells.find((spell) => spell.id === "healing-word")
    .prepared,
  false,
  "the prepared limit must prevent a ninth selection",
);

karma.togglePreparedSpell("bane");
assert.ok(
  !karma
    .getCombatItemRecords()
    .some((record) => record.item.id === "bane"),
  "an unprepared spell must be removed from combat resources",
);
karma.togglePreparedSpell("healing-word");
assert.equal(
  karma.character.spells.find((spell) => spell.id === "healing-word")
    .prepared,
  true,
);
assert.equal(karma.getPreparedCount("cleric"), 8);
assert.ok(
  karma
    .getCombatItemRecords()
    .some((record) => record.item.id === "healing-word"),
);
const savedState = JSON.parse(karma.storage.get("dnd-karma-state"));
assert.equal(
  savedState.prepared.find((spell) => spell.id === "healing-word").prepared,
  true,
);

const allySource = fs.readFileSync("data/characters/ally.js", "utf8");
const ally = loadCharacter(allySource);
assert.equal(
  ally.character.spellcasting.profiles.find(
    (profile) => profile.id === "artificer",
  ).preparedLimit,
  7,
);
assert.equal(
  ally.isSpellAvailableInCombat(
    ally.character.spells.find((spell) => spell.id === "cure-wounds"),
  ),
  true,
);
assert.equal(
  ally.isAlwaysPreparedSpell(
    ally.character.spells.find((spell) => spell.id === "shield"),
  ),
  true,
);

const legacy = loadCharacter(`
  window.character = {
    id: "legacy",
    hp: { max: 1, current: 1, temp: 0 },
    spellcasting: {
      enabled: true,
      profiles: [{ name: "Cleric", ability: "WIS" }],
      slots: [{ id: "slot-1", level: 1, current: 1, max: 2 }]
    },
    spells: [{ id: "bless", name: "Bless", level: 1, spellcasting: "WIS" }]
  };
`);
assert.equal(legacy.character.spellcasting.profiles[0].id, "cleric");
assert.equal(legacy.character.spellcasting.profiles[0].preparedLimit, 0);
assert.equal(legacy.character.spellcasting.slots[0].profileId, "cleric");
assert.equal(legacy.character.spells[0].source, "cleric");

const profileless = loadCharacter(`
  window.character = {
    id: "profileless",
    hp: { max: 1, current: 1, temp: 0 },
    spellcasting: {
      enabled: true,
      profiles: [],
      slots: [{ id: "slot-1", level: 1, current: 1, max: 1 }]
    },
    spells: [{ id: "light", name: "Light", level: 0, spellcasting: "CHA" }]
  };
`);
assert.equal(profileless.character.spellcasting.profiles[0].id, "spellcasting");
assert.equal(
  profileless.character.spellcasting.slots[0].profileId,
  "spellcasting",
);

const savedKarma = loadCharacter(`
  window.character = {
    id: "karma",
    hp: { max: 31, current: 31, temp: 0 },
    spellcasting: {
      enabled: true,
      profiles: [{ name: "Cleric · Grave Domain", ability: "WIS" }],
      slots: []
    },
    spells: []
  };
`);
assert.equal(
  savedKarma.character.spellcasting.profiles[0].preparedLimit,
  8,
  "older locally saved Karma sheets should receive the new limit",
);

console.log("Spellcasting profile and preparation tests passed.");
