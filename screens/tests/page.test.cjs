const assert = require("node:assert/strict");
const fs = require("node:fs");

for (const [file, kind, title] of [
  ["player-screen/index.html", "player", "Player Screen"],
  ["dm-screen/index.html", "dm", "DM Screen"],
]) {
  const html = fs.readFileSync(file, "utf8");
  assert.ok(html.includes(`data-screen-kind="${kind}"`));
  assert.ok(html.includes(`<h1 class="mt-3 font-display text-4xl font-bold sm:text-5xl">${title}</h1>`));
  for (const id of ["screen-grid", "screen-refresh", "screen-editor", "screen-detail", "screen-compendium", "screen-image-modal"]) {
    assert.ok(html.includes(`id="${id}"`), `${file} should include ${id}.`);
  }
  assert.ok(html.includes('src="screens/js/entry.js"'));
}

const view = fs.readFileSync("screens/js/view.js", "utf8");
for (const label of ["Character Quick Info", "Party Overview", "Manual Reference", "Compendium Reference", "Note", "Public Initiative", "Calculator"]) {
  assert.ok(view.includes(label), `Widget picker should include ${label}.`);
}
for (const control of ["data-edit-widget", "data-remove-widget", "data-move-widget", "data-view-widget", "data-calculator-key"]) {
  assert.ok(view.includes(control), `Cards should include ${control}.`);
}
const page = fs.readFileSync("screens/js/page.js", "utf8");
assert.ok(page.includes("data-add-widget"), "An empty screen should still render the add placeholder.");
assert.ok(page.includes("reorderWidget"), "Desktop drag ordering should persist through the model.");
assert.ok(page.includes("refreshShared"), "Shared references should have an explicit refresh path.");
assert.ok(page.includes("Changing widget type discards fields"), "Type changes should warn before discarding incompatible fields.");
assert.doesNotMatch(page, /\beval\s*\(|new Function/);

console.log("Player and DM Screen page contracts passed.");
