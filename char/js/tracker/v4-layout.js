// Builds the V4 tracker hierarchy from existing live tracker nodes and renders its core summary.
import { escapeAttribute, escapeHTML } from "../../../shared/js/text.js";
import { modifierRollFormula, renderRollButton } from "./rolls.js";
import { v4BackgroundDetails } from "./v4-content.js";

export const V4_TAB_DEFINITIONS = Object.freeze([
  Object.freeze({ id: "actions", label: "Actions", icon: "bi-lightning-charge-fill" }),
  Object.freeze({ id: "spells", label: "Spells", icon: "bi-magic" }),
  Object.freeze({ id: "inventory", label: "Inventory", icon: "bi-backpack-fill" }),
  Object.freeze({ id: "features", label: "Features & Traits", icon: "bi-stars" }),
  Object.freeze({ id: "extras", label: "Extras", icon: "bi-people-fill" }),
]);

let controller = null;

function entityLabel() {
  return document.body?.dataset?.trackerKind === "npc" ? "NPC" : "Character";
}

function text(value, fallback = "—") {
  const normalized = String(value ?? "").trim();
  return normalized || fallback;
}

function list(value) {
  if (Array.isArray(value)) return value.flatMap((item) => {
    if (item && typeof item === "object") return [text(item.name || item.label || item.id, "")].filter(Boolean);
    return [text(item, "")].filter(Boolean);
  });
  if (value && typeof value === "object") return Object.entries(value).flatMap(([group, items]) => {
    const values = list(items);
    return values.length ? values.map((item) => `${group}: ${item}`) : [];
  });
  return text(value, "") ? [text(value)] : [];
}

function movement(character) {
  return [
    ["Walk", character.walk],
    ["Fly", character.fly],
    ["Swim", character.swim],
    ["Climb", character.climb],
    ["Burrow", character.burrow],
  ].filter(([, speed]) => Number(speed) > 0).map(([name, speed]) => `${name} ${speed} ft`);
}

function senses(character) {
  const values = list(character.senses);
  if (character.passivePerception !== undefined) values.unshift(`Passive Perception ${character.passivePerception}`);
  if (Number(character.darkvision) > 0) values.push(`Darkvision ${character.darkvision} ft`);
  return [...new Set(values)];
}

function defenses(character) {
  const source = character.defenses || {};
  const values = [
    ...list(source.resistances || character.resistances).map((item) => `Resistance: ${item}`),
    ...list(source.immunities || character.immunities).map((item) => `Immunity: ${item}`),
    ...list(source.vulnerabilities || character.vulnerabilities).map((item) => `Vulnerability: ${item}`),
  ];
  return [...new Set(values)];
}

export function v4SummaryModel(character = {}) {
  const conditions = list(character.conditions);
  if (Number(character.exhaustion) > 0) conditions.push(`Exhaustion ${character.exhaustion}`);
  if (character.concentration) conditions.push(`Concentrating: ${text(character.concentration.name || character.concentration)}`);
  return {
    movement: movement(character),
    senses: senses(character),
    proficiencies: [...new Set([...list(character.proficiencies), ...list(character.languages).map((item) => `Language: ${item}`)])],
    defenses: defenses(character),
    conditions: [...new Set(conditions)],
    background: text(character.background),
    backgroundDetails: v4BackgroundDetails(character),
  };
}

function summaryCard(title, values, id) {
  const content = values.length
    ? `<ul class="v4-summary-list">${values.map((value) => `<li>${escapeHTML(value)}</li>`).join("")}</ul>`
    : '<p class="v4-empty">None recorded.</p>';
  return `<section class="v4-summary-card" aria-labelledby="${id}-title"><h2 id="${id}-title">${escapeHTML(title)}</h2>${content}</section>`;
}

export function renderV4CoreSummary(character = {}, root = document) {
  const host = root.getElementById("v4-summary-details");
  if (!host) return false;
  const model = v4SummaryModel(character);
  host.innerHTML = [
    summaryCard("Speed", model.movement, "v4-speed"),
    summaryCard("Senses", model.senses, "v4-senses"),
    summaryCard("Proficiencies & Languages", model.proficiencies, "v4-proficiencies"),
    summaryCard("Defenses", model.defenses, "v4-defenses"),
  ].join("");
  const background = root.getElementById("v4-background-content");
  if (background) background.innerHTML = `<strong>${escapeHTML(model.background)}</strong>${model.backgroundDetails.fields.length ? `<dl>${model.backgroundDetails.fields.map((field) => `<div><dt>${escapeHTML(field.label)}</dt><dd>${escapeHTML(field.value)}</dd></div>`).join("")}</dl>` : ""}`;
  const conditions = root.getElementById("v4-condition-list");
  if (conditions) conditions.innerHTML = model.conditions.length
    ? model.conditions.map((condition) => {
      if (condition.startsWith("Concentrating:")) return `<li><span>${escapeHTML(condition)}</span><button type="button" data-tracker-action="clear-concentration">Clear</button></li>`;
      if (condition.startsWith("Exhaustion ")) return `<li><span>${escapeHTML(condition)}</span><span class="v4-condition-buttons"><button type="button" data-tracker-action="exhaustion" data-delta="-1" aria-label="Decrease exhaustion">−</button><button type="button" data-tracker-action="exhaustion" data-delta="1" aria-label="Increase exhaustion">+</button></span></li>`;
      return `<li><span>${escapeHTML(condition)}</span><button type="button" data-tracker-action="remove-condition" data-condition="${escapeAttribute(condition)}" aria-label="Remove ${escapeAttribute(condition)}">Remove</button></li>`;
    }).join("")
    : '<li class="v4-empty">No active conditions.</li>';
  return true;
}

function formatModifier(value) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return "—";
  return Number(value) >= 0 ? `+${Number(value)}` : String(Number(value));
}

export function renderV4Stats(container, character = {}) {
  const names = { str: "Strength", dex: "Dexterity", con: "Constitution", int: "Intelligence", wis: "Wisdom", cha: "Charisma" };
  const stats = Object.entries(character.stats || {});
  const abilities = stats.map(([key, stat]) => `<article class="v4-ability" aria-label="${escapeHTML(names[key] || key)}"><span>${escapeHTML(key.toUpperCase())}</span><strong>${stat.score ?? "—"}</strong>${renderRollButton({ formula: modifierRollFormula(stat.modifier), label: `${names[key] || key} Check`, text: formatModifier(stat.modifier), className: "v4-roll" })}${renderRollButton({ formula: modifierRollFormula(stat.save), label: `${names[key] || key} Saving Throw`, text: `Save ${formatModifier(stat.save)}`, className: "v4-save-roll" })}</article>`).join("");
  const skills = stats.flatMap(([key, stat]) => (stat.skills || []).map((skill) => ({ ...skill, ability: key.toUpperCase() })))
    .sort((left, right) => String(left.name).localeCompare(String(right.name)))
    .map((skill) => `<li>${renderRollButton({ formula: modifierRollFormula(skill.modifier), label: `${skill.name} Skill`, content: `<span>${skill.proficiency ? '<i class="bi bi-star-fill" aria-label="Proficient"></i>' : '<i class="bi bi-circle" aria-hidden="true"></i>'}<small>${escapeHTML(skill.ability)}</small>${escapeHTML(skill.name)}</span><strong>${formatModifier(skill.modifier)}</strong>`, className: "v4-skill-roll" })}</li>`).join("");
  container.innerHTML = `<section aria-labelledby="v4-abilities-title"><h2 id="v4-abilities-title" class="v4-section-title">Abilities & Saves</h2><div class="v4-ability-grid">${abilities || '<p class="v4-empty">No abilities recorded.</p>'}</div></section><section aria-labelledby="v4-skills-title"><h2 id="v4-skills-title" class="v4-section-title">Skills</h2><ul class="v4-skill-list">${skills || '<li class="v4-empty">No skills recorded.</li>'}</ul></section>`;
}

function panel(id) {
  const element = document.createElement("section");
  element.id = `v4-panel-${id}`;
  element.className = "v4-panel";
  element.dataset.v4Panel = id;
  element.setAttribute("role", "tabpanel");
  element.setAttribute("aria-labelledby", `v4-tab-${id}`);
  element.tabIndex = 0;
  return element;
}

function tablist() {
  const element = document.createElement("div");
  element.id = "v4-tabs";
  element.className = "v4-tabs";
  element.setAttribute("role", "tablist");
  element.setAttribute("aria-label", `${entityLabel()} tracker sections`);
  V4_TAB_DEFINITIONS.forEach(({ id, label, icon }) => {
    const button = document.createElement("button");
    button.id = `v4-tab-${id}`;
    button.type = "button";
    button.className = "v4-tab";
    button.dataset.v4Tab = id;
    button.setAttribute("role", "tab");
    button.setAttribute("aria-controls", `v4-panel-${id}`);
    button.setAttribute("aria-selected", String(id === "actions"));
    button.tabIndex = id === "actions" ? 0 : -1;
    button.innerHTML = `<i class="bi ${icon}" aria-hidden="true"></i><span>${label}</span>`;
    element.appendChild(button);
  });
  return element;
}

function possibilityCard(collapseId) {
  const collapse = document.getElementById(collapseId);
  if (!collapse) return null;
  collapse.classList.remove("hidden");
  const button = document.querySelector(`[data-collapse-target="${collapseId}"]`);
  button?.setAttribute("aria-expanded", "true");
  return collapse.parentElement;
}

function spellBrowser() {
  const section = document.createElement("section");
  section.id = "v4-spell-browser";
  section.className = "v4-spell-browser";
  section.setAttribute("aria-labelledby", "v4-spell-browser-title");
  section.innerHTML = `<div class="v4-spell-browser-header"><div><h2 id="v4-spell-browser-title">Spell repertoire</h2><p><span id="v4-spell-count">0</span> visible</p></div><p id="v4-spell-status" class="sr-only" role="status" aria-live="polite"></p></div><div id="v4-spell-filters" class="v4-spell-filters"><label><span>Search</span><input type="search" data-v4-spell-filter="search" placeholder="Spell name, school, effect…" autocomplete="off"></label><label><span>Level</span><select data-v4-spell-filter="level"><option value="">All levels</option><option value="0">Cantrips</option>${Array.from({ length: 9 }, (_, index) => `<option value="${index + 1}">Level ${index + 1}</option>`).join("")}</select></label><label><span>Preparation</span><select data-v4-spell-filter="preparation"><option value="">Any preparation</option><option value="prepared">Prepared</option><option value="unprepared">Unprepared</option></select></label><label><span>Repertoire</span><select data-v4-spell-filter="repertoire"><option value="">Any repertoire</option><option value="known">Known</option><option value="spellbook">Spellbook</option><option value="granted">Granted</option></select></label><button type="button" data-tracker-action="reset-spell-filters">Clear filters</button></div><div id="v4-spell-list" class="v4-spell-list"></div>`;
  return section;
}

function spellCastDialog() {
  const dialog = document.createElement("div");
  dialog.id = "v4-spell-cast-dialog";
  dialog.className = "v4-use-dialog hidden";
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.setAttribute("aria-labelledby", "v4-spell-cast-title");
  dialog.setAttribute("aria-describedby", "v4-spell-cast-description");
  dialog.innerHTML = '<div class="v4-use-dialog-card"><div><p class="v4-dialog-kicker">Confirm casting</p><h2 id="v4-spell-cast-title">Cast spell</h2></div><p id="v4-spell-cast-description"></p><fieldset id="v4-spell-cast-modes"><legend>Cast method</legend><label><input type="radio" name="v4-spell-cast-mode" value="standard" checked> Use spell</label><label id="v4-spell-ritual-option"><input type="radio" name="v4-spell-cast-mode" value="ritual"> Cast as ritual</label></fieldset><label id="v4-spell-slot-label" for="v4-spell-slot">Spell slot or use</label><select id="v4-spell-slot"></select><p id="v4-spell-cast-availability" aria-live="polite"></p><p class="v4-use-boundary">Casting updates your selected slot or use and concentration. Target damage and healing remain outside the tracker.</p><div class="v4-use-dialog-actions"><button id="v4-spell-cast-cancel" type="button">Cancel</button><button id="v4-spell-cast-confirm" type="button">Confirm cast</button></div></div>';
  return dialog;
}

function inventoryBrowser() {
  const section = document.createElement("section");
  section.id = "v4-inventory-browser";
  section.className = "v4-inventory-browser";
  section.setAttribute("aria-labelledby", "v4-inventory-title");
  section.innerHTML = '<div class="v4-inventory-header"><div><h2 id="v4-inventory-title">Inventory</h2><p><span id="v4-inventory-count">0</span> visible</p></div><dl id="v4-inventory-summary" aria-label="Inventory totals"></dl></div><div class="v4-inventory-filters"><label><span>Search</span><input type="search" data-v4-inventory-filter="search" placeholder="Item or container…" autocomplete="off"></label><label><span>Status</span><select data-v4-inventory-filter="status"><option value="">Any status</option><option value="equipped">Equipped</option><option value="attuned">Attuned</option><option value="charges">Has charges</option><option value="containers">Containers</option><option value="manual">Manual entries</option></select></label><label><span>Location</span><select id="v4-inventory-container-filter" data-v4-inventory-filter="container"><option value="">Any location</option><option value="loose">Not contained</option><option value="contained">Inside a container</option></select></label><button type="button" data-tracker-action="reset-inventory-filters">Clear filters</button></div><p id="v4-inventory-status" class="sr-only" role="status" aria-live="polite"></p>';
  return section;
}

function inventoryChargeDialog() {
  const dialog = document.createElement("div");
  dialog.id = "v4-inventory-charge-dialog";
  dialog.className = "v4-use-dialog hidden";
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.setAttribute("aria-labelledby", "v4-inventory-charge-title");
  dialog.setAttribute("aria-describedby", "v4-inventory-charge-description");
  dialog.innerHTML = '<div class="v4-use-dialog-card"><div><p class="v4-dialog-kicker">Confirm item use</p><h2 id="v4-inventory-charge-title">Use item charge</h2></div><p id="v4-inventory-charge-description"></p><p id="v4-inventory-charge-availability" aria-live="polite"></p><div class="v4-use-dialog-actions"><button id="v4-inventory-charge-cancel" type="button">Cancel</button><button id="v4-inventory-charge-confirm" type="button">Use 1 charge</button></div></div>';
  return dialog;
}

function featureBrowser() {
  const section = document.createElement("section");
  section.id = "v4-feature-browser";
  section.className = "v4-content-browser";
  section.setAttribute("aria-labelledby", "v4-feature-title");
  section.innerHTML = '<div class="v4-content-header"><div><h2 id="v4-feature-title">Features & Traits</h2><p>Grouped by their stored rules source.</p></div><button type="button" data-character-editor-section="features"><i class="bi bi-pencil-square" aria-hidden="true"></i>Edit features</button></div><div id="v4-feature-groups" class="v4-content-groups"></div><p id="v4-feature-status" class="sr-only" role="status" aria-live="polite"></p>';
  return section;
}

function extrasBrowser() {
  const section = document.createElement("section");
  section.id = "v4-extras-browser";
  section.className = "v4-content-browser";
  section.setAttribute("aria-labelledby", "v4-extras-title");
  section.innerHTML = '<div class="v4-content-header"><div><h2 id="v4-extras-title">Extras</h2><p>Companions, familiars, forms, vehicles, and custom records.</p></div><button type="button" data-character-editor-section="features"><i class="bi bi-plus-lg" aria-hidden="true"></i>Add or edit extras</button></div><div id="v4-extra-groups" class="v4-content-groups"></div><p id="v4-extra-status" class="sr-only" role="status" aria-live="polite"></p>';
  return section;
}

function detailSidebar() {
  const dialog = document.createElement("div");
  dialog.id = "v4-detail-dialog";
  dialog.className = "v4-detail-dialog hidden";
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.setAttribute("aria-labelledby", "v4-detail-title");
  dialog.innerHTML = '<aside class="v4-detail-sidebar"><header><div><p id="v4-detail-eyebrow"></p><h2 id="v4-detail-title">Details</h2></div><button id="v4-detail-close" type="button" aria-label="Close details"><i class="bi bi-x-lg" aria-hidden="true"></i></button></header><div id="v4-detail-content"></div></aside>';
  return dialog;
}

function conversionDialog() {
  const dialog = document.createElement("div");
  dialog.id = "v4-conversion-dialog";
  dialog.className = "v4-use-dialog hidden";
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.setAttribute("aria-labelledby", "v4-conversion-title");
  dialog.innerHTML = `<div class="v4-conversion-card">
    <header><div><p class="v4-dialog-kicker">Reviewed mapping</p><h2 id="v4-conversion-title">Convert to automatic</h2></div><button id="v4-conversion-close" type="button" aria-label="Close conversion preview"><i class="bi bi-x-lg" aria-hidden="true"></i></button></header>
    <div class="v4-conversion-body">
      <p id="v4-conversion-description">Only exact rules-ready matches are added. Your current sheet totals remain unchanged until the builder is complete.</p>
      <label id="v4-conversion-ruleset-label" for="v4-conversion-ruleset"><span>Ruleset</span><select id="v4-conversion-ruleset"><option value="5e">5e (2014)</option><option value="5.5e">5.5e (2024)</option></select></label>
      <p id="v4-conversion-status" role="status" aria-live="polite">Loading Compendium…</p>
      <div id="v4-conversion-preview" class="v4-conversion-preview">
        ${["matched", "unresolved", "added", "removed", "changed"].map((group) => `<section data-conversion-group="${group}"><h3>${group[0].toUpperCase()}${group.slice(1)} <span data-conversion-count="${group}">0</span></h3><ul data-conversion-list="${group}"></ul></section>`).join("")}
      </div>
    </div>
    <footer><button id="v4-conversion-cancel" type="button">Cancel</button><button id="v4-conversion-confirm" type="button" disabled>Convert safely</button></footer>
  </div>`;
  return dialog;
}

export function activateV4Tab(id, { focus = false } = {}) {
  if (!controller?.tabs.has(id)) return false;
  controller.activeTab = id;
  controller.tabs.forEach((tab, tabId) => {
    const selected = tabId === id;
    tab.setAttribute("aria-selected", String(selected));
    tab.tabIndex = selected ? 0 : -1;
  });
  controller.panels.forEach((item, panelId) => { item.hidden = panelId !== id; });
  if (focus) controller.tabs.get(id).focus();
  return true;
}

function handleTabKeydown(event) {
  if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
  const tabs = [...controller.tabs.values()];
  const current = Math.max(0, tabs.indexOf(event.target));
  const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1
    : (current + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
  event.preventDefault();
  activateV4Tab(tabs[next].dataset.v4Tab, { focus: true });
}

export function applyV4CharacterSheetLayout() {
  if (document.documentElement.dataset.characterSheetStyle !== "v4") return false;
  if (controller) return true;
  const combatPage = document.getElementById("combat-page");
  const identity = document.getElementById("characterDescription");
  if (!combatPage || !identity) return false;

  const sheet = document.createElement("div");
  sheet.id = "v4-sheet";
  sheet.dataset.v4Entity = document.body?.dataset?.trackerKind === "npc" ? "npc" : "character";
  const core = document.createElement("section");
  core.id = "v4-core";
  core.setAttribute("aria-label", `${entityLabel()} summary`);
  const headerActions = document.createElement("div");
  headerActions.id = "v4-character-actions";
  headerActions.className = "v4-character-actions";
  identity.querySelector(".p-5 > div")?.appendChild(headerActions);
  const coreGrid = document.createElement("div");
  coreGrid.id = "v4-core-grid";
  coreGrid.innerHTML = '<section id="v4-stats-region" class="v4-core-column"></section><div id="v4-vitals-region" class="v4-core-column"></div>';
  coreGrid.querySelector("#v4-stats-region")?.appendChild(document.getElementById("combatAccordion"));
  const vitals = coreGrid.querySelector("#v4-vitals-region");
  vitals?.append(document.getElementById("quickStatsCard"));
  const hp = document.createElement("div");
  hp.className = "v4-hp-grid";
  hp.append(document.getElementById("hpManager"), document.getElementById("death-saves-section"));
  vitals?.appendChild(hp);
  const details = document.createElement("div");
  details.id = "v4-summary-details";
  details.className = "v4-summary-details";
  vitals?.appendChild(details);
  const conditions = document.createElement("section");
  conditions.id = "v4-conditions";
  conditions.className = "v4-summary-card v4-conditions";
  conditions.setAttribute("aria-labelledby", "v4-conditions-title");
  conditions.innerHTML = '<h2 id="v4-conditions-title">Conditions & Concentration</h2><ul id="v4-condition-list" aria-live="polite"></ul><form id="v4-condition-form"><label for="v4-condition-name">Add condition</label><div><input id="v4-condition-name" maxlength="80" autocomplete="off" placeholder="Condition name"><button type="submit">Add</button></div></form><p id="v4-condition-status" class="sr-only" role="status" aria-live="polite"></p>';
  vitals?.appendChild(conditions);
  core.append(identity, coreGrid);

  const tabs = tablist();
  const panels = new Map(V4_TAB_DEFINITIONS.map(({ id }) => [id, panel(id)]));
  const actionStatus = document.createElement("p");
  actionStatus.id = "v4-action-status";
  actionStatus.className = "sr-only";
  actionStatus.setAttribute("role", "status");
  actionStatus.setAttribute("aria-live", "polite");
  panels.get("actions").append(actionStatus, document.getElementById("combatResources"));
  panels.get("spells").append(document.getElementById("spellcastingSection"), document.getElementById("preparedSpellsSection"), spellBrowser());
  panels.get("inventory").append(inventoryBrowser(), document.getElementById("inventory-page"));
  panels.get("features").appendChild(featureBrowser());
  panels.get("extras").appendChild(extrasBrowser());
  const workspace = document.createElement("div");
  workspace.id = "v4-workspace";
  panels.forEach((item) => workspace.appendChild(item));

  const secondary = document.createElement("div");
  secondary.id = "v4-secondary";
  secondary.innerHTML = '<section id="v4-background-section" class="v4-secondary-card" tabindex="-1" aria-labelledby="v4-background-title"><h2 id="v4-background-title">Background</h2><p id="v4-background-content">—</p></section><div id="v4-notes-host" class="v4-secondary-card"></div>';
  const notes = document.getElementById("notesSection");
  if (notes) secondary.querySelector("#v4-notes-host")?.appendChild(notes);
  const useDialog = document.createElement("div");
  useDialog.id = "v4-use-dialog";
  useDialog.className = "v4-use-dialog hidden";
  useDialog.setAttribute("role", "dialog");
  useDialog.setAttribute("aria-modal", "true");
  useDialog.setAttribute("aria-labelledby", "v4-use-title");
  useDialog.setAttribute("aria-describedby", "v4-use-description");
  useDialog.innerHTML = '<div class="v4-use-dialog-card"><div><p class="v4-dialog-kicker">Confirm action</p><h2 id="v4-use-title">Use action</h2></div><p id="v4-use-description"></p><label id="v4-use-resource-label" for="v4-use-resource">Resource</label><select id="v4-use-resource"></select><p id="v4-use-availability" aria-live="polite"></p><p class="v4-use-boundary">This records the use only. Target damage remains outside the tracker.</p><div class="v4-use-dialog-actions"><button id="v4-use-cancel" type="button">Cancel</button><button id="v4-use-confirm" type="button">Confirm use</button></div></div>';
  sheet.append(core, tabs, workspace, secondary, useDialog, spellCastDialog(), inventoryChargeDialog(), detailSidebar(), conversionDialog());
  combatPage.replaceChildren(sheet);

  controller = {
    activeTab: "actions",
    panels,
    tabs: new Map([...tabs.querySelectorAll("[data-v4-tab]")].map((tab) => [tab.dataset.v4Tab, tab])),
  };
  tabs.addEventListener("click", (event) => {
    const tab = event.target.closest("[data-v4-tab]");
    if (tab) activateV4Tab(tab.dataset.v4Tab);
  });
  tabs.addEventListener("keydown", handleTabKeydown);
  activateV4Tab("actions");
  return true;
}

export function refreshV4CharacterSheetLayout() {
  if (!controller) return false;
  activateV4Tab(controller.activeTab);
  return true;
}
