const assert = require("node:assert/strict");
const fs = require("node:fs");

const html = fs.readFileSync("music/index.html", "utf8");
const order = [
  html.indexOf(">Now Playing<"),
  html.indexOf('id="fade-settings"'),
  html.indexOf(">Library<"),
  html.indexOf('id="track-form"'),
];
assert.ok(order.every((position) => position >= 0), "Music page should contain every requested section.");
assert.deepEqual([...order].sort((left, right) => left - right), order, "Music sections should use the requested order.");
assert.match(html, /id="player-frame"[^>]*aspect-video/, "The embedded video should use a responsive 16:9 ratio.");
assert.match(html, /id="player-frame"[^>]*max-w-\[1280px\]/, "The embedded video should reach a 1280 by 720 desktop size.");
assert.match(html, /class="flex flex-col gap-16"/, "The four Music sections should have clear vertical separation.");
assert.match(html, /id="tag-entry-badges"/, "The add form should include live tag badges.");
assert.match(html, /id="tag-suggestions"/, "The add form should include existing-tag suggestions.");
assert.match(html, /id="track-form-title"/, "The track form should expose its add\/edit heading.");
assert.match(html, /id="track-form-cancel"/, "The reused edit form should include Cancel.");

const page = fs.readFileSync("music/js/page.js", "utf8");
assert.match(page, /formatTag\(tag\)/, "Visible tags should use display formatting.");
assert.match(page, /mb-5 mt-3 flex flex-wrap/, "Library tags should be separated from the Play button.");
assert.match(page, /restoreCloudLibrary\(\)/, "The Music page should restore its authoritative D1 library.");
assert.match(page, /"Track saved to D1\."/, "New tracks should save immediately to D1.");
assert.match(page, /persistLibrary\("Track removed from D1\."\)/, "Removed tracks should update D1 immediately.");
assert.match(page, /data-edit=/, "Every rendered track should include Edit beside Delete.");
assert.match(page, /updateTrack\(tracks\[editingIndex\], changes\)/, "Editing should preserve the existing track identity.");
assert.match(page, /persistLibrary\(successMessage\)/, "Edited tracks should update D1 immediately.");
assert.match(page, /form\.scrollIntoView/, "Edit should bring the reused form into view.");

const tailwindConfig = fs.readFileSync("shared/styles/tailwind.config.cjs", "utf8");
assert.match(tailwindConfig, /\.\/music\/\*\*\/\*\.\{html,js\}/, "Tailwind should scan Music templates and scripts.");
console.log("Music page structure tests passed.");
