// Coordinates all tracker state, rendering, filtering, events, rests, and persistence.
import { normalizeSpellcastingData } from "./spellcasting-model.js";
import { applyDamage, applyHealing, applyTemporaryHitPoints, totalHitPoints } from "./hit-points.js";
import { hasActiveFilters, uniqueValues } from "./filter-utilities.js";
import {
  ACTION_USAGE_OPTIONS,
  FILTER_FOCUS_OPTIONS,
  createFilterState,
  itemMatchesFilters,
} from "./filters.js";
import { normalizeDeathSaves, resetDeathSaves, toggleDeathSave, toggleStable } from "./death-saves.js";
import { createRestController } from "./rest-controller.js";
import { createTrackerViews } from "./views.js";
import { createNotesController } from "./notes.js";
import { createTrackerState, normalizeCharacterFlag } from "./state.js";
import { escapeHTML, sanitizeIdentifier, setText, trackerUI as ui } from "./rendering.js";
import { applyV1CharacterSheetOrder, refreshCharacterSheetTabs, refreshV3CharacterSheetLayout, refreshV4CharacterSheetLayout } from "./layout.js";
import { initializeDiceRoller } from "../../../shared/js/dice/index.js";
import { diceHistoryStorageKey } from "../storage-keys.js";
import { modifierRollFormula, renderRollButton } from "./rolls.js";
import { renderV4CoreSummary, renderV4Stats } from "./v4-layout.js";
import { consumeV4ActionUse, planV4ActionUse } from "./v4-actions.js";
import {
  consumeV4SpellCast,
  createV4SpellFilterState,
  planV4SpellCast,
  spellMatchesV4Filters,
} from "./v4-spells.js";
import {
  createV4InventoryFilterState,
  v4InventoryItemMatches,
  v4InventoryItemModel,
  v4InventorySummary,
} from "./v4-inventory.js";
import { v4DetailRecord, v4ExtraGroups, v4FeatureGroups } from "./v4-content.js";
import { setRuntimeConcentration, setRuntimeCondition } from "../rules/runtime.js";
import { loadCharacterBuilderCatalog } from "../builder/catalog-provider.js";
import {
  applyCharacterAutomationPreview,
  canRollbackCharacterAutomation,
  previewCharacterAutomation,
  rollbackCharacterAutomation,
} from "../conversion.js";
import { persistCharacterDocument } from "../archive/repository.js";

const character = window.character;
let diceRoller = null;
let pendingV4Use = null;
let v4UseReturnFocus = null;
let v4UseReturnId = "";
let v4SpellFilters = createV4SpellFilterState();
let pendingV4SpellCast = null;
let v4SpellReturnFocus = null;
let v4SpellReturnId = "";
let v4InventoryFilters = createV4InventoryFilterState();
let pendingV4InventoryCharge = null;
let v4InventoryChargeReturnFocus = null;
let v4DetailReturnFocus = null;
let pendingV4Conversion = null;
let v4ConversionReturnFocus = null;
let v4ConversionRequest = 0;
if (!character.hp || typeof character.hp !== "object") character.hp = { current: 0, temp: 0, max: 0 };
character.hp.current = Number.isFinite(Number(character.hp.current)) ? Number(character.hp.current) : 0;
character.hp.temp = Number.isFinite(Number(character.hp.temp)) ? Number(character.hp.temp) : 0;
character.hp.max = Number.isFinite(Number(character.hp.max)) ? Number(character.hp.max) : 0;
character.inspiration = normalizeCharacterFlag(character.inspiration);
character.cinematic = normalizeCharacterFlag(character.cinematic);
character.deathSaves = normalizeDeathSaves(character.deathSaves);
normalizeSpellcastingData(character);
enforcePreparedLimits();
const statNames = {
  str: "Strength",
  dex: "Dexterity",
  con: "Constitution",
  int: "Intelligence",
  wis: "Wisdom",
  cha: "Charisma",
};
const resetLabels = {
  short: "Short Rest",
  long: "Long Rest",
  turn: "Turn",
  manual: "Manual",
};
const actionGroups = [
  { value: "Action", label: "Actions" },
  { value: "Bonus Action", label: "Bonus Actions" },
  { value: "Free Action", label: "Free Actions" },
  { value: "Reaction", label: "Reactions" },
  { value: "Other", label: "Other Resources" },
];
const filterState = {
  combat: createFilterState(),
  all: createFilterState(),
};
const notesController = createNotesController({
  characterId: character.id,
  cardClasses: ui,
  escapeHTML,
});
const trackerState = createTrackerState({
  character,
  getAllCharacterItems,
  getSpellSlots,
  findCharacterItem,
  findSpellSlot,
  enforcePreparedLimits,
});
const {
  closeRestDialog,
  confirmRest,
  longRest,
  requestRest,
  shortRest,
} = createRestController({
  character,
  getAllCharacterItems,
  getSpellSlots,
  refresh: refreshUI,
  save: saveState,
});
const {
  renderInventoryItem,
  renderV4InventoryItem,
  renderV4Feature,
  renderV4Extra,
  renderAbilityCard,
  renderPreparedProfile,
  renderResourceCard,
  renderSpellSlot,
  renderV4SpellCard,
} = createTrackerViews({
  formatReset,
  formatSpellLevel,
  getPreparedCount,
  getSpellcastingProfile,
  getSpells: () => character.spells || [],
  isAlwaysPreparedSpell,
  isV4: () => document.documentElement?.dataset?.characterSheetStyle === "v4",
});
function initializeApp() {
  diceRoller = initializeDiceRoller({ historyKey: diceHistoryStorageKey(character.id) });
  notesController.load();
  trackerState.load();
  loadStats();
  initializeFilters();
  refreshUI();
  setupEvents();
  Promise.all([notesController.loadCloud(), trackerState.loadCloud()])
    .then(([notesLoaded, stateLoaded]) => {
      if (notesLoaded || stateLoaded) refreshUI();
    })
    .catch((error) => console.error("Could not restore character data from D1:", error));
}
function refreshUI() {
  loadHeader();
  loadCharacterFlags();
  loadHP();
  loadDeathSaves();
  loadTrackers();
  loadResources();
  loadSpellcasting();
  loadPreparedSpells();
  loadAbilities();
  loadV4Spells();
  loadV4Content();
  loadV4ConversionAction();
  loadInventory();
  notesController.render();
  if (document.documentElement?.dataset?.characterSheetStyle === "v4") renderV4CoreSummary(character);
  applyV1CharacterSheetOrder(character);
  if (typeof refreshV3CharacterSheetLayout === "function") refreshV3CharacterSheetLayout();
  if (typeof refreshV4CharacterSheetLayout === "function") refreshV4CharacterSheetLayout();
  refreshCharacterSheetTabs();
}
function loadCharacterFlags() {
  ["inspiration", "cinematic"].forEach((field) => {
    const active = character[field] === 1;
    const button = document.getElementById(`${field}-toggle`);
    button?.setAttribute("aria-checked", String(active));
    button?.setAttribute(
      "aria-label",
      `${field[0].toUpperCase()}${field.slice(1)}: ${active ? "Yes" : "No"}`,
    );
  });
}
function toggleCharacterFlag(field) {
  if (field !== "inspiration" && field !== "cinematic") return false;
  character[field] = character[field] === 1 ? 0 : 1;
  saveState();
  loadCharacterFlags();
  return true;
}
function loadHeader() {
  const className = [character.class, character.subclass]
    .filter(Boolean)
    .join(" • ");
  const fields = {
    "character-name": character.name,
    "character-status": String(character.status || "Active").trim() || "Active",
    "character-level": character.level,
    "character-experience": character.experience ?? 0,
    "character-race": character.race,
    "character-class": className,
    "character-background": character.background,
    "character-gender": character.gender,
    "character-alignment": character.alignment,
    "character-ac": character.ac,
    "character-hp": `${getTotalHP()}/${character.hp.max}`,
    "character-initiative": formatModifier(character.initiative),
    "character-proficiency": formatModifier(character.proficiency),
    "character-walk": character.walk ?? 0,
    "character-fly": character.fly ?? 0,
    "character-passive-perception": character.passivePerception ?? 10,
    "character-dark": character.darkvision ?? 0,
  };
  Object.entries(fields).forEach(([id, value]) => setText(id, value));
  const portrait = document.getElementById("character-portrait");
  if (portrait) {
    portrait.onerror = () => {
      portrait.onerror = null;
      portrait.src = "shared/assets/bat.ico";
    };
    portrait.src = character.portrait || "shared/assets/bat.ico";
    portrait.alt = `${character.name} portrait`;
  }
  document.title = `${character.name || "NPC"} | ${document.body?.dataset?.trackerKind === "npc" ? "NPC" : "Character"} Tracker`;
}
function loadHP() {
  setText("effective-hp", getTotalHP());
  setText("current-hp", character.hp.current);
  setText("temp-hp", character.hp.temp);
  setText("max-hp", character.hp.max);
}
function loadDeathSaves() {
  const section = document.getElementById("death-saves-section");
  section?.classList.toggle("hidden", document.documentElement.dataset.characterSheetStyle !== "v4" && character.hp.current > 0);
  ["failures", "successes"].forEach((kind) => {
    document.querySelectorAll(`[data-death-save="${kind}"]`).forEach((button) => {
      const active = Number(button.dataset.index) < character.deathSaves[kind];
      button.setAttribute("aria-checked", String(active));
    });
  });
  const stableButton = document.getElementById("stable-toggle");
  const stable = character.deathSaves.stable === 1;
  stableButton?.setAttribute("aria-checked", String(stable));
  stableButton?.setAttribute("aria-label", `Stable: ${stable ? "Yes" : "No"}`);
}
function changeDeathSave(kind, index) {
  if (!toggleDeathSave(character.deathSaves, kind, index)) return;
  saveState();
  loadDeathSaves();
}
function changeStable() {
  toggleStable(character.deathSaves);
  saveState();
  loadDeathSaves();
}
function damageHP(amount) {
  if (!applyDamage(character, amount)) return;
  saveState();
  refreshUI();
}
function healHP(amount) {
  if (!applyHealing(character, amount)) return;
  if (character.hp.current > 0) resetDeathSaves(character.deathSaves);
  saveState();
  refreshUI();
}
function setTempHP(amount) {
  applyTemporaryHitPoints(character, amount);
  saveState();
  refreshUI();
}
function getTotalHP() {
  return totalHitPoints(character);
}
function getHPAmount() {
  return getNumberInput("hp-amount");
}
function getTempAmount() {
  return getNumberInput("temp-input");
}
function clearHPInputs() {
  document.getElementById("hp-amount").value = "";
  document.getElementById("temp-input").value = "";
}
function stepInput(id, delta) {
  const input = document.getElementById(id);
  if (!input) return;
  input.value = Math.max(0, (Number(input.value) || 0) + delta);
}
function loadStats() {
  const container = document.getElementById("skills-container");
  if (!container) return;
  if (document.documentElement?.dataset?.characterSheetStyle === "v4") {
    renderV4Stats(container, character);
    return;
  }
  if (document.documentElement.dataset.characterSheetStyle === "v2") {
    renderV2Stats(container);
    return;
  }
  container.innerHTML = Object.entries(character.stats || {})
    .map(([key, stat]) => renderStatCard(statNames[key] || key, stat))
    .join("");
}
function renderV2Stats(container) {
  const stats = Object.entries(character.stats || {});
  const abilities = stats.map(([key, stat]) => `
    <div class="v2-ability-card">
      <div><span class="v2-ability-key">${escapeHTML(key.toUpperCase())}</span><strong>${escapeHTML(statNames[key] || key)}</strong></div>
      <div class="v2-ability-values"><span title="Ability score">${stat.score}</span><strong title="Ability modifier">${formatModifier(stat.modifier)}</strong></div>
      ${renderRollButton({
        formula: modifierRollFormula(stat.save),
        label: `${statNames[key] || key} Saving Throw`,
        content: `<span><i class="bi bi-shield-check" aria-hidden="true"></i> Save</span><strong>${formatModifier(stat.save)}</strong>`,
        className: "v2-save-row flex w-full cursor-pointer items-center justify-between text-left transition hover:text-blood-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold",
      })}
    </div>`).join("");
  const skills = stats.flatMap(([key, stat]) => (stat.skills || []).map((skill) => ({
    ...skill,
    ability: key.toUpperCase(),
  }))).map((skill) => `
    <li>${renderRollButton({
      formula: modifierRollFormula(skill.modifier),
      label: `${skill.name} Skill`,
      content: `<span>${skill.proficiency ? '<i class="bi bi-star-fill" aria-label="Proficient"></i>' : '<i class="bi bi-circle" aria-hidden="true"></i>'}<small>${escapeHTML(skill.ability)}</small>${escapeHTML(skill.name)}</span><strong>${formatModifier(skill.modifier)}</strong>`,
      className: "v2-skill-row flex w-full cursor-pointer items-center justify-between text-left transition hover:text-blood-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold",
    })}</li>`).join("");
  container.innerHTML = `
    <section class="v2-stat-column" aria-labelledby="v2-abilities-heading">
      <h2 id="v2-abilities-heading" class="v2-rail-heading"><i class="bi bi-dice-6-fill" aria-hidden="true"></i> Abilities &amp; Saves</h2>
      <div class="v2-ability-list">${abilities}</div>
    </section>
    <section class="v2-stat-column" aria-labelledby="v2-skills-heading">
      <h2 id="v2-skills-heading" class="v2-rail-heading"><i class="bi bi-list-check" aria-hidden="true"></i> Skills</h2>
      <ul class="v2-skill-list">${skills}</ul>
    </section>`;
}
function renderStatCard(name, stat) {
  const skills = (stat.skills || [])
    .map(
      (skill) =>
        `<li class="border-t border-stone-200 first:border-0 dark:border-white/10">${renderRollButton({
          formula: modifierRollFormula(skill.modifier),
          label: `${skill.name} Skill`,
          content: `<div>${skill.proficiency ? '<i class="bi bi-star-fill mr-2 text-blood-500"></i>' : '<i class="bi bi-dot mr-2"></i>'}${escapeHTML(skill.name)}</div><span class="${ui.badge} ${ui.badgeSecondary}">${formatModifier(skill.modifier)}</span>`,
          className: "flex w-full cursor-pointer items-center justify-between px-4 py-3 text-left transition hover:bg-blood-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-gold",
        })}</li>`,
    )
    .join("");
  return `<div class="${ui.card}"><div class="${ui.cardHeader}"><span class="${ui.badge} ${ui.badgeWarning}">${stat.score}</span><strong>${escapeHTML(name)}</strong><span class="${ui.badge} ${ui.badgeDanger}">${formatModifier(stat.modifier)}</span></div><ul><li>${renderRollButton({
    formula: modifierRollFormula(stat.save),
    label: `${name} Saving Throw`,
    content: `<strong><i class="bi bi-shield-check mr-2"></i>Saving Throw</strong><span class="${ui.badge} ${ui.badgeWarning}">${formatModifier(stat.save)}</span>`,
    className: "flex w-full cursor-pointer items-center justify-between px-4 py-3 text-left font-bold transition hover:bg-blood-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-gold",
  })}</li>${skills}</ul></div>`;
}
function loadTrackers() {
  const trackers = character.trackers || [];
  const card = document.getElementById("trackers-card");
  const container = document.getElementById("trackers-container");
  if (!card || !container) return;
  card.classList.toggle("hidden", trackers.length === 0);
  container.innerHTML = trackers
    .map(
      (tracker) =>
        `<div class="flex items-center gap-3 py-1"><input class="character-tracker peer h-5 w-9 cursor-pointer appearance-none rounded-full bg-stone-300 after:block after:h-4 after:w-4 after:translate-x-0.5 after:translate-y-0.5 after:rounded-full after:bg-white after:transition checked:bg-blood-500 checked:after:translate-x-[1.125rem]" type="checkbox" id="tracker-${sanitizeIdentifier(tracker.id)}" data-tracker-id="${sanitizeIdentifier(tracker.id)}"${tracker.active ? " checked" : ""}><label for="tracker-${sanitizeIdentifier(tracker.id)}">${escapeHTML(tracker.name)}</label></div>`,
    )
    .join("");
}
function initializeFilters() {
  renderFilterControls("combat", getCombatItemRecords());
  renderFilterControls("all", getAllPossibilityRecords());
}
function renderFilterControls(scope, records) {
  const container = document.getElementById(`${scope}-filters`);
  if (!container) return;
  const categories = uniqueValues(records.map(({ item }) => item.category));
  const actions = uniqueValues(records.map(({ item }) => item.action));
  const levels = [
    ...new Set(
      records
        .map(({ item }) => item.level)
        .filter((level) => level !== undefined && level !== null)
        .map(Number),
    ),
  ].sort((a, b) => a - b);
  const availableSources = new Set(records.map((record) => record.source));
  const sourceOptions = [
    { value: "", label: "All sources" },
    { value: "actions", label: "Actions & attacks" },
    { value: "spells", label: "Spells" },
    { value: "features", label: "Features & feats" },
    { value: "resources", label: "Resources" },
  ].filter((option) => !option.value || availableSources.has(option.value));
  const fieldClass =
    "min-w-0 w-full rounded-xl border border-stone-300 bg-white/80 px-3 py-2.5 text-sm text-stone-900 shadow-sm outline-none transition focus:border-blood-500 focus:ring-2 focus:ring-blood-500/20 dark:border-white/15 dark:bg-white/5 dark:text-white";
  const labelClass =
    "mb-1.5 block text-xs font-bold uppercase tracking-wide text-stone-500 dark:text-stone-400";
  container.innerHTML = `
    <div class="overflow-hidden rounded-2xl border border-stone-200/90 bg-stone-50/70 dark:border-white/10 dark:bg-black/10">
      <div class="flex items-center gap-2 p-2">
        <button type="button" data-collapse-target="${scope}FiltersCollapse" aria-expanded="false" aria-controls="${scope}FiltersCollapse" class="group flex min-w-0 grow items-center gap-3 rounded-xl px-3 py-2 text-left transition hover:bg-blood-500/10">
          <i class="bi bi-funnel-fill shrink-0 text-blood-500"></i>
          <span class="min-w-0 grow">
            <span class="block font-display font-bold">Find an option</span>
            <span class="block text-xs text-stone-500 dark:text-stone-400">Search and filters</span>
          </span>
          <span id="${scope}-filter-summary" class="text-sm font-semibold text-stone-500 dark:text-stone-400" aria-live="polite"></span>
          <i class="bi bi-chevron-down shrink-0 text-stone-400 transition group-aria-expanded:rotate-180"></i>
        </button>
        <button type="button" data-filter-reset class="hidden shrink-0 rounded-xl border border-stone-300 bg-white/70 px-3 py-2 text-xs font-bold text-stone-600 transition hover:border-blood-500 hover:text-blood-500 dark:border-white/15 dark:bg-white/5 dark:text-stone-300">
          <i class="bi bi-arrow-counterclockwise mr-1"></i>Clear
        </button>
      </div>
      <div id="${scope}FiltersCollapse" class="hidden">
        <div class="border-t border-stone-200/90 p-4 dark:border-white/10">
          <p class="mb-4 text-sm text-stone-500 dark:text-stone-400">Use any filters you need.</p>
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-8">
            <label class="min-w-0 sm:col-span-2">
              <span class="${labelClass}">Search</span>
              <span class="relative block">
                <i class="bi bi-search pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400"></i>
                <input type="search" data-filter-key="search" class="${fieldClass} pl-9" placeholder="Name, effect, damage..." autocomplete="off">
              </span>
            </label>
            ${renderFilterSelect("source", "Source", sourceOptions, fieldClass, labelClass)}
            ${renderFilterSelect("focus", "Focus", FILTER_FOCUS_OPTIONS, fieldClass, labelClass)}
            ${renderFilterSelect(
              "level",
              "Spell level",
              [
                { value: "", label: "Any level" },
                ...levels.map((level) => ({
                  value: String(level),
                  label: formatSpellLevel(level),
                })),
              ],
              fieldClass,
              labelClass,
            )}
            ${renderFilterSelect(
              "category",
              "Category",
              [
                { value: "", label: "Any category" },
                ...categories.map((category) => ({
                  value: category,
                  label: category,
                })),
              ],
              fieldClass,
              labelClass,
            )}
            ${renderFilterSelect(
              "action",
              "Timing",
              [
                { value: "", label: "Any timing" },
                ...actions.map((action) => ({ value: action, label: action })),
              ],
              fieldClass,
              labelClass,
            )}
            ${scope === "combat" && document.documentElement?.dataset?.characterSheetStyle === "v4"
              ? renderFilterSelect("usage", "Action type", ACTION_USAGE_OPTIONS, fieldClass, labelClass)
              : ""}
          </div>
        </div>
      </div>
    </div>`;
  container.addEventListener("input", (event) => {
    const input = event.target.closest("[data-filter-key]");
    if (!input || input.tagName === "SELECT") return;
    updateFilters(scope, input.dataset.filterKey, input.value);
  });
  container.addEventListener("change", (event) => {
    const input = event.target.closest("select[data-filter-key]");
    if (!input) return;
    updateFilters(scope, input.dataset.filterKey, input.value);
  });
  container
    .querySelector("[data-filter-reset]")
    ?.addEventListener("click", () => resetFilters(scope));
}
function renderFilterSelect(key, label, options, fieldClass, labelClass) {
  return `<label class="min-w-0"><span class="${labelClass}">${escapeHTML(label)}</span><select data-filter-key="${key}" class="${fieldClass}">${options
    .map(
      (option) =>
        `<option value="${escapeHTML(option.value)}">${escapeHTML(option.label)}</option>`,
    )
    .join("")}</select></label>`;
}
function updateFilters(scope, key, value) {
  filterState[scope][key] = value;
  if (scope === "combat") loadResources();
  else loadAbilities();
  updateFilterResetButton(scope);
}
function resetFilters(scope) {
  filterState[scope] = createFilterState();
  const container = document.getElementById(`${scope}-filters`);
  container?.querySelectorAll("[data-filter-key]").forEach((input) => {
    input.value = "";
  });
  if (scope === "combat") loadResources();
  else {
    document
      .querySelectorAll("#allAccordion [data-collapse-target]")
      .forEach((button) => {
        button.setAttribute("aria-expanded", "false");
        document
          .getElementById(button.dataset.collapseTarget)
          ?.classList.add("hidden");
      });
    loadAbilities();
  }
  updateFilterResetButton(scope);
}
function updateFilterResetButton(scope) {
  document
    .querySelector(`#${scope}-filters [data-filter-reset]`)
    ?.classList.toggle("hidden", !hasActiveFilters(filterState[scope]));
}
function updateFilterSummary(scope, visible, total) {
  const summary = document.getElementById(`${scope}-filter-summary`);
  if (summary)
    summary.textContent = hasActiveFilters(filterState[scope])
      ? `${visible} of ${total}`
      : `${total} ${total === 1 ? "option" : "options"}`;
}
function renderEmptyFilterState(scope) {
  const filtering = hasActiveFilters(filterState[scope]);
  return `<div class="rounded-2xl border border-dashed border-stone-300 bg-stone-50/60 px-5 py-10 text-center text-stone-500 dark:border-white/15 dark:bg-white/[.025] dark:text-stone-400"><i class="bi ${filtering ? "bi-search" : "bi-journal-plus"} mb-2 block text-2xl text-blood-500"></i><strong class="block text-stone-700 dark:text-stone-200">${filtering ? "No matching options" : "No options added yet"}</strong><span class="mt-1 block text-sm">${filtering ? "Clear a filter or shorten the search." : "Add an action, spell, feature, or resource in the character editor."}</span>${filtering ? `<button type="button" class="mt-4 rounded-xl border border-stone-300 px-3 py-2 text-xs font-bold hover:border-blood-500 hover:text-blood-500 dark:border-white/15" data-tracker-action="reset-filters" data-scope="${sanitizeIdentifier(scope)}">Clear filters</button>` : ""}</div>`;
}
function loadResources() {
  const container = document.getElementById("resources-container");
  if (!container) return;
  const records = getCombatItemRecords().filter((record) =>
    itemMatchesFilters(record, filterState.combat),
  );
  updateFilterSummary("combat", records.length, getCombatItemRecords().length);
  if (!records.length) {
    container.innerHTML = renderEmptyFilterState("combat");
    return;
  }
  container.innerHTML = actionGroups
    .map((group) => {
      const items = records.map((record) => record.item).filter((item) =>
        group.value === "Other"
          ? !["Action", "Bonus Action", "Free Action", "Reaction"].includes(
              item.action,
            )
          : item.action === group.value,
      );
      if (!items.length) return "";
      return `<div><h6 class="mb-2 text-sm font-semibold text-stone-500 dark:text-stone-400">${group.label}</h6><div class="grid grid-cols-1 gap-4 md:grid-cols-2">${items.map(renderResourceCard).join("")}</div></div>`;
    })
    .join("");
}
function changeResource(id, delta) {
  const item = findCharacterItem(id);
  if (!item?.uses) return;
  item.uses.current = Math.max(
    0,
    Math.min(item.uses.max, Number(item.uses.current) + delta),
  );
  saveState();
  refreshUI();
}

function canEditCharacter() {
  return document.body?.dataset?.characterCanEdit !== "false";
}

function loadV4ConversionAction() {
  if (document.documentElement?.dataset?.characterSheetStyle !== "v4") return;
  const host = document.getElementById("v4-character-actions");
  if (!host) return;
  let button = document.getElementById("v4-conversion-open");
  const characterMode = character.build?.mode || "manual";
  const rollback = characterMode === "rules" && canRollbackCharacterAutomation(character);
  const available = document.body?.dataset?.trackerKind !== "npc"
    && canEditCharacter()
    && (characterMode !== "rules" || rollback);
  if (!available) {
    button?.remove();
    return;
  }
  if (!button) {
    button = document.createElement("button");
    button.id = "v4-conversion-open";
    button.type = "button";
    button.className = "v4-conversion-open";
    host.appendChild(button);
  }
  button.dataset.mode = rollback ? "rollback" : "convert";
  button.innerHTML = rollback
    ? '<i class="bi bi-arrow-counterclockwise" aria-hidden="true"></i><span>Restore manual snapshot</span>'
    : '<i class="bi bi-diagram-3-fill" aria-hidden="true"></i><span>Convert to automatic</span>';
}

function conversionValue(value) {
  if (value === "" || value === null || value === undefined) return "None";
  return String(value);
}

function conversionListText(group, item) {
  if (group === "matched") return `${item.label}: ${item.sourceValue} → ${item.definitionName}`;
  if (group === "unresolved") return `${item.label}: ${item.sourceValue || "Not recorded"} — ${item.reason}`;
  if (group === "added") return `${item.path}: ${item.label || item.value}`;
  if (group === "removed") return `${item.path || item.label || item.value}`;
  return `${item.path}: ${conversionValue(item.before)} → ${conversionValue(item.after)}`;
}

function renderV4ConversionPreview(preview) {
  ["matched", "unresolved", "added", "removed", "changed"].forEach((group) => {
    const items = preview[group] || [];
    const count = document.querySelector(`[data-conversion-count="${group}"]`);
    if (count) count.textContent = String(items.length);
    const list = document.querySelector(`[data-conversion-list="${group}"]`);
    if (list) list.innerHTML = items.length
      ? items.map((item) => `<li>${escapeHTML(conversionListText(group, item))}</li>`).join("")
      : '<li class="v4-empty">None.</li>';
  });
}

async function loadV4ConversionPreview() {
  const request = ++v4ConversionRequest;
  const ruleset = document.getElementById("v4-conversion-ruleset")?.value || "5e";
  const confirm = document.getElementById("v4-conversion-confirm");
  if (confirm) confirm.disabled = true;
  setText("v4-conversion-status", "Loading reviewed Compendium mappings…");
  try {
    const catalog = await loadCharacterBuilderCatalog();
    if (request !== v4ConversionRequest) return;
    pendingV4Conversion = {
      mode: "convert",
      preview: previewCharacterAutomation(character, catalog, { ruleset }),
    };
    renderV4ConversionPreview(pendingV4Conversion.preview);
    setText("v4-conversion-status", `${pendingV4Conversion.preview.matched.length} matched; ${pendingV4Conversion.preview.unresolved.length} unresolved. Conversion keeps current totals and opens an incomplete automatic build.`);
    if (confirm) confirm.disabled = false;
  } catch (error) {
    if (request !== v4ConversionRequest) return;
    console.error("Could not preview Character conversion:", error);
    pendingV4Conversion = null;
    setText("v4-conversion-status", "The Compendium is unavailable. Nothing changed; try again later.");
  }
}

function openV4Conversion(trigger) {
  if (!canEditCharacter()) return false;
  const dialog = document.getElementById("v4-conversion-dialog");
  if (!dialog) return false;
  v4ConversionReturnFocus = trigger || document.activeElement;
  const rollback = trigger?.dataset.mode === "rollback" && canRollbackCharacterAutomation(character);
  const rulesetLabel = document.getElementById("v4-conversion-ruleset-label");
  const preview = document.getElementById("v4-conversion-preview");
  const confirm = document.getElementById("v4-conversion-confirm");
  if (rollback) {
    pendingV4Conversion = { mode: "rollback" };
    setText("v4-conversion-title", "Restore manual snapshot");
    setText("v4-conversion-description", "This replaces the converted document with the exact copy saved immediately before conversion. Runtime tracker state is separate and is not changed.");
    setText("v4-conversion-status", "Rollback copy is ready.");
    rulesetLabel?.classList.add("hidden");
    preview?.classList.add("hidden");
    if (confirm) {
      confirm.textContent = "Restore snapshot";
      confirm.disabled = false;
    }
  } else {
    pendingV4Conversion = null;
    setText("v4-conversion-title", "Convert to automatic");
    setText("v4-conversion-description", "Only exact rules-ready matches are added. Your current sheet totals remain unchanged until the builder is complete.");
    rulesetLabel?.classList.remove("hidden");
    preview?.classList.remove("hidden");
    if (confirm) confirm.textContent = "Convert safely";
    const ruleset = document.getElementById("v4-conversion-ruleset");
    if (ruleset) ruleset.value = character.build?.ruleset === "5.5e" ? "5.5e" : "5e";
    loadV4ConversionPreview();
  }
  dialog.classList.remove("hidden");
  dialog.classList.add("flex");
  document.body.classList.add("overflow-hidden");
  (rollback ? confirm : document.getElementById("v4-conversion-ruleset"))?.focus();
  return true;
}

function closeV4Conversion({ restoreFocus = true } = {}) {
  const dialog = document.getElementById("v4-conversion-dialog");
  if (!dialog || dialog.classList.contains("hidden")) return false;
  v4ConversionRequest += 1;
  dialog.classList.add("hidden");
  dialog.classList.remove("flex");
  document.body.classList.remove("overflow-hidden");
  pendingV4Conversion = null;
  if (restoreFocus) {
    const target = v4ConversionReturnFocus?.isConnected
      ? v4ConversionReturnFocus
      : document.getElementById("v4-conversion-open");
    target?.focus();
  }
  v4ConversionReturnFocus = null;
  return true;
}

function replaceCharacterDocument(next) {
  Object.keys(character).forEach((key) => delete character[key]);
  Object.assign(character, next);
  window.character = character;
}

async function confirmV4Conversion() {
  if (!pendingV4Conversion || !canEditCharacter()) return false;
  const confirm = document.getElementById("v4-conversion-confirm");
  if (confirm) confirm.disabled = true;
  setText("v4-conversion-status", "Saving locally…");
  const previous = JSON.parse(JSON.stringify(character));
  const next = pendingV4Conversion.mode === "rollback"
    ? rollbackCharacterAutomation(character)
    : applyCharacterAutomationPreview(pendingV4Conversion.preview);
  replaceCharacterDocument(next);
  const source = document.body?.dataset?.characterShell && document.body.dataset.characterShell !== "template"
    ? "bundled"
    : "custom";
  let result;
  try {
    result = await persistCharacterDocument(character, { source });
  } catch (error) {
    replaceCharacterDocument(previous);
    console.error("Could not save Character conversion locally:", error);
    setText("v4-conversion-status", "Nothing changed because the local save failed. Free storage space and try again.");
    if (confirm) confirm.disabled = false;
    return false;
  }
  closeV4Conversion({ restoreFocus: false });
  refreshUI();
  if (result.cloudError) console.error("Character conversion saved locally but not to D1:", result.cloudError);
  document.getElementById("v4-conversion-open")?.focus();
  return true;
}

function announceV4(id, message) {
  const status = document.getElementById(id);
  if (status) status.textContent = message;
}

function renderV4UseDialog(plan) {
  setText("v4-use-title", `Use ${plan.name}`);
  setText("v4-use-description", plan.limited
    ? "Confirm the resource that will be consumed."
    : "Confirm this at-will action.");
  setText("v4-use-availability", plan.message);
  const select = document.getElementById("v4-use-resource");
  const label = document.getElementById("v4-use-resource-label");
  if (select) {
    select.innerHTML = plan.options.map((option) => `<option value="${escapeHTML(option.id)}"${option.id === plan.selectedId ? " selected" : ""}>${escapeHTML(option.label)} — ${option.current}/${option.max}</option>`).join("");
    select.classList.toggle("hidden", !plan.limited || plan.options.length === 0);
    select.disabled = plan.options.length < 2;
  }
  label?.classList.toggle("hidden", !plan.limited || plan.options.length === 0);
  const confirm = document.getElementById("v4-use-confirm");
  if (confirm) confirm.disabled = !plan.canConfirm;
}

function requestV4ActionUse(id, trigger) {
  if (!canEditCharacter()) {
    announceV4("v4-action-status", "Read-only viewers cannot use actions.");
    return false;
  }
  pendingV4Use = planV4ActionUse(character, id);
  if (!pendingV4Use.item) {
    announceV4("v4-action-status", pendingV4Use.message);
    return false;
  }
  v4UseReturnFocus = trigger || document.activeElement;
  v4UseReturnId = id;
  renderV4UseDialog(pendingV4Use);
  const dialog = document.getElementById("v4-use-dialog");
  dialog?.classList.remove("hidden");
  dialog?.classList.add("flex");
  document.body.classList.add("overflow-hidden");
  (pendingV4Use.canConfirm ? document.getElementById("v4-use-confirm") : document.getElementById("v4-use-cancel"))?.focus();
  return true;
}

function closeV4UseDialog({ restoreFocus = true } = {}) {
  const dialog = document.getElementById("v4-use-dialog");
  if (!dialog || dialog.classList.contains("hidden")) return false;
  dialog.classList.add("hidden");
  dialog.classList.remove("flex");
  document.body.classList.remove("overflow-hidden");
  pendingV4Use = null;
  if (restoreFocus) {
    const target = v4UseReturnFocus?.isConnected
      ? v4UseReturnFocus
      : document.querySelector(`[data-tracker-action="request-use"][data-id="${sanitizeIdentifier(v4UseReturnId)}"]`);
    target?.focus();
  }
  v4UseReturnFocus = null;
  v4UseReturnId = "";
  return true;
}

function selectV4UseResource(selectionId) {
  if (!pendingV4Use?.item) return;
  pendingV4Use = planV4ActionUse(character, pendingV4Use.item.id, selectionId);
  renderV4UseDialog(pendingV4Use);
}

function confirmV4ActionUse() {
  if (!pendingV4Use?.item || !canEditCharacter()) return false;
  const name = pendingV4Use.name;
  const result = consumeV4ActionUse(character, pendingV4Use.item.id, pendingV4Use.selectedId);
  if (!result.applied) {
    pendingV4Use = result.plan;
    renderV4UseDialog(pendingV4Use);
    return false;
  }
  const consumed = result.consumed;
  const spell = (character.spells || []).find((item) => item.id === pendingV4Use.item.id);
  if (spell?.concentration) character.concentration = { id: spell.id, name: spell.name };
  if (consumed || spell?.concentration) {
    saveState();
    refreshUI();
  }
  closeV4UseDialog();
  announceV4("v4-action-status", consumed
    ? `Used ${name}. ${consumed.label} now has ${Math.max(0, consumed.current - 1)} of ${consumed.max} remaining.`
    : `Used ${name}. No resource was consumed.`);
  return true;
}

function addV4Condition(name) {
  const normalized = String(name || "").trim();
  if (!normalized || !canEditCharacter()) return false;
  character.conditions = setRuntimeCondition({ conditions: character.conditions }, { name: normalized }, true).conditions;
  saveState();
  refreshUI();
  announceV4("v4-condition-status", `${normalized} added.`);
  return true;
}

function removeV4Condition(name) {
  if (!canEditCharacter()) return false;
  const condition = (character.conditions || []).find((item) => String(item?.name || item) === name) || { name };
  character.conditions = setRuntimeCondition({ conditions: character.conditions }, condition, false).conditions;
  saveState();
  refreshUI();
  announceV4("v4-condition-status", `${name} removed.`);
  return true;
}

function clearV4Concentration() {
  if (!canEditCharacter() || !character.concentration) return false;
  character.concentration = setRuntimeConcentration({ concentration: character.concentration }, null).concentration;
  saveState();
  refreshUI();
  announceV4("v4-condition-status", "Concentration cleared.");
  return true;
}

function changeV4Exhaustion(delta) {
  if (!canEditCharacter()) return false;
  character.exhaustion = Math.max(0, Math.min(6, (Number(character.exhaustion) || 0) + delta));
  saveState();
  refreshUI();
  announceV4("v4-condition-status", `Exhaustion is now ${character.exhaustion}.`);
  return true;
}
function loadSpellcasting() {
  const section = document.getElementById("spellcastingSection");
  const profilesContainer = document.getElementById("spellcasting-profiles");
  const slotsContainer = document.getElementById("spell-slots-container");
  if (!section || !profilesContainer || !slotsContainer) return;
  const spellcasting = character.spellcasting;
  const profiles = spellcasting?.profiles || [];
  const slots = (spellcasting?.slots || []).filter((slot) => slot.max > 0);
  const enabled = Boolean(spellcasting?.enabled);
  section.classList.toggle("hidden", !enabled);
  if (!enabled) return;
  profilesContainer.innerHTML = profiles
    .map(
      (profile) =>
        `<div class="${ui.card}"><div class="${ui.cardHeader}"><strong>${escapeHTML(profile.name || "Spellcasting")}</strong></div><div class="p-5"><div class="flex flex-wrap gap-2"><span class="${ui.badge} ${ui.badgePrimary}">${escapeHTML(profile.ability || "—")}</span>${profile.saveDC !== null && profile.saveDC !== undefined ? `<span class="${ui.badge} ${ui.badgeWarning}">Save DC ${profile.saveDC}</span>` : ""}${profile.attackBonus !== null && profile.attackBonus !== undefined ? `<span class="${ui.badge} ${ui.badgeSuccess}">Attack ${formatModifier(profile.attackBonus)}</span>` : ""}${profile.preparedLimit > 0 ? `<span class="${ui.badge} ${ui.badgeSecondary}">Prepare up to ${profile.preparedLimit}</span>` : ""}</div></div></div>`,
    )
    .join("");
  slotsContainer.innerHTML = profiles
    .map((profile) => {
      const profileSlots = slots.filter(
        (slot) => slot.profileId === profile.id,
      );
      return `<section class="${ui.card}"><div class="${ui.cardHeader}"><div><div class="text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">Spell slots</div><strong>${escapeHTML(profile.name || "Spellcasting")}</strong></div><span class="${ui.badge} ${ui.badgeSecondary}">${profileSlots.length} level${profileSlots.length === 1 ? "" : "s"}</span></div><div class="p-4 sm:p-5">${profileSlots.length ? `<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">${profileSlots.map((slot) => renderSpellSlot(slot, profile)).join("")}</div>` : '<p class="text-sm text-stone-500 dark:text-stone-400">This profile has no spell slots.</p>'}</div></section>`;
    })
    .join("");
}
function changeSpellSlot(id, delta) {
  const slot = findSpellSlot(id);
  if (!slot) return;
  slot.current = Math.max(0, Math.min(slot.max, Number(slot.current) + delta));
  saveState();
  refreshUI();
}
function loadPreparedSpells() {
  const section = document.getElementById("preparedSpellsSection");
  const container = document.getElementById("prepared-spells-container");
  const navigationItem = document.querySelector(
    '[data-scroll-to="preparedSpellsSection"]',
  );
  if (!section || !container) return;
  const profiles = character.spellcasting?.profiles || [];
  const spells = character.spells || [];
  const enabled =
    Boolean(character.spellcasting?.enabled) &&
    spells.length > 0 &&
    profiles.some((profile) => profile.preparedLimit > 0);
  section.classList.toggle("hidden", !enabled);
  navigationItem?.classList.toggle("hidden", !enabled);
  if (!enabled) return;

  container.innerHTML = profiles
    .filter(
      (profile) =>
        profile.preparedLimit > 0 ||
        spells.some((spell) => spell.source === profile.id),
    )
    .map((profile) => renderPreparedProfile(profile))
    .join("");
  const totals = profiles
    .filter((profile) => profile.preparedLimit > 0)
    .map(
      (profile) =>
        `${getPreparedCount(profile.id)}/${profile.preparedLimit}`,
    );
  setText("prepared-spells-total", `(${totals.join(" · ")})`);
}

function loadV4Spells() {
  if (document.documentElement?.dataset?.characterSheetStyle !== "v4") return;
  const container = document.getElementById("v4-spell-list");
  if (!container) return;
  const spells = character.spells || [];
  const visible = spells.filter((spell) => spellMatchesV4Filters(spell, v4SpellFilters));
  container.innerHTML = visible.length
    ? visible.map(renderV4SpellCard).join("")
    : '<p class="v4-empty">No spells match these filters.</p>';
  setText("v4-spell-count", `${visible.length} of ${spells.length}`);
}

function updateV4SpellFilter(key, value) {
  if (!Object.prototype.hasOwnProperty.call(v4SpellFilters, key)) return;
  v4SpellFilters[key] = value;
  loadV4Spells();
}

function resetV4SpellFilters() {
  v4SpellFilters = createV4SpellFilterState();
  document.querySelectorAll("[data-v4-spell-filter]").forEach((control) => { control.value = ""; });
  loadV4Spells();
}
function togglePreparedSpell(id) {
  const spell = (character.spells || []).find((item) => item.id === id);
  const profile = getSpellcastingProfile(spell?.source);
  if (
    !spell ||
    !profile ||
    profile.preparedLimit <= 0 ||
    Number(spell.level) === 0 ||
    isAlwaysPreparedSpell(spell)
  )
    return;
  if (!spell.prepared && getPreparedCount(profile.id) >= profile.preparedLimit)
    return;
  spell.prepared = !spell.prepared;
  saveState();
  refreshUI();
}

function renderV4SpellCastDialog(plan) {
  setText("v4-spell-cast-title", `Cast ${plan.name}`);
  setText("v4-spell-cast-description", plan.spell?.description || "Confirm how this spell will be cast.");
  setText("v4-spell-cast-availability", plan.message);
  const ritualOption = document.getElementById("v4-spell-ritual-option");
  ritualOption?.classList.toggle("hidden", !plan.ritualAvailable);
  const mode = document.querySelector(`input[name="v4-spell-cast-mode"][value="${plan.mode}"]`);
  if (mode) mode.checked = true;
  const slot = document.getElementById("v4-spell-slot");
  const slotLabel = document.getElementById("v4-spell-slot-label");
  const showSlot = plan.mode === "standard" && plan.options.length > 0;
  if (slot) {
    slot.innerHTML = plan.options.map((option) => `<option value="${escapeHTML(option.id)}"${option.id === plan.selectedId ? " selected" : ""}>${escapeHTML(option.label)} — ${option.current}/${option.max}</option>`).join("");
    slot.classList.toggle("hidden", !showSlot);
  }
  slotLabel?.classList.toggle("hidden", !showSlot);
  const confirm = document.getElementById("v4-spell-cast-confirm");
  if (confirm) confirm.disabled = !plan.canConfirm;
}

function requestV4SpellCast(id, trigger) {
  if (!canEditCharacter()) {
    announceV4("v4-spell-status", "Read-only viewers cannot cast spells.");
    return false;
  }
  pendingV4SpellCast = planV4SpellCast(character, id);
  if (!pendingV4SpellCast.spell) {
    announceV4("v4-spell-status", pendingV4SpellCast.message);
    return false;
  }
  v4SpellReturnFocus = trigger || document.activeElement;
  v4SpellReturnId = id;
  renderV4SpellCastDialog(pendingV4SpellCast);
  const dialog = document.getElementById("v4-spell-cast-dialog");
  dialog?.classList.remove("hidden");
  dialog?.classList.add("flex");
  document.body.classList.add("overflow-hidden");
  (pendingV4SpellCast.canConfirm ? document.getElementById("v4-spell-cast-confirm") : document.getElementById("v4-spell-cast-cancel"))?.focus();
  return true;
}

function closeV4SpellCastDialog({ restoreFocus = true } = {}) {
  const dialog = document.getElementById("v4-spell-cast-dialog");
  if (!dialog || dialog.classList.contains("hidden")) return false;
  dialog.classList.add("hidden");
  dialog.classList.remove("flex");
  document.body.classList.remove("overflow-hidden");
  pendingV4SpellCast = null;
  if (restoreFocus) {
    const target = v4SpellReturnFocus?.isConnected
      ? v4SpellReturnFocus
      : document.querySelector(`[data-tracker-action="request-spell-cast"][data-id="${sanitizeIdentifier(v4SpellReturnId)}"]`);
    target?.focus();
  }
  v4SpellReturnFocus = null;
  v4SpellReturnId = "";
  return true;
}

function changeV4SpellCastSelection({ mode, optionId } = {}) {
  if (!pendingV4SpellCast?.spell) return;
  pendingV4SpellCast = planV4SpellCast(character, pendingV4SpellCast.spell.id, {
    mode: mode || pendingV4SpellCast.mode,
    optionId: optionId ?? pendingV4SpellCast.selectedId,
  });
  renderV4SpellCastDialog(pendingV4SpellCast);
}

function confirmV4SpellCast() {
  if (!pendingV4SpellCast?.spell || !canEditCharacter()) return false;
  const name = pendingV4SpellCast.name;
  const result = consumeV4SpellCast(character, pendingV4SpellCast.spell.id, {
    mode: pendingV4SpellCast.mode,
    optionId: pendingV4SpellCast.selectedId,
  });
  if (!result.applied) {
    setText("v4-spell-cast-availability", result.warning);
    return false;
  }
  saveState();
  refreshUI();
  closeV4SpellCastDialog();
  const cast = result.cast;
  const detail = cast.ritual ? " as a ritual"
    : cast.upcastBy > 0 ? ` at level ${cast.castLevel}, upcast by ${cast.upcastBy}`
      : cast.slotId ? ` using a level ${cast.castLevel} slot` : "";
  announceV4("v4-spell-status", `Cast ${name}${detail}.`);
  return true;
}
function getPreparedCount(profileId) {
  return (character.spells || []).filter(
    (spell) =>
      spell.source === profileId &&
      Number(spell.level) > 0 &&
      !isAlwaysPreparedSpell(spell) &&
      Boolean(spell.prepared),
  ).length;
}
function isAlwaysPreparedSpell(spell) {
  return (
    Boolean(spell.alwaysPrepared) ||
    /\b(always prepared|domain spell|battle smith spell)\b/i.test(
      spell.category || "",
    )
  );
}
function getSpellcastingProfile(id) {
  return (character.spellcasting?.profiles || []).find(
    (profile) => profile.id === id,
  );
}
function enforcePreparedLimits() {
  (character.spellcasting?.profiles || [])
    .filter((profile) => profile.preparedLimit > 0)
    .forEach((profile) => {
      let remaining = profile.preparedLimit;
      (character.spells || [])
        .filter(
          (spell) =>
            spell.source === profile.id &&
            Number(spell.level) > 0 &&
            !isAlwaysPreparedSpell(spell) &&
            Boolean(spell.prepared),
        )
        .forEach((spell) => {
          if (remaining > 0) remaining -= 1;
          else spell.prepared = false;
        });
    });
}
function loadAbilities() {
  const allRecords = getAllPossibilityRecords();
  const records = allRecords.filter((record) =>
    itemMatchesFilters(record, filterState.all),
  );
  updateFilterSummary("all", records.length, allRecords.length);
  const sections = [
    {
      source: "actions",
      containerId: "actions-container",
      countId: "actions-count",
      collapseId: "actionsCollapse",
    },
    {
      source: "spells",
      containerId: "spells-container",
      countId: "spells-count",
      collapseId: "spellsCollapse",
    },
    {
      source: "features",
      containerId: "features-container",
      countId: "features-count",
      collapseId: "featuresCollapse",
    },
    {
      source: "resources",
      containerId: "possibility-resources-container",
      countId: "possibility-resources-count",
      collapseId: "possibilityResourcesCollapse",
    },
  ];
  const filtering = hasActiveFilters(filterState.all);
  sections.forEach((section) => {
    const items = records
      .filter((record) => record.source === section.source)
      .map((record) => record.item);
    loadAbilitySection(section.containerId, items);
    setText(section.countId, `(${items.length})`);
    const panel = document.getElementById(section.collapseId);
    const button = document.querySelector(
      `[data-collapse-target="${section.collapseId}"]`,
    );
    const card = button?.closest(".overflow-hidden");
    const sourceTotal = allRecords.filter(
      (record) => record.source === section.source,
    ).length;
    card?.classList.toggle(
      "hidden",
      sourceTotal === 0 || (filtering && items.length === 0),
    );
    if (filtering && items.length) {
      panel?.classList.remove("hidden");
      button?.setAttribute("aria-expanded", "true");
    }
  });
}
function loadAbilitySection(id, items) {
  const container = document.getElementById(id);
  if (!container) return;
  container.innerHTML = items.length
    ? items.map(renderAbilityCard).join("")
    : '<p class="text-stone-500 dark:text-stone-400">Nothing added yet.</p>';
}
function loadInventory() {
  loadCurrency();
  const container = document.getElementById("inventory-container");
  if (!container) return;
  const inventory = character.inventory || [];
  if (document.documentElement?.dataset?.characterSheetStyle === "v4") {
    document.getElementById("inventoryCollapse")?.classList.remove("hidden");
    const models = inventory.map((item, index) => v4InventoryItemModel(item, trackerState.getInventoryItemState(index), inventory));
    const visible = models.map((item, index) => ({ item, index }))
      .filter(({ item }) => v4InventoryItemMatches(item, v4InventoryFilters));
    container.innerHTML = visible.length
      ? visible.map(({ item, index }) => renderV4InventoryItem(item, index)).join("")
      : '<p class="v4-empty">No inventory matches these filters.</p>';
    setText("v4-inventory-count", `${visible.length} of ${models.length}`);
    renderV4InventorySummary(models);
    renderV4InventoryContainerFilter(models);
    return;
  }
  container.innerHTML = inventory.length
    ? inventory
        .map((item, index) => renderInventoryItem(item, index, trackerState.getInventoryItemState(index)))
        .join("")
    : '<p class="text-stone-500 dark:text-stone-400">Inventory is empty.</p>';
}

function renderV4InventorySummary(models) {
  const summary = v4InventorySummary(character, models);
  const host = document.getElementById("v4-inventory-summary");
  if (!host) return;
  const weight = summary.weight === null ? "Not calculated" : `${summary.weight} lb.${summary.capacity === null ? "" : ` / ${summary.capacity} lb.`}`;
  host.innerHTML = `<div><dt>Items</dt><dd>${summary.count}</dd></div><div><dt>Weight</dt><dd>${escapeHTML(weight)}</dd></div><div><dt>Burden</dt><dd>${escapeHTML(summary.encumbrance.replaceAll("-", " "))}</dd></div><div><dt>Attuned</dt><dd>${summary.attuned}/${summary.attunementLimit}</dd></div>`;
}

function renderV4InventoryContainerFilter(models) {
  const select = document.getElementById("v4-inventory-container-filter");
  if (!select) return;
  const options = models.filter((item) => item.containerCapacity !== null && item.containerCapacity !== undefined);
  const value = v4InventoryFilters.container;
  select.innerHTML = `<option value="">Any location</option><option value="loose">Not contained</option><option value="contained">Inside a container</option>${options.map((item) => `<option value="${escapeHTML(item.instanceId)}">Inside ${escapeHTML(item.name)}</option>`).join("")}`;
  select.value = value;
}

function updateV4InventoryFilter(key, value) {
  if (!Object.prototype.hasOwnProperty.call(v4InventoryFilters, key)) return;
  v4InventoryFilters[key] = value;
  loadInventory();
}

function resetV4InventoryFilters() {
  v4InventoryFilters = createV4InventoryFilterState();
  document.querySelectorAll("[data-v4-inventory-filter]").forEach((control) => { control.value = ""; });
  loadInventory();
}

function changeV4InventoryItem(index, changes) {
  if (!canEditCharacter()) return false;
  const result = trackerState.updateInventoryItemState(index, changes);
  if (!result.applied) {
    announceV4("v4-inventory-status", result.warning?.message || "Inventory was not changed.");
    return false;
  }
  saveState();
  loadInventory();
  announceV4("v4-inventory-status", "Inventory updated.");
  return true;
}

function requestV4InventoryCharge(index, trigger) {
  if (!canEditCharacter()) return false;
  const item = (character.inventory || [])[index];
  const state = trackerState.getInventoryItemState(index);
  if (!item?.charges || !state.charges) return false;
  pendingV4InventoryCharge = { index, name: item.name || "item" };
  v4InventoryChargeReturnFocus = trigger || document.activeElement;
  setText("v4-inventory-charge-title", `Use ${pendingV4InventoryCharge.name}`);
  setText("v4-inventory-charge-description", "Confirm spending one tracked charge.");
  setText("v4-inventory-charge-availability", `${state.charges.current} of ${item.charges.max} charges available.`);
  const dialog = document.getElementById("v4-inventory-charge-dialog");
  dialog?.classList.remove("hidden");
  dialog?.classList.add("flex");
  document.body.classList.add("overflow-hidden");
  document.getElementById("v4-inventory-charge-confirm")?.focus();
  return true;
}

function closeV4InventoryChargeDialog() {
  const dialog = document.getElementById("v4-inventory-charge-dialog");
  if (!dialog || dialog.classList.contains("hidden")) return false;
  dialog.classList.add("hidden");
  dialog.classList.remove("flex");
  document.body.classList.remove("overflow-hidden");
  const target = v4InventoryChargeReturnFocus;
  pendingV4InventoryCharge = null;
  v4InventoryChargeReturnFocus = null;
  target?.isConnected && target.focus();
  return true;
}

function confirmV4InventoryCharge() {
  if (!pendingV4InventoryCharge || !canEditCharacter()) return false;
  const { index, name } = pendingV4InventoryCharge;
  const result = trackerState.spendInventoryItemCharge(index);
  if (!result.applied) {
    announceV4("v4-inventory-status", result.warning?.message || "The charge was not used.");
    return false;
  }
  saveState();
  closeV4InventoryChargeDialog();
  loadInventory();
  announceV4("v4-inventory-status", `${name} used one charge.`);
  return true;
}

function loadV4Content() {
  if (document.documentElement?.dataset?.characterSheetStyle !== "v4") return;
  const featureHost = document.getElementById("v4-feature-groups");
  const featureGroups = v4FeatureGroups(character);
  if (featureHost) featureHost.innerHTML = featureGroups.length
    ? featureGroups.map((group) => `<section aria-labelledby="v4-feature-group-${group.id}"><h3 id="v4-feature-group-${group.id}">${escapeHTML(group.label)} <span>${group.features.length}</span></h3><div>${group.features.map(renderV4Feature).join("")}</div></section>`).join("")
    : '<p class="v4-empty">No features recorded.</p>';
  const extraHost = document.getElementById("v4-extra-groups");
  const extraGroups = v4ExtraGroups(character);
  if (extraHost) extraHost.innerHTML = extraGroups.length
    ? extraGroups.map((group) => `<section aria-labelledby="v4-extra-group-${group.id}"><h3 id="v4-extra-group-${group.id}">${escapeHTML(group.label)} <span>${group.extras.length}</span></h3><div>${group.extras.map(renderV4Extra).join("")}</div></section>`).join("")
    : '<div class="v4-empty"><strong>No extras recorded.</strong><p>Add a companion, familiar, wild shape, vehicle, or custom extra through Edit features.</p></div>';
}

function changeV4ExtraHP(id, delta) {
  if (!canEditCharacter()) return false;
  const extra = (character.extras || []).find((item) => item.id === id);
  if (!extra?.hp) return false;
  extra.hp.current = Math.max(0, Math.min(Number(extra.hp.max) || 0, (Number(extra.hp.current) || 0) + delta));
  saveState();
  loadV4Content();
  announceV4("v4-extra-status", `${extra.name} has ${extra.hp.current} of ${extra.hp.max} hit points.`);
  return true;
}

function renderV4Detail(record) {
  setText("v4-detail-eyebrow", record.eyebrow);
  setText("v4-detail-title", record.name);
  const content = document.getElementById("v4-detail-content");
  if (!content) return;
  const stats = record.stats.length
    ? `<dl class="v4-detail-stats">${record.stats.map(([label, value]) => `<div><dt>${escapeHTML(label)}</dt><dd>${escapeHTML(value)}</dd></div>`).join("")}</dl>` : "";
  const selections = record.selections.length
    ? `<section><h3>Current selections</h3><ul>${record.selections.map((selection) => `<li>${escapeHTML(selection)}</li>`).join("")}</ul></section>` : "";
  content.innerHTML = `${stats}<section><h3>Description</h3><p>${escapeHTML(record.description)}</p></section>${selections}`;
}

function openV4Detail(kind, id, trigger) {
  const record = v4DetailRecord(character, kind, id);
  if (!record) return false;
  v4DetailReturnFocus = trigger || document.activeElement;
  renderV4Detail(record);
  const dialog = document.getElementById("v4-detail-dialog");
  dialog?.classList.remove("hidden");
  dialog?.classList.add("flex");
  document.body.classList.add("overflow-hidden");
  document.getElementById("v4-detail-close")?.focus();
  return true;
}

function closeV4Detail() {
  const dialog = document.getElementById("v4-detail-dialog");
  if (!dialog || dialog.classList.contains("hidden")) return false;
  dialog.classList.add("hidden");
  dialog.classList.remove("flex");
  document.body.classList.remove("overflow-hidden");
  const target = v4DetailReturnFocus;
  v4DetailReturnFocus = null;
  target?.isConnected && target.focus();
  return true;
}
function loadCurrency() {
  const container = document.getElementById("currency-container");
  if (!container) return;
  const currency = character.currency || {};
  container.innerHTML = `<div class="${ui.card}"><div class="${ui.cardHeader}">Currency</div><div class="${ui.cardBody}"><div class="flex flex-wrap items-center gap-3"><div class="flex grow flex-wrap gap-2"><span class="${ui.badge} ${ui.badgeSecondary}">CP: ${currency.cp ?? 0}</span><span class="${ui.badge} bg-stone-100 text-stone-900">SP: ${currency.sp ?? 0}</span><span class="${ui.badge} bg-cyan-300 text-stone-900">EP: ${currency.ep ?? 0}</span><span class="${ui.badge} ${ui.badgeWarning}">GP: ${currency.gp ?? 0}</span><span class="${ui.badge} ${ui.badgePrimary}">PP: ${currency.pp ?? 0}</span></div><button type="button" data-character-editor-section="inventory" class="ml-auto inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-blood-500 px-3 py-2 text-sm font-bold text-blood-500 transition hover:bg-blood-500 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"><i class="bi bi-pencil-square" aria-hidden="true"></i>Edit Inventory</button></div></div></div>`;
}
function setupEvents() {
  document.addEventListener("click", (event) => {
    const rollTarget = event.target.closest("[data-roll-formula]");
    if (rollTarget) {
      event.preventDefault();
      diceRoller?.roll(rollTarget.dataset.rollFormula, rollTarget.dataset.rollLabel);
      return;
    }
    const target = event.target.closest("[data-tracker-action]");
    if (!target) return;
    const action = target.dataset.trackerAction;
    if (action === "reset-filters") resetFilters(target.dataset.scope);
    else if (action === "resource") changeResource(target.dataset.id, Number(target.dataset.delta));
    else if (action === "spell-slot") changeSpellSlot(target.dataset.id, Number(target.dataset.delta));
    else if (action === "prepared-spell") togglePreparedSpell(target.dataset.id);
    else if (action === "character-flag") toggleCharacterFlag(target.dataset.field);
    else if (action === "inventory-item-status") toggleInventoryItemStatus(Number(target.dataset.index), target.dataset.field);
    else if (action === "death-save") changeDeathSave(target.dataset.kind, Number(target.dataset.index));
    else if (action === "stable") changeStable();
    else if (action === "edit-note") notesController.edit(Number(target.dataset.index));
    else if (action === "delete-note") notesController.remove(Number(target.dataset.index));
    else if (action === "request-use") requestV4ActionUse(target.dataset.id, target);
    else if (action === "remove-condition") removeV4Condition(target.dataset.condition);
    else if (action === "clear-concentration") clearV4Concentration();
    else if (action === "exhaustion") changeV4Exhaustion(Number(target.dataset.delta));
    else if (action === "request-spell-cast") requestV4SpellCast(target.dataset.id, target);
    else if (action === "reset-spell-filters") resetV4SpellFilters();
    else if (action === "reset-inventory-filters") resetV4InventoryFilters();
    else if (action === "inventory-runtime") changeV4InventoryItem(Number(target.dataset.index), { [target.dataset.field]: target.getAttribute("aria-checked") !== "true" });
    else if (action === "inventory-quantity") {
      const index = Number(target.dataset.index);
      changeV4InventoryItem(index, { quantity: trackerState.getInventoryItemState(index).quantity + Number(target.dataset.delta) });
    } else if (action === "request-item-charge") requestV4InventoryCharge(Number(target.dataset.index), target);
    else if (action === "open-v4-detail") openV4Detail(target.dataset.kind, target.dataset.id, target);
    else if (action === "extra-hp") changeV4ExtraHP(target.dataset.id, Number(target.dataset.delta));
    else if (action === "open-conversion") openV4Conversion(target);
  });
  on("damage-btn", "click", () => {
    damageHP(getHPAmount());
    clearHPInputs();
  });
  on("heal-btn", "click", () => {
    healHP(getHPAmount());
    clearHPInputs();
  });
  on("temp-btn", "click", () => {
    setTempHP(getTempAmount());
    clearHPInputs();
  });
  on("hp-decrease-btn", "click", () => stepInput("hp-amount", -1));
  on("hp-increase-btn", "click", () => stepInput("hp-amount", 1));
  on("temp-decrease-btn", "click", () => stepInput("temp-input", -1));
  on("temp-increase-btn", "click", () => stepInput("temp-input", 1));
  on("shortRest-btn", "click", (event) => requestRest("short", event.currentTarget));
  on("longRest-btn", "click", (event) => requestRest("long", event.currentTarget));
  on("confirm-rest", "click", confirmRest);
  on("cancel-rest", "click", closeRestDialog);
  on("close-rest-dialog", "click", closeRestDialog);
  document.getElementById("rest-dialog")?.addEventListener("click", (event) => {
    if (event.target.id === "rest-dialog") closeRestDialog();
  });
  on("v4-use-confirm", "click", confirmV4ActionUse);
  on("v4-use-cancel", "click", closeV4UseDialog);
  on("v4-use-resource", "change", (event) => selectV4UseResource(event.target.value));
  document.getElementById("v4-use-dialog")?.addEventListener("click", (event) => {
    if (event.target.id === "v4-use-dialog") closeV4UseDialog();
  });
  document.getElementById("v4-condition-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const input = document.getElementById("v4-condition-name");
    if (addV4Condition(input?.value)) input.value = "";
  });
  document.getElementById("v4-spell-filters")?.addEventListener("input", (event) => {
    const control = event.target.closest("input[data-v4-spell-filter]");
    if (control) updateV4SpellFilter(control.dataset.v4SpellFilter, control.value);
  });
  document.getElementById("v4-spell-filters")?.addEventListener("change", (event) => {
    const control = event.target.closest("select[data-v4-spell-filter]");
    if (control) updateV4SpellFilter(control.dataset.v4SpellFilter, control.value);
  });
  on("v4-spell-cast-confirm", "click", confirmV4SpellCast);
  on("v4-spell-cast-cancel", "click", closeV4SpellCastDialog);
  on("v4-spell-slot", "change", (event) => changeV4SpellCastSelection({ optionId: event.target.value }));
  document.getElementById("v4-spell-cast-modes")?.addEventListener("change", (event) => {
    if (event.target.name === "v4-spell-cast-mode") changeV4SpellCastSelection({ mode: event.target.value, optionId: "" });
  });
  document.getElementById("v4-spell-cast-dialog")?.addEventListener("click", (event) => {
    if (event.target.id === "v4-spell-cast-dialog") closeV4SpellCastDialog();
  });
  document.getElementById("v4-inventory-browser")?.addEventListener("input", (event) => {
    const control = event.target.closest("input[data-v4-inventory-filter]");
    if (control) updateV4InventoryFilter(control.dataset.v4InventoryFilter, control.value);
  });
  document.getElementById("v4-inventory-browser")?.addEventListener("change", (event) => {
    const control = event.target.closest("select[data-v4-inventory-filter]");
    if (control) updateV4InventoryFilter(control.dataset.v4InventoryFilter, control.value);
  });
  document.getElementById("inventory-container")?.addEventListener("change", (event) => {
    const control = event.target.closest("[data-v4-inventory-container]");
    if (control) changeV4InventoryItem(Number(control.dataset.index), { containerId: control.value });
  });
  on("v4-inventory-charge-confirm", "click", confirmV4InventoryCharge);
  on("v4-inventory-charge-cancel", "click", closeV4InventoryChargeDialog);
  document.getElementById("v4-inventory-charge-dialog")?.addEventListener("click", (event) => {
    if (event.target.id === "v4-inventory-charge-dialog") closeV4InventoryChargeDialog();
  });
  on("v4-detail-close", "click", closeV4Detail);
  document.getElementById("v4-detail-dialog")?.addEventListener("click", (event) => {
    if (event.target.id === "v4-detail-dialog") closeV4Detail();
  });
  on("v4-conversion-open", "click", (event) => openV4Conversion(event.currentTarget));
  on("v4-conversion-confirm", "click", confirmV4Conversion);
  on("v4-conversion-cancel", "click", closeV4Conversion);
  on("v4-conversion-close", "click", closeV4Conversion);
  on("v4-conversion-ruleset", "change", loadV4ConversionPreview);
  document.getElementById("v4-conversion-dialog")?.addEventListener("click", (event) => {
    if (event.target.id === "v4-conversion-dialog") closeV4Conversion();
  });
  on("save-note-btn", "click", notesController.saveFromInputs);
  document.querySelectorAll("[data-collapse-target]").forEach((button) => {
    button.addEventListener("click", () => {
      const panel = document.getElementById(button.dataset.collapseTarget);
      if (!panel) return;
      const expanded = button.getAttribute("aria-expanded") === "true";
      const accordion = button.closest("#allAccordion");
      if (!expanded && accordion) {
        accordion.querySelectorAll("[data-collapse-target]").forEach((otherButton) => {
          if (otherButton === button) return;
          otherButton.setAttribute("aria-expanded", "false");
          document
            .getElementById(otherButton.dataset.collapseTarget)
            ?.classList.add("hidden");
        });
      }
      button.setAttribute("aria-expanded", String(!expanded));
      panel.classList.toggle("hidden", expanded);
    });
  });
  const navigationButton = document.getElementById("navigation-menu-button");
  const navigationMenu = document.getElementById("navigation-menu");
  navigationButton?.addEventListener("click", () => {
    const expanded = navigationButton.getAttribute("aria-expanded") === "true";
    navigationButton.setAttribute("aria-expanded", String(!expanded));
    navigationMenu?.classList.toggle("hidden", expanded);
  });
  document.addEventListener("click", (event) => {
    if (
      navigationMenu?.classList.contains("hidden") ||
      navigationButton?.parentElement?.contains(event.target)
    ) {
      return;
    }
    navigationButton?.setAttribute("aria-expanded", "false");
    navigationMenu?.classList.add("hidden");
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (closeV4Conversion()) return;
    if (closeV4Detail()) return;
    if (closeV4InventoryChargeDialog()) return;
    if (closeV4SpellCastDialog()) return;
    if (closeV4UseDialog()) return;
    if (closeRestDialog()) return;
    navigationButton?.setAttribute("aria-expanded", "false");
    navigationMenu?.classList.add("hidden");
    navigationButton?.focus();
  });
  document.querySelectorAll("[data-scroll-to]").forEach((button) => {
    button.addEventListener("click", () => {
      document.getElementById(button.dataset.scrollTo)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
      navigationButton?.setAttribute("aria-expanded", "false");
      navigationMenu?.classList.add("hidden");
    });
  });
  const trackerContainer = document.getElementById("trackers-container");
  if (trackerContainer)
    trackerContainer.addEventListener("change", (event) => {
      const input = event.target.closest(".character-tracker");
      if (!input) return;
      const tracker = (character.trackers || []).find(
        (item) => item.id === input.dataset.trackerId,
      );
      if (!tracker) return;
      tracker.active = input.checked;
      saveState();
    });
}

function toggleInventoryItemStatus(index, field) {
  if (!trackerState.toggleInventoryItemState(index, field)) return;
  saveState();
  loadInventory();
}
function getCombatItems() {
  return getCombatItemRecords().map((record) => record.item);
}
function getCombatItemRecords() {
  return [
    ...createItemRecords("actions", character.actions),
    ...createItemRecords(
      "spells",
      (character.spells || []).filter(isSpellAvailableInCombat),
    ),
    ...createItemRecords("resources", character.resources),
    ...createItemRecords(
      "features",
      (character.features || []).filter((item) => item.action),
    ),
  ];
}
function isSpellAvailableInCombat(spell) {
  const profile = getSpellcastingProfile(spell.source);
  return (
    Number(spell.level) === 0 ||
    isAlwaysPreparedSpell(spell) ||
    profile?.preparedLimit <= 0 ||
    Boolean(spell.prepared)
  );
}
function getAllPossibilityRecords() {
  return [
    ...createItemRecords("actions", character.actions),
    ...createItemRecords("spells", character.spells),
    ...createItemRecords("features", character.features),
    ...createItemRecords("resources", character.resources),
  ];
}
function createItemRecords(source, items) {
  return (items || []).map((item) => ({ source, item }));
}
function getAllCharacterItems() {
  return [
    ...(character.actions || []),
    ...(character.spells || []),
    ...(character.features || []),
    ...(character.resources || []),
    ...(character.extras || []),
  ];
}
function getSpellSlots() {
  return character.spellcasting?.slots || [];
}
function findCharacterItem(id) {
  return getAllCharacterItems().find((item) => item.id === id);
}
function findSpellSlot(id) {
  return getSpellSlots().find((slot) => slot.id === id);
}
function getNumberInput(id) {
  return Math.max(0, Number(document.getElementById(id).value) || 0);
}
function formatModifier(value) {
  if (value === null || value === undefined) return "—";
  return Number(value) >= 0 ? `+${value}` : String(value);
}
function formatReset(reset) {
  return resetLabels[reset] || reset || "Manual";
}
function formatSpellLevel(level) {
  return Number(level) === 0 ? "Cantrip" : `Level ${level}`;
}
function on(id, event, handler) {
  const element = document.getElementById(id);
  if (element) element.addEventListener(event, handler);
}
function saveState() {
  trackerState.save();
}
function loadState() {
  trackerState.load();
}
export {
  character,
  getPreparedCount,
  getCombatItemRecords,
  isAlwaysPreparedSpell,
  isSpellAvailableInCombat,
  normalizeSpellcastingData,
  refreshUI,
  renderAbilityCard,
  saveState,
  togglePreparedSpell,
};

export function initializeTracker() {
  initializeApp();
}
