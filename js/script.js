// Initialization
document.addEventListener("DOMContentLoaded", initializeApp);
function initializeApp() {
  refreshUI();
  document.getElementById("damage-btn");
  document.getElementById("damage-btn").addEventListener("click", () => {
    damageHP(getHPAmount());
    clearInputs();
  });
  document.getElementById("heal-btn").addEventListener("click", () => {
    healHP(getHPAmount());
    clearInputs();
  });
  document.getElementById("temp-btn").addEventListener("click", () => {
    setTempHP(getTempAmount());
    clearInputs();
  });
  loadHeader();
  loadNotesFromStorage();
  loadNotes();
  loadStats();
  loadHP();
  loadResources();
  loadAbilities();
  loadInventory();
  loadCombat();
  setupEvents();
}
function refreshUI() {
  loadHeader();
  loadHP();
  loadResources();
  loadAbilities();
  loadNotes();
  loadCombat();
}
// Header
function loadHeader() {
  const headerFields = {
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
    "character-dark": character.darkvision,
  };
  Object.entries(headerFields).forEach(([id, value]) => {
    setText(id, value);
  });
}
//HP Manager
function loadHP() {
  setText("effective-hp", getTotalHP());
  setText("current-hp", character.hp.current);
  setText("temp-hp", character.hp.temp);
  setText("max-hp", character.hp.max);
}
function damageHP(amount) {
  if (amount === 0) return;
  if (character.hp.temp >= amount) {
    character.hp.temp -= amount;
  } else {
    amount -= character.hp.temp;
    character.hp.temp = 0;
    character.hp.current = Math.max(0, character.hp.current - amount);
  }
  refreshUI();
}
function healHP(amount) {
  if (amount === 0) return;
  character.hp.current = Math.min(
    character.hp.max,
    character.hp.current + amount,
  );
  refreshUI();
}
function setTempHP(amount) {
  if (amount === 0) return;
  character.hp.temp = amount;
  refreshUI();
}
function getTotalHP() {
  return character.hp.current + character.hp.temp;
}
function getHPAmount() {
  return Math.max(0, Number(document.getElementById("hp-amount").value) || 0);
}
function getTempAmount() {
  return Math.max(0, Number(document.getElementById("temp-input").value) || 0);
}
function clearInputs() {
  document.getElementById("hp-amount").value = null;
  document.getElementById("temp-input").value = null;
}
//Stats
const statNames = {
  str: "Strength",
  dex: "Dexterity",
  con: "Constitution",
  int: "Intelligence",
  wis: "Wisdom",
  cha: "Charisma",
};
function loadStats() {
  const container = document.getElementById("skills-container");
  container.innerHTML = "";
  for (const [key, stat] of Object.entries(character.stats)) {
    const card = document.createElement("div");
    card.className = "col-12 col-md-6";
    const statName = statNames[key];
    const skills = stat.skills
      .map(
        (skill) => `
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
`,
      )
      .join("");
    card.innerHTML = `
<div class="card">
    <div class="card-header d-flex justify-content-between align-items-center">
        <span class="badge text-bg-warning">
          ${stat.score}
        </span>
    <div>
            <strong>${statName}</strong>
        </div>
        <span class="badge text-bg-danger">
            ${formatModifier(stat.modifier)}
        </span>
    </div>
    <ul class="list-group list-group-flush">
        <li class="list-group-item d-flex justify-content-between">
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
`;
    container.appendChild(card);
  }
}
//Resources
function loadResources() {
  const container = document.getElementById("resources-container");
  const resources = character.abilities.filter((a) => a.uses);
  container.innerHTML = resources
    .map(
      (r) => `
        <div class="col-12 col-md-6">
           <div class="card h-100">
                <div class="card-header d-flex justify-content-between align-items-center">
                    <div>
                        <strong>${r.name}</strong>
                        <div class="small text-body-secondary">${r.action}</div>
                    </div>
                    <span class="badge text-bg-danger">Max: ${r.uses.max}</span>
                </div>
                <ul class="list-group list-group-flush">
                    <li class="list-group-item d-flex justify-content-between align-items-center">
                        <div class="btn-group btn-group-sm">
                            <button class="btn btn-outline-secondary" onclick="changeResource('${r.id}',-1)">−</button>
                            <button class="btn btn-outline-secondary" onclick="changeResource('${r.id}',1)">+</button>
                        </div>
                        <span class="text-body-secondary">Uses per ${r.uses.reset} rest</span>
                        <span class="badge text-bg-warning">Uses: ${r.uses.current}</span>
                    </li>
                </ul>
            </div>
        </div>
    `,
    )
    .join("");
}
function changeResource(id, delta) {
  const ability = character.abilities.find((a) => a.id === id && a.uses);
  if (!ability) return;
  ability.uses.current = Math.max(
    0,
    Math.min(ability.uses.max, ability.uses.current + delta),
  );
  refreshUI();
}
//Abilities
function loadAbilities() {
  const container = document.getElementById("abilities-container");
  container.innerHTML = character.abilities
    .map(
      (a) => `
        <div class="col-12 col-md-6">
            <div class="card">
                <div class="card-header d-flex justify-content-between align-items-center">
                    <div>
                        <strong>${a.name}</strong>
                    </div>
                    <div>
                        <span class="badge text-bg-danger">${a.category}</span>
                    </div>
                </div>
                <div class="card-body d-flex justify-content-between align-items-center">
                    ${a.action ? `<p><strong>${a.action}</strong></p>` : ""}
                    ${a.uses ? `<p><strong>Uses:</strong> Available ${a.uses.current}/${a.uses.max} per (${a.uses.reset} rest)</p>` : ""}
                </div>
                <div>
                  <hr>
                </div>
                <div class="card-body">
                    <small>${a.description}</small>
                </div>
            </div>
        </div>
    `,
    )
    .join("");
}
//Inventory
function loadInventory() {
  const container = document.getElementById("inventory-container");
  container.innerHTML = character.inventory
    .map(
      (item) => `
        <div class="col-12 col-md-6">
            <div class="card h-100">
                <div class="card-header d-flex justify-content-between align-items-center">
                    <strong>${item.name}</strong>
                    <span class="badge text-bg-primary">x${item.quantity}</span>
                </div>
                <div class="card-body">
                    <small>${item.description}</small>
                </div>
            </div>
        </div>
    `,
    )
    .join("");
}
//Rests
function shortRest() {
  character.abilities
    .filter((a) => a.uses?.reset === "short")
    .forEach((a) => (a.uses.current = a.uses.max));
  character.hp.temp = 0;
  refreshUI();
}
function longRest() {
  character.abilities
    .filter((a) => a.uses)
    .forEach((a) => (a.uses.current = a.uses.max));
  character.hp.current = character.hp.max;
  character.hp.temp = 0;
  refreshUI();
}
function setupEvents() {
  document.getElementById("shortRest-btn").addEventListener("click", shortRest);
  document.getElementById("longRest-btn").addEventListener("click", longRest);
  document.getElementById("save-note-btn").addEventListener("click", saveNote);
  document.getElementById("echo1-toggle").addEventListener("change", (e) => {
    character.combat.echoes[0].active = e.target.checked;
    saveCombat();
  });
  document.getElementById("echo2-toggle").addEventListener("change", (e) => {
    character.combat.echoes[1].active = e.target.checked;
    saveCombat();
  });
  document
    .getElementById("concentration-toggle")
    .addEventListener("change", (e) => {
      character.combat.concentration = e.target.checked;
      saveCombat();
    });
}
const resetLabels = {
  short: "Short Rest",
  long: "Long Rest",
};
//Notes
let notes = [];
let editingNote = null;
function loadNotes() {
  const container = document.getElementById("notes-container");
  container.innerHTML = notes
    .map(
      (note, index) => `
        <div class="col-12 col-md-6">
            <div class="card h-100">
                <div class="card-header d-flex justify-content-between align-items-center">
                    <strong>${note.title}</strong>
                    <div class="btn-group btn-group-sm">
                        <button class="btn btn-outline-primary" onclick="editNote(${index})">
                            <i class="bi bi-pencil"></i>
                        </button>
                        <button class="btn btn-outline-danger" onclick="deleteNote(${index})">
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>
                </div>
                <div class="card-body">
                    ${note.body}
                </div>
            </div>
        </div>
    `,
    )
    .join("");
}
function saveNote() {
  const title = document.getElementById("note-title").value.trim();
  const body = document.getElementById("note-body").value.trim();
  if (!title || !body) return;
  if (editingNote === null) {
    notes.push({ title, body });
  } else {
    notes[editingNote] = { title, body };
    editingNote = null;
  }
  clearNoteInputs();
  loadNotes();
  saveNotes();
}
function editNote(index) {
  const note = notes[index];
  document.getElementById("note-title").value = note.title;
  document.getElementById("note-body").value = note.body;
  editingNote = index;
}
function deleteNote(index) {
  notes.splice(index, 1);
  saveNotes();
  loadNotes();
}
// Helpers
function setText(id, value) {
  document.getElementById(id).textContent = value;
}
function formatModifier(value) {
  return value >= 0 ? `+${value}` : value;
}
function clearNoteInputs() {
  document.getElementById("note-title").value = "";
  document.getElementById("note-body").value = "";
}
const NOTES_KEY = "cassian-notes";
function saveNotes() {
  localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
}
function loadNotesFromStorage() {
  notes = JSON.parse(localStorage.getItem(NOTES_KEY)) || [];
}
const COMBAT_KEY = "cassian-combat";
function saveCombat() {
  localStorage.setItem(COMBAT_KEY, JSON.stringify(character.combat));
}
function loadCombat() {
  const saved = JSON.parse(localStorage.getItem(COMBAT_KEY));
  if (saved) character.combat = saved;
}