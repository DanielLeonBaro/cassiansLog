const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const storageCode = fs.readFileSync("shared/js/storage.js", "utf8").replace(/export /g, "");
const textCode = fs.readFileSync("shared/js/text.js", "utf8").replace(/export /g, "");
const storageKeyCode = fs.readFileSync("char/js/storage-keys.js", "utf8").replace(/export /g, "");
const repositoryCode = fs.readFileSync("char/js/archive/repository.js", "utf8")
  .replace(/^import[\s\S]*?;\r?\n/gm, "")
  .replace(/import\.meta\.url/g, '"https://example.test/cassiansLog/char/js/archive/repository.js"')
  .replace(/export /g, "");
const values = new Map([
  ["dnd-characters", JSON.stringify({
    cassian: { id: "cassian", portrait: "data/portraits/Chibi Cassian.jpg" },
    custom: { id: "custom", portrait: "data:image/png;base64,abc" },
  })],
]);
const template = JSON.parse(fs.readFileSync("char/template/character.json", "utf8"));
const cloudWrites = [];
let failCloudWrite = false;
const context = {
  readCloudJSON: async () => null,
  writeCloudJSON: async (url, value) => {
    cloudWrites.push({ url, value });
    if (failCloudWrite) throw new Error("offline");
    return { ok: true };
  },
  fetch: async () => ({ ok: true, json: async () => template }),
  URL,
  localStorage: {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  },
};
vm.createContext(context);
vm.runInContext(`${storageCode}\n${textCode}\n${storageKeyCode}\n${repositoryCode}\nglobalThis.api = { storedCharacters, migrateLegacyPortrait, isBundledCharacter, applyNewCharacterSetup, createCharacter };`, context);

const characters = context.api.storedCharacters();
assert.equal(characters.cassian.portrait, "char/cassian/portrait.jpg");
assert.equal(characters.custom.portrait, "data:image/png;base64,abc");
assert.equal(JSON.parse(values.get("dnd-characters")).cassian.portrait, "char/cassian/portrait.jpg");

const catalog = JSON.parse(fs.readFileSync("char/catalog.json", "utf8"));
assert.equal(context.api.isBundledCharacter("cassian", catalog), true);
assert.equal(context.api.isBundledCharacter("elaria", catalog), true);
assert.equal(context.api.isBundledCharacter("template", catalog), true);
assert.equal(context.api.isBundledCharacter("custom", catalog), false);
for (const id of [...catalog.characters, "template"]) {
  const character = JSON.parse(fs.readFileSync(`char/${id}/character.json`, "utf8"));
  assert.equal(character.id, id);
}

const starter = context.api.applyNewCharacterSetup(template, {
  id: "mira",
  name: "  Mira  ",
  portrait: "data:image/png;base64,mira",
  class: "  Bard ",
  race: " Half-Elf ",
  level: "3",
  starterMode: "starter",
});
assert.equal(starter.name, "Mira");
assert.equal(starter.class, "Bard");
assert.equal(starter.race, "Half-Elf");
assert.equal(starter.level, 3);
assert.equal(starter.actions.length, template.actions.length);

const blank = context.api.applyNewCharacterSetup(template, {
  id: "blank",
  name: "Blank",
  level: 1,
  starterMode: "blank",
});
for (const collection of ["trackers", "actions", "spells", "resources", "features", "inventory"]) {
  assert.equal(blank[collection].length, 0, `${collection} should be empty in clean-sheet mode.`);
}
assert.equal(blank.spellcasting.enabled, false);
assert.equal(blank.spellcasting.profiles.length, 0);
assert.equal(blank.spellcasting.slots.length, 0);
assert.equal(blank.stats.str.skills[0].name, "Athletics", "Clean sheets must preserve skill scaffolding.");

(async () => {
  const created = await context.api.createCharacter({ name: "Cloud Hero", level: 2, starterMode: "blank" });
  assert.equal(created.cloudSaved, true);
  assert.equal(cloudWrites.at(-1).url, "api/characters/cloud-hero");
  assert.equal(cloudWrites.at(-1).value.source, "custom");
  assert.equal(JSON.parse(values.get("dnd-characters"))["cloud-hero"].name, "Cloud Hero");

  failCloudWrite = true;
  const localOnly = await context.api.createCharacter({ name: "Local Hero", level: 1, starterMode: "starter" });
  assert.equal(localOnly.cloudSaved, false);
  assert.equal(JSON.parse(values.get("dnd-characters"))["local-hero"].name, "Local Hero");
  console.log("Character repository, creation, and legacy portrait migration tests passed.");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
