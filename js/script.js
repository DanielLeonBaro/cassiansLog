const character = window.character;
const CHARACTER_ID = character.id || "character";
const NOTES_KEY = `dnd-${CHARACTER_ID}-notes`;
const STATE_KEY = `dnd-${CHARACTER_ID}-state`;
const THEME_KEY="dnd-theme";
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
let notes = [];
let editingNote = null;
function initializeApp() {
  loadTheme();
  loadNotesFromStorage();
  loadState();
  loadStats();
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
        `<li class="list-group-item d-flex justify-content-between align-items-center"><div>${skill.proficiency ? '<i class="bi bi-star-fill text-danger me-2"></i>' : '<i class="bi bi-dot me-2"></i>'}${escapeHTML(skill.name)}</div><span class="badge text-bg-secondary">${formatModifier(skill.modifier)}</span></li>`,
    )
    .join("");
  return `<div class="col-12 col-md-6"><div class="card"><div class="card-header d-flex justify-content-between align-items-center"><span class="badge text-bg-warning">${stat.score}</span><strong>${escapeHTML(name)}</strong><span class="badge text-bg-danger">${formatModifier(stat.modifier)}</span></div><ul class="list-group list-group-flush"><li class="list-group-item d-flex justify-content-between align-items-center"><strong><i class="bi bi-shield-check me-2"></i>Saving Throw</strong><span class="badge text-bg-warning">${formatModifier(stat.save)}</span></li>${skills}</ul></div></div>`;
}
function loadTrackers() {
  const trackers = character.trackers || [];
  const card = document.getElementById("trackers-card");
  const container = document.getElementById("trackers-container");
  if (!card || !container) return;
  card.classList.toggle("d-none", trackers.length === 0);
  container.innerHTML = trackers
    .map(
      (tracker) =>
        `<div class="form-check form-switch"><input class="form-check-input character-tracker" type="checkbox" id="tracker-${escapeAttribute(tracker.id)}" data-tracker-id="${escapeAttribute(tracker.id)}"${tracker.active ? " checked" : ""}><label class="form-check-label" for="tracker-${escapeAttribute(tracker.id)}">${escapeHTML(tracker.name)}</label></div>`,
    )
    .join("");
}
function loadResources() {
  const container = document.getElementById("resources-container");
  if (!container) return;
  container.innerHTML = actionGroups
    .map((group) => {
      const items = getCombatItems().filter((item) =>
        group.value === "Other"
          ? !["Action", "Bonus Action", "Free Action", "Reaction"].includes(
              item.action,
            )
          : item.action === group.value,
      );
      if (!items.length) return "";
      return `<div class="col-12"><h6 class="text-body-secondary mb-2">${group.label}</h6><div class="row g-3">${items.map(renderResourceCard).join("")}</div></div>`;
    })
    .join("");
}
function renderResourceCard(item) {
  let usage = "";
  if (item.uses) {
    usage = `<div class="btn-group btn-group-sm" role="group"><button type="button" class="btn btn-outline-secondary" onclick="changeResource('${escapeAttribute(item.id)}',-1)">−</button><button type="button" class="btn btn-outline-secondary" onclick="changeResource('${escapeAttribute(item.id)}',1)">+</button></div><div class="d-flex gap-2"><span class="badge text-bg-success">${item.uses.current}/${item.uses.max}</span><span class="badge text-bg-warning">${formatReset(item.uses.reset)}</span></div>`;
  } else if (item.slotLevel) {
    usage = `<span class="badge text-bg-primary">Uses level ${item.slotLevel} slot</span>`;
  } else {
    usage = '<span class="badge text-bg-secondary">At will</span>';
  }
  return `<div class="col-12 col-md-6"><div class="card h-100"><div class="card-header d-flex justify-content-between align-items-center"><strong>${escapeHTML(item.name)}</strong><span class="badge text-bg-danger">${escapeHTML(item.category || "Ability")}</span></div><div class="card-body py-2"><div class="d-flex justify-content-between align-items-center gap-2 flex-wrap">${usage}</div>${renderDetailBadges(item)}<p class="small mb-0 mt-2">${escapeHTML(item.description || "")}</p></div></div></div>`;
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
  section.classList.toggle("d-none", !enabled);
  if (!enabled) return;
  profilesContainer.innerHTML = profiles
    .map(
      (profile) =>
        `<div class="col-12 col-md-6"><div class="card h-100"><div class="card-header"><strong>${escapeHTML(profile.name || "Spellcasting")}</strong></div><div class="card-body py-2"><div class="d-flex gap-2 flex-wrap"><span class="badge text-bg-primary">${escapeHTML(profile.ability || "—")}</span>${profile.saveDC !== null && profile.saveDC !== undefined ? `<span class="badge text-bg-warning">Save DC ${profile.saveDC}</span>` : ""}${profile.attackBonus !== null && profile.attackBonus !== undefined ? `<span class="badge text-bg-success">Attack ${formatModifier(profile.attackBonus)}</span>` : ""}</div></div></div></div>`,
    )
    .join("");
  slotsContainer.innerHTML = `<div class="col-12"><h6 class="text-body-secondary mb-2">Spell Slots</h6>${slots.length ? `<div class="row g-3">${slots.map(renderSpellSlot).join("")}</div>` : `<div class="card"><div class="card-body py-2 text-body-secondary">This character has no spell slots.</div></div>`}</div>`;
}
function renderSpellSlot(slot) {
  return `<div class="col-12 col-sm-6 col-lg-4"><div class="card h-100"><div class="card-header d-flex justify-content-between align-items-center"><strong>Level ${slot.level}</strong><span class="badge text-bg-danger">Max: ${slot.max}</span></div><div class="card-body py-2"><div class="d-flex justify-content-between align-items-center"><div class="btn-group btn-group-sm"><button type="button" class="btn btn-outline-secondary" onclick="changeSpellSlot('${escapeAttribute(slot.id)}',-1)">−</button><button type="button" class="btn btn-outline-secondary" onclick="changeSpellSlot('${escapeAttribute(slot.id)}',1)">+</button></div><span class="badge text-bg-warning">${slot.current}/${slot.max}</span><span class="badge text-bg-secondary">${formatReset(slot.reset || "long")}</span></div></div></div></div>`;
}
function changeSpellSlot(id, delta) {
  const slot = findSpellSlot(id);
  if (!slot) return;
  slot.current = Math.max(0, Math.min(slot.max, Number(slot.current) + delta));
  saveState();
  refreshUI();
}
function loadAbilities() {
  loadAbilitySection("actions-container", character.actions || []);
  loadAbilitySection("spells-container", character.spells || []);
  loadAbilitySection("features-container", character.features || []);
}
function loadAbilitySection(id, items) {
  const container = document.getElementById(id);
  if (!container) return;
  container.innerHTML = items.length
    ? items.map(renderAbilityCard).join("")
    : '<div class="col-12"><p class="text-body-secondary mb-0">Nothing added yet.</p></div>';
}
function renderAbilityCard(item) {
  const useBadges = item.uses
    ? `<span class="badge text-bg-success">${item.uses.current}/${item.uses.max}</span><span class="badge text-bg-secondary">${formatReset(item.uses.reset)}</span>`
    : "";
  return `<div class="col-12 col-md-6"><div class="card h-100"><div class="card-header d-flex justify-content-between align-items-center"><strong>${escapeHTML(item.name)}</strong><span class="badge text-bg-danger">${escapeHTML(item.category || "Ability")}</span></div><div class="card-body py-2"><div class="d-flex justify-content-between align-items-center gap-2 flex-wrap"><div class="d-flex gap-2 flex-wrap">${item.action ? `<span class="badge text-bg-primary">${escapeHTML(item.action)}</span>` : ""}</div><div class="d-flex gap-2 flex-wrap">${useBadges}</div></div>${renderDetailBadges(item)}<p class="small mb-0 mt-2">${escapeHTML(item.description || "")}</p></div></div></div>`;
}
function renderDetailBadges(item) {
  const badges = [];
  if (item.level !== undefined && item.level !== null)
    badges.push(
      `<span class="badge text-bg-dark border">${formatSpellLevel(item.level)}</span>`,
    );
  if (item.school)
    badges.push(
      `<span class="badge text-bg-dark border">${escapeHTML(item.school)}</span>`,
    );
  if (item.range)
    badges.push(
      `<span class="badge text-bg-dark border">Range: ${escapeHTML(item.range)}</span>`,
    );
  if (item.attack)
    badges.push(
      `<span class="badge text-bg-dark border">${escapeHTML(item.attack)}</span>`,
    );
  if (item.damage)
    badges.push(
      `<span class="badge text-bg-dark border">${escapeHTML(item.damage)}</span>`,
    );
  if (item.duration)
    badges.push(
      `<span class="badge text-bg-dark border">Duration: ${escapeHTML(item.duration)}</span>`,
    );
  if (item.components)
    badges.push(
      `<span class="badge text-bg-dark border">${escapeHTML(item.components)}</span>`,
    );
  if (item.spellcasting)
    badges.push(
      `<span class="badge text-bg-dark border">${escapeHTML(item.spellcasting)}</span>`,
    );
  if (item.concentration)
    badges.push('<span class="badge text-bg-warning">Concentration</span>');
  return badges.length
    ? `<div class="d-flex gap-2 flex-wrap mt-2">${badges.join("")}</div>`
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
            `<div class="col-12 col-md-6"><div class="card h-100"><div class="card-header d-flex justify-content-between align-items-center"><strong>${escapeHTML(item.name)}</strong><span class="badge text-bg-primary">x${item.quantity}</span></div><div class="card-body"><small>${escapeHTML(item.description || "")}</small></div></div></div>`,
        )
        .join("")
    : '<div class="col-12"><p class="text-body-secondary mb-0">Inventory is empty.</p></div>';
}
function loadCurrency() {
  const container = document.getElementById("currency-container");
  if (!container) return;
  const currency = character.currency || {};
  container.innerHTML = `<div class="card"><div class="card-header">Currency</div><div class="card-body py-2"><div class="d-flex gap-2 flex-wrap"><span class="badge text-bg-secondary">CP: ${currency.cp ?? 0}</span><span class="badge text-bg-light text-dark border">SP: ${currency.sp ?? 0}</span><span class="badge text-bg-info text-dark">EP: ${currency.ep ?? 0}</span><span class="badge text-bg-warning text-dark">GP: ${currency.gp ?? 0}</span><span class="badge text-bg-primary">PP: ${currency.pp ?? 0}</span></div></div></div>`;
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
        `<div class="col-12 col-md-6"><div class="card h-100"><div class="card-header d-flex justify-content-between align-items-center"><strong>${escapeHTML(note.title)}</strong><div class="btn-group btn-group-sm"><button type="button" class="btn btn-outline-primary" onclick="editNote(${index})"><i class="bi bi-pencil"></i></button><button type="button" class="btn btn-outline-danger" onclick="deleteNote(${index})"><i class="bi bi-trash"></i></button></div></div><div class="card-body">${escapeHTML(note.body)}</div></div></div>`,
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
  on("shortRest-btn", "click", shortRest);
  on("longRest-btn", "click", longRest);
  on("save-note-btn", "click", saveNote);
  on("theme-toggle", "click", toggleTheme);
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
    document.documentElement.getAttribute("data-bs-theme") || "dark";
  applyTheme(current === "dark" ? "light" : "dark");
}
function applyTheme(theme) {
  document.documentElement.setAttribute("data-bs-theme", theme);
  document.body.classList.remove("bg-dark");
  document.body.classList.add("bg-body");
  localStorage.setItem(THEME_KEY, theme);
  const button = document.getElementById("theme-toggle");
  const icon = document.getElementById("theme-icon");
  if (!button || !icon) return;
  const dark = theme === "dark";
  button.className = `btn btn-sm ${dark ? "btn-outline-light" : "btn-outline-dark"} position-fixed bottom-0 end-0 m-3 z-3`;
  icon.className = dark ? "bi bi-sun-fill" : "bi bi-moon-stars-fill";
}
function getCombatItems() {
  return [
    ...(character.actions || []),
    ...(character.spells || []),
    ...(character.resources || []),
  ];
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
