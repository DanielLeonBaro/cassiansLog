export function wikiPageURL(id) {
  return `/wiki/${encodeURIComponent(id)}`;
}

export function wikiPageId(
  pathname = globalThis.location?.pathname || "/wiki/",
  hash = globalThis.location?.hash || "",
) {
  const params = new URLSearchParams(String(hash).replace(/^#/, ""));
  const legacyId = params.get("page");
  if (legacyId) return legacyId;
  const match = String(pathname).match(/^\/wiki\/([^/]+)\/?$/);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}
