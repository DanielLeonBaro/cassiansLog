// Renders schema-driven editor fields and nested collection controls.
import { escapeAttribute, escapeHTML } from "../../../shared/js/text.js";
import { npcFieldVisible } from "../../../shared/js/npc-visibility.js";
import {
  COLLECTION_KNOWN_FIELDS,
  collectionItemSummary,
  fieldPathKey,
  fieldTitle,
  isSystemField,
} from "./field-schema.js";

export function createCharacterFieldRenderer({ classes, expandedItems, getDraft, getVisibility = () => ({}), showVisibilityControls = false }) {
  function renderVisibilityControl(path, label = fieldTitle(path.at(-1))) {
    if (!showVisibilityControls) return "";
    const fieldPath = fieldPathKey(path);
    const visible = npcFieldVisible(getVisibility(), fieldPath);
    return `<button type="button" role="switch" aria-checked="${visible}" data-npc-field-visibility="${escapeAttribute(fieldPath)}" class="inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold transition ${visible ? "border-emerald-600 bg-emerald-600 text-white" : "border-stone-400 text-stone-500 dark:border-white/20 dark:text-stone-300"}" aria-label="${visible ? "Hide" : "Show"} ${escapeAttribute(label)} from players"><i class="bi ${visible ? "bi-eye-fill" : "bi-eye-slash-fill"}" aria-hidden="true"></i>${visible ? "Shown" : "Hidden"}</button>`;
  }

  function fieldHeading(id, path, label, required = false) {
    return `<span class="mb-1 flex items-center justify-between gap-2"><label for="${id}" class="block text-xs font-bold text-stone-500 dark:text-stone-400">${label}${required ? ' <span class="text-blood-500">*</span>' : ""}</label>${renderVisibilityControl(path, label)}</span>`;
  }

  function renderPrimitive(value, path, key, { readOnly = false } = {}) {
    const id = `editor-${path.join("-")}`;
    const fieldPath = escapeAttribute(fieldPathKey(path));
    const systemField = readOnly || isSystemField(path, key);
    const profileField =
      (path[0] === "spells" && key === "source") ||
      (path[0] === "spellcasting" && path[1] === "slots" && key === "profileId");

    if (profileField) {
      const options = getDraft().spellcasting?.profiles || [];
      const label = path[0] === "spells" ? "Source spellcasting profile" : "Spellcasting profile";
      return `<div class="block">${fieldHeading(id, path, label)}<select id="${id}" data-path="${fieldPath}" class="${classes.field}"><option value="">No profile</option>${options.map((profile) => `<option value="${escapeAttribute(profile.id)}" ${profile.id === value ? "selected" : ""}>${escapeHTML(profile.name || profile.id)}</option>`).join("")}</select></div>`;
    }
    if (path[0] === "spells" && key === "prepared") {
      return '<div><span class="mb-1 block text-xs font-bold text-stone-500 dark:text-stone-400">Prepared</span><p class="rounded-xl border border-stone-300 bg-stone-100/70 px-3 py-2.5 text-sm text-stone-500 dark:border-white/15 dark:bg-white/5 dark:text-stone-400">Managed from the Prepare Spells section.</p></div>';
    }
    if (typeof value === "boolean") {
      return `<div class="flex items-center gap-2"><label class="flex min-h-11 grow items-center gap-3 rounded-xl border border-stone-300 bg-white/60 px-3 py-2 dark:border-white/15 dark:bg-white/5 ${systemField ? "opacity-70" : ""}"><input id="${id}" data-path="${fieldPath}" type="checkbox" ${value ? "checked" : ""} ${systemField ? "disabled" : ""} class="h-5 w-5 accent-red-700"><span class="font-medium">${fieldTitle(key)}</span></label>${renderVisibilityControl(path)}</div>`;
    }

    const type = typeof value === "number" ? "number" : "text";
    const multiline = typeof value === "string" && (key === "description" || value.length > 80);
    const list = key === "action" ? "editor-action-options"
      : key === "ability" ? "editor-ability-options"
        : key === "reset" ? "editor-reset-options" : "";
    const required = path.length === 1 && key === "name";
    const maxLength = path.length === 1 && key === "status" ? 'maxlength="32" list="editor-status-options"' : "";
    const helper = systemField ? '<span class="mt-1 block text-xs text-stone-500">Preserved for links and saved-data compatibility.</span>' : "";
    return `<div class="block">${fieldHeading(id, path, fieldTitle(key), required)}${multiline
      ? `<textarea id="${id}" data-path="${fieldPath}" class="${classes.field} ${systemField ? "opacity-70" : ""}" rows="3" ${systemField ? "readonly" : ""}>${escapeHTML(value)}</textarea>`
      : `<input id="${id}" data-path="${fieldPath}" type="${type}" value="${escapeAttribute(value)}" ${list ? `list="${list}"` : ""} ${maxLength} ${required ? "required" : ""} ${systemField ? "readonly" : ""} class="${classes.field} ${systemField ? "opacity-70" : ""}">`}${helper}</div>`;
  }

  function collectionSummary(item, key, index) {
    const { name, details } = collectionItemSummary(item, key, index);
    return `<span class="min-w-0"><strong class="block truncate text-left">${escapeHTML(name)}</strong>${details ? `<span class="mt-0.5 block truncate text-left text-xs font-normal text-stone-500 dark:text-stone-400">${escapeHTML(details)}</span>` : ""}</span>`;
  }

  function renderCollection(value, path, key) {
    const collectionPath = fieldPathKey(path);
    const expanded = expandedItems.get(collectionPath);
    return `<section class="space-y-3" data-array="${escapeAttribute(collectionPath)}">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div><h3 class="font-display text-lg font-bold">${fieldTitle(key)}</h3><p class="text-xs text-stone-500">${value.length} ${value.length === 1 ? "entry" : "entries"}</p></div>
        <div class="flex flex-wrap gap-2" data-array-actions="${escapeAttribute(collectionPath)}"><button type="button" data-add="${escapeAttribute(collectionPath)}" class="${classes.button}"><i class="bi bi-plus-lg"></i> Add manually</button></div>
      </div>
      <div class="space-y-3">${value.map((item, index) => {
        const open = expanded === index;
        return `<article class="overflow-hidden rounded-2xl border border-stone-300/80 bg-white/70 dark:border-white/10 dark:bg-white/[.04]">
          <div class="flex items-center gap-2 p-3 sm:p-4">
            <button type="button" data-edit="${escapeAttribute(collectionPath)}" data-index="${index}" class="flex min-w-0 grow items-center justify-between gap-3 rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold" aria-expanded="${open}">
              ${collectionSummary(item, key, index)}<i class="bi ${open ? "bi-chevron-up" : "bi-chevron-down"} shrink-0 text-stone-400"></i>
            </button>
            <button type="button" data-duplicate="${escapeAttribute(collectionPath)}" data-index="${index}" class="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sky-600 hover:bg-sky-600/10" aria-label="Duplicate ${escapeAttribute(item?.name || `${fieldTitle(key)} ${index + 1}`)}"><i class="bi bi-copy"></i></button>
            <button type="button" data-remove="${escapeAttribute(collectionPath)}" data-index="${index}" class="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-danger-500 hover:bg-danger-500/10" aria-label="Remove ${escapeAttribute(item?.name || `${fieldTitle(key)} ${index + 1}`)}"><i class="bi bi-trash"></i></button>
          </div>
          ${open ? `<div class="border-t border-stone-200 p-4 dark:border-white/10">${renderNode(item, [...path, index], `${fieldTitle(key)} ${index + 1}`)}</div>` : ""}
        </article>`;
      }).join("") || '<div class="rounded-2xl border border-dashed border-stone-300 px-4 py-8 text-center text-sm text-stone-500 dark:border-white/15">No entries yet. Add one manually or use an available content picker.</div>'}</div>
    </section>`;
  }

  function renderNode(value, path = [], key = "", options = {}) {
    if (Array.isArray(value)) return renderCollection(value, path, key);
    if (value && typeof value === "object") {
      const collection = typeof path.at(-1) === "number" ? path.at(-2) : "";
      const editableValue = collection === "inventory"
        ? {
            ...value,
            attunement: value.attunement === true || Number(value.attunement) === 1,
            wearable: value.wearable === true || Number(value.wearable) === 1,
          }
        : value;
      const entries = Object.entries(editableValue);
      const knownFields = COLLECTION_KNOWN_FIELDS[collection];
      const primaryEntries = knownFields ? entries.filter(([childKey]) => knownFields.has(childKey)) : entries;
      const additionalEntries = knownFields ? entries.filter(([childKey]) => !knownFields.has(childKey)) : [];
      const renderEntries = (selected) => selected.map(([childKey, child]) => {
        const nested = child && typeof child === "object";
        return `<div class="${nested ? "md:col-span-2" : ""}">${renderNode(child, [...path, childKey], childKey, options)}</div>`;
      }).join("");
      return `<fieldset class="space-y-3"><legend class="${path.length > 1 ? "mb-2 font-bold" : "sr-only"}">${fieldTitle(key)}</legend>
        <div class="grid grid-cols-1 gap-3 md:grid-cols-2">${renderEntries(primaryEntries)}</div>
        ${additionalEntries.length ? `<details class="rounded-xl border border-stone-300/80 p-3 dark:border-white/10"><summary class="cursor-pointer text-sm font-bold text-stone-600 dark:text-stone-300">Additional fields (${additionalEntries.length})</summary><div class="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">${renderEntries(additionalEntries)}</div></details>` : ""}
      </fieldset>`;
    }
    return renderPrimitive(value, path, key, options);
  }

  return { renderNode, renderPrimitive, renderVisibilityControl };
}
