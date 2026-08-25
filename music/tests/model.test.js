import assert from "node:assert/strict";
import {
  parseMediaLink,
  normalizeTags,
  formatTag,
  clampSeconds,
  updateTrack,
} from "../js/model.js";

assert.equal(parseMediaLink("https://youtu.be/dQw4w9WgXcQ").id, "dQw4w9WgXcQ");
assert.equal(parseMediaLink("https://www.youtube.com/watch?v=dQw4w9WgXcQ").provider, "youtube");
assert.equal(parseMediaLink("https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT").uri, "spotify:track:4cOdK2wGLETKBW3PvgPWqT");
assert.equal(parseMediaLink("https://example.com/song"), null);
assert.deepEqual(Array.from(normalizeTags(" Ambience, calm,ambience ")), ["ambience", "calm"]);
assert.equal(formatTag("IN THE DARKNESS"), "In the darkness");
assert.equal(clampSeconds(40, 3), 30);
assert.equal(clampSeconds(-2, 3), 0);
assert.equal(clampSeconds("bad", 3), 3);
const original = {
  id: "track-1",
  title: "Old title",
  url: "https://youtu.be/dQw4w9WgXcQ",
  provider: "youtube",
  loopable: false,
  tags: ["old"],
  addedAt: "2026-08-18T00:00:00.000Z",
};
const updated = updateTrack(original, {
  title: "New title",
  url: "https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT",
  tags: ["Battle", "battle", "Boss"],
  loopable: true,
});
assert.equal(updated.id, original.id);
assert.equal(updated.addedAt, original.addedAt);
assert.equal(updated.provider, "spotify");
assert.equal(updated.loopable, true);
assert.deepEqual(Array.from(updated.tags), ["battle", "boss"]);
console.log("Music model tests passed.");
