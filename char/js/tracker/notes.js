import { readJSON, writeJSON } from "../../../shared/js/storage.js";
import { readCloudJSON, writeCloudJSON } from "../../../shared/js/cloud-store.js";
import { characterNotesStorageKey } from "../storage-keys.js";

export function createNotesController({ characterId, cardClasses, escapeHTML }) {
  const storageKey = characterNotesStorageKey(characterId);
  let notes = [];
  let editingNote = null;

  function clearInputs() {
    document.getElementById("note-title").value = "";
    document.getElementById("note-body").value = "";
  }

  function persist() {
    writeJSON(storageKey, notes);
    writeCloudJSON(`api/characters/${encodeURIComponent(characterId)}/notes`, { value: notes })
      .catch((error) => console.error("Could not save notes to D1:", error));
  }

  function render() {
    const container = document.getElementById("notes-container");
    if (!container) return;
    container.innerHTML = notes
      .map(
        (note, index) =>
          `<div class="${cardClasses.card}"><div class="${cardClasses.cardHeader}"><strong>${escapeHTML(note.title)}</strong><div class="inline-flex"><button type="button" class="inline-flex items-center justify-center rounded-l-xl border border-sky-500 px-3 py-1.5 text-xs font-bold text-sky-600 transition hover:bg-sky-500 hover:text-white" data-tracker-action="edit-note" data-index="${index}"><i class="bi bi-pencil"></i></button><button type="button" class="inline-flex items-center justify-center rounded-r-xl border border-blood-500 px-3 py-1.5 text-xs font-bold text-blood-500 transition hover:bg-blood-500 hover:text-white" data-tracker-action="delete-note" data-index="${index}"><i class="bi bi-trash"></i></button></div></div><div class="${cardClasses.cardBody}">${escapeHTML(note.body)}</div></div>`,
      )
      .join("");
  }

  return {
    load() {
      notes = readJSON(storageKey, []);
    },
    async loadCloud() {
      const result = await readCloudJSON(`api/characters/${encodeURIComponent(characterId)}/notes`, { fallback: null });
      if (!Array.isArray(result?.value)) return false;
      notes = result.value;
      writeJSON(storageKey, notes);
      return true;
    },
    render,
    saveFromInputs() {
      const title = document.getElementById("note-title").value.trim();
      const body = document.getElementById("note-body").value.trim();
      if (!title || !body) return;
      const note = { title, body };
      if (editingNote === null) notes.push(note);
      else notes[editingNote] = note;
      editingNote = null;
      clearInputs();
      persist();
      render();
    },
    edit(index) {
      const note = notes[index];
      if (!note) return;
      document.getElementById("note-title").value = note.title;
      document.getElementById("note-body").value = note.body;
      editingNote = index;
    },
    remove(index) {
      notes.splice(index, 1);
      if (editingNote === index) {
        editingNote = null;
        clearInputs();
      }
      persist();
      render();
    },
  };
}
