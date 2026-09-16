// Coordinates character listing, Quick Setup, portrait selection, creation, and removal.
import { createDialogController } from "../../../shared/js/dialog.js";
import { initializeTheme } from "../../../shared/js/theme.js";
import { mountSiteHeader } from "../../../shared/js/site-header.js";
import { createCharacterCard } from "./cards.js";
import { createCharacter, listCharacters, removeCharacter } from "./repository.js";
import { importDndBeyondPage, importDndBeyondPdf } from "./dnd-beyond-import.js";
import { initializeDiceRoller } from "../../../shared/js/dice/index.js";
import { campaignCanManage, campaignPagePath, currentCampaignSlug } from "../../../shared/js/campaign-context.js";
import { initializeCharacterBuilderShell } from "../builder/index.js";

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
  const importToggle = document.getElementById("dnd-beyond-import-toggle");
  const importPanel = document.getElementById("dnd-beyond-import-panel");
  const importURL = document.getElementById("dnd-beyond-url");
  const importURLButton = document.getElementById("dnd-beyond-url-import");
  const importPDFButton = document.getElementById("dnd-beyond-pdf-import");
  const importPDFInput = document.getElementById("dnd-beyond-pdf-input");
  const importStatus = document.getElementById("dnd-beyond-import-status");
  const importSummary = document.getElementById("dnd-beyond-import-summary");
  const startingContent = document.getElementById("new-character-starting-content");
  const fallbackPortrait = "shared/assets/bat.ico";
  let portrait = fallbackPortrait;
  let importedCharacter = null;
  let importing = false;
  let creating = false;
  const builder = initializeCharacterBuilderShell();
  const canManage = currentCampaignSlug() ? await campaignCanManage() : true;
  const controller = createDialogController(dialog, {
    form,
    initialFocus: nameInput,
    returnFocus: document.getElementById("add-character"),
    beforeClose() {
      return !creating && !importing;
    },
    onClose() {
      creating = false;
      importing = false;
      importedCharacter = null;
      portrait = fallbackPortrait;
      portraitPreview.src = fallbackPortrait;
      status.textContent = "";
      importStatus.textContent = "";
      importSummary.textContent = "";
      importSummary.classList.add("hidden");
      startingContent.classList.remove("hidden");
      importPanel.classList.add("hidden");
      importToggle.setAttribute("aria-expanded", "false");
      importURLButton.disabled = false;
      importPDFButton.disabled = false;
      submitButton.disabled = false;
      builder?.reset();
    },
  });

  function applyImportedCharacter(character) {
    importedCharacter = character;
    nameInput.value = character.name || "";
    document.getElementById("new-character-status").value = character.status || "Active";
    document.getElementById("new-character-class").value = character.class || "";
    document.getElementById("new-character-race").value = character.race || "";
    document.getElementById("new-character-level").value = character.level || 1;
    portrait = character.portrait || fallbackPortrait;
    portraitPreview.src = portrait;
    startingContent.classList.add("hidden");
    importSummary.textContent = `Imported ${character.name}. Review the essentials, then create the character to open the full editor.`;
    importSummary.classList.remove("hidden");
  }

  async function readImport(load, progress) {
    if (importing) return;
    importing = true;
    importURLButton.disabled = true;
    importPDFButton.disabled = true;
    importStatus.textContent = progress;
    try {
      const character = await load();
      applyImportedCharacter(character);
      importStatus.textContent = `Ready: ${character.name}, level ${character.level}.`;
      nameInput.focus();
    } catch (error) {
      console.error("Could not import D&D Beyond character:", error);
      importStatus.textContent = error instanceof Error ? error.message : "Could not read that D&D Beyond character.";
    } finally {
      importing = false;
      importURLButton.disabled = false;
      importPDFButton.disabled = false;
    }
  }

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
  importToggle.addEventListener("click", () => {
    const expanded = importToggle.getAttribute("aria-expanded") === "true";
    importToggle.setAttribute("aria-expanded", String(!expanded));
    importPanel.classList.toggle("hidden", expanded);
    if (!expanded) importURL.focus();
  });
  importURLButton.addEventListener("click", () => readImport(
    () => importDndBeyondPage(importURL.value),
    "Reading the public character page…",
  ));
  importPDFButton.addEventListener("click", () => importPDFInput.click());
  importPDFInput.addEventListener("change", () => {
    const file = importPDFInput.files?.[0];
    if (file) readImport(() => importDndBeyondPdf(file), `Reading ${file.name}…`);
  });
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
        status: document.getElementById("new-character-status").value,
        portrait,
        class: document.getElementById("new-character-class").value,
        race: document.getElementById("new-character-race").value,
        level: document.getElementById("new-character-level").value,
        starterMode: form.elements.starterMode.value,
        importedCharacter,
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
