import { readJSON, removeStored, writeJSON } from "../../shared/js/storage.js";
import { readCloudJSON } from "../../shared/js/cloud-store.js";
import { migrateLegacyPortrait } from "./archive/repository.js";

export function initializeCharacterPage() {
  const loaderScript = document.querySelector("script[data-character]");
  const bundledCharacter = loaderScript?.dataset.character;
  const params = new URLSearchParams(window.location.search);
  const requestedCharacter = params.get("character") || bundledCharacter;
  const characterName = /^[a-z0-9-]+$/i.test(requestedCharacter || "")
    ? requestedCharacter
    : bundledCharacter;
  const storageKey = "dnd-characters";
  const trackerURL = new URL("../tracker.html", window.location.href);

  function showError(message) {
    document.body.innerHTML = `
      <main class="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <div class="mb-4 rounded-2xl border border-blood-500/30 bg-blood-500/10 p-4 text-blood-600 dark:text-red-300">${message}</div>
        <a class="inline-flex items-center justify-center rounded-xl border border-stone-400 bg-white/60 px-4 py-2 text-sm font-bold text-stone-700 shadow-sm transition hover:border-blood-500 hover:text-blood-500 dark:border-white/20 dark:bg-white/5 dark:text-stone-200" href="char/">Back to characters</a>
      </main>`;
  }

  function applyBundledUpdates(savedCharacter, bundledData) {
    const update = bundledData?.bundledUpdate;
    const version = Number(update?.version) || 0;
    const appliedVersions = savedCharacter.bundledUpdateVersions || {};
    const appliedVersion = Number(appliedVersions[bundledData?.id]) || 0;

    if (!version || version <= appliedVersion) return false;

    Object.entries(update.additions || {}).forEach(([collection, ids]) => {
      if (!Array.isArray(savedCharacter[collection])) savedCharacter[collection] = [];
      const bundledEntries = Array.isArray(bundledData[collection])
        ? bundledData[collection]
        : [];

      ids.forEach((id) => {
        const alreadyPresent = savedCharacter[collection].some(
          (entry) => entry.id === id,
        );
        const bundledEntry = bundledEntries.find((entry) => entry.id === id);
        if (!alreadyPresent && bundledEntry) {
          savedCharacter[collection].push(
            JSON.parse(JSON.stringify(bundledEntry)),
          );
        }
      });
    });

    savedCharacter.bundledUpdateVersions = {
      ...appliedVersions,
      [bundledData.id]: version,
    };
    return true;
  }

  async function loadCharacterPage() {
    if (!characterName || !/^[a-z0-9-]+$/i.test(characterName)) {
      showError("This character route is invalid.");
      return;
    }

    try {
      const response = await fetch(trackerURL);
      if (!response.ok) throw new Error(`Could not load the tracker layout (${response.status}).`);

      const markup = await response.text();
      const trackerDocument = new DOMParser().parseFromString(markup, "text/html");
      trackerDocument.body.querySelectorAll("script").forEach((script) => script.remove());

      document.body.className = trackerDocument.body.className;
      document.body.id = trackerDocument.body.id;
      document.body.innerHTML = trackerDocument.body.innerHTML;
      const { initializeTrackerHeader } = await import("./tracker/header.js");
      initializeTrackerHeader();

      const savedCharacters = readJSON(storageKey, {});
      const savedCharacter = savedCharacters[characterName];
      const cloudCharacter = await readCloudJSON(
        `api/characters/${encodeURIComponent(characterName)}`,
        { fallback: null },
      );
      const characterResponse = await fetch(new URL("character.json", window.location.href));
      if (!characterResponse.ok) {
        throw new Error(`Could not load the character data (${characterResponse.status}).`);
      }
      const bundledData = await characterResponse.json();
      window.character = cloudCharacter?.document || bundledData;
      if (savedCharacter) {
        const migrated = migrateLegacyPortrait(savedCharacter);
        if (applyBundledUpdates(savedCharacter, bundledData) || migrated) {
          savedCharacters[characterName] = savedCharacter;
          writeJSON(storageKey, savedCharacters);
        }
        window.character = savedCharacter;
      } else if (params.get("new") === "1") {
        const pending = readJSON("dnd-new-character", {});
        window.character = JSON.parse(JSON.stringify(window.character));
        window.character.id = characterName;
        window.character.name = pending.name || "New Character";
        window.character.portrait = "shared/assets/bat.ico";
        savedCharacters[characterName] = window.character;
        writeJSON(storageKey, savedCharacters);
        removeStored("dnd-new-character");
      }
      await import("./entries/tracker.js");
    } catch (error) {
      console.error("Could not load character page:", error);
      showError(error.message);
    }
  }

  loadCharacterPage();
}
