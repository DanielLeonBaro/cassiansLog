// Normalizes optional tracker-row links to Character and NPC sheets.
import { campaignPagePath } from "./campaign-context.js";

const TRACKER_LINK_KINDS = new Set(["character", "npc"]);
const TRACKER_LINK_ID = /^[a-z0-9][a-z0-9-]{0,127}$/i;

export function normalizeTrackerLink(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const kind = String(value.kind || "").trim().toLowerCase();
  const id = String(value.id || "").trim();
  return TRACKER_LINK_KINDS.has(kind) && TRACKER_LINK_ID.test(id)
    ? { kind, id }
    : null;
}

export function validTrackerLink(value) {
  const normalized = normalizeTrackerLink(value);
  return Boolean(normalized && normalized.kind === value.kind && normalized.id === value.id);
}

export function trackerLinkHref(value) {
  const link = normalizeTrackerLink(value);
  if (!link) return "";
  const section = link.kind === "npc" ? "npc" : "char";
  return `${campaignPagePath(section)}${encodeURIComponent(link.id)}/`;
}
