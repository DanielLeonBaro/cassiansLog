// Renders starting equipment or gold with Compendium-backed item instances.
import { escapeAttribute, escapeHTML } from "../../../shared/js/text.js";
import { BUILDER_CURRENCY, builderEquipmentEntries, equipmentStepValidation } from "./equipment-model.js";

function checked(value) {
  return value ? " checked" : "";
}

export function renderCharacterBuilderEquipment(container, {
  document,
  entries = [],
  loading = false,
  error = "",
  disabled = false,
  onMethodChange,
  onCurrencyChange,
  onAddItem,
  onQuantityChange,
  onRemoveItem,
} = {}) {
  if (loading || error) {
    container.innerHTML = `<p class="rounded-xl border border-sky-600/30 bg-sky-500/10 p-4 text-sm" role="status" aria-live="polite">${escapeHTML(error || "Loading equipment choices…")}</p>`;
    return null;
  }
  const validation = equipmentStepValidation(document, entries);
  const options = builderEquipmentEntries(entries, document);
  const index = new Map(entries.map((entry) => [entry.id, entry]));
  const inventory = document.build.inventory.map((item) => {
    const entry = index.get(item.definitionId);
    const coverage = entry?.automation?.status || "manual";
    return `<li class="grid gap-3 rounded-xl border border-stone-300 p-3 dark:border-white/15 sm:grid-cols-[minmax(0,1fr)_6rem_auto] sm:items-end" data-builder-inventory-instance="${escapeAttribute(item.instanceId)}"><div><strong class="block">${escapeHTML(entry?.name || item.definitionId)}</strong><span class="block text-xs text-stone-500 dark:text-stone-400">${escapeHTML(entry?.publication || entry?.source || "Unknown source")} · ${escapeHTML(coverage)}${coverage === "rules-ready" ? "" : " · no guessed effects"}</span></div><label><span class="mb-1 block text-xs font-bold">Quantity</span><input type="number" min="1" max="999" step="1" value="${item.quantity}" data-builder-inventory-quantity="${escapeAttribute(item.instanceId)}" class="w-full rounded-xl border border-stone-300 bg-white/80 px-3 py-2 text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold dark:border-white/15 dark:bg-ink dark:text-white"${disabled ? " disabled" : ""}></label><button type="button" data-builder-inventory-remove="${escapeAttribute(item.instanceId)}" class="rounded-xl border border-stone-400 px-3 py-2 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"${disabled ? " disabled" : ""}>Remove</button></li>`;
  }).join("");
  container.innerHTML = `<div id="character-builder-equipment" class="grid gap-5">
    <fieldset${disabled ? " disabled" : ""}><legend class="font-display text-lg font-bold">Starting method</legend><div class="mt-3 grid gap-3 sm:grid-cols-2"><label class="flex gap-3 rounded-xl border border-stone-300 p-3 has-[:checked]:border-blood-500 has-[:checked]:ring-1 has-[:checked]:ring-blood-500 dark:border-white/15"><input id="builder-equipment-method-equipment" type="radio" name="builder-equipment-method" value="equipment" class="mt-1 h-4 w-4 accent-red-700"${checked(document.build.equipmentMethod === "equipment")}><span><strong class="block text-sm">Starting equipment</strong><span class="block text-xs text-stone-500 dark:text-stone-400">Add the granted items from enabled Compendium sources.</span></span></label><label class="flex gap-3 rounded-xl border border-stone-300 p-3 has-[:checked]:border-blood-500 has-[:checked]:ring-1 has-[:checked]:ring-blood-500 dark:border-white/15"><input id="builder-equipment-method-gold" type="radio" name="builder-equipment-method" value="gold" class="mt-1 h-4 w-4 accent-red-700"${checked(document.build.equipmentMethod === "gold")}><span><strong class="block text-sm">Starting gold</strong><span class="block text-xs text-stone-500 dark:text-stone-400">Record rolled or fixed currency instead.</span></span></label></div><p class="mt-2 text-xs text-stone-500 dark:text-stone-400">Switching methods preserves existing items and coins so no work is silently deleted.</p></fieldset>
    <section aria-labelledby="builder-currency-title"><h4 id="builder-currency-title" class="font-display text-lg font-bold">Currency</h4><div class="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">${BUILDER_CURRENCY.map((coin) => `<label><span class="mb-1 block text-xs font-bold uppercase">${coin}</span><input id="builder-currency-${coin}" data-builder-currency="${coin}" type="number" min="0" step="1" value="${document.build.currency[coin]}" class="w-full rounded-xl border border-stone-300 bg-white/80 px-3 py-2 text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold dark:border-white/15 dark:bg-ink dark:text-white"${disabled ? " disabled" : ""}></label>`).join("")}</div></section>
    ${document.build.equipmentMethod === "equipment" ? `<section aria-labelledby="builder-add-equipment-title"><h4 id="builder-add-equipment-title" class="font-display text-lg font-bold">Add equipment</h4><p class="mt-1 text-xs text-stone-500 dark:text-stone-400">${options.length.toLocaleString()} compatible item${options.length === 1 ? "" : "s"}. Partial/manual items remain selectable and visibly non-automatic.</p><div class="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_6rem_auto]"><label><span class="mb-1 block text-sm font-bold">Compendium item</span><select id="builder-equipment-definition" class="w-full rounded-xl border border-stone-300 bg-white/80 px-3 py-2.5 text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold dark:border-white/15 dark:bg-ink dark:text-white"${disabled || !options.length ? " disabled" : ""}><option value="">Choose an item…</option>${options.map((entry) => `<option value="${escapeAttribute(entry.id)}">${escapeHTML(`${entry.name || entry.id} — ${entry.publication || entry.source || "Unknown source"} — ${entry.automation?.status || "manual"}`)}</option>`).join("")}</select></label><label><span class="mb-1 block text-sm font-bold">Quantity</span><input id="builder-equipment-quantity" type="number" min="1" max="999" step="1" value="1" class="w-full rounded-xl border border-stone-300 bg-white/80 px-3 py-2.5 text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold dark:border-white/15 dark:bg-ink dark:text-white"${disabled || !options.length ? " disabled" : ""}></label><button id="builder-equipment-add" type="button" class="rounded-xl bg-blood-500 px-4 py-2.5 text-sm font-bold text-on-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"${disabled || !options.length ? " disabled" : ""}>Add</button></div>${!options.length ? '<p class="mt-2 text-sm text-amber-700 dark:text-amber-300">No items match Home filters. Change automation coverage or sources on Home.</p>' : ""}</section>` : ""}
    <section aria-labelledby="builder-inventory-title"><h4 id="builder-inventory-title" class="font-display text-lg font-bold">Selected inventory</h4>${inventory ? `<ul class="mt-3 grid gap-3">${inventory}</ul>` : '<p class="mt-2 text-sm text-stone-500 dark:text-stone-400">No starting items selected.</p>'}</section>
    <p id="builder-equipment-status" class="rounded-xl border ${validation.errors.length ? "border-amber-600/40 bg-amber-500/10" : "border-sky-600/30 bg-sky-500/10"} p-3 text-sm" role="status" aria-live="polite">${escapeHTML(validation.errors.join(" ") || (validation.complete ? "Starting equipment or currency recorded." : "Equipment is optional; you can continue with none."))}</p>
  </div>`;
  container.querySelectorAll('[name="builder-equipment-method"]').forEach((control) => control.addEventListener("change", () => onMethodChange?.(control.value, control.id)));
  container.querySelectorAll("[data-builder-currency]").forEach((control) => control.addEventListener("change", () => onCurrencyChange?.(control.dataset.builderCurrency, control.value, control.id)));
  container.querySelector("#builder-equipment-add")?.addEventListener("click", (event) => onAddItem?.(container.querySelector("#builder-equipment-definition")?.value, container.querySelector("#builder-equipment-quantity")?.value, event.currentTarget.id));
  container.querySelectorAll("[data-builder-inventory-quantity]").forEach((control) => control.addEventListener("change", () => onQuantityChange?.(control.dataset.builderInventoryQuantity, control.value, control.id)));
  container.querySelectorAll("[data-builder-inventory-remove]").forEach((control) => control.addEventListener("click", () => onRemoveItem?.(control.dataset.builderInventoryRemove, "builder-equipment-definition")));
  return validation;
}
