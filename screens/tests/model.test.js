import assert from "node:assert/strict";
import {
  createEmptyScreen,
  createWidget,
  moveWidget,
  normalizeScreenDocument,
  removeWidget,
  reorderWidget,
  replaceWidget,
  validScreenDocument,
  WIDGET_TYPES,
} from "../js/model.js";

const empty = createEmptyScreen();
assert.deepEqual(empty, { version: 1, widgets: [] });
const character = createWidget("character", "character-1");
character.characterId = "cassian";
let document = replaceWidget(empty, character);
document = replaceWidget(document, { ...createWidget("note", "note-1"), title: "Rules", body: "**Remember**" });
assert.equal(document.widgets.length, 2);
assert.equal(validScreenDocument(document), true);
assert.deepEqual(moveWidget(document, "note-1", -1).widgets.map((item) => item.id), ["note-1", "character-1"]);
assert.deepEqual(reorderWidget(document, "character-1", "note-1").widgets.map((item) => item.id), ["note-1", "character-1"]);
assert.deepEqual(removeWidget(document, "character-1").widgets.map((item) => item.id), ["note-1"]);

const malformed = normalizeScreenDocument({ version: 99, widgets: [character, character, null, { id: "bad/id", type: "note" }] });
assert.deepEqual(malformed.widgets.map((item) => item.id), ["character-1"]);
assert.equal(validScreenDocument({ version: 1, widgets: [character, character] }), false);

const party = createWidget("party", "party-1");
assert.deepEqual(party.fields, ["classLevel", "hp", "ac"]);
const normalizedParty = normalizeScreenDocument({ version: 1, widgets: [{ ...party, characterIds: ["cassian", "cassian", "bad/id"], fields: ["hp", "hp", "str", "unknown"] }] });
assert.deepEqual(normalizedParty.widgets[0].characterIds, ["cassian"]);
assert.deepEqual(normalizedParty.widgets[0].fields, ["hp", "str"]);

for (const type of WIDGET_TYPES) {
  const widget = createWidget(type, `${type}-widget`);
  assert.equal(normalizeScreenDocument({ version: 1, widgets: [widget] }).widgets[0].type, type);
}
assert.throws(() => createWidget("unknown"), /Unknown widget type/);
const changedType = replaceWidget(document, { ...createWidget("calculator", "note-1"), expression: "2+2" });
assert.deepEqual(changedType.widgets.find((item) => item.id === "note-1"), { id: "note-1", type: "calculator", expression: "2+2" });
assert.equal(document.widgets.find((item) => item.id === "note-1").type, "note", "Widget replacement must not mutate its source document.");
assert.equal(normalizeScreenDocument({ version: 1, widgets: [{ id: "missing-character", type: "character", characterId: "removed" }] }).widgets[0].characterId, "removed");
assert.deepEqual(normalizeScreenDocument({ version: 1, widgets: [{ id: "party-empty", type: "party", characterIds: [], fields: "bad" }] }).widgets[0].fields, ["classLevel", "hp", "ac"]);

console.log("Screen model tests passed.");
