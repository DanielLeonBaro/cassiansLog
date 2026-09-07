export const DEFAULT_ENTITY_STATUS = "Active";
export const ENTITY_STATUS_MAX = 32;
export const ENTITY_STATUS_SUGGESTIONS = ["Active", "Paused", "Hiatus", "Draft", "Ended"];

export function normalizeEntityStatus(value, fallback = DEFAULT_ENTITY_STATUS) {
  const status = typeof value === "string" ? value.trim() : "";
  if (!status) return fallback;
  return status.length <= ENTITY_STATUS_MAX ? status : null;
}
