// Selects Character or NPC persistence while both use the same tracker/editor runtime.
import { campaignPagePath } from "../../shared/js/campaign-context.js";

export function trackerKind() {
  return globalThis.document?.body?.dataset.trackerKind === "npc" ? "npc" : "character";
}

export function isNpcTracker() {
  return trackerKind() === "npc";
}

export function trackerEntityLabel() {
  return isNpcTracker() ? "NPC" : "character";
}

export function trackerResource() {
  return isNpcTracker() ? "npcs" : "characters";
}

export function trackerPageSegment() {
  return isNpcTracker() ? "npc" : "char";
}

export function trackerApiPath(id, tail = "") {
  const suffix = tail ? `/${String(tail).replace(/^\/+/, "")}` : "";
  return `api/${trackerResource()}/${encodeURIComponent(id)}${suffix}`;
}

export function trackerPagePath(id = "") {
  const base = campaignPagePath(trackerPageSegment());
  return id ? `${base}${encodeURIComponent(id)}/` : base;
}
