// Normalizes NPC player-visibility rules and removes hidden values before API responses.
const FIELD_PATH = /^[^.\u0000-\u001f]+(?:\.[^.\u0000-\u001f]+)*$/;
const FORBIDDEN_SEGMENTS = new Set(["__proto__", "prototype", "constructor"]);
const DEFAULT_VISIBLE_KEY = "$default";

export function defaultNpcVisibility() {
  return { [DEFAULT_VISIBLE_KEY]: true };
}

export function normalizeNpcVisibility(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const defaultVisible = value[DEFAULT_VISIBLE_KEY] === true;
  const fields = Object.fromEntries(Object.entries(value).filter(([path, visible]) => (
    path !== DEFAULT_VISIBLE_KEY
      && visible === (defaultVisible ? false : true)
      && path.length <= 512
      && FIELD_PATH.test(path)
      && path.split(".").every((segment) => !FORBIDDEN_SEGMENTS.has(segment))
  )));
  return defaultVisible ? { [DEFAULT_VISIBLE_KEY]: true, ...fields } : fields;
}

function normalizedFieldVisible(normalized, path) {
  const fieldPath = String(path || "");
  return normalized[DEFAULT_VISIBLE_KEY] === true
    ? normalized[fieldPath] !== false
    : normalized[fieldPath] === true;
}

export function npcFieldVisible(visibility, path) {
  return normalizedFieldVisible(normalizeNpcVisibility(visibility), path);
}

const OMIT = Symbol("omit");

function projectValue(value, path, visibility, visibleFields) {
  if (Array.isArray(value)) {
    const projected = value.flatMap((item, index) => {
      const itemPath = path ? `${path}.${index}` : String(index);
      const child = projectValue(item, itemPath, visibility, visibleFields);
      return child === OMIT ? [] : [child];
    });
    return projected.length || !path ? projected : OMIT;
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value).flatMap(([key, child]) => {
      const childPath = path ? `${path}.${key}` : key;
      const projected = projectValue(child, childPath, visibility, visibleFields);
      return projected === OMIT ? [] : [[key, projected]];
    });
    return entries.length || !path ? Object.fromEntries(entries) : OMIT;
  }
  if (!normalizedFieldVisible(visibility, path)) return OMIT;
  visibleFields.push(path);
  return value;
}

export function projectNpcForPlayer(document, visibility) {
  const normalized = normalizeNpcVisibility(visibility);
  const visibleFields = [];
  const projected = projectValue(document && typeof document === "object" ? document : {}, "", normalized, visibleFields);
  // Route identity is already visible in the URL and is required by the reused tracker runtime.
  projected.id = String(document?.id || "");
  return { document: projected, visibleFields };
}
