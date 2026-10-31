import { DENSITY_PAGES } from "./catalog.js";

export const DENSITIES = Object.freeze(["comfortable", "compact"]);
export const TRACKER_STYLES = Object.freeze(["v1", "v2", "v3", "v4", "v5", "v6", "v2.1", "v2.2", "campaign"]);
const pageIds = new Set(DENSITY_PAGES.map(({ id }) => id));
const record = (value) => value && typeof value === "object" && !Array.isArray(value);

export function normalizeUiPreferences(value = {}) {
  const source = record(value) ? value : {};
  return {
    version: 1,
    density: DENSITIES.includes(source.density) ? source.density : "comfortable",
    pageDensity: Object.fromEntries(Object.entries(record(source.pageDensity) ? source.pageDensity : {})
      .filter(([id, density]) => pageIds.has(id) && DENSITIES.includes(density))),
    sidebarCollapsed: source.sidebarCollapsed === true,
    trackerStyles: {
      character: TRACKER_STYLES.includes(source.trackerStyles?.character) ? source.trackerStyles.character : "v5",
      npc: TRACKER_STYLES.includes(source.trackerStyles?.npc) ? source.trackerStyles.npc : "v5",
    },
  };
}

export function validUiPreferences(value) {
  return Boolean(record(value) && value.version === 1 && DENSITIES.includes(value.density)
    && typeof value.sidebarCollapsed === "boolean" && record(value.pageDensity)
    && Object.entries(value.pageDensity).every(([id, density]) => pageIds.has(id) && DENSITIES.includes(density))
    && record(value.trackerStyles)
    && ["character", "npc"].every((kind) => TRACKER_STYLES.includes(value.trackerStyles[kind]))
    && Object.keys(value).every((key) => ["version", "density", "pageDensity", "sidebarCollapsed", "trackerStyles"].includes(key))
    && Object.keys(value.trackerStyles).every((key) => ["character", "npc"].includes(key)));
}

export function resolveDensity(preferences, pageId) {
  const normalized = normalizeUiPreferences(preferences);
  return normalized.pageDensity[pageId] || normalized.density;
}

export function changeUiPreferences(preferences, changes) {
  const current = normalizeUiPreferences(preferences);
  const pageDensity = { ...current.pageDensity, ...changes.pageDensity };
  for (const [id, density] of Object.entries(pageDensity)) {
    if (density === "inherit") delete pageDensity[id];
  }
  return normalizeUiPreferences({
    ...current, ...changes, pageDensity,
    trackerStyles: { ...current.trackerStyles, ...changes.trackerStyles },
  });
}

export function uiStorageKey(userId) {
  return `cassianslog-ui-preferences:${encodeURIComponent(userId || "anonymous")}`;
}
