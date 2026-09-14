// Applies reasoned build overrides without mutating the Character document.
import { cloneJSON } from "../../../shared/js/text.js";

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function isRecord(value) {
  return Object.prototype.toString.call(value) === "[object Object]";
}

function numericValue(value) {
  if (value === "" || value === null || value === undefined || typeof value === "boolean") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function warning(code, path, message) {
  return { code, path: `build.overrides.${path}`, sourceId: path, blocking: false, message };
}

function overriddenTrace(path, automaticValue, value, reason, sources) {
  return {
    value,
    automaticValue,
    overridden: true,
    override: { value, reason },
    sources: [...sources, {
      kind: "override",
      sourceId: `build.overrides.${path}`,
      label: reason,
      value,
      operation: "set",
    }],
  };
}

export function createOverrideResolver(overrides = {}) {
  const source = isRecord(overrides) ? overrides : {};
  const consumed = new Set();
  const warnings = [];

  function candidate(path) {
    if (!Object.prototype.hasOwnProperty.call(source, path)) return null;
    consumed.add(path);
    const override = source[path];
    if (!isRecord(override) || !text(override.reason)) {
      warnings.push(warning("invalid-override", path, `Override ${path} needs a reason and was not applied.`));
      return null;
    }
    return { ...override, reason: text(override.reason) };
  }

  return {
    number(path, automaticValue, sources, { integer = false, minimum = -Infinity } = {}) {
      const override = candidate(path);
      if (!override) return { value: automaticValue, trace: { value: automaticValue, sources } };
      const value = numericValue(override.value);
      if (value === null || (integer && !Number.isInteger(value)) || value < minimum) {
        warnings.push(warning("invalid-override", path, `Override ${path} has an invalid numeric value and was not applied.`));
        return { value: automaticValue, trace: { value: automaticValue, sources } };
      }
      return { value, trace: overriddenTrace(path, automaticValue, value, override.reason, sources) };
    },
    stringList(path, automaticValue, sources) {
      const override = candidate(path);
      if (!override) return { value: automaticValue, trace: { value: automaticValue, sources } };
      if (!Array.isArray(override.value) || override.value.some((item) => !text(item))) {
        warnings.push(warning("invalid-override", path, `Override ${path} must be a list of names and was not applied.`));
        return { value: automaticValue, trace: { value: automaticValue, sources } };
      }
      const value = [...new Set(override.value.map(text))].sort((left, right) => left.localeCompare(right));
      return { value, trace: overriddenTrace(path, automaticValue, value, override.reason, sources) };
    },
    finish() {
      Object.keys(source).sort().forEach((path) => {
        if (consumed.has(path)) return;
        const override = source[path];
        warnings.push(!isRecord(override) || !text(override.reason)
          ? warning("invalid-override", path, `Override ${path} needs a reason and was not applied.`)
          : warning("unsupported-override", path, `Override ${path} is not owned by the current rules engine stage.`));
      });
      return [...warnings].sort((left, right) => left.code.localeCompare(right.code) || left.path.localeCompare(right.path));
    },
  };
}

export function setCharacterOverride(character, path, value, reason) {
  const normalizedPath = text(path);
  const normalizedReason = text(reason);
  if (!normalizedPath) throw new TypeError("Override path is required.");
  if (!normalizedReason) throw new TypeError("Override reason is required.");
  const result = cloneJSON(character);
  result.build = isRecord(result.build) ? result.build : {};
  result.build.overrides = isRecord(result.build.overrides) ? result.build.overrides : {};
  result.build.overrides[normalizedPath] = { value: cloneJSON(value), reason: normalizedReason };
  return result;
}

export function resetCharacterOverride(character, path) {
  const normalizedPath = text(path);
  if (!normalizedPath) throw new TypeError("Override path is required.");
  const result = cloneJSON(character);
  if (isRecord(result.build?.overrides)) delete result.build.overrides[normalizedPath];
  return result;
}
