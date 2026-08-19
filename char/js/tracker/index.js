import { normalizeSpellcastingData } from "./spellcasting-model.js";
import { applyDamage, applyHealing, applyTemporaryHitPoints, totalHitPoints } from "./hit-points.js";
import { hasActiveFilters, normalizeFilterText, uniqueValues } from "./filter-utilities.js";
import { normalizeDeathSaves, resetDeathSaves, toggleDeathSave, toggleStable } from "./death-saves.js";
import { getRestDetails } from "./rest.js";
import { createNotesController } from "./notes.js";
import { createTrackerState, normalizeCharacterFlag } from "./state.js";
import { escapeAttribute, escapeHTML, setText, trackerUI as ui } from "./rendering.js";
import { applyV1CharacterSheetOrder, refreshCharacterSheetTabs } from "./layout.js";

const character = window.character;
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
const filterFocusOptions = [
  { value: "", label: "Any focus" },
  { value: "damage-spell", label: "Damage spells" },
  { value: "healing-spell", label: "Healing spells" },
  { value: "utility-spell", label: "Utility spells" },
  { value: "melee-spell", label: "Melee spells" },
  { value: "melee-attack", label: "Melee attacks" },
  { value: "ranged-attack", label: "Ranged attacks" },
  { value: "feat", label: "Feats" },
  { value: "feature", label: "Features" },
  { value: "resource", label: "Resources" },
];
const blankFilterState = () => ({
  search: "",
  source: "",
  focus: "",
  level: "",
  category: "",
  action: "",
});
const filterState = {
  combat: blankFilterState(),
  all: blankFilterState(),
};
let pendingRest = null;
let restToastTimer = null;
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
function initializeApp() {
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
  loadInventory();
  notesController.render();
  applyV1CharacterSheetOrder(character);
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
  document.title = `${character.name} | Character Tracker`;
}
function loadHP() {
  setText("effective-hp", getTotalHP());
  setText("current-hp", character.hp.current);
  setText("temp-hp", character.hp.temp);
  setText("max-hp", character.hp.max);
}
function loadDeathSaves() {
  const section = document.getElementById("death-saves-section");
  section?.classList.toggle("hidden", character.hp.current > 0);
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
      <div class="v2-save-row"><span><i class="bi bi-shield-check" aria-hidden="true"></i> Save</span><strong>${formatModifier(stat.save)}</strong></div>
    </div>`).join("");
  const skills = stats.flatMap(([key, stat]) => (stat.skills || []).map((skill) => ({
    ...skill,
    ability: key.toUpperCase(),
  }))).map((skill) => `
    <li class="v2-skill-row">
      <span>${skill.proficiency ? '<i class="bi bi-star-fill" aria-label="Proficient"></i>' : '<i class="bi bi-circle" aria-hidden="true"></i>'}<small>${escapeHTML(skill.ability)}</small>${escapeHTML(skill.name)}</span>
      <strong>${formatModifier(skill.modifier)}</strong>
    </li>`).join("");
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
        `<li class="flex items-center justify-between border-t border-stone-200 px-4 py-3 first:border-0 dark:border-white/10"><div>${skill.proficiency ? '<i class="bi bi-star-fill mr-2 text-blood-500"></i>' : '<i class="bi bi-dot mr-2"></i>'}${escapeHTML(skill.name)}</div><span class="${ui.badge} ${ui.badgeSecondary}">${formatModifier(skill.modifier)}</span></li>`,
    )
    .join("");
  return `<div class="${ui.card}"><div class="${ui.cardHeader}"><span class="${ui.badge} ${ui.badgeWarning}">${stat.score}</span><strong>${escapeHTML(name)}</strong><span class="${ui.badge} ${ui.badgeDanger}">${formatModifier(stat.modifier)}</span></div><ul><li class="flex items-center justify-between px-4 py-3"><strong><i class="bi bi-shield-check mr-2"></i>Saving Throw</strong><span class="${ui.badge} ${ui.badgeWarning}">${formatModifier(stat.save)}</span></li>${skills}</ul></div>`;
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
        `<div class="flex items-center gap-3 py-1"><input class="character-tracker peer h-5 w-9 cursor-pointer appearance-none rounded-full bg-stone-300 after:block after:h-4 after:w-4 after:translate-x-0.5 after:translate-y-0.5 after:rounded-full after:bg-white after:transition checked:bg-blood-500 checked:after:translate-x-[1.125rem]" type="checkbox" id="tracker-${escapeAttribute(tracker.id)}" data-tracker-id="${escapeAttribute(tracker.id)}"${tracker.active ? " checked" : ""}><label for="tracker-${escapeAttribute(tracker.id)}">${escapeHTML(tracker.name)}</label></div>`,
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
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-7">
            <label class="min-w-0 sm:col-span-2">
              <span class="${labelClass}">Search</span>
              <span class="relative block">
                <i class="bi bi-search pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400"></i>
                <input type="search" data-filter-key="search" class="${fieldClass} pl-9" placeholder="Name, effect, damage..." autocomplete="off">
              </span>
            </label>
            ${renderFilterSelect("source", "Source", sourceOptions, fieldClass, labelClass)}
            ${renderFilterSelect("focus", "Focus", filterFocusOptions, fieldClass, labelClass)}
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
  filterState[scope] = blankFilterState();
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
function itemMatchesFilters(record, state) {
  const { item, source } = record;
  if (state.source && source !== state.source) return false;
  if (
    state.level !== "" &&
    (item.level === undefined || Number(item.level) !== Number(state.level))
  )
    return false;
  if (state.category && item.category !== state.category) return false;
  if (state.action && item.action !== state.action) return false;
  if (state.focus && !matchesFocus(record, state.focus)) return false;
  const terms = normalizeFilterText(state.search).split(/\s+/).filter(Boolean);
  if (terms.length) {
    const haystack = itemFilterText(record);
    if (!terms.every((term) => haystack.includes(term))) return false;
  }
  return true;
}
function matchesFocus(record, focus) {
  const { item, source } = record;
  const text = itemFilterText(record);
  const spell = source === "spells";
  const healing =
    /\b(heal|healing|cure|stabiliz)/.test(text) ||
    /\b(regain|restore)[a-z ]{0,24}\bhit points?\b/.test(text);
  const damaging = Boolean(item.damage) || /\bdeals?\b.{0,32}\bdamage\b/.test(text);
  const rangeText = normalizeFilterText(item.range);
  const description = normalizeFilterText(item.description);
  const distances = [...String(item.range || "").matchAll(/\d+/g)].map(
    (match) => Number(match[0]),
  );
  const attack =
    Boolean(item.attack) ||
    /\battack\b/.test(normalizeFilterText(`${item.name} ${item.description}`));
  const melee =
    /\b(melee|touch|adjacent)\b/.test(`${rangeText} ${description}`) ||
    (attack && distances.length > 0 && Math.min(...distances) <= 5);
  const ranged =
    /\b(ranged|thrown)\b/.test(description) ||
    (attack && distances.some((distance) => distance > 5));
  switch (focus) {
    case "damage-spell":
      return spell && damaging;
    case "healing-spell":
      return spell && healing;
    case "utility-spell":
      return spell && !damaging && !healing;
    case "melee-spell":
      return spell && melee;
    case "melee-attack":
      return attack && melee;
    case "ranged-attack":
      return attack && ranged;
    case "feat":
      return /\bfeat\b/.test(
        normalizeFilterText(`${item.name} ${item.category}`),
      );
    case "feature":
      return source === "features" || /\b(feature|trait)\b/.test(text);
    case "resource":
      return source === "resources";
    default:
      return true;
  }
}
function itemFilterText({ item, source }) {
  return normalizeFilterText(
    [
      item.name,
      item.category,
      item.action,
      item.description,
      item.school,
      item.range,
      item.attack,
      item.damage,
      item.duration,
      item.components,
      item.level !== undefined ? formatSpellLevel(item.level) : "",
      source,
    ].join(" "),
  );
}
function renderEmptyFilterState(scope) {
  const filtering = hasActiveFilters(filterState[scope]);
  return `<div class="rounded-2xl border border-dashed border-stone-300 bg-stone-50/60 px-5 py-10 text-center text-stone-500 dark:border-white/15 dark:bg-white/[.025] dark:text-stone-400"><i class="bi ${filtering ? "bi-search" : "bi-journal-plus"} mb-2 block text-2xl text-blood-500"></i><strong class="block text-stone-700 dark:text-stone-200">${filtering ? "No matching options" : "No options added yet"}</strong><span class="mt-1 block text-sm">${filtering ? "Clear a filter or shorten the search." : "Add an action, spell, feature, or resource in the character editor."}</span>${filtering ? `<button type="button" class="mt-4 rounded-xl border border-stone-300 px-3 py-2 text-xs font-bold hover:border-blood-500 hover:text-blood-500 dark:border-white/15" data-tracker-action="reset-filters" data-scope="${escapeAttribute(scope)}">Clear filters</button>` : ""}</div>`;
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
function renderResourceCard(item) {
  let usage = "";
  if (item.uses) {
    usage = `<div class="inline-flex gap-2" role="group"><button type="button" class="${ui.iconButton}" aria-label="Decrease ${escapeAttribute(item.name)}" data-tracker-action="resource" data-id="${escapeAttribute(item.id)}" data-delta="-1">−</button><button type="button" class="${ui.iconButton}" aria-label="Increase ${escapeAttribute(item.name)}" data-tracker-action="resource" data-id="${escapeAttribute(item.id)}" data-delta="1">+</button></div><div class="flex gap-2"><span class="${ui.badge} ${ui.badgeSuccess}">${item.uses.current}/${item.uses.max}</span><span class="${ui.badge} ${ui.badgeWarning}">${formatReset(item.uses.reset)}</span></div>`;
  } else if (item.slotLevel) {
    usage = `<span class="${ui.badge} ${ui.badgePrimary}">Uses level ${item.slotLevel} slot</span>`;
  } else {
    usage = `<span class="${ui.badge} ${ui.badgeSecondary}">At will</span>`;
  }
  return `<div class="${ui.card}"><div class="${ui.cardHeader}"><strong>${escapeHTML(item.name)}</strong><span class="${ui.badge} ${ui.badgeDanger}">${escapeHTML(item.category || "Ability")}</span></div><div class="p-5"><div class="flex flex-wrap items-center justify-between gap-2">${usage}</div>${renderDetailBadges(item)}<p class="mt-2 text-sm">${escapeHTML(item.description || "")}</p></div></div>`;
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
function renderSpellSlot(slot, profile) {
  const profileName = profile?.name || "spellcasting";
  return `<div class="rounded-xl border border-stone-200 bg-stone-50/70 dark:border-white/10 dark:bg-white/[.035]"><div class="flex items-center justify-between gap-3 border-b border-stone-200 px-4 py-3 dark:border-white/10"><strong>Level ${slot.level}</strong><span class="${ui.badge} ${ui.badgeDanger}">Max: ${slot.max}</span></div><div class="p-4"><div class="flex items-center justify-between gap-3"><div class="inline-flex gap-2"><button type="button" class="${ui.iconButton}" aria-label="Decrease ${escapeAttribute(profileName)} level ${slot.level} spell slots" data-tracker-action="spell-slot" data-id="${escapeAttribute(slot.id)}" data-delta="-1">−</button><button type="button" class="${ui.iconButton}" aria-label="Increase ${escapeAttribute(profileName)} level ${slot.level} spell slots" data-tracker-action="spell-slot" data-id="${escapeAttribute(slot.id)}" data-delta="1">+</button></div><span class="${ui.badge} ${ui.badgeWarning}">${slot.current}/${slot.max}</span><span class="${ui.badge} ${ui.badgeSecondary}">${formatReset(slot.reset || "long")}</span></div></div></div>`;
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
function renderPreparedProfile(profile) {
  const spells = (character.spells || [])
    .filter((spell) => spell.source === profile.id)
    .sort(
      (left, right) =>
        Number(left.level || 0) - Number(right.level || 0) ||
        String(left.name).localeCompare(String(right.name)),
    );
  const preparedCount = getPreparedCount(profile.id);
  const atLimit =
    profile.preparedLimit > 0 && preparedCount >= profile.preparedLimit;
  const limitLabel =
    profile.preparedLimit > 0
      ? `${preparedCount} / ${profile.preparedLimit} prepared`
      : "No preparation required";
  return `<section class="${ui.card}"><div class="${ui.cardHeader}"><div><div class="text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">Spellcasting profile</div><strong>${escapeHTML(profile.name || "Spellcasting")}</strong></div><span class="${ui.badge} ${atLimit ? ui.badgeWarning : ui.badgeSuccess}">${limitLabel}</span></div><div class="divide-y divide-stone-200 dark:divide-white/10">${spells.length ? spells.map((spell) => renderPreparedSpell(spell, profile, atLimit)).join("") : '<p class="p-5 text-sm text-stone-500 dark:text-stone-400">No spells use this profile yet. Choose it as the source while editing a spell.</p>'}</div></section>`;
}
function renderPreparedSpell(spell, profile, atLimit) {
  const cantrip = Number(spell.level) === 0;
  const alwaysPrepared = isAlwaysPreparedSpell(spell);
  const canPrepare = profile.preparedLimit > 0 && !cantrip && !alwaysPrepared;
  const prepared =
    profile.preparedLimit <= 0 ||
    alwaysPrepared ||
    cantrip ||
    Boolean(spell.prepared);
  const disabled = !canPrepare || (!prepared && atLimit);
  const status = cantrip
    ? "Cantrip · always ready"
    : alwaysPrepared
      ? "Always prepared"
      : profile.preparedLimit <= 0
        ? "Always available"
        : prepared
          ? "Prepared"
          : atLimit
            ? "Limit reached"
            : "Not prepared";
  return `<div class="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"><div class="min-w-0"><div class="font-bold">${escapeHTML(spell.name || "Unnamed spell")}</div><div class="mt-1 flex flex-wrap gap-2"><span class="${ui.badge} ${ui.badgeSecondary}">${formatSpellLevel(spell.level)}</span>${spell.category ? `<span class="text-xs text-stone-500 dark:text-stone-400">${escapeHTML(spell.category)}</span>` : ""}</div></div><button type="button" role="switch" aria-checked="${prepared}" ${disabled ? "disabled" : ""} data-tracker-action="prepared-spell" data-id="${escapeAttribute(spell.id)}" class="inline-flex shrink-0 items-center gap-2 self-start rounded-full border px-3 py-2 text-xs font-bold transition sm:self-auto ${prepared ? "border-emerald-600 bg-emerald-600 text-white" : "border-stone-300 bg-stone-100 text-stone-600 hover:border-blood-500 dark:border-white/15 dark:bg-white/10 dark:text-stone-300"} disabled:cursor-not-allowed disabled:opacity-60"><span class="relative h-5 w-9 rounded-full bg-black/20"><span class="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition ${prepared ? "left-[18px]" : "left-0.5"}"></span></span>${status}</button></div>`;
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
function renderAbilityCard(item) {
  const useBadges = item.uses
    ? `<span class="${ui.badge} ${ui.badgeSuccess}">${item.uses.current}/${item.uses.max}</span><span class="${ui.badge} ${ui.badgeSecondary}">${formatReset(item.uses.reset)}</span>`
    : "";
  const googleURL = `https://www.google.com/search?q=${encodeURIComponent(`${item.name} D&D 5e`)}`;
  return `<div class="${ui.card}"><div class="${ui.cardHeader}"><strong>${escapeHTML(item.name)}</strong><div class="flex items-center gap-2"><span class="${ui.badge} ${ui.badgeDanger}">${escapeHTML(item.category || "Ability")}</span><a class="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-sky-600 text-sky-600 transition hover:bg-sky-600 hover:text-white" href="${escapeHTML(googleURL)}" target="_blank" rel="noopener noreferrer" aria-label="Search Google for ${escapeHTML(item.name)}"><i class="bi bi-google"></i></a></div></div><div class="p-5"><div class="flex flex-wrap items-center justify-between gap-2"><div class="flex flex-wrap gap-2">${item.action ? `<span class="${ui.badge} ${ui.badgePrimary}">${escapeHTML(item.action)}</span>` : ""}</div><div class="flex flex-wrap gap-2">${useBadges}</div></div>${renderDetailBadges(item)}<p class="mt-2 text-sm">${escapeHTML(item.description || "")}</p></div></div>`;
}
function renderDetailBadges(item) {
  const badges = [];
  if (item.level !== undefined && item.level !== null)
    badges.push(
      `<span class="${ui.badge} bg-stone-800 text-white">${formatSpellLevel(item.level)}</span>`,
    );
  if (item.school)
    badges.push(
      `<span class="${ui.badge} bg-stone-800 text-white">${escapeHTML(item.school)}</span>`,
    );
  if (item.range)
    badges.push(
      `<span class="${ui.badge} bg-stone-800 text-white">Range: ${escapeHTML(item.range)}</span>`,
    );
  if (item.attack)
    badges.push(
      `<span class="${ui.badge} bg-stone-800 text-white">${escapeHTML(item.attack)}</span>`,
    );
  if (item.damage)
    badges.push(
      `<span class="${ui.badge} bg-stone-800 text-white">${escapeHTML(item.damage)}</span>`,
    );
  if (item.duration)
    badges.push(
      `<span class="${ui.badge} bg-stone-800 text-white">Duration: ${escapeHTML(item.duration)}</span>`,
    );
  if (item.components)
    badges.push(
      `<span class="${ui.badge} bg-stone-800 text-white">${escapeHTML(item.components)}</span>`,
    );
  if (item.spellcasting)
    badges.push(
      `<span class="${ui.badge} bg-stone-800 text-white">${escapeHTML(item.spellcasting)}</span>`,
    );
  if (item.source) {
    const profile = getSpellcastingProfile(item.source);
    badges.push(
      `<span class="${ui.badge} ${ui.badgePrimary}">${escapeHTML(profile?.name || item.source)}</span>`,
    );
  }
  if (
    item.level !== undefined &&
    Number(item.level) > 0 &&
    item.prepared &&
    !isAlwaysPreparedSpell(item)
  )
    badges.push(`<span class="${ui.badge} ${ui.badgeSuccess}">Prepared</span>`);
  if (item.concentration)
    badges.push(`<span class="${ui.badge} ${ui.badgeWarning}">Concentration</span>`);
  return badges.length
    ? `<div class="mt-2 flex flex-wrap gap-2">${badges.join("")}</div>`
    : "";
}
function loadInventory() {
  loadCurrency();
  const container = document.getElementById("inventory-container");
  if (!container) return;
  const inventory = character.inventory || [];
  container.innerHTML = inventory.length
    ? inventory
        .map(
          (item) =>
            `<div class="${ui.card}"><div class="${ui.cardHeader}"><strong>${escapeHTML(item.name)}</strong><span class="${ui.badge} ${ui.badgePrimary}">x${item.quantity}</span></div><div class="${ui.cardBody}"><small>${escapeHTML(item.description || "")}</small></div></div>`,
        )
        .join("")
    : '<p class="text-stone-500 dark:text-stone-400">Inventory is empty.</p>';
}
function loadCurrency() {
  const container = document.getElementById("currency-container");
  if (!container) return;
  const currency = character.currency || {};
  container.innerHTML = `<div class="${ui.card}"><div class="${ui.cardHeader}">Currency</div><div class="${ui.cardBody}"><div class="flex flex-wrap items-center gap-3"><div class="flex grow flex-wrap gap-2"><span class="${ui.badge} ${ui.badgeSecondary}">CP: ${currency.cp ?? 0}</span><span class="${ui.badge} bg-stone-100 text-stone-900">SP: ${currency.sp ?? 0}</span><span class="${ui.badge} bg-cyan-300 text-stone-900">EP: ${currency.ep ?? 0}</span><span class="${ui.badge} ${ui.badgeWarning}">GP: ${currency.gp ?? 0}</span><span class="${ui.badge} ${ui.badgePrimary}">PP: ${currency.pp ?? 0}</span></div><button type="button" data-character-editor-section="inventory" class="ml-auto inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-blood-500 px-3 py-2 text-sm font-bold text-blood-500 transition hover:bg-blood-500 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"><i class="bi bi-pencil-square" aria-hidden="true"></i>Edit Inventory</button></div></div></div>`;
}
function shortRest() {
  getAllCharacterItems()
    .filter((item) => item.uses?.reset === "short")
    .forEach((item) => (item.uses.current = item.uses.max));
  getSpellSlots()
    .filter((slot) => (slot.reset || "long") === "short")
    .forEach((slot) => (slot.current = slot.max));
  character.hp.temp = 0;
  resetDeathSaves(character.deathSaves);
  saveState();
  refreshUI();
}
function longRest() {
  getAllCharacterItems()
    .filter((item) => item.uses)
    .forEach((item) => (item.uses.current = item.uses.max));
  getSpellSlots().forEach((slot) => (slot.current = slot.max));
  character.hp.current = character.hp.max;
  character.hp.temp = 0;
  resetDeathSaves(character.deathSaves);
  saveState();
  refreshUI();
}
function requestRest(kind) {
  pendingRest = getRestDetails(
    character,
    getAllCharacterItems(),
    getSpellSlots(),
    kind,
  );
  setText("rest-dialog-title", `Confirm ${pendingRest.title.toLowerCase()}`);
  setText("rest-dialog-duration", pendingRest.duration);
  setText("rest-dialog-description", pendingRest.description);
  const effects = document.getElementById("rest-dialog-effects");
  effects?.replaceChildren(
    ...pendingRest.effects.map((effect) => {
      const item = document.createElement("li");
      item.textContent = effect;
      return item;
    }),
  );
  const dialog = document.getElementById("rest-dialog");
  dialog?.classList.remove("hidden");
  dialog?.classList.add("flex");
  document.body.classList.add("overflow-hidden");
  document.getElementById("confirm-rest")?.focus();
}
function closeRestDialog() {
  const dialog = document.getElementById("rest-dialog");
  if (!dialog || dialog.classList.contains("hidden")) return;
  dialog?.classList.add("hidden");
  dialog?.classList.remove("flex");
  document.body.classList.remove("overflow-hidden");
  pendingRest = null;
}
function showRestToast(message) {
  const toast = document.getElementById("rest-toast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.remove("hidden");
  clearTimeout(restToastTimer);
  restToastTimer = setTimeout(() => toast.classList.add("hidden"), 5000);
}
function confirmRest() {
  if (!pendingRest) return;
  const rest = pendingRest;
  if (rest.kind === "short") shortRest();
  else longRest();
  closeRestDialog();
  showRestToast(rest.toast);
}
function setupEvents() {
  document.addEventListener("click", (event) => {
    const target = event.target.closest("[data-tracker-action]");
    if (!target) return;
    const action = target.dataset.trackerAction;
    if (action === "reset-filters") resetFilters(target.dataset.scope);
    else if (action === "resource") changeResource(target.dataset.id, Number(target.dataset.delta));
    else if (action === "spell-slot") changeSpellSlot(target.dataset.id, Number(target.dataset.delta));
    else if (action === "prepared-spell") togglePreparedSpell(target.dataset.id);
    else if (action === "character-flag") toggleCharacterFlag(target.dataset.field);
    else if (action === "death-save") changeDeathSave(target.dataset.kind, Number(target.dataset.index));
    else if (action === "stable") changeStable();
    else if (action === "edit-note") notesController.edit(Number(target.dataset.index));
    else if (action === "delete-note") notesController.remove(Number(target.dataset.index));
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
  on("shortRest-btn", "click", () => requestRest("short"));
  on("longRest-btn", "click", () => requestRest("long"));
  on("confirm-rest", "click", confirmRest);
  on("cancel-rest", "click", closeRestDialog);
  on("close-rest-dialog", "click", closeRestDialog);
  document.getElementById("rest-dialog")?.addEventListener("click", (event) => {
    if (event.target.id === "rest-dialog") closeRestDialog();
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
    closeRestDialog();
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
