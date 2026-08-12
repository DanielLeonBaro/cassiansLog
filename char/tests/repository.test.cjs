const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const storageCode = fs.readFileSync("shared/js/storage.js", "utf8").replace(/export /g, "");
const repositoryCode = fs.readFileSync("char/js/archive/repository.js", "utf8")
  .replace(/^import .*\r?\n/gm, "")
  .replace(/import\.meta\.url/g, '"https://example.test/cassiansLog/char/js/archive/repository.js"')
  .replace(/export /g, "");
const values = new Map([
  ["dnd-characters", JSON.stringify({
    cassian: { id: "cassian", portrait: "data/portraits/Chibi Cassian.jpg" },
    custom: { id: "custom", portrait: "data:image/png;base64,abc" },
  })],
]);
const context = {
  readCloudJSON: async () => null,
  writeCloudJSON: async () => ({ ok: true }),
  localStorage: {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  },
};
vm.createContext(context);
vm.runInContext(`${storageCode}\n${repositoryCode}\nglobalThis.api = { storedCharacters, migrateLegacyPortrait };`, context);

const characters = context.api.storedCharacters();
assert.equal(characters.cassian.portrait, "char/cassian/portrait.jpg");
assert.equal(characters.custom.portrait, "data:image/png;base64,abc");
assert.equal(JSON.parse(values.get("dnd-characters")).cassian.portrait, "char/cassian/portrait.jpg");

const catalog = JSON.parse(fs.readFileSync("char/catalog.json", "utf8"));
for (const id of [...catalog.characters, "template"]) {
  const character = JSON.parse(fs.readFileSync(`char/${id}/character.json`, "utf8"));
  assert.equal(character.id, id);
}

console.log("Character repository and legacy portrait migration tests passed.");
