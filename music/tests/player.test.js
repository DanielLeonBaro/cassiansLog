import assert from "node:assert/strict";
import { createMusicPlayer } from "../js/player.js";

function classList() {
  const values = new Set();
  return {
    add: (...names) => names.forEach((name) => values.add(name)),
    remove: (...names) => names.forEach((name) => values.delete(name)),
  };
}

function playerElements() {
  const container = {
    children: [],
    classList: classList(),
    replaceChildren() { this.children = []; },
    append(child) { this.children.push(child); },
    querySelector() { return null; },
  };
  return { container, status: { textContent: "" } };
}

globalThis.document = {
  createElement: () => ({ className: "" }),
  head: { append() {} },
};

let youtubePlayer;
class FakeYouTubePlayer {
  constructor(_mount, options) {
    this.events = options.events;
    this.playCount = 0;
    this.stopCount = 0;
    this.seekCount = 0;
    youtubePlayer = this;
    queueMicrotask(() => this.events.onReady({ target: this }));
  }

  setVolume() {}
  getVolume() { return 100; }
  playVideo() { this.playCount += 1; }
  stopVideo() { this.stopCount += 1; }
  destroy() {}
  seekTo() { this.seekCount += 1; }
  finish() { this.events.onStateChange({ data: 0, target: this }); }
}

globalThis.window = {
  YT: { Player: FakeYouTubePlayer, PlayerState: { ENDED: 0 } },
};

const youtubeTrack = {
  title: "Battle Theme",
  url: "https://youtu.be/dQw4w9WgXcQ",
  loopable: false,
};
let elements = playerElements();
await createMusicPlayer(elements.container, elements.status).play(youtubeTrack, { fadeIn: 0, fadeOut: 0 });
youtubePlayer.finish();
assert.equal(youtubePlayer.stopCount, 1);
assert.equal(youtubePlayer.seekCount, 0);
assert.match(elements.status.textContent, /Nothing else will play/);

elements = playerElements();
await createMusicPlayer(elements.container, elements.status).play({ ...youtubeTrack, loopable: true }, { fadeIn: 0, fadeOut: 0 });
youtubePlayer.finish();
assert.equal(youtubePlayer.stopCount, 0);
assert.equal(youtubePlayer.seekCount, 1);
assert.equal(youtubePlayer.playCount, 2);
assert.match(elements.status.textContent, /Looping/);

let spotifyController;
const spotifyApi = {
  createController(_mount, _options, ready) {
    const listeners = new Map();
    spotifyController = {
      pauseCount: 0,
      restartCount: 0,
      addListener(name, listener) { listeners.set(name, listener); },
      pause() { this.pauseCount += 1; },
      restart() { this.restartCount += 1; },
      destroy() {},
      emit(name, data) { listeners.get(name)?.({ data }); },
    };
    queueMicrotask(() => ready(spotifyController));
  },
};
document.head.append = () => queueMicrotask(() => window.onSpotifyIframeApiReady(spotifyApi));

const spotifyTrack = {
  title: "Quiet Tavern",
  url: "https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT",
  loopable: false,
};
elements = playerElements();
await createMusicPlayer(elements.container, elements.status).play(spotifyTrack, { fadeIn: 0, fadeOut: 0 });
spotifyController.emit("playback_update", { duration: 1000, position: 1000, isPaused: true, isBuffering: false });
assert.equal(spotifyController.pauseCount, 1);
assert.equal(spotifyController.restartCount, 0);
assert.match(elements.status.textContent, /Nothing else will play/);

elements = playerElements();
await createMusicPlayer(elements.container, elements.status).play({ ...spotifyTrack, loopable: true }, { fadeIn: 0, fadeOut: 0 });
spotifyController.emit("playback_update", { duration: 1000, position: 1000, isPaused: true, isBuffering: false });
assert.equal(spotifyController.pauseCount, 0);
assert.equal(spotifyController.restartCount, 1);
assert.match(elements.status.textContent, /Looping/);

console.log("Music player loop tests passed.");
