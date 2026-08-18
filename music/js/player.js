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
    if (current.provider === "youtube") {
      await fadeVolume(current.player, current.player.getVolume(), 0, fadeOut);
      current.player.stopVideo();
      current.player.destroy();
    } else {
      await wait(fadeOut * 1000);
      current.iframe.remove();
    }
    current = null;
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
        const instance = new YT.Player(mount, {
          width: "100%", height: "100%", videoId: media.id,
          playerVars: { autoplay: 1, rel: 0 },
          events: { onReady: () => resolve(instance) },
        });
      });
      current = { provider: "youtube", player };
      player.setVolume(0);
      player.playVideo();
      status.textContent = `Now playing ${track.title}`;
      await fadeVolume(player, 0, 100, settings.fadeIn);
      return;
    }
    container.classList.remove("aspect-video");
    container.classList.add("min-h-40");
    const iframe = document.createElement("iframe");
    iframe.src = `https://open.spotify.com/embed/${media.type}/${media.id}?utm_source=generator&theme=0`;
    iframe.width = "100%";
    iframe.height = media.type === "track" ? "152" : "352";
    iframe.allow = "autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture";
    iframe.loading = "eager";
    iframe.title = `Spotify player: ${track.title}`;
    iframe.className = "w-full rounded-xl border-0";
    container.append(iframe);
    current = { provider: "spotify", iframe };
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
