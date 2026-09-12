// Normalizes NPC player-visibility rules and removes hidden values before API responses.
const FIELD_PATH = /^[^.\u0000-\u001f]+(?:\.[^.\u0000-\u001f]+)*$/;
const FORBIDDEN_SEGMENTS = new Set(["__proto__", "prototype", "constructor"]);

export function normalizeNpcVisibility(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([path, visible]) => (
    visible === true
      && path.length <= 512
      && FIELD_PATH.test(path)
      && path.split(".").every((segment) => !FORBIDDEN_SEGMENTS.has(segment))
  )));
}

export function npcFieldVisible(visibility, path) {
  return normalizeNpcVisibility(visibility)[String(path || "")] === true;
}

function pathHasVisibleValue(visiblePaths, path) {
  const prefix = path ? `${path}.` : "";
  return visiblePaths.some((candidate) => candidate === path || candidate.startsWith(prefix));
}

function projectValue(value, path, visiblePaths) {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => {
      const itemPath = path ? `${path}.${index}` : String(index);
      return pathHasVisibleValue(visiblePaths, itemPath)
        ? [projectValue(item, itemPath, visiblePaths)]
        : [];
    });
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).flatMap(([key, child]) => {
      const childPath = path ? `${path}.${key}` : key;
      return pathHasVisibleValue(visiblePaths, childPath)
        ? [[key, projectValue(child, childPath, visiblePaths)]]
        : [];
    }));
  }
  return visiblePaths.includes(path) ? value : undefined;
}

export function projectNpcForPlayer(document, visibility) {
  const normalized = normalizeNpcVisibility(visibility);
  const visibleFields = Object.keys(normalized);
  const projected = projectValue(document && typeof document === "object" ? document : {}, "", visibleFields) || {};
  // Route identity is already visible in the URL and is required by the reused tracker runtime.
  projected.id = String(document?.id || "");
  return { document: projected, visibleFields };
}
