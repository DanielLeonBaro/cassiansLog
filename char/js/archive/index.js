import { createDialogController } from "../../../shared/js/dialog.js";
import { writeJSON } from "../../../shared/js/storage.js";
import { initializeTheme } from "../../../shared/js/theme.js";
import { mountSiteHeader } from "../../../shared/js/site-header.js";
import { createCharacterCard } from "./cards.js";
import { createCharacterId, listCharacters, PENDING_KEY, removeCharacter } from "./repository.js";
import { initializeDiceRoller } from "../../../shared/js/dice/index.js";

export function initializeCharacterArchive() {
  mountSiteHeader({ activePage: "characters" });
  initializeTheme();
  initializeDiceRoller();
  const container = document.getElementById("characters");
  const dialog = document.getElementById("character-dialog");
  const form = document.getElementById("character-form");
  const nameInput = document.getElementById("new-character-name");
  const controller = createDialogController(dialog, { form, initialFocus: nameInput });

  async function load() {
    try {
      const characters = await listCharacters();
      container.replaceChildren(...characters.map((character) => createCharacterCard(character, {
        async onRemove(item) {
          if (!confirm(`Remove ${item.name}? The character will be hidden from the shared cloud list.`)) return;
          try {
            await removeCharacter(item);
            load();
          } catch (error) {
            console.error("Could not remove character:", error);
            alert("The character remains available because the cloud update failed.");
          }
        },
      })));
    } catch (error) {
      container.innerHTML = '<div class="rounded-2xl border border-blood-500/30 bg-blood-500/10 p-4 text-blood-600 dark:text-red-300 md:col-span-2 xl:col-span-3">Could not load the character list.</div>';
      console.error("Could not load characters:", error);
    }
  }

  document.getElementById("add-character").addEventListener("click", controller.open);
  document.getElementById("close-dialog").addEventListener("click", controller.close);
  document.getElementById("cancel-dialog").addEventListener("click", controller.close);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const name = nameInput.value.trim();
    if (!name) return;
    const id = createCharacterId(name);
    writeJSON(PENDING_KEY, { id, name });
    location.href = `char/${encodeURIComponent(id)}/?new=1&edit=1`;
  });
  load();
}
