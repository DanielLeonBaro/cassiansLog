// Defines Player and DM Screen normalization and state transformations without DOM side effects.
import { cloneJSON } from "../../shared/js/text.js";

export const SCREEN_VERSION = 1;
export const MAX_SCREEN_DOCUMENT_BYTES = 1_700_000;
export const SCREEN_KINDS = new Set(["player", "dm"]);
export const WIDGET_TYPES = new Set([
  "character",
  "party",
  "manual",
  "compendium",
  "note",
  "initiative",
  "calculator",
]);
export const PARTY_FIELDS = new Set([
  "portrait", "classLevel", "hp", "ac", "str", "dex", "con", "int", "wis", "cha",
]);
export const DEFAULT_PARTY_FIELDS = ["classLevel", "hp", "ac"];

const ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,127}$/i;

function text(value, maximum = Infinity) {
  return typeof value === "string" ? value.slice(0, maximum) : "";
}

function textList(value) {
  return Array.isArray(value)
    ? [...new Set(value.filter((item) => typeof item === "string" && ID_PATTERN.test(item)))]
    : [];
}

function normalizeBase(widget) {
  if (!widget || typeof widget !== "object" || Array.isArray(widget)) return null;
  if (!ID_PATTERN.test(widget.id || "") || !WIDGET_TYPES.has(widget.type)) return null;
  return { id: widget.id, type: widget.type };
}

export function normalizeWidget(widget) {
  const base = normalizeBase(widget);
  if (!base) return null;
  if (base.type === "character") {
    return { ...base, characterId: ID_PATTERN.test(widget.characterId || "") ? widget.characterId : "" };
  }
  if (base.type === "party") {
    const fields = Array.isArray(widget.fields)
      ? [...new Set(widget.fields.filter((field) => PARTY_FIELDS.has(field)))]
      : [...DEFAULT_PARTY_FIELDS];
    return { ...base, characterIds: textList(widget.characterIds), fields };
  }
  if (base.type === "manual") {
    return {
      ...base,
      title: text(widget.title, 120),
      sourceLabel: text(widget.sourceLabel, 160),
      sourceUrl: text(widget.sourceUrl, 2000),
      image: text(widget.image, 700_000),
      body: text(widget.body, 1_500_000),
    };
  }
  if (base.type === "compendium") {
    const source = widget.source && typeof widget.source === "object" && !Array.isArray(widget.source)
      ? {
        id: text(widget.source.id, 128),
        category: text(widget.source.category, 80),
        name: text(widget.source.name, 160),
        publication: text(widget.source.publication, 160),
      }
      : { id: "", category: "", name: "", publication: "" };
    return {
      ...base,
      title: text(widget.title, 120),
      image: text(widget.image, 700_000),
      body: text(widget.body, 1_500_000),
      source,
    };
  }
  if (base.type === "note") {
    return { ...base, title: text(widget.title, 120), body: text(widget.body, 1_500_000) };
  }
  if (base.type === "calculator") {
    return { ...base, expression: text(widget.expression, 200) };
  }
  return base;
}

export function normalizeScreenDocument(value) {
  const widgets = Array.isArray(value?.widgets) ? value.widgets : [];
  const seen = new Set();
  return {
    version: SCREEN_VERSION,
    widgets: widgets.reduce((result, candidate) => {
      const widget = normalizeWidget(candidate);
      if (widget && !seen.has(widget.id)) {
        seen.add(widget.id);
        result.push(widget);
      }
      return result;
    }, []),
  };
}

export function validScreenDocument(value) {
  if (!value || value.version !== SCREEN_VERSION || !Array.isArray(value.widgets)) return false;
  const normalized = normalizeScreenDocument(value);
  return normalized.widgets.length === value.widgets.length;
}

export function createEmptyScreen() {
  return { version: SCREEN_VERSION, widgets: [] };
}

export function createWidget(type, id = crypto.randomUUID()) {
  const base = { id: String(id), type };
  if (type === "character") return { ...base, characterId: "" };
  if (type === "party") return { ...base, characterIds: [], fields: [...DEFAULT_PARTY_FIELDS] };
  if (type === "manual") return { ...base, title: "", sourceLabel: "", sourceUrl: "", image: "", body: "" };
  if (type === "compendium") return { ...base, title: "", image: "", body: "", source: { id: "", category: "", name: "", publication: "" } };
  if (type === "note") return { ...base, title: "", body: "" };
  if (type === "calculator") return { ...base, expression: "" };
  if (type === "initiative") return base;
  throw new TypeError("Unknown widget type.");
}

export function replaceWidget(documentValue, widget) {
  const document = normalizeScreenDocument(documentValue);
  const normalized = normalizeWidget(widget);
  if (!normalized) throw new TypeError("Widget is invalid.");
  const index = document.widgets.findIndex((item) => item.id === normalized.id);
  if (index >= 0) document.widgets.splice(index, 1, normalized);
  else document.widgets.push(normalized);
  return cloneJSON(document);
}

export function removeWidget(documentValue, id) {
  const document = normalizeScreenDocument(documentValue);
  document.widgets = document.widgets.filter((widget) => widget.id !== id);
  return cloneJSON(document);
}

export function moveWidget(documentValue, id, delta) {
  const document = normalizeScreenDocument(documentValue);
  const index = document.widgets.findIndex((widget) => widget.id === id);
  const target = Math.max(0, Math.min(document.widgets.length - 1, index + Number(delta)));
  if (index < 0 || index === target) return document;
  const [widget] = document.widgets.splice(index, 1);
  document.widgets.splice(target, 0, widget);
  return cloneJSON(document);
}

export function reorderWidget(documentValue, sourceId, targetId) {
  const document = normalizeScreenDocument(documentValue);
  const source = document.widgets.findIndex((widget) => widget.id === sourceId);
  const target = document.widgets.findIndex((widget) => widget.id === targetId);
  if (source < 0 || target < 0 || source === target) return document;
  const [widget] = document.widgets.splice(source, 1);
  document.widgets.splice(target, 0, widget);
  return cloneJSON(document);
}

export function screenDocumentBytes(value) {
  return new TextEncoder().encode(JSON.stringify(normalizeScreenDocument(value))).length;
}
