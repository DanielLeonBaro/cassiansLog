document.addEventListener("DOMContentLoaded", initializeApp);
const NOTES_KEY = "cassian-notes";
const STATE_KEY = "cassian-state";
const statNames = {
  str: "Strength",
  dex: "Dexterity",
  con: "Constitution",
  int: "Intelligence",
  wis: "Wisdom",
  cha: "Charisma"
};
const resetLabels = {
  short: "Short Rest",
  long: "Long Rest"
};
const actionGroups = [
  { value: "Action", label: "Actions" },
  { value: "Bonus Action", label: "Bonus Actions" },
  { value: "Free Action", label: "Free Actions" },
  { value: "Reaction", label: "Reactions" }
];
let notes = [];
let editingNote = null;
function initializeApp() {
  loadNotesFromStorage();
  loadState();
  loadStats();
  setupEvents();
  refreshUI();
}
function refreshUI() {
  loadHeader();
  loadHP();
  loadCombatToggles();
  loadResources();
  loadAbilities();
  loadInventory();
  loadNotes();
}
// Header
function loadHeader() {
  const fields = {
    "character-name": character.name,
    "character-level": character.level,
    "character-race": character.race,
    "character-class": character.class,
    "character-background": character.background,
    "character-gender": character.gender,
    "character-alignment": character.alignment,
    "character-ac": character.ac,
    "character-hp": `${getTotalHP()}/${character.hp.max}`,
    "character-initiative": formatModifier(character.initiative),
    "character-proficiency": formatModifier(character.proficiency),
    "character-walk": character.walk,
    "character-fly": character.fly,
    "character-passive-perception": character.passivePerception,
    "character-dark": character.darkvision
  };
  Object.entries(fields).forEach(([id, value]) => setText(id, value));
}
// HP
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
    character.hp.current - (amount - absorbed)
  );
  saveState();
  refreshUI();
}
function healHP(amount) {
  if (amount <= 0) return;
  character.hp.current = Math.min(
    character.hp.max,
    character.hp.current + amount
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
// Stats
function loadStats() {
  const container = document.getElementById("skills-container");
  if (!container) return;
  container.innerHTML = Object.entries(character.stats)
    .map(([key, stat]) => renderStatCard(statNames[key], stat))
    .join("");
}
function renderStatCard(name, stat) {
  const skills = stat.skills
    .map(skill => `
      <li class="list-group-item d-flex justify-content-between align-items-center">
        <div>
          ${
            skill.proficiency
              ? '<i class="bi bi-star-fill text-danger me-2"></i>'
              : '<i class="bi bi-dot me-2"></i>'
          }
          ${skill.name}
        </div>
        <span class="badge text-bg-secondary">
          ${formatModifier(skill.modifier)}
        </span>
      </li>
    `)
    .join("");
  return `
    <div class="col-12 col-md-6">
      <div class="card">
        <div class="card-header d-flex justify-content-between align-items-center">
          <span class="badge text-bg-warning">
            ${stat.score}
          </span>
          <strong>${name}</strong>
          <span class="badge text-bg-danger">
            ${formatModifier(stat.modifier)}
          </span>
        </div>
        <ul class="list-group list-group-flush">
          <li class="list-group-item d-flex justify-content-between align-items-center">
            <strong>
              <i class="bi bi-shield-check me-2"></i>
              Saving Throw
            </strong>
            <span class="badge text-bg-warning">
              ${formatModifier(stat.save)}
            </span>
          </li>
          ${skills}
        </ul>
      </div>
    </div>
  `;
}
// Combat Toggles
function loadCombatToggles() {
  setChecked("echo1-toggle", character.combat.echoes[0].active);
  setChecked("echo2-toggle", character.combat.echoes[1].active);
  setChecked("concentration-toggle", character.combat.concentration);
}
// Combat Resources
function loadResources() {
  const container = document.getElementById("resources-container");
  if (!container) return;
  container.innerHTML = actionGroups
    .map(group => {
      const items = getCombatItems()
        .filter(item => item.action === group.value);
      if (!items.length) return "";
      return `
        <div class="col-12">
          <h6 class="text-body-secondary mb-2">
            ${group.label}
          </h6>
          <div class="row g-3">
            ${items.map(renderResourceCard).join("")}
          </div>
        </div>
      `;
    })
    .join("");
}
function renderResourceCard(item) {
  const usageControls = item.uses
    ? `
      <div class="btn-group btn-group-sm" role="group">
        <button
          type="button"
          class="btn btn-outline-secondary"
          onclick="changeResource('${item.id}', -1)">
          −
        </button>
        <button
          type="button"
          class="btn btn-outline-secondary"
          onclick="changeResource('${item.id}', 1)">
          +
        </button>
      </div>
      <div class="d-flex gap-2">
        <span class="badge text-bg-success">
          ${item.uses.current}/${item.uses.max}
        </span>
        <span class="badge text-bg-warning">
          ${formatReset(item.uses.reset)}
        </span>
      </div>
    `
    : `
      <span class="badge text-bg-secondary">
        Unlimited
      </span>
    `;
  return `
    <div class="col-12 col-md-6">
      <div class="card h-100">
        <div class="card-header d-flex justify-content-between align-items-center">
          <strong>${item.name}</strong>
          <span class="badge text-bg-danger">
            ${item.category}
          </span>
        </div>
        <div class="card-body py-2">
          <div class="d-flex justify-content-between align-items-center gap-2 flex-wrap">
            ${usageControls}
          </div>
          ${renderDetailBadges(item)}
          <p class="small mb-0 mt-2">
            ${item.description}
          </p>
        </div>
      </div>
    </div>
  `;
}
function changeResource(id, delta) {
  const item = findCharacterItem(id);
  if (!item?.uses) return;
  item.uses.current = Math.max(
    0,
    Math.min(
      item.uses.max,
      Number(item.uses.current) + delta
    )
  );
  saveState();
  refreshUI();
}
// All Possibilities
function loadAbilities() {
  loadAbilitySection("actions-container", character.actions);
  loadAbilitySection("spells-container", character.spells);
  loadAbilitySection("features-container", character.features);
}
function loadAbilitySection(id, items) {
  const container = document.getElementById(id);
  if (!container) return;
  container.innerHTML = items
    .map(renderAbilityCard)
    .join("");
}
function renderAbilityCard(item) {
  const useBadges = item.uses
    ? `
      <span class="badge text-bg-success">
        ${item.uses.current}/${item.uses.max}
      </span>
      <span class="badge text-bg-secondary">
        ${formatReset(item.uses.reset)}
      </span>
    `
    : "";
  return `
    <div class="col-12 col-md-6">
      <div class="card">
        <div class="card-header d-flex justify-content-between align-items-center">
          <strong>${item.name}</strong>
          <span class="badge text-bg-danger">
            ${item.category}
          </span>
        </div>
        <div class="card-body py-2">
          <div class="d-flex justify-content-between align-items-center gap-2 flex-wrap">
            <div class="d-flex gap-2 flex-wrap">
              ${
                item.action
                  ? `<span class="badge text-bg-primary">${item.action}</span>`
                  : ""
              }
            </div>
            <div class="d-flex gap-2 flex-wrap">
              ${useBadges}
            </div>
          </div>
          ${renderDetailBadges(item)}
          <p class="small mb-0 mt-2">
            ${item.description}
          </p>
        </div>
      </div>
    </div>
  `;
}
function renderDetailBadges(item) {
  const badges = [
    item.range
      ? `<span class="badge text-bg-dark border">Range: ${item.range}</span>`
      : "",
    item.attack
      ? `<span class="badge text-bg-dark border">${item.attack}</span>`
      : "",
    item.damage
      ? `<span class="badge text-bg-dark border">${item.damage}</span>`
      : "",
    item.duration
      ? `<span class="badge text-bg-dark border">Duration: ${item.duration}</span>`
      : "",
    item.spellcasting
      ? `<span class="badge text-bg-dark border">${item.spellcasting}</span>`
      : "",
    item.concentration
      ? `<span class="badge text-bg-warning">Concentration</span>`
      : ""
  ]
    .filter(Boolean)
    .join("");
  return badges
    ? `<div class="d-flex gap-2 flex-wrap mt-2">${badges}</div>`
    : "";
}
// Inventory
function loadInventory() {
  const container = document.getElementById("inventory-container");
  if (!container) return;
  container.innerHTML = character.inventory
    .map(item => `
      <div class="col-12 col-md-6">
        <div class="card h-100">
          <div class="card-header d-flex justify-content-between align-items-center">
            <strong>${item.name}</strong>
            <span class="badge text-bg-primary">
              x${item.quantity}
            </span>
          </div>
          <div class="card-body">
            <small>${item.description}</small>
          </div>
        </div>
      </div>
    `)
    .join("");
}
// Rests
function shortRest() {
  getAllCharacterItems()
    .filter(item => item.uses?.reset === "short")
    .forEach(item => {
      item.uses.current = item.uses.max;
    });
  character.hp.temp = 0;
  saveState();
  refreshUI();
}
function longRest() {
  getAllCharacterItems()
    .filter(item => item.uses)
    .forEach(item => {
      item.uses.current = item.uses.max;
    });
  character.hp.current = character.hp.max;
  character.hp.temp = 0;
  saveState();
  refreshUI();
}
// Notes
function loadNotes() {
  const container = document.getElementById("notes-container");
  if (!container) return;
  container.innerHTML = notes
    .map((note, index) => `
      <div class="col-12 col-md-6">
        <div class="card h-100">
          <div class="card-header d-flex justify-content-between align-items-center">
            <strong>${escapeHTML(note.title)}</strong>
            <div class="btn-group btn-group-sm" role="group">
              <button
                type="button"
                class="btn btn-outline-primary"
                onclick="editNote(${index})">
                <i class="bi bi-pencil"></i>
              </button>
              <button
                type="button"
                class="btn btn-outline-danger"
                onclick="deleteNote(${index})">
                <i class="bi bi-trash"></i>
              </button>
            </div>
          </div>
          <div class="card-body">
            ${escapeHTML(note.body)}
          </div>
        </div>
      </div>
    `)
    .join("");
}
function saveNote() {
  const title = document.getElementById("note-title").value.trim();
  const body = document.getElementById("note-body").value.trim();
  if (!title || !body) return;
  const note = { title, body };
  if (editingNote === null) {
    notes.push(note);
  } else {
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
// State
function saveState() {
  const state = {
    hp: {
      current: character.hp.current,
      temp: character.hp.temp
    },
    combat: structuredClone(character.combat),
    uses: getAllCharacterItems()
      .filter(item => item.uses)
      .map(item => ({
        id: item.id,
        current: item.uses.current
      }))
  };
  localStorage.setItem(STATE_KEY, JSON.stringify(state));
}
function loadState() {
  const state = readStorage(STATE_KEY, null);
  if (!state) return;
  if (state.hp) {
    character.hp.current = state.hp.current;
    character.hp.temp = state.hp.temp;
  }
  if (state.combat) {
    character.combat = state.combat;
  }
  (state.uses || []).forEach(savedUse => {
    const item = findCharacterItem(savedUse.id);
    if (item?.uses) {
      item.uses.current = Number(savedUse.current);
    }
  });
}
// Events
function setupEvents() {
  document.getElementById("damage-btn").addEventListener("click", () => {
    damageHP(getHPAmount());
    clearHPInputs();
  });
  document.getElementById("heal-btn").addEventListener("click", () => {
    healHP(getHPAmount());
    clearHPInputs();
  });
  document.getElementById("temp-btn").addEventListener("click", () => {
    setTempHP(getTempAmount());
    clearHPInputs();
  });
  document.getElementById("shortRest-btn").addEventListener("click", shortRest);
  document.getElementById("longRest-btn").addEventListener("click", longRest);
  document.getElementById("save-note-btn").addEventListener("click", saveNote);
  document.getElementById("echo1-toggle").addEventListener("change", event => {
    character.combat.echoes[0].active = event.target.checked;
    saveState();
  });
  document.getElementById("echo2-toggle").addEventListener("change", event => {
    character.combat.echoes[1].active = event.target.checked;
    saveState();
  });
  document.getElementById("concentration-toggle").addEventListener("change", event => {
    character.combat.concentration = event.target.checked;
    saveState();
  });
}
// Helpers
function getCombatItems() {
  return [...character.actions, ...character.spells];
}
function getAllCharacterItems() {
  return [
    ...character.actions,
    ...character.spells,
    ...character.features
  ];
}
function findCharacterItem(id) {
  return getAllCharacterItems()
    .find(item => item.id === id);
}
function getNumberInput(id) {
  return Math.max(
    0,
    Number(document.getElementById(id).value) || 0
  );
}
function formatModifier(value) {
  return value >= 0 ? `+${value}` : String(value);
}
function formatReset(reset) {
  return resetLabels[reset] || reset;
}
function setText(id, value) {
  const element = document.getElementById(id);
  if (element) {
    element.textContent = value;
  }
}
function setChecked(id, value) {
  const element = document.getElementById(id);
  if (element) {
    element.checked = Boolean(value);
  }
}
function readStorage(key, fallback) {
  try {
    const stored = localStorage.getItem(key);
    return stored === null ? fallback : JSON.parse(stored);
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
    "'": "&#039;"
  };
  return String(value).replace(/[&<>"']/g, character => characters[character]);
}