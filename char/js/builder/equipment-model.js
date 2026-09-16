// Owns starting equipment/gold edits using Compendium item definitions and stable instances.
import { normalizeCharacterDocument } from "../model.js";
import { filterBuilderCatalogEntries } from "./home-model.js";

export const BUILDER_CURRENCY = Object.freeze(["cp", "sp", "ep", "gp", "pp"]);

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function itemEntry(entry) {
  return entry?.category === "items" || entry?.add?.target === "inventory"
    || ["armor", "item", "tool", "weapon", "adventuring gear"].includes(text(entry?.type).toLocaleLowerCase());
}

function indexEntries(entries) {
  const index = new Map();
  (Array.isArray(entries) ? entries : []).forEach((entry) => {
    if (text(entry?.id)) index.set(entry.id, entry);
    if (text(entry?.originalId)) index.set(entry.originalId, entry);
  });
  return index;
}

export function builderEquipmentEntries(entries, value) {
  const document = normalizeCharacterDocument(value);
  const selectedIds = new Set(document.build.inventory.map(({ definitionId }) => definitionId));
  const filtered = filterBuilderCatalogEntries(entries, document).filter(itemEntry);
  const index = indexEntries(entries);
  selectedIds.forEach((id) => {
    const entry = index.get(id);
    if (entry && itemEntry(entry) && [document.build.ruleset, "agnostic"].includes(entry.ruleset || "agnostic")) filtered.push(entry);
  });
  const seen = new Set();
  return filtered.filter((entry) => entry?.id && !seen.has(entry.id) && seen.add(entry.id))
    .sort((left, right) => text(left.name).localeCompare(text(right.name)) || left.id.localeCompare(right.id));
}

export function applyBuilderEquipmentMethod(value, method) {
  const document = normalizeCharacterDocument(value);
  if (!["equipment", "gold"].includes(method)) return document;
  document.build.equipmentMethod = method;
  document.build.status = "incomplete";
  return normalizeCharacterDocument(document);
}

export function applyBuilderCurrency(value, coin, amount) {
  const document = normalizeCharacterDocument(value);
  const number = Number(amount);
  if (!BUILDER_CURRENCY.includes(coin) || !Number.isInteger(number) || number < 0) return document;
  document.build.currency[coin] = number;
  document.build.status = "incomplete";
  return normalizeCharacterDocument(document);
}

function defaultInstanceId() {
  const random = globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `item-${random}`;
}

export function addBuilderInventoryItem(value, entries, definitionId, quantity = 1, createId = defaultInstanceId) {
  const document = normalizeCharacterDocument(value);
  const entry = builderEquipmentEntries(entries, document).find((candidate) => candidate.id === definitionId || candidate.originalId === definitionId);
  const amount = Math.trunc(Number(quantity));
  if (!entry || !Number.isFinite(amount) || amount < 1 || amount > 999) return document;
  let instanceId = text(createId());
  if (!/^[a-z0-9][a-z0-9-]{0,127}$/i.test(instanceId)) return document;
  const occupied = new Set(document.build.inventory.map((item) => item.instanceId));
  let suffix = 2;
  const base = instanceId;
  while (occupied.has(instanceId)) instanceId = `${base}-${suffix++}`.slice(0, 128);
  document.build.inventory.push({ instanceId, definitionId: entry.id, quantity: amount, containerId: "" });
  document.build.status = "incomplete";
  return normalizeCharacterDocument(document);
}

export function updateBuilderInventoryQuantity(value, instanceId, quantity) {
  const document = normalizeCharacterDocument(value);
  const item = document.build.inventory.find((candidate) => candidate.instanceId === instanceId);
  const amount = Math.trunc(Number(quantity));
  if (!item || !Number.isFinite(amount) || amount < 1 || amount > 999) return document;
  item.quantity = amount;
  document.build.status = "incomplete";
  return normalizeCharacterDocument(document);
}

export function removeBuilderInventoryItem(value, instanceId) {
  const document = normalizeCharacterDocument(value);
  if (!document.build.inventory.some((item) => item.instanceId === instanceId)) return document;
  document.build.inventory = document.build.inventory
    .filter((item) => item.instanceId !== instanceId)
    .map((item) => item.containerId === instanceId ? { ...item, containerId: "" } : item);
  document.build.status = "incomplete";
  return normalizeCharacterDocument(document);
}

export function equipmentStepValidation(value, entries = []) {
  const document = normalizeCharacterDocument(value);
  const index = indexEntries(entries);
  const seen = new Set();
  const errors = [];
  document.build.inventory.forEach((item) => {
    if (!item.instanceId || seen.has(item.instanceId)) errors.push("Inventory instances need unique IDs.");
    seen.add(item.instanceId);
    const entry = index.get(item.definitionId);
    if (!entry) errors.push(`Inventory entry ${item.definitionId || "(missing)"} cannot be resolved.`);
    else if (![document.build.ruleset, "agnostic"].includes(entry.ruleset || "agnostic")) errors.push(`${entry.name || entry.id} belongs to another ruleset.`);
  });
  const coinCount = BUILDER_CURRENCY.reduce((sum, coin) => sum + document.build.currency[coin], 0);
  const hasContent = document.build.inventory.length > 0 || coinCount > 0;
  return {
    method: document.build.equipmentMethod,
    errors: [...new Set(errors)],
    complete: !errors.length && hasContent,
    status: errors.length ? "blocked" : hasContent ? "complete" : "warning",
    coinCount,
  };
}
