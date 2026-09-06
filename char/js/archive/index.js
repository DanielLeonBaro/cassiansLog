// Coordinates character listing, Quick Setup, portrait selection, creation, and removal.
import { createDialogController } from "../../../shared/js/dialog.js";
import { initializeTheme } from "../../../shared/js/theme.js";
import { mountSiteHeader } from "../../../shared/js/site-header.js";
import { createCharacterCard } from "./cards.js";
import { createCharacter, listCharacters, removeCharacter } from "./repository.js";
import { initializeDiceRoller } from "../../../shared/js/dice/index.js";
import { campaignCanManage, campaignPagePath, currentCampaignSlug } from "../../../shared/js/campaign-context.js";

export async function initializeCharacterArchive() {
  mountSiteHeader({ activePage: "characters" });
  initializeTheme();
  initializeDiceRoller();
  const container = document.getElementById("characters");
  const dialog = document.getElementById("character-dialog");
  const form = document.getElementById("character-form");
  const nameInput = document.getElementById("new-character-name");
  const portraitInput = document.getElementById("new-character-portrait-input");
  const portraitPreview = document.getElementById("new-character-portrait");
  const submitButton = document.getElementById("create-character-submit");
  const status = document.getElementById("character-form-status");
  const fallbackPortrait = "shared/assets/bat.ico";
  let portrait = fallbackPortrait;
  let creating = false;
  const canManage = currentCampaignSlug() ? await campaignCanManage() : true;
  const controller = createDialogController(dialog, {
    form,
    initialFocus: nameInput,
    returnFocus: document.getElementById("add-character"),
    beforeClose() {
      return !creating;
    },
    onClose() {
      creating = false;
      portrait = fallbackPortrait;
      portraitPreview.src = fallbackPortrait;
      status.textContent = "";
      submitButton.disabled = false;
    },
  });

  async function load() {
    try {
      const characters = await listCharacters();
      container.replaceChildren(...characters.map((character) => createCharacterCard(character, {
        canRemove: canManage,
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
      container.innerHTML = '<div class="rounded-2xl border border-danger-500/30 bg-danger-500/10 p-4 text-danger-600 dark:text-red-300 md:col-span-2 xl:col-span-3">Could not load the character list.</div>';
      console.error("Could not load characters:", error);
    }
  }

  document.getElementById("add-character").addEventListener("click", controller.open);
  document.getElementById("close-dialog").addEventListener("click", controller.close);
  document.getElementById("cancel-dialog").addEventListener("click", controller.close);
  document.getElementById("new-character-portrait-button").addEventListener("click", () => portraitInput.click());
  portraitInput.addEventListener("change", () => {
    const file = portraitInput.files?.[0];
    if (!file?.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      portrait = reader.result;
      portraitPreview.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const name = nameInput.value.trim();
    if (!name) {
      nameInput.focus();
      return;
    }
    creating = true;
    submitButton.disabled = true;
    submitButton.innerHTML = '<span class="h-4 w-4 animate-spin rounded-full border-2 border-white border-r-transparent" aria-hidden="true"></span> Creating…';
    status.textContent = "Creating the character and saving it to the shared archive…";
    try {
      const result = await createCharacter({
        name,
        portrait,
        class: document.getElementById("new-character-class").value,
        race: document.getElementById("new-character-race").value,
        level: document.getElementById("new-character-level").value,
        starterMode: form.elements.starterMode.value,
      });
      if (!result.cloudSaved) {
        alert("The character was created in this browser, but could not be saved to the shared cloud database. Save it again from the editor to retry.");
      }
      const id = result.character.id;
      location.href = `${campaignPagePath("char")}${encodeURIComponent(id)}/?new=1&edit=1`;
    } catch (error) {
      console.error("Could not create character:", error);
      creating = false;
      status.textContent = "Could not create the character. Check your connection and try again.";
      submitButton.disabled = false;
      submitButton.innerHTML = '<i class="bi bi-arrow-right"></i> Create & continue';
    }
  });
  load();
}
