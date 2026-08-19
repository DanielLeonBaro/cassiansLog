const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const source = fs.readFileSync("public-initiative/js/model.js", "utf8").replace(/export /g, "");
const context = {};
vm.createContext(context);
vm.runInContext(`${source}\nglobalThis.initiativeNamesFromSnapshot = initiativeNamesFromSnapshot;`, context);

const namesFrom = context.initiativeNamesFromSnapshot;

const snapshot = {
  draft: {
    currentDocument: {
      tables: [
        {
          type: "combat",
          columns: [{ id: "combat-name", role: "character" }],
          rows: [{ cells: { "combat-name": "Not initiative" } }],
        },
        {
          type: "initiative",
          columns: [
            { id: "name", role: "character" },
            { id: "score", role: "initiative" },
          ],
          rows: [
            { cells: { name: "  Rogue  ", score: "21" } },
            { cells: { name: "Wizard", score: "17" } },
            { cells: { name: "", score: "12" } },
            { cells: { name: "Fighter", score: "9" } },
          ],
        },
      ],
    },
  },
};

assert.deepEqual(Array.from(namesFrom(snapshot)), ["Rogue", "Wizard", "Fighter"]);
assert.deepEqual(Array.from(namesFrom(null)), []);
assert.deepEqual(Array.from(namesFrom({ draft: { currentDocument: { tables: [] } } })), []);

console.log("Public Initiative model tests passed.");
