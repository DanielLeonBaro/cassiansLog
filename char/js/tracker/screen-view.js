// Shared, theme-aware presentation for Tracker 2.1 and 2.2.
import { escapeHTML as escape } from "../../../shared/js/text.js";
import { attackRollFormula, damageRollFormula, modifierRollFormula, renderRollButton } from "./rolls.js";
import { combatTiming } from "./v6-model.js";
import { renderRichText } from "../../../shared/js/rich-text.js";
import { v4BackgroundDetails } from "./v4-content.js";
import { ACTION_USAGE_OPTIONS, FILTER_FOCUS_OPTIONS, createFilterState, itemMatchesFilters } from "./filters.js";
import { v4InventoryItemMatches } from "./v4-inventory.js";
import { v4SummaryModel } from "./v4-layout.js";

export const PORTRAIT_FALLBACK = new URL("../../../shared/assets/bat.ico", import.meta.url).href;

export const SCREEN_NAVIGATION = {
  "v2.1": [["play", "Play", "lightning-charge"], ["checks", "Checks", "hexagon"], ["inventory", "Inventory", "backpack"], ["more", "More", "three-dots"]],
  "v2.2": [["sheet", "Sheet", "person-vcard"], ["actions", "Actions", "lightning-charge"], ["spells", "Spells", "stars"], ["inventory", "Inventory", "backpack"], ["more", "More", "three-dots"]],
};
export const ABILITY_NAMES = { str: "Strength", dex: "Dexterity", con: "Constitution", int: "Intelligence", wis: "Wisdom", cha: "Charisma" };
export const SECTION_NAMES = { play: "Play", actions: "Actions", checks: "Checks", sheet: "Character sheet", spells: "Spells", inventory: "Inventory", more: "More", resources: "Resources", features: "Features & traits", extras: "Companions & extras", notes: "Notes", profile: "Character details", preparation: "Prepare spells", trackers: "Custom trackers" };
export const modifier = (value) => value === null || value === undefined ? "—" : Number(value) >= 0 ? `+${value}` : String(value);
export const resetLabel = (value) => ({ short: "Short rest", long: "Long rest", turn: "Turn", manual: "Manual" })[value] || value || "Manual";
export const icon = (name) => `<i class="bi bi-${name}" aria-hidden="true"></i>`;
export const button = (label, attributes = "", className = "") => `<button type="button" class="${className}" ${attributes}>${label}</button>`;
export const unavailable = (adapter) => adapter.canEdit ? "" : " disabled";
export const pageForVariant = (page, variant) => (variant === "v2.2" ? { play: "actions", checks: "sheet" } : { actions: "play", sheet: "checks" })[page] || page;
export const navigation = (variant) => SCREEN_NAVIGATION[variant].map(([id, label, symbol]) => button(`${icon(symbol)}<span>${label}</span>`, `role="tab" id="tracker-tab-${id}" data-page="${id}" aria-controls="tracker-content" aria-selected="false" tabindex="-1"`)).join("");

export function rollControl(value, formula, label, focus = label) {
  return renderRollButton({ formula, label, text: value, className: "tracker-roll" }).replace("<button ", `<button data-focus="roll:${escape(focus)}" `);
}
export function description(character) {
  return character.kind === "npc" ? `${character.type || "NPC"}${character.challenge ? ` · Challenge ${character.challenge}` : ""}` : `Level ${character.level ?? "—"} ${character.class || "Character"}${character.subclass ? ` · ${character.subclass}` : ""}`;
}
export function shell(variant, character) {
  return `<header class="tracker-header"><a class="tracker-back" href="${escape(character.backHref || "./index.html")}" target="_top" aria-label="${escape(character.backLabel || "Back to preview choices")}">${icon("arrow-left")}</a><strong class="tracker-name" data-header-name>${escape(character.name)}</strong>${button(`<span data-version-label>${variant.slice(1)}</span>${icon("arrow-left-right")}`, 'data-command="switch-view" data-focus="switch-view" aria-label="Switch tracker view"', "tracker-view-switch")}<button type="button" class="tracker-header-hp" data-command="hp" data-focus="hp" aria-label="Manage hit points"><span>HP</span><strong data-header-hp></strong></button>${button(icon("three-dots-vertical"), 'data-command="menu" data-focus="menu" aria-label="Open tracker menu"', "tracker-overflow")}</header><main class="tracker-main" id="tracker-content" role="tabpanel" tabindex="-1"></main><nav class="tracker-tabs" role="tablist" aria-label="Tracker sections">${navigation(variant)}</nav><dialog class="tracker-dialog" aria-labelledby="tracker-dialog-title"><div class="tracker-dialog-content"></div></dialog><output class="tracker-status" role="status" aria-live="polite" hidden></output>`;
}

export function summary(character) {
  return `<dl class="tracker-combat-summary"><div><dt>Armor class</dt><dd>${escape(character.ac ?? "—")}</dd></div><div><dt>Initiative</dt><dd>${rollControl(modifier(character.initiative), modifierRollFormula(character.initiative), "Initiative")}</dd></div><div><dt>Speed</dt><dd>${escape(character.walk ?? "—")} <small>ft</small></dd></div></dl>`;
}

export function combatOverview(character) {
  const model = v4SummaryModel(character);
  const movements = [["Fly", character.fly], ["Swim", character.swim], ["Climb", character.climb], ["Burrow", character.burrow]]
    .filter(([, value]) => Number(value) > 0).map(([label, value]) => [label, `${value} ft`]);
  const metrics = [...movements, ...(character.proficiency != null ? [["Proficiency", modifier(character.proficiency)]] : [])];
  const profiles = character.spellcasting?.profiles || [];
  profiles.forEach((profile) => {
    const prefix = profiles.length > 1 ? profile.name || "Spell" : "Spell";
    const attack = profile.attackBonus ?? profile.spellAttack, dc = profile.saveDC ?? profile.spellSaveDC;
    if (attack != null) metrics.push([`${prefix} attack`, modifier(attack)]);
    if (dc != null) metrics.push([`${prefix} DC`, dc]);
  });
  const extra = [["Senses", model.senses], ["Defenses", model.defenses], ["Proficiencies & languages", model.proficiencies]].filter(([, values]) => values.length);
  return `<section class="tracker-combat-overview" aria-label="Combat information"><div class="tracker-combat-core"><img class="tracker-portrait" data-tracker-portrait src="${escape(character.portrait || PORTRAIT_FALLBACK)}" alt="${escape(character.name)} portrait" width="64" height="64">${summary(character)}</div>${metrics.length ? `<dl class="tracker-combat-metrics">${metrics.map(([label, value]) => `<div><dt>${escape(label)}</dt><dd>${escape(value)}</dd></div>`).join("")}</dl>` : ""}${model.senses.length ? `<p class="tracker-combat-senses">${model.senses.map(escape).join(" · ")}</p>` : ""}<details class="tracker-combat-info"><summary>More character info</summary>${extra.filter(([label]) => label !== "Senses").map(([label, values]) => `<section><h2>${label}</h2><p>${values.map(escape).join(" · ")}</p></section>`).join("")}${profile(character)}${abilityTiles(character, false)}${skills(character)}</details></section>`;
}
export function conditions(character) {
  const values = v4SummaryModel(character).conditions;
  return values.length ? `<button type="button" class="tracker-condition-summary" data-command="conditions">${icon("activity")}${values.map(escape).join(" · ")}</button>` : "";
}
export function toolbar(query, timing, inventory = false, count = timing ? 1 : 0) {
  return `<div class="tracker-toolbar"><label class="tracker-search">${icon("search")}<span class="tracker-sr-only">Search ${inventory ? "inventory" : "options"}</span><input id="tracker-search" type="search" value="${escape(query)}" placeholder="${inventory ? "Find an item" : "Find an action, spell, or ability"}" autocomplete="off"></label>${button(`${icon("sliders2")}<span>Filter${count ? ` · ${count}` : ""}</span>`, 'data-command="filters" data-focus="filters"', "tracker-filter-button")}</div>`;
}
export function optionRecords(adapter, page, query, timing, advanced = {}) {
  return adapter.all().filter((record) => {
    const { source, item, key } = record;
    const eligible = page === "inventory" ? source === "inventory" : page === "spells" ? source === "spells"
      : source === "actions" || source === "spells" && (adapter.availableInCombat ? adapter.availableInCombat(item) : item.prepared || Number(item.level) === 0 || item.alwaysPrepared)
      || source === "features" && (item.action || adapter.personal.pins.has(key)) || ["resources", "inventory"].includes(source) && adapter.personal.pins.has(key);
    return eligible && (!timing || combatTiming(item) === timing) && (page === "inventory" ? v4InventoryItemMatches(item, { search: query, status: advanced.status || "", container: advanced.container || "" }) : itemMatchesFilters(record, { ...createFilterState(), ...advanced, search: query }));
  });
}
export function optionRow(record, adapter, page) {
  const { source, item, key } = record;
  const isInventory = source === "inventory";
  const plan = isInventory && !item.charges ? null : adapter.plan(key);
  const recovery = [item.recharge, item.uses ? `${item.uses.current}/${item.uses.max} · ${resetLabel(item.uses.reset)}` : "", item.legendaryCost ? `${item.legendaryCost} legendary actions` : ""].filter(Boolean).join(" · ");
  const linked = item.resourceId ? adapter.character.resources.find((resource) => resource.id === item.resourceId) : null;
  const metadata = isInventory ? `Quantity ${item.quantity ?? 1}${item.charges ? ` · ${item.charges.current}/${item.charges.max} charges` : ""}${(item.equipped ?? item.wearing) ? " · Equipped" : ""}${item.attuned ? " · Attuned" : ""}`
    : [item.action || "Other", item.range, item.concentration ? "Concentration" : "", recovery, linked?.uses ? `${linked.uses.current}/${linked.uses.max} ${linked.name.toLowerCase()}` : ""].filter(Boolean).join(" · ");
  const rolls = !isInventory ? `${item.attack ? rollControl(item.attack, attackRollFormula(item.attack), `${item.name} attack`, `${key}:attack`) : ""}${item.damage ? rollControl(item.damage, damageRollFormula(item.damage), `${item.name} damage`, `${key}:damage`) : ""}${item.save ? `<span class="tracker-save-label">${escape(item.save)}</span>` : ""}` : "";
  const spendLabel = source === "spells" ? "Cast" : isInventory ? "Use charge" : "Use";
  return `<article class="tracker-option" data-record="${escape(key)}"><button type="button" class="tracker-option-name" data-detail="${escape(key)}" data-focus="detail:${escape(key)}"><span>${escape(item.name)}</span>${page === "spells" ? `<small>${Number(item.level) === 0 ? "Cantrip" : `Level ${item.level}`} · ${escape(item.school || "Spell")}</small>` : ""}</button>${plan ? button(spendLabel, `data-use="${escape(key)}" data-focus="use:${escape(key)}"${!adapter.canEdit || !plan.canConfirm ? " disabled" : ""}`, "tracker-use") : button("Details", `data-detail="${escape(key)}" data-focus="details:${escape(key)}"`, "tracker-use")}<div class="tracker-option-meta">${escape(metadata)}</div>${rolls ? `<div class="tracker-option-rolls">${rolls}</div>` : ""}${plan && !plan.canConfirm ? `<p class="tracker-option-unavailable">${escape(plan.message)}</p>` : ""}</article>`;
}
export function optionsList(adapter, state) {
  const records = optionRecords(adapter, state.page, state.query, state.timing, state.advanced);
  if (!records.length) return '<div class="tracker-empty"><strong>No matching options</strong><p>Try a different search or clear your filters.</p><button type="button" data-command="clear-filters">Clear search and filters</button></div>';
  const pinned = ["play", "actions"].includes(state.page) ? records.filter(({ key }) => adapter.personal.pins.has(key)) : [];
  const remaining = records.filter((record) => !pinned.includes(record));
  const group = (label, items) => items.length ? `<section class="tracker-option-group"><h2>${label}<span>${items.length}</span></h2><div class="tracker-option-list">${items.map((item) => optionRow(item, adapter, state.page)).join("")}</div></section>` : "";
  return group("Pinned", pinned) + group(state.page === "inventory" ? "Equipment" : state.page === "spells" ? "Spell repertoire" : pinned.length ? "All other options" : "Your options", remaining);
}
export function resourceCounters(adapter) {
  const pools = adapter.all().filter(({ item }) => item.uses);
  const slots = adapter.character.spellcasting.slots;
  const counter = (kind, id, name, current, max, recovery, key = "") => `<div class="tracker-resource"><div>${key ? button(escape(name), `data-detail="${escape(key)}" data-focus="detail:${escape(key)}"`, "tracker-resource-name") : `<strong>${escape(name)}</strong>`}<small>${escape(recovery)}</small></div><div class="tracker-stepper">${button("−", `data-adjust="${kind}" data-id="${escape(id)}" data-delta="-1" data-focus="${kind}:${escape(id)}:-1" aria-label="Decrease ${escape(name)}"${unavailable(adapter)}`)}<output>${escape(current)}<span> / ${escape(max)}</span></output>${button("+", `data-adjust="${kind}" data-id="${escape(id)}" data-delta="1" data-focus="${kind}:${escape(id)}:1" aria-label="Increase ${escape(name)}"${unavailable(adapter)}`)}</div></div>`;
  return `${slots.length ? `<section><h2>Spell slots</h2>${slots.map((slot) => counter("slot", slot.id, `Level ${slot.level}`, slot.current, slot.max, resetLabel(slot.reset))).join("")}</section>` : ""}${pools.length ? `<section><h2>Limited uses</h2>${pools.map(({ item, key }) => counter("resource", item.id, item.name, item.uses.current, item.uses.max, item.recharge || resetLabel(item.uses.reset), key)).join("")}</section>` : ""}${!slots.length && !pools.length ? '<p class="tracker-muted">No limited-use resources recorded.</p>' : ""}${(adapter.character.hitDice || []).length ? `<section><h2>Hit dice</h2>${adapter.character.hitDice.map((pool, index) => counter("hit-die", String(index), pool.die, pool.current, pool.max, "Long rest")).join("")}</section>` : ""}`;
}
export function abilityTiles(character, boxed = true) {
  return `<section class="tracker-abilities-section"><h2>Ability scores</h2><div class="${boxed ? "tracker-ability-grid" : "tracker-check-list"}">${Object.entries(character.stats || {}).map(([key, stat]) => `<article class="tracker-ability"><div><span>${escape(ABILITY_NAMES[key])}</span><strong>${escape(stat.score ?? "—")}</strong></div>${rollControl(modifier(stat.modifier), modifierRollFormula(stat.modifier), `${ABILITY_NAMES[key]} check`, `ability:${key}`)}<div class="tracker-ability-save"><span>Saving throw</span>${rollControl(modifier(stat.save), modifierRollFormula(stat.save), `${ABILITY_NAMES[key]} saving throw`, `save:${key}`)}</div></article>`).join("")}</div></section>`;
}
export function skills(character) {
  const entries = Object.entries(character.stats || {}).flatMap(([ability, stat]) => stat.skills.map((skill) => ({ ...skill, ability }))).sort((a, b) => a.name.localeCompare(b.name));
  return `<section class="tracker-skills"><h2>Skills</h2>${entries.map((skill) => `<div class="tracker-skill"><div><strong>${escape(skill.name)}</strong><small>${escape(ABILITY_NAMES[skill.ability])}${skill.proficiency ? " · Proficient" : ""}</small></div>${rollControl(modifier(skill.modifier), modifierRollFormula(skill.modifier), `${skill.name} check`, `skill:${skill.name}`)}</div>`).join("") || '<p class="tracker-muted">No skills recorded.</p>'}</section>`;
}
export function defenses(character) {
  return `<section class="tracker-defenses"><h2>Defenses</h2><dl>${Object.entries(character.defenses || {}).map(([label, values]) => `<div><dt>${escape(label)}</dt><dd>${values.length ? values.map(escape).join(", ") : "None recorded"}</dd></div>`).join("")}</dl></section>`;
}
export function details(record, adapter) {
  const { item, key, source } = record;
  const plan = source === "inventory" && !item.charges ? null : adapter.plan(key);
  return `<p class="tracker-eyebrow">${escape(source === "spells" ? `${Number(item.level) === 0 ? "Cantrip" : `Level ${item.level}`} · ${item.school || "Spell"}` : item.category || source)}</p><h2 id="tracker-detail-title">${escape(item.name)}</h2><dl class="tracker-detail-facts">${["action", "range", "duration", "components", "attack", "damage", "save", "recharge", "legendaryCost", "weight"].filter((field) => item[field]).map((field) => `<div><dt>${escape(field)}</dt><dd>${escape(item[field])}</dd></div>`).join("")}</dl><p class="tracker-description">${escape(item.description || "No description recorded.")}</p>${item.selections?.length ? `<ul>${item.selections.map(value=>`<li>${escape(value)}</li>`).join("")}</ul>` : ""}${source === "inventory" ? inventoryDetails(item, adapter) : ""}${plan ? `<p class="tracker-muted">${escape(plan.message)}</p>` : ""}<div class="tracker-detail-actions">${button(`${icon(adapter.personal.pins.has(key) ? "pin-fill" : "pin")} ${adapter.personal.pins.has(key) ? "Unpin" : "Pin to Play"}`, `data-pin="${escape(key)}" data-focus="pin:${escape(key)}" aria-pressed="${adapter.personal.pins.has(key)}"`)}${plan ? button(source === "spells" ? "Cast spell" : source === "inventory" ? "Use charge" : "Use option", `data-use="${escape(key)}"${!adapter.canEdit || !plan.canConfirm ? " disabled" : ""}`, "tracker-primary") : ""}</div>`;
}
export function moreLinks(character) {
  const links = [["resources", "Resources", "Slots, limited uses, and recovery"], ["spells", "Spells", "Full spell repertoire"], ["preparation", "Prepare spells", "Choose your prepared repertoire"], ["features", character.kind === "npc" ? "Traits" : "Features & traits", "Abilities, features, and rules"], ["extras", "Companions & extras", "Familiars, forms, and custom records"], ["notes", "Notes", "Session notes and reminders"], ["profile", character.kind === "npc" ? "NPC details" : "Character details", "Identity, background, and flags"], ["trackers", "Custom trackers", "Your manual toggles"]];
  return `<div class="tracker-more-list">${links.map(([id, title, subtitle]) => button(`<span><strong>${title}</strong><small>${subtitle}</small></span>${icon("chevron-right")}`, `data-page="${id}"`)).join("")}</div>`;
}

export function profile(character) {
  const fields = ["name", "status", "race", "class", "subclass", "level", "experience", "background", "alignment", "gender", "type", "challenge", "proficiency", "passivePerception", "darkvision", "walk", "fly", "swim", "climb"];
  const background = v4BackgroundDetails(character);
  return `<dl>${fields.filter((field) => character[field] != null && character[field] !== "").map((field) => `<div><dt>${escape(field.replace(/([A-Z])/g, " $1"))}</dt><dd>${escape(character[field])}</dd></div>`).join("")}</dl>${background.fields.map((field) => `<article><h2>${escape(field.label)}</h2>${renderRichText(field.value)}</article>`).join("")}`;
}

export const noteContent = (value) => renderRichText(value);

export function advancedFilters(adapter, state) {
  const select = (key, label, options) => `<label>${label}<select data-advanced-filter="${key}">${options.map(({ value, label }) => `<option value="${escape(value)}"${String(state.advanced[key] || "") === String(value) ? " selected" : ""}>${escape(label)}</option>`).join("")}</select></label>`;
  if (state.page === "inventory") return select("status", "Item status", [{value:"",label:"All items"}, ...[["equipped","Equipped"],["attuned","Attuned"],["charges","With charges"],["containers","Containers"],["manual","Manual items"]].map(([value,label])=>({value,label}))]) + select("container", "Container", [{value:"",label:"Any container"},{value:"loose",label:"Loose equipment"},{value:"contained",label:"In a container"},...adapter.character.inventory.filter(item=>item.containerCapacity!==undefined&&item.containerCapacity!==null).map(item=>({value:item.instanceId,label:item.name}))]);
  const values = (field) => [...new Set(adapter.all().map(({item})=>item[field]).filter(value=>value!==undefined&&value!==""))].sort((a,b)=>String(a).localeCompare(String(b),undefined,{numeric:true})).map(value=>({value:String(value),label:String(value)}));
  return select("source", "Source", [{value:"",label:"All sources"},...["actions","spells","features","resources","inventory"].map(value=>({value,label:value[0].toUpperCase()+value.slice(1)}))]) + select("focus", "Focus", FILTER_FOCUS_OPTIONS) + select("usage", "Action type", ACTION_USAGE_OPTIONS) + select("level", "Spell level", [{value:"",label:"Any level"},...values("level")]) + select("category", "Category", [{value:"",label:"Any category"},...values("category")]);
}

export function inventoryDetails(item, adapter) {
  if (!adapter.inventoryChange) return "";
  const controls = item.runtimeManaged ? `${button("−", `data-inventory="quantity" data-index="${item.index}" data-delta="-1" aria-label="Decrease quantity"${unavailable(adapter)}`)}<span>Quantity ${item.quantity}</span>${button("+", `data-inventory="quantity" data-index="${item.index}" data-delta="1" aria-label="Increase quantity"${unavailable(adapter)}`)}${item.canEquip ? button("Equipped", `data-inventory="equipped" data-index="${item.index}" aria-pressed="${item.equipped}"${unavailable(adapter)}`) : ""}${item.canAttune ? button("Attuned", `data-inventory="attuned" data-index="${item.index}" aria-pressed="${item.attuned}"${unavailable(adapter)}`) : ""}`
    : `${item.wearable ? button("Wearing", `data-inventory="wearing" data-index="${item.index}" aria-pressed="${item.equipped}"${unavailable(adapter)}`) : ""}${item.attunement ? button("Attuned", `data-inventory="attuned" data-index="${item.index}" aria-pressed="${item.attuned}"${unavailable(adapter)}`) : ""}`;
  return `<div class="tracker-inventory-controls">${controls}${item.runtimeManaged ? `<label>Container<select data-item-container data-index="${item.index}"${unavailable(adapter)}><option value="">Loose equipment</option>${item.containers.map((container) => `<option value="${escape(container.id)}"${item.containerId === container.id ? " selected" : ""}>${escape(container.name)}</option>`).join("")}</select></label>` : ""}</div>`;
}
