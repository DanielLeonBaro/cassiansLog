// Verifies character archive shortcuts and editor UI.
const assert = require("node:assert/strict");
const fs = require("node:fs");

// Character archive and Quick Setup contracts.

const archive = fs.readFileSync("char/index.html", "utf8");
for (const id of [
  "new-character-portrait-button",
  "new-character-name",
  "new-character-status",
  "new-character-class",
  "new-character-race",
  "new-character-level",
  "dnd-beyond-import-toggle",
  "dnd-beyond-url",
  "dnd-beyond-url-import",
  "dnd-beyond-pdf-import",
  "dnd-beyond-pdf-input",
  "create-character-submit",
]) assert.ok(archive.includes(`id="${id}"`), `Quick Setup should include ${id}.`);
assert.match(archive, /> Import from D&amp;D Beyond\s*<\/button>/);
assert.match(archive, /name="starterMode" value="starter" checked/);
assert.match(archive, /name="starterMode" value="blank"/);
const shortcuts = [...archive.matchAll(/<a href="([^"]+)" target="_blank" rel="noopener" aria-label="[^"]+ in a new tab" data-section-link="([^"]+)" data-role-link="\2"/g)];
assert.deepEqual(
  shortcuts.map(([, href, section]) => [href, section]),
  [
    ["player-screen/", "player-screen"],
    ["dm-screen/", "dm-screen"],
    ["wiki/", "wiki"],
    ["compendium/", "compendium"],
    ["combat-loot/", "combat-loot"],
    ["public-initiative/", "public-initiative"],
    ["music/", "music"],
  ],
  "Character archive shortcuts should open every public component in a new tab.",
);
assert.match(archive, /<nav aria-label="Open another page" class="[^"]*justify-center/, "Shortcuts should be centered above character selection.");
assert.match(archive, /px-3 py-1 text-xs/, "Shortcuts should use slim badge sizing.");

const editor = fs.readFileSync("char/js/editor/index.js", "utf8");
const fieldSchema = fs.readFileSync("char/js/editor/field-schema.js", "utf8");
const fieldRenderer = fs.readFileSync("char/js/editor/field-renderer.js", "utf8");
const editorContracts = `${editor}\n${fieldRenderer}`;
for (const section of ["basics", "combat", "actions", "spellcasting", "features", "inventory", "advanced"]) {
  assert.ok(fieldSchema.includes(`id: "${section}"`), `Editor should include the ${section} section.`);
}
for (const hook of ["data-editor-section", "data-array-actions", "data-path", "data-editor-extensions"]) {
  assert.ok(editorContracts.includes(hook), `Editor should preserve ${hook}.`);
}
assert.match(fieldRenderer, /data-duplicate/);
assert.match(fieldRenderer, /Additional fields/);
assert.match(editor, /Discard your unsaved character changes/);
assert.match(editor, /Character name is required/);
assert.match(editor, /Character status cannot exceed 32 characters/);
assert.match(fieldSchema, /"status"/, "Status should be part of the editable character document.");
assert.match(fieldRenderer, /editor-status-options/, "Status should offer common values without restricting custom text.");
assert.match(editor, /createDialogController/);
assert.match(editor, /id="editor-character-sheet-style"/, "Advanced should include a per-character V1\/V2\/V3 selector.");
assert.match(editor, /data-v1-section-drag/, "V1 ordering should include drag handles.");
assert.match(editor, /data-v1-section-move/, "V1 ordering should include accessible move buttons.");
assert.match(editor, /data-v1-section-reset/, "V1 ordering should include Reset.");
assert.match(editor, /Style v2 uses a fixed tabbed layout/, "V2 should explain why ordering is unavailable.");
for (const hook of ["editor-v3-columns", "data-v3-section-drag", "data-v3-section-move", "data-v3-section-span", "data-v3-layout-reset"]) {
  assert.ok(editor.includes(hook), `V3 grid editing should include ${hook}.`);
}
assert.match(editor, /The campaign DM controls the style; this grid is personal to you/, "Assigned players should receive personal V3 controls without style authority.");
assert.match(editor, /saveV3Layout/, "V3 changes should use personal layout persistence.");
assert.match(editor, /saveCharacterSheetStyleOverride/, "Style changes should use shared persistence.");
for (const id of ["editor-export-menu", "editor-export-json", "editor-export-pdf"]) {
  assert.ok(editor.includes(`id=\"${id}\"`), `Editor should include ${id}.`);
}
assert.match(editor, /downloadCharacterJson\(clone\(draft\)\)/, "JSON export should include current unsaved draft data.");
assert.match(editor, /downloadCharacterPdf\(clone\(draft\)\)/, "PDF export should include current unsaved draft data.");
assert.match(editor, /data-character-editor-section/, "Editor should accept focused section triggers.");
assert.match(editor, /return \{ open \};/, "Editor should expose its focused open action.");

const tracker = fs.readFileSync("char/js/tracker/index.js", "utf8");
const trackerHTML = fs.readFileSync("char/tracker.html", "utf8");
const cards = fs.readFileSync("char/js/archive/cards.js", "utf8");
const notes = fs.readFileSync("char/js/tracker/notes.js", "utf8");
assert.match(trackerHTML, /id="character-status"[^>]*bg-blood-500[^>]*text-on-accent/, "Tracker status badge should use the theme accent.");
assert.match(cards, /bg-blood-500[^\n]*text-on-accent/, "Character-card status badge should use the theme accent.");
assert.match(trackerHTML, /data-markdown-editor[\s\S]*id="note-format-toolbar"[\s\S]*<textarea id="note-body"/, "Character Notes should provide the shared formatting editor.");
assert.match(notes, /markdownToolbarMarkup\("Character note formatting", STANDARD_MARKDOWN_FORMATS\)/);
assert.match(notes, /wiki-rich"\>\$\{renderRichText\(note\.body\)\}/, "Saved Notes should safely render their formatting.");
assert.match(tracker, /data-character-editor-section="inventory"/, "Currency should link directly to inventory editing.");
assert.match(tracker, />Edit Inventory<\/button>/, "Currency should show an Edit Inventory button.");

const dialog = fs.readFileSync("shared/js/dialog.js", "utf8");
assert.match(dialog, /beforeClose/);
assert.match(dialog, /getClientRects/);
assert.match(dialog, /event\.key === "Escape"/);
assert.match(dialog, /event\.key !== "Tab"/);
console.log("Character Quick Setup and editor UI contract tests passed.");
