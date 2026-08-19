const assert = require("node:assert/strict");
const fs = require("node:fs");

const archive = fs.readFileSync("char/index.html", "utf8");
for (const id of [
  "new-character-portrait-button",
  "new-character-name",
  "new-character-class",
  "new-character-race",
  "new-character-level",
  "create-character-submit",
]) assert.ok(archive.includes(`id="${id}"`), `Quick Setup should include ${id}.`);
assert.match(archive, /name="starterMode" value="starter" checked/);
assert.match(archive, /name="starterMode" value="blank"/);

const editor = fs.readFileSync("char/js/editor/index.js", "utf8");
for (const section of ["basics", "combat", "actions", "spellcasting", "features", "inventory", "advanced"]) {
  assert.ok(editor.includes(`id: "${section}"`), `Editor should include the ${section} section.`);
}
for (const hook of ["data-editor-section", "data-array-actions", "data-path", "data-editor-extensions"]) {
  assert.ok(editor.includes(hook), `Editor should preserve ${hook}.`);
}
assert.match(editor, /data-duplicate/);
assert.match(editor, /Additional fields/);
assert.match(editor, /Discard your unsaved character changes/);
assert.match(editor, /Character name is required/);
assert.match(editor, /createDialogController/);

const dialog = fs.readFileSync("shared/js/dialog.js", "utf8");
assert.match(dialog, /beforeClose/);
assert.match(dialog, /getClientRects/);
assert.match(dialog, /event\.key === "Escape"/);
assert.match(dialog, /event\.key !== "Tab"/);
console.log("Character Quick Setup and editor UI contract tests passed.");
