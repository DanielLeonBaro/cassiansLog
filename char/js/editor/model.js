// Creates editor drafts and applies safe nested-field and collection mutations.
import { cloneJSON } from "../../../shared/js/text.js";

let generatedIdSequence = 0;

export function clone(value) {
  return cloneJSON(value);
}

export function pathValue(root, path) {
  return path.reduce((value, key) => value?.[key], root);
}

export function uniqueItemId(prefix = "item") {
  generatedIdSequence += 1;
  return `${prefix}-${Date.now().toString(36)}-${generatedIdSequence.toString(36)}`;
}

export function duplicateCollectionItem(item, collection) {
  const duplicate = cloneJSON(item);
  if (duplicate && typeof duplicate === "object" && Object.prototype.hasOwnProperty.call(duplicate, "id")) {
    const prefix = String(duplicate.id || collection || "item").replace(/-[^-]+$/, "") || collection || "item";
    duplicate.id = uniqueItemId(prefix);
  }
  return duplicate;
}

export function createBlankCollectionItem(path, items, draft) {
  const collection = path.at(-1);
  const defaults = {
    trackers: { id: uniqueItemId("tracker"), name: "", active: false },
    profiles: { id: uniqueItemId("profile"), name: "", ability: "", saveDC: 0, attackBonus: 0, preparedLimit: 0 },
    slots: { id: uniqueItemId("slot"), profileId: draft.spellcasting?.profiles?.[0]?.id || "", level: 1, current: 0, max: 0, reset: "long" },
    skills: { name: "", modifier: 0, proficiency: false },
    actions: { id: uniqueItemId("action"), name: "", category: "", action: "Action", description: "" },
    spells: { id: uniqueItemId("spell"), name: "", category: "Spell", action: "Action", level: 1, source: draft.spellcasting?.profiles?.[0]?.id || "", prepared: false, description: "" },
    resources: { id: uniqueItemId("resource"), name: "", category: "Resource", action: "Other", description: "" },
    features: { id: uniqueItemId("feature"), name: "", category: "Feature", description: "" },
    inventory: { name: "", quantity: 1, description: "", attunement: false, wearable: false },
  };
  if (defaults[collection]) return cloneJSON(defaults[collection]);
  if (!items.length) return "";
  const sample = cloneJSON(items[0]);
  Object.keys(sample).forEach((key) => {
    if (key === "id") sample[key] = uniqueItemId(collection || "item");
    else if (typeof sample[key] === "string") sample[key] = "";
    else if (typeof sample[key] === "number") sample[key] = 0;
    else if (typeof sample[key] === "boolean") sample[key] = false;
    else if (Array.isArray(sample[key])) sample[key] = [];
  });
  return sample;
}

export function draftsDiffer(baseline, draft) {
  return JSON.stringify(baseline) !== JSON.stringify(draft);
}
