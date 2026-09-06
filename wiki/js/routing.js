// Builds canonical Wiki URLs and reads canonical or legacy route state.
import { campaignPagePath } from "../../shared/js/campaign-context.js";

export function wikiPageURL(id) {
  return `${campaignPagePath("wiki")}${encodeURIComponent(id)}`;
}

export function wikiPageId(
  pathname = globalThis.location?.pathname || "/wiki/",
  hash = globalThis.location?.hash || "",
) {
  const params = new URLSearchParams(String(hash).replace(/^#/, ""));
  const legacyId = params.get("page");
  if (legacyId) return legacyId;
  const match = String(pathname).match(/^(?:\/c\/[a-z]{2,48})?\/wiki\/([^/]+)\/?$/);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}
