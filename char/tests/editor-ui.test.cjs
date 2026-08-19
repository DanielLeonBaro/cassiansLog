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
assert.match(editor, /id="editor-character-sheet-style"/, "Advanced should include a per-character V1\/V2 selector.");
assert.match(editor, /data-v1-section-drag/, "V1 ordering should include drag handles.");
assert.match(editor, /data-v1-section-move/, "V1 ordering should include accessible move buttons.");
assert.match(editor, /data-v1-section-reset/, "V1 ordering should include Reset.");
assert.match(editor, /Style v2 uses a fixed tabbed layout/, "V2 should explain why ordering is unavailable.");
assert.match(editor, /saveCharacterSheetStyleOverride/, "Style changes should use shared persistence.");
assert.match(editor, /data-character-editor-section/, "Editor should accept focused section triggers.");
assert.match(editor, /return \{ open \};/, "Editor should expose its focused open action.");

const tracker = fs.readFileSync("char/js/tracker/index.js", "utf8");
assert.match(tracker, /data-character-editor-section="inventory"/, "Currency should link directly to inventory editing.");
assert.match(tracker, />Edit Inventory<\/button>/, "Currency should show an Edit Inventory button.");

const dialog = fs.readFileSync("shared/js/dialog.js", "utf8");
assert.match(dialog, /beforeClose/);
assert.match(dialog, /getClientRects/);
assert.match(dialog, /event\.key === "Escape"/);
assert.match(dialog, /event\.key !== "Tab"/);
console.log("Character Quick Setup and editor UI contract tests passed.");
