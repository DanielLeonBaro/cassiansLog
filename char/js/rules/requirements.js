// Evaluates the small, explicit requirement grammar supported by Character rules automation.

function normalizedText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizedName(value) {
  return normalizedText(value).toLowerCase().replaceAll(/\s+/g, " ");
}

function tokenizeIdExpression(value) {
  const tokens = [];
  let offset = 0;
  while (offset < value.length) {
    const rest = value.slice(offset);
    const whitespace = rest.match(/^\s+/);
    if (whitespace) {
      offset += whitespace[0].length;
      continue;
    }
    const operator = rest.match(/^(\|\||&&|[!,()])/);
    if (operator) {
      tokens.push(operator[0] === "," ? "&&" : operator[0]);
      offset += operator[0].length;
      continue;
    }
    const identifier = rest.match(/^ID_[A-Z0-9_]+/i);
    if (identifier) {
      tokens.push(identifier[0]);
      offset += identifier[0].length;
      continue;
    }
    return null;
  }
  return tokens;
}

function evaluateTokens(tokens, activeIds) {
  let offset = 0;

  function primary() {
    const token = tokens[offset];
    if (token === "!") {
      offset += 1;
      const value = primary();
      return value === null ? null : !value;
    }
    if (token === "(") {
      offset += 1;
      const value = orExpression();
      if (tokens[offset] !== ")") return null;
      offset += 1;
      return value;
    }
    if (typeof token === "string" && /^ID_/i.test(token)) {
      offset += 1;
      return activeIds.has(token);
    }
    return null;
  }

  function andExpression() {
    let value = primary();
    if (value === null) return null;
    while (tokens[offset] === "&&") {
      offset += 1;
      const right = primary();
      if (right === null) return null;
      value = value && right;
    }
    return value;
  }

  function orExpression() {
    let value = andExpression();
    if (value === null) return null;
    while (tokens[offset] === "||") {
      offset += 1;
      const right = andExpression();
      if (right === null) return null;
      value = value || right;
    }
    return value;
  }

  const value = orExpression();
  return value !== null && offset === tokens.length ? value : null;
}

export function evaluateIdRequirement(expression, activeIds = new Set()) {
  const value = normalizedText(expression);
  if (!value) return { status: "met" };
  const tokens = tokenizeIdExpression(value);
  if (!tokens?.length) return { status: "unsupported", expression: value };
  const result = evaluateTokens(tokens, activeIds);
  if (result === null) return { status: "unsupported", expression: value };
  return { status: result ? "met" : "unmet", expression: value };
}

function classLevelFor(reference, classLevels) {
  const key = normalizedName(reference);
  if (!key) return null;
  return classLevels.get(key) ?? null;
}

function evaluateLevelRequirement(value, context) {
  const minimum = Number(typeof value === "object" ? value.minimum : value);
  if (!Number.isFinite(minimum) || minimum < 1) return { status: "unsupported" };
  const classId = typeof value === "object" ? value.classId : "";
  const actual = classId
    ? classLevelFor(classId, context.classLevels)
    : context.level;
  return { status: (actual ?? 0) >= minimum ? "met" : "unmet" };
}

function evaluateStructuredPrerequisite(value, context) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { status: "unsupported", expression: value };
  }
  if (value.entryId) {
    const met = context.activeIds.has(String(value.entryId));
    return { status: met ? "met" : "unmet" };
  }
  if (value.level !== undefined) return evaluateLevelRequirement(value.level, context);
  if (Array.isArray(value.allOf)) {
    const results = value.allOf.map((item) => evaluatePrerequisite(item, context));
    if (results.some((result) => result.status === "unsupported")) return { status: "unsupported", expression: value };
    return { status: results.every((result) => result.status === "met") ? "met" : "unmet" };
  }
  if (Array.isArray(value.anyOf)) {
    const results = value.anyOf.map((item) => evaluatePrerequisite(item, context));
    if (results.some((result) => result.status === "met")) return { status: "met" };
    if (results.every((result) => result.status === "unmet")) return { status: "unmet" };
    return { status: "unsupported", expression: value };
  }
  if (value.not !== undefined) {
    const result = evaluatePrerequisite(value.not, context);
    if (result.status === "unsupported") return result;
    return { status: result.status === "met" ? "unmet" : "met" };
  }
  return { status: "unsupported", expression: value };
}

export function evaluatePrerequisite(prerequisite, {
  activeIds = new Set(),
  activeEntries = [],
  classLevels = new Map(),
  level = 0,
} = {}) {
  const context = { activeIds, activeEntries, classLevels, level };
  if (prerequisite && typeof prerequisite === "object") {
    return evaluateStructuredPrerequisite(prerequisite, context);
  }

  const value = normalizedText(prerequisite);
  if (!value) return { status: "met" };
  if (/ID_/i.test(value)) return evaluateIdRequirement(value, activeIds);

  const minimumLevel = value.match(/^level\s+(\d+)\+?(?:\s+(.+))?$/i)
    || value.match(/^(\d+)(?:st|nd|rd|th)(?:-level|\s+level)(?:\s+(.+))?$/i);
  if (minimumLevel) {
    const minimum = Number(minimumLevel[1]);
    const classReference = normalizedText(minimumLevel[2]);
    const actual = classReference
      ? classLevelFor(classReference, classLevels)
      : level;
    return {
      status: (actual ?? 0) >= minimum ? "met" : "unmet",
      expression: value,
    };
  }

  const expectedName = normalizedName(value.replace(/\s+feature$/i, ""));
  const hasNamedEntry = activeEntries.some((entry) => normalizedName(entry.name) === expectedName);
  if (hasNamedEntry) return { status: "met", expression: value };

  return { status: "unsupported", expression: value };
}
