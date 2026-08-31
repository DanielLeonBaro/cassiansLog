// Controls media loading, loop points, fades, volume, and playback transitions.
import { parseMediaLink } from "./model.js";

let youtubeApiPromise;
function loadYouTubeApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (youtubeApiPromise) return youtubeApiPromise;
  youtubeApiPromise = new Promise((resolve) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve(window.YT);
    };
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    document.head.append(script);
  });
  return youtubeApiPromise;
}

let spotifyApiPromise;
function loadSpotifyApi() {
  if (spotifyApiPromise) return spotifyApiPromise;
  spotifyApiPromise = new Promise((resolve) => {
    const previous = window.onSpotifyIframeApiReady;
    window.onSpotifyIframeApiReady = (api) => {
      previous?.(api);
      resolve(api);
    };
    const script = document.createElement("script");
    script.src = "https://open.spotify.com/embed/iframe-api/v1";
    script.async = true;
    document.head.append(script);
  });
  return spotifyApiPromise;
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function fadeVolume(player, from, to, seconds) {
  if (!seconds) {
    player.setVolume(to);
    return;
  }
  const started = performance.now();
  while (true) {
    const progress = Math.min(1, (performance.now() - started) / (seconds * 1000));
    player.setVolume(Math.round(from + ((to - from) * progress)));
    if (progress === 1) return;
    await wait(50);
  }
}

export function createMusicPlayer(container, status) {
  let current = null;
  let transition = Promise.resolve();

  async function stop(fadeOut) {
    if (!current) return;
    clearTimeout(current.endTimer);
    if (current.provider === "youtube") {
      if (!current.ended) await fadeVolume(current.player, current.player.getVolume(), 0, fadeOut);
      current.player.stopVideo();
      current.player.destroy();
    } else {
      if (!current.ended) await wait(fadeOut * 1000);
      current.controller.pause();
      current.controller.destroy();
    }
    current = null;
  }

  function finishYouTube(event, track) {
    if (event.data !== window.YT.PlayerState.ENDED || current?.player !== event.target) return;
    if (track.loopable === true) {
      event.target.seekTo(0, true);
      event.target.playVideo();
      status.textContent = `Looping ${track.title}`;
      return;
    }
    event.target.stopVideo();
    current.ended = true;
    status.textContent = `Finished ${track.title}. Nothing else will play.`;
  }

  function finishSpotify(controller, track) {
    if (current?.controller !== controller || current.ended || current.ending) return;
    clearTimeout(current.endTimer);
    if (track.loopable === true) {
      current.ending = true;
      controller.restart();
      status.textContent = `Looping ${track.title}`;
      return;
    }
    controller.pause();
    current.ended = true;
    status.textContent = `Finished ${track.title}. Nothing else will play.`;
  }

  function watchSpotifyPlayback(controller, track, event) {
    if (current?.controller !== controller || current.ended) return;
    const playback = event.data || {};
    const duration = Number(playback.duration);
    const position = Number(playback.position);
    clearTimeout(current.endTimer);
    if (!Number.isFinite(duration) || !Number.isFinite(position) || duration <= 0) return;
    if (current.ending) {
      if (position < Math.min(1000, duration / 2)) current.ending = false;
      else return;
    }
    if (position >= duration) {
      finishSpotify(controller, track);
      return;
    }
    if (!playback.isPaused && !playback.isBuffering) {
      current.endTimer = setTimeout(() => finishSpotify(controller, track), Math.max(0, duration - position));
    }
  }

  async function playNow(track, settings) {
    await stop(settings.fadeOut);
    const media = parseMediaLink(track.url);
    container.replaceChildren();
    status.textContent = `Loading ${track.title}…`;
    if (media.provider === "youtube") {
      container.classList.add("aspect-video");
      container.classList.remove("min-h-40");
      const mount = document.createElement("div");
      mount.className = "h-full w-full";
      container.append(mount);
      const YT = await loadYouTubeApi();
      const player = await new Promise((resolve) => {
        new YT.Player(mount, {
          width: "100%", height: "100%", videoId: media.id,
          playerVars: { autoplay: 1, rel: 0 },
          events: {
            onReady: (event) => resolve(event.target),
            onStateChange: (event) => finishYouTube(event, track),
          },
        });
      });
      current = { provider: "youtube", player, ended: false };
      player.setVolume(0);
      player.playVideo();
      status.textContent = `Now playing ${track.title}`;
      await fadeVolume(player, 0, 100, settings.fadeIn);
      return;
    }
    container.classList.remove("aspect-video");
    container.classList.add("min-h-40");
    const mount = document.createElement("div");
    mount.className = "w-full";
    container.append(mount);
    const api = await loadSpotifyApi();
    const controller = await new Promise((resolve) => {
      api.createController(mount, {
        uri: media.uri,
        width: "100%",
        height: media.type === "track" ? 152 : 352,
      }, resolve);
    });
    current = { provider: "spotify", controller, ended: false, ending: false, endTimer: null };
    controller.addListener("playback_update", (event) => watchSpotifyPlayback(controller, track, event));
    let playingUri = "";
    controller.addListener("playback_started", (event) => {
      const nextUri = event.data?.playingURI || "";
      if (track.loopable === true && current?.controller === controller) current.ending = false;
      if (!playingUri) playingUri = nextUri;
      else if (track.loopable !== true && nextUri && nextUri !== playingUri) finishSpotify(controller, track);
    });
    const iframe = container.querySelector("iframe");
    if (iframe) {
      iframe.title = `Spotify player: ${track.title}`;
      iframe.className = "w-full rounded-xl border-0";
    }
    status.textContent = `Loaded ${track.title}. Press play in the Spotify player.`;
  }

  return {
    play(track, settings) {
      transition = transition.then(() => playNow(track, settings)).catch((error) => {
        console.error(error);
        status.textContent = "The player could not be loaded.";
      });
      return transition;
    },
  };
}
