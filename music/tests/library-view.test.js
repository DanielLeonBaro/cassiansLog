import assert from "node:assert/strict";
import {
  allMusicTags,
  renderMusicTagBadges,
  renderMusicTrackCards,
  suggestedMusicTags,
  visibleMusicTracks,
} from "../js/library-view.js";

const tracks = [
  { id: "1", title: "Battle Theme", provider: "YouTube", tags: ["combat", "boss"] },
  { id: "2", title: "Quiet Tavern", provider: "YouTube", tags: ["ambient", "tavern"] },
];

assert.deepEqual(allMusicTags(tracks), ["ambient", "boss", "combat", "tavern"]);
assert.deepEqual(suggestedMusicTags(tracks, ["combat"], "b"), ["ambient", "boss"]);
assert.deepEqual(visibleMusicTracks(tracks, { activeTag: "combat" }), [tracks[0]]);
assert.deepEqual(visibleMusicTracks(tracks, { search: "quiet tavern" }), [tracks[1]]);
assert.match(renderMusicTagBadges(["boss"]), /data-entry-tag="boss"/);
assert.match(renderMusicTrackCards([tracks[0]], false), /data-edit="1" disabled/);
assert.match(renderMusicTrackCards([tracks[0]], true), /data-play="1"/);

console.log("Music library view tests passed.");
