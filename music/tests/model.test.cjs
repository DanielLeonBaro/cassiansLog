const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

let source = fs.readFileSync("music/js/model.js", "utf8")
  .replace(/export const /g, "const ")
  .replace(/export function /g, "function ");
source += "\nthis.api = { parseMediaLink, normalizeTags, formatTag, clampSeconds };";
const context = { URL };
vm.runInNewContext(source, context);
const { parseMediaLink, normalizeTags, formatTag, clampSeconds } = context.api;

assert.equal(parseMediaLink("https://youtu.be/dQw4w9WgXcQ").id, "dQw4w9WgXcQ");
assert.equal(parseMediaLink("https://www.youtube.com/watch?v=dQw4w9WgXcQ").provider, "youtube");
assert.equal(parseMediaLink("https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT").uri, "spotify:track:4cOdK2wGLETKBW3PvgPWqT");
assert.equal(parseMediaLink("https://example.com/song"), null);
assert.deepEqual(Array.from(normalizeTags(" Ambience, calm,ambience ")), ["ambience", "calm"]);
assert.equal(formatTag("IN THE DARKNESS"), "In the darkness");
assert.equal(clampSeconds(40, 3), 30);
assert.equal(clampSeconds(-2, 3), 0);
assert.equal(clampSeconds("bad", 3), 3);
console.log("Music model tests passed.");
