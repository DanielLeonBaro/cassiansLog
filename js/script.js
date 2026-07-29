const character = window.character;
const CHARACTER_ID = character.id || "character";
const NOTES_KEY = `dnd-${CHARACTER_ID}-notes`;
const STATE_KEY = `dnd-${CHARACTER_ID}-state`;
const THEME_KEY = "dnd-theme";
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
const ui = {
  card: "min-w-0 h-full overflow-hidden rounded-2xl border border-stone-300/80 bg-white/75 shadow-card dark:border-white/10 dark:bg-white/[.055]",
  cardHeader: "flex flex-wrap items-center justify-between gap-3 border-b border-stone-200/80 bg-stone-100/70 px-5 py-4 font-bold leading-none dark:border-white/10 dark:bg-white/[.045]",
  cardBody: "p-5",
  badge: "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold",
  badgeDanger: "bg-blood-500 text-white",
  badgeSecondary: "bg-stone-200 text-stone-700 dark:bg-white/10 dark:text-stone-200",
  badgeWarning: "bg-amber-300 text-stone-900",
  badgeSuccess: "bg-emerald-600 text-white",
  badgePrimary: "bg-sky-700 text-white",
  iconButton: "inline-flex h-9 w-9 items-center justify-center rounded-full border border-stone-300 bg-stone-100 text-sm font-bold text-stone-700 shadow-sm transition hover:border-blood-500 hover:bg-blood-500 hover:text-white dark:border-white/15 dark:bg-white/10 dark:text-stone-100 dark:hover:bg-blood-500",
};
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
let notes = [];
let editingNote = null;
function initializeApp() {
  loadTheme();
  loadNotesFromStorage();
  loadState();
  loadStats();
  initializeFilters();
  refreshUI();
  setupEvents();
}
function refreshUI() {
  loadHeader();
  loadHP();
  loadTrackers();
  loadResources();
  loadSpellcasting();
  loadAbilities();
  loadInventory();
  loadNotes();
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
      portrait.src = "bat.ico";
    };
    portrait.src = character.portrait || "bat.ico";
    portrait.alt = `${character.name} portrait`;
  }
  document.title = `${character.name} — Character Tracker`;
}
function loadHP() {
  setText("effective-hp", getTotalHP());
  setText("current-hp", character.hp.current);
  setText("temp-hp", character.hp.temp);
  setText("max-hp", character.hp.max);
}
function damageHP(amount) {
  if (amount <= 0) return;
  const absorbed = Math.min(character.hp.temp, amount);
  character.hp.temp -= absorbed;
  character.hp.current = Math.max(
    0,
    character.hp.current - (amount - absorbed),
  );
  saveState();
  refreshUI();
}
function healHP(amount) {
  if (amount <= 0) return;
  character.hp.current = Math.min(
    character.hp.max,
    character.hp.current + amount,
  );
  saveState();
  refreshUI();
}
function setTempHP(amount) {
  character.hp.temp = Math.max(0, amount);
  saveState();
  refreshUI();
}
function getTotalHP() {
  return character.hp.current + character.hp.temp;
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
  container.innerHTML = Object.entries(character.stats || {})
    .map(([key, stat]) => renderStatCard(statNames[key] || key, stat))
    .join("");
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
    <div class="rounded-2xl border border-stone-200/90 bg-stone-50/70 p-4 dark:border-white/10 dark:bg-black/10">
      <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 class="font-display font-bold"><i class="bi bi-funnel-fill mr-2 text-blood-500"></i>Find an option</h3>
          <p class="mt-1 text-sm text-stone-500 dark:text-stone-400">Combine filters to narrow the list.</p>
        </div>
        <div class="flex items-center gap-3">
          <span id="${scope}-filter-summary" class="text-sm font-semibold text-stone-500 dark:text-stone-400" aria-live="polite"></span>
          <button type="button" data-filter-reset class="hidden rounded-xl border border-stone-300 bg-white/70 px-3 py-2 text-xs font-bold text-stone-600 transition hover:border-blood-500 hover:text-blood-500 dark:border-white/15 dark:bg-white/5 dark:text-stone-300">
            <i class="bi bi-arrow-counterclockwise mr-1"></i>Clear
          </button>
        </div>
      </div>
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
function hasActiveFilters(state) {
  return Object.values(state).some((value) => String(value).trim());
}
function uniqueValues(values) {
  return [...new Set(values.filter(Boolean).map(String))].sort((a, b) =>
    a.localeCompare(b),
  );
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
function normalizeFilterText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}
function renderEmptyFilterState(scope) {
  const filtering = hasActiveFilters(filterState[scope]);
  return `<div class="rounded-2xl border border-dashed border-stone-300 bg-stone-50/60 px-5 py-10 text-center text-stone-500 dark:border-white/15 dark:bg-white/[.025] dark:text-stone-400"><i class="bi ${filtering ? "bi-search" : "bi-journal-plus"} mb-2 block text-2xl text-blood-500"></i><strong class="block text-stone-700 dark:text-stone-200">${filtering ? "No matching options" : "No options added yet"}</strong><span class="mt-1 block text-sm">${filtering ? "Try removing a filter or using a broader search." : "Add an action, spell, feature, or resource in the character editor."}</span>${filtering ? `<button type="button" class="mt-4 rounded-xl border border-stone-300 px-3 py-2 text-xs font-bold hover:border-blood-500 hover:text-blood-500 dark:border-white/15" onclick="resetFilters('${scope}')">Clear filters</button>` : ""}</div>`;
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
    usage = `<div class="inline-flex gap-2" role="group"><button type="button" class="${ui.iconButton}" aria-label="Decrease ${escapeAttribute(item.name)}" onclick="changeResource('${escapeAttribute(item.id)}',-1)">−</button><button type="button" class="${ui.iconButton}" aria-label="Increase ${escapeAttribute(item.name)}" onclick="changeResource('${escapeAttribute(item.id)}',1)">+</button></div><div class="flex gap-2"><span class="${ui.badge} ${ui.badgeSuccess}">${item.uses.current}/${item.uses.max}</span><span class="${ui.badge} ${ui.badgeWarning}">${formatReset(item.uses.reset)}</span></div>`;
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
        `<div class="${ui.card}"><div class="${ui.cardHeader}"><strong>${escapeHTML(profile.name || "Spellcasting")}</strong></div><div class="p-5"><div class="flex flex-wrap gap-2"><span class="${ui.badge} ${ui.badgePrimary}">${escapeHTML(profile.ability || "—")}</span>${profile.saveDC !== null && profile.saveDC !== undefined ? `<span class="${ui.badge} ${ui.badgeWarning}">Save DC ${profile.saveDC}</span>` : ""}${profile.attackBonus !== null && profile.attackBonus !== undefined ? `<span class="${ui.badge} ${ui.badgeSuccess}">Attack ${formatModifier(profile.attackBonus)}</span>` : ""}</div></div></div>`,
    )
    .join("");
  slotsContainer.innerHTML = `<div><h6 class="mb-2 text-sm font-semibold text-stone-500 dark:text-stone-400">Spell Slots</h6>${slots.length ? `<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">${slots.map(renderSpellSlot).join("")}</div>` : `<div class="${ui.card}"><div class="p-5 text-stone-500 dark:text-stone-400">This character has no spell slots.</div></div>`}</div>`;
}
function renderSpellSlot(slot) {
  return `<div class="${ui.card}"><div class="${ui.cardHeader}"><strong>Level ${slot.level}</strong><span class="${ui.badge} ${ui.badgeDanger}">Max: ${slot.max}</span></div><div class="p-5"><div class="flex items-center justify-between"><div class="inline-flex gap-2"><button type="button" class="${ui.iconButton}" aria-label="Decrease level ${slot.level} spell slots" onclick="changeSpellSlot('${escapeAttribute(slot.id)}',-1)">−</button><button type="button" class="${ui.iconButton}" aria-label="Increase level ${slot.level} spell slots" onclick="changeSpellSlot('${escapeAttribute(slot.id)}',1)">+</button></div><span class="${ui.badge} ${ui.badgeWarning}">${slot.current}/${slot.max}</span><span class="${ui.badge} ${ui.badgeSecondary}">${formatReset(slot.reset || "long")}</span></div></div></div>`;
}
function changeSpellSlot(id, delta) {
  const slot = findSpellSlot(id);
  if (!slot) return;
  slot.current = Math.max(0, Math.min(slot.max, Number(slot.current) + delta));
  saveState();
  refreshUI();
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
  return `<div class="${ui.card}"><div class="${ui.cardHeader}"><strong>${escapeHTML(item.name)}</strong><span class="${ui.badge} ${ui.badgeDanger}">${escapeHTML(item.category || "Ability")}</span></div><div class="p-5"><div class="flex flex-wrap items-center justify-between gap-2"><div class="flex flex-wrap gap-2">${item.action ? `<span class="${ui.badge} ${ui.badgePrimary}">${escapeHTML(item.action)}</span>` : ""}</div><div class="flex flex-wrap gap-2">${useBadges}</div></div>${renderDetailBadges(item)}<p class="mt-2 text-sm">${escapeHTML(item.description || "")}</p></div></div>`;
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
  container.innerHTML = `<div class="${ui.card}"><div class="${ui.cardHeader}">Currency</div><div class="${ui.cardBody}"><div class="flex flex-wrap gap-2"><span class="${ui.badge} ${ui.badgeSecondary}">CP: ${currency.cp ?? 0}</span><span class="${ui.badge} bg-stone-100 text-stone-900">SP: ${currency.sp ?? 0}</span><span class="${ui.badge} bg-cyan-300 text-stone-900">EP: ${currency.ep ?? 0}</span><span class="${ui.badge} ${ui.badgeWarning}">GP: ${currency.gp ?? 0}</span><span class="${ui.badge} ${ui.badgePrimary}">PP: ${currency.pp ?? 0}</span></div></div></div>`;
}
function shortRest() {
  getAllCharacterItems()
    .filter((item) => item.uses?.reset === "short")
    .forEach((item) => (item.uses.current = item.uses.max));
  getSpellSlots()
    .filter((slot) => (slot.reset || "long") === "short")
    .forEach((slot) => (slot.current = slot.max));
  character.hp.temp = 0;
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
  saveState();
  refreshUI();
}
function loadNotes() {
  const container = document.getElementById("notes-container");
  if (!container) return;
  container.innerHTML = notes
    .map(
      (note, index) =>
        `<div class="${ui.card}"><div class="${ui.cardHeader}"><strong>${escapeHTML(note.title)}</strong><div class="inline-flex"><button type="button" class="inline-flex items-center justify-center rounded-l-xl border border-sky-500 px-3 py-1.5 text-xs font-bold text-sky-600 transition hover:bg-sky-500 hover:text-white" onclick="editNote(${index})"><i class="bi bi-pencil"></i></button><button type="button" class="inline-flex items-center justify-center rounded-r-xl border border-blood-500 px-3 py-1.5 text-xs font-bold text-blood-500 transition hover:bg-blood-500 hover:text-white" onclick="deleteNote(${index})"><i class="bi bi-trash"></i></button></div></div><div class="${ui.cardBody}">${escapeHTML(note.body)}</div></div>`,
    )
    .join("");
}
function saveNote() {
  const title = document.getElementById("note-title").value.trim();
  const body = document.getElementById("note-body").value.trim();
  if (!title || !body) return;
  const note = { title, body };
  if (editingNote === null) notes.push(note);
  else {
    notes[editingNote] = note;
    editingNote = null;
  }
  clearNoteInputs();
  saveNotes();
  loadNotes();
}
function editNote(index) {
  const note = notes[index];
  document.getElementById("note-title").value = note.title;
  document.getElementById("note-body").value = note.body;
  editingNote = index;
}
function deleteNote(index) {
  notes.splice(index, 1);
  if (editingNote === index) {
    editingNote = null;
    clearNoteInputs();
  }
  saveNotes();
  loadNotes();
}
function saveNotes() {
  localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
}
function loadNotesFromStorage() {
  notes = readStorage(NOTES_KEY, []);
}
function clearNoteInputs() {
  document.getElementById("note-title").value = "";
  document.getElementById("note-body").value = "";
}
function saveState() {
  const state = {
    hp: { current: character.hp.current, temp: character.hp.temp },
    trackers: (character.trackers || []).map((tracker) => ({
      id: tracker.id,
      active: tracker.active,
    })),
    uses: getAllCharacterItems()
      .filter((item) => item.uses)
      .map((item) => ({ id: item.id, current: item.uses.current })),
    slots: getSpellSlots().map((slot) => ({
      id: slot.id,
      current: slot.current,
    })),
  };
  localStorage.setItem(STATE_KEY, JSON.stringify(state));
}
function loadState() {
  const state = readStorage(STATE_KEY, null);
  if (!state) return;
  if (state.hp) {
    character.hp.current = Math.max(
      0,
      Math.min(character.hp.max, Number(state.hp.current)),
    );
    character.hp.temp = Math.max(0, Number(state.hp.temp) || 0);
  }
  (state.trackers || []).forEach((saved) => {
    const tracker = (character.trackers || []).find(
      (item) => item.id === saved.id,
    );
    if (tracker) tracker.active = Boolean(saved.active);
  });
  (state.uses || []).forEach((saved) => {
    const item = findCharacterItem(saved.id);
    if (item?.uses)
      item.uses.current = Math.max(
        0,
        Math.min(item.uses.max, Number(saved.current)),
      );
  });
  (state.slots || []).forEach((saved) => {
    const slot = findSpellSlot(saved.id);
    if (slot)
      slot.current = Math.max(0, Math.min(slot.max, Number(saved.current)));
  });
}
function setupEvents() {
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
  on("shortRest-btn", "click", shortRest);
  on("longRest-btn", "click", longRest);
  on("save-note-btn", "click", saveNote);
  on("theme-toggle", "click", toggleTheme);
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
function loadTheme() {
  applyTheme(localStorage.getItem(THEME_KEY) || "dark");
}
function toggleTheme() {
  const current =
    document.documentElement.getAttribute("data-theme") || "dark";
  applyTheme(current === "dark" ? "light" : "dark");
}
function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem(THEME_KEY, theme);
  const button = document.getElementById("theme-toggle");
  const icon = document.getElementById("theme-icon");
  if (!button || !icon) return;
  const dark = theme === "dark";
  button.setAttribute(
    "aria-label",
    dark ? "Switch to light theme" : "Switch to dark theme",
  );
  icon.className = dark ? "bi bi-sun-fill" : "bi bi-moon-stars-fill";
}
function getCombatItems() {
  return getCombatItemRecords().map((record) => record.item);
}
function getCombatItemRecords() {
  return [
    ...createItemRecords("actions", character.actions),
    ...createItemRecords("spells", character.spells),
    ...createItemRecords("resources", character.resources),
    ...createItemRecords(
      "features",
      (character.features || []).filter((item) => item.action),
    ),
  ];
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
function setText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value ?? "—";
}
function on(id, event, handler) {
  const element = document.getElementById(id);
  if (element) element.addEventListener(event, handler);
}
function readStorage(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : JSON.parse(value);
  } catch {
    return fallback;
  }
}
function escapeHTML(value) {
  const characters = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return String(value ?? "").replace(
    /[&<>"']/g,
    (character) => characters[character],
  );
}
function escapeAttribute(value) {
  return String(value ?? "").replace(/[^a-zA-Z0-9_-]/g, "-");
}
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeApp);
} else {
  initializeApp();
}
