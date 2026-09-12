// Verifies Public Initiative model behavior.
import assert from "node:assert/strict";
import { initiativeEntriesFromSnapshot as entriesFrom, initiativeNamesFromSnapshot as namesFrom } from "../js/model.js";
import { renderEntries, renderNames } from "../js/page.js";

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
            { cells: { name: "  Rogue  ", score: "21" }, characterLink: { kind: "character", id: "rogue" } },
            { cells: { name: "Wizard", score: "17" }, characterLink: { kind: "monster", id: "wizard" } },
            { cells: { name: "", score: "12" } },
            { cells: { name: "Fighter", score: "9" } },
          ],
        },
      ],
    },
  },
};

assert.deepEqual(Array.from(namesFrom(snapshot)), ["Rogue", "Wizard", "Fighter"]);
assert.deepEqual(Array.from(entriesFrom(snapshot)), [
  { name: "Rogue", characterLink: { kind: "character", id: "rogue" } },
  { name: "Wizard" },
  { name: "Fighter" },
]);
assert.deepEqual(Array.from(namesFrom(null)), []);
assert.deepEqual(Array.from(namesFrom({ draft: { currentDocument: { tables: [] } } })), []);

globalThis.document = {
  createElement(tagName) {
    return {
      tagName,
      className: "",
      textContent: "",
      attributes: {},
      children: [],
      setAttribute(name, value) { this.attributes[name] = value; },
      append(...children) { this.children.push(...children); },
    };
  },
};
const list = {
  children: [],
  replaceChildren(...children) { this.children = children; },
};
renderNames(list, ["Dragons", "Cassian", "Nekofi"]);
assert.deepEqual(list.children.map((item) => item.children[0].textContent), ["1", "2", "3"]);
assert.deepEqual(list.children.map((item) => item.children[1].textContent), ["Dragons", "Cassian", "Nekofi"]);
assert.ok(list.children.every((item) => item.children[0].className.includes("bg-blood-500")));

renderEntries(list, [
  { name: "Cassian", characterLink: { kind: "character", id: "cassian" } },
  { name: "Goblin", characterLink: { kind: "npc", id: "goblin" } },
]);
assert.equal(list.children[0].children[2].href, "/char/cassian/");
assert.equal(list.children[1].children[2].href, "/npc/goblin/");
assert.equal(list.children[0].children[2].target, "_blank");
assert.equal(list.children[0].children[2].rel, "noopener");

globalThis.location = { pathname: "/c/aotr/public-initiative/" };
renderEntries(list, [
  { name: "Goblin", characterLink: { kind: "npc", id: "goblin" } },
]);
assert.equal(list.children[0].children[2].href, "/c/aotr/npc/goblin/");

console.log("Public Initiative model tests passed.");
