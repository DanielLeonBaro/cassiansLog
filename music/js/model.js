// Defines Music normalization and state transformations without DOM side effects.
export const DEFAULT_SETTINGS = Object.freeze({ fadeIn: 3, fadeOut: 2 });

export function parseMediaLink(value) {
  const raw = String(value || "").trim();
  let url;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  if (host === "youtu.be") {
    const id = url.pathname.split("/").filter(Boolean)[0];
    return validYouTubeId(id) ? { provider: "youtube", id, url: raw } : null;
  }
  if (["youtube.com", "m.youtube.com", "music.youtube.com"].includes(host)) {
    const parts = url.pathname.split("/").filter(Boolean);
    const id = url.pathname === "/watch" ? url.searchParams.get("v") : (["embed", "shorts", "live"].includes(parts[0]) ? parts[1] : null);
    return validYouTubeId(id) ? { provider: "youtube", id, url: raw } : null;
  }
  if (host === "open.spotify.com") {
    const parts = url.pathname.split("/").filter(Boolean);
    const offset = parts[0]?.startsWith("intl-") ? 1 : 0;
    const type = parts[offset];
    const id = parts[offset + 1];
    if (["track", "album", "playlist", "episode", "show", "artist"].includes(type) && /^[A-Za-z0-9]+$/.test(id || "")) {
      return { provider: "spotify", id, type, uri: `spotify:${type}:${id}`, url: raw };
    }
  }
  return null;
}

function validYouTubeId(id) {
  return /^[A-Za-z0-9_-]{11}$/.test(id || "");
}

export function normalizeTags(value) {
  const source = Array.isArray(value) ? value : String(value || "").split(",");
  return [...new Set(source.map((tag) => String(tag).trim().toLowerCase()).filter(Boolean))];
}

export function formatTag(value) {
  const tag = String(value || "").trim().toLowerCase();
  return tag ? `${tag[0].toUpperCase()}${tag.slice(1)}` : "";
}

export function createTrack({ title, url, tags, loopable = false }, id = crypto.randomUUID()) {
  const media = parseMediaLink(url);
  const cleanTitle = String(title || "").trim();
  if (!cleanTitle || !media) throw new Error("Add a title and a valid YouTube or Spotify link.");
  return {
    id,
    title: cleanTitle,
    url: media.url,
    tags: normalizeTags(tags),
    provider: media.provider,
    loopable: loopable === true,
    addedAt: new Date().toISOString(),
  };
}

export function updateTrack(track, changes) {
  const updated = createTrack(changes, track.id);
  return { ...updated, addedAt: track.addedAt };
}

export function clampSeconds(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(30, Math.max(0, number)) : fallback;
}
